import Sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from './logger';
import { COLLECTION_CONFIG } from './advanced-config';
import { EnhancedImageData } from './AdvancedImageScraper';

export interface ProcessingOptions {
  targetWidth: number;
  targetHeight: number;
  jpegQuality: { min: number; max: number };
  maxFileSize: number;
  preserveAspectRatio: boolean;
  enableSharpening: boolean;
  enableNoiseReduction: boolean;
}

export interface ProcessedImageInfo {
  originalPath: string;
  processedPath: string;
  originalSize: number;
  processedSize: number;
  width: number;
  height: number;
  format: string;
  quality: number;
  processingTime: number;
}

/**
 * 高級圖片處理管道 - 使用 Sharp 進行專業級圖片處理
 */
export class AdvancedImageProcessor {
  private logger: Logger;
  private options: ProcessingOptions;

  constructor(options?: Partial<ProcessingOptions>) {
    this.logger = new Logger();
    
    this.options = {
      targetWidth: COLLECTION_CONFIG.imageSize.width,
      targetHeight: COLLECTION_CONFIG.imageSize.height,
      jpegQuality: COLLECTION_CONFIG.jpegQuality,
      maxFileSize: COLLECTION_CONFIG.maxFileSize,
      preserveAspectRatio: true,
      enableSharpening: true,
      enableNoiseReduction: true,
      ...options
    };

    this.logger.info('Advanced image processor initialized', this.options);
  }

  /**
   * 處理單張圖片 - 完整的優化管道
   */
  async processImage(
    inputPath: string, 
    outputPath: string, 
    imageData: EnhancedImageData
  ): Promise<ProcessedImageInfo> {
    const startTime = Date.now();
    
    try {
      // 獲取原始檔案資訊
      const originalStats = fs.statSync(inputPath);
      const originalSize = originalStats.size;

      // 初始化 Sharp 實例
      let pipeline = Sharp(inputPath);
      
      // 獲取圖片元數據
      const metadata = await pipeline.metadata();
      this.logger.debug(`Processing image: ${path.basename(inputPath)} (${metadata.width}x${metadata.height}, ${originalSize} bytes)`);

      // 1. 圖片方向校正
      pipeline = pipeline.rotate();

      // 2. 色彩空間轉換 (確保 RGB)
      pipeline = pipeline.toColorspace('rgb');

      // 3. 智能裁剪和縮放
      pipeline = await this.applySmartResize(pipeline, metadata);

      // 4. 圖片增強
      if (this.options.enableNoiseReduction) {
        pipeline = this.applyNoiseReduction(pipeline);
      }
      
      if (this.options.enableSharpening) {
        pipeline = this.applySharpening(pipeline);
      }

      // 5. 動態質量優化 (確保文件大小 < 50KB)
      const { buffer, quality } = await this.optimizeJpegQuality(pipeline, outputPath);

      // 6. 寫入處理後的圖片
      await fs.promises.writeFile(outputPath, buffer);

      // 7. 驗證結果
      const processedStats = fs.statSync(outputPath);
      const processingTime = Date.now() - startTime;

      const result: ProcessedImageInfo = {
        originalPath: inputPath,
        processedPath: outputPath,
        originalSize: originalSize,
        processedSize: processedStats.size,
        width: this.options.targetWidth,
        height: this.options.targetHeight,
        format: 'jpeg',
        quality: quality,
        processingTime: processingTime
      };

      this.logger.debug(`Image processed successfully: ${path.basename(outputPath)} (${result.processedSize} bytes, quality: ${quality}%, ${processingTime}ms)`);
      return result;

    } catch (error) {
      this.logger.error(`Failed to process image ${inputPath}:`, error);
      throw error;
    }
  }

  /**
   * 智能縮放和裁剪
   */
  private async applySmartResize(pipeline: Sharp.Sharp, metadata: Sharp.Metadata): Promise<Sharp.Sharp> {
    const { width = 0, height = 0 } = metadata;
    
    if (width === 0 || height === 0) {
      throw new Error('Invalid image dimensions');
    }

    const targetWidth = this.options.targetWidth;
    const targetHeight = this.options.targetHeight;
    
    // 計算縮放比例
    const scaleX = targetWidth / width;
    const scaleY = targetHeight / height;
    
    if (this.options.preserveAspectRatio) {
      // 保持寬高比，使用智能裁剪
      const scale = Math.max(scaleX, scaleY);
      const newWidth = Math.round(width * scale);
      const newHeight = Math.round(height * scale);
      
      return pipeline
        .resize(newWidth, newHeight, {
          kernel: Sharp.kernel.lanczos3,
          fit: 'cover',
          position: 'centre'
        })
        .extract({
          left: Math.max(0, Math.round((newWidth - targetWidth) / 2)),
          top: Math.max(0, Math.round((newHeight - targetHeight) / 2)),
          width: targetWidth,
          height: targetHeight
        });
    } else {
      // 直接縮放到目標尺寸
      return pipeline.resize(targetWidth, targetHeight, {
        kernel: Sharp.kernel.lanczos3,
        fit: 'fill'
      });
    }
  }

  /**
   * 降噪處理
   */
  private applyNoiseReduction(pipeline: Sharp.Sharp): Sharp.Sharp {
    return pipeline
      .median(2) // 中值濾波去噪
      .blur(0.3); // 輕微高斯模糊
  }

  /**
   * 銳化處理
   */
  private applySharpening(pipeline: Sharp.Sharp): Sharp.Sharp {
    return pipeline
      .sharpen(1.0, 1.0, 2.0); // sigma, flat, jagged
  }

  /**
   * 動態 JPEG 質量優化 - 確保檔案大小 < 50KB
   */
  private async optimizeJpegQuality(pipeline: Sharp.Sharp, outputPath: string): Promise<{ buffer: Buffer; quality: number }> {
    const { min, max } = this.options.jpegQuality;
    const maxSize = this.options.maxFileSize;
    
    let bestQuality = max;
    let bestBuffer: Buffer | null = null;
    
    // 二分搜索最佳質量
    let lowQuality = min;
    let highQuality = max;
    
    while (lowQuality <= highQuality) {
      const currentQuality = Math.round((lowQuality + highQuality) / 2);
      
      try {
        const buffer = await pipeline
          .jpeg({
            quality: currentQuality,
            progressive: true,
            mozjpeg: true, // 使用 mozjpeg 編碼器獲得更好的壓縮
            optimiseScans: true,
            quantisationTable: 3
          })
          .toBuffer();
          
        if (buffer.length <= maxSize) {
          // 檔案大小符合要求，嘗試更高質量
          bestBuffer = buffer;
          bestQuality = currentQuality;
          lowQuality = currentQuality + 1;
        } else {
          // 檔案太大，降低質量
          highQuality = currentQuality - 1;
        }
      } catch (error) {
        this.logger.warn(`Failed to encode with quality ${currentQuality}:`, error);
        highQuality = currentQuality - 1;
      }
    }
    
    // 如果還是太大，使用最低質量
    if (!bestBuffer) {
      bestBuffer = await pipeline
        .jpeg({
          quality: min,
          progressive: true,
          mozjpeg: true
        })
        .toBuffer();
      bestQuality = min;
    }
    
    // 最終檢查
    if (bestBuffer.length > maxSize) {
      this.logger.warn(`Image still too large after optimization: ${bestBuffer.length} bytes (max: ${maxSize})`);
    }
    
    return { buffer: bestBuffer, quality: bestQuality };
  }

  /**
   * 批量處理圖片
   */
  async processBatch(
    images: EnhancedImageData[], 
    inputDir: string, 
    outputDir: string,
    progressCallback?: (processed: number, total: number) => void
  ): Promise<{ success: ProcessedImageInfo[]; failed: Array<{ image: EnhancedImageData; error: string }> }> {
    const success: ProcessedImageInfo[] = [];
    const failed: Array<{ image: EnhancedImageData; error: string }> = [];
    
    // 確保輸出目錄存在
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    this.logger.info(`Starting batch processing: ${images.length} images`);
    
    for (let i = 0; i < images.length; i++) {
      const imageData = images[i];
      
      try {
        // 構建檔案路徑
        const inputFilename = this.generateFilename(imageData, i + 1, 'original');
        const outputFilename = this.generateFilename(imageData, i + 1, 'processed');
        
        const inputPath = path.join(inputDir, imageData.category, imageData.subcategory, inputFilename);
        const categoryOutputDir = path.join(outputDir, imageData.category, imageData.subcategory);
        
        // 確保分類輸出目錄存在
        if (!fs.existsSync(categoryOutputDir)) {
          fs.mkdirSync(categoryOutputDir, { recursive: true });
        }
        
        const outputPath = path.join(categoryOutputDir, outputFilename);
        
        // 檢查輸入檔案是否存在
        if (!fs.existsSync(inputPath)) {
          failed.push({ image: imageData, error: `Input file not found: ${inputPath}` });
          continue;
        }
        
        // 處理圖片
        const result = await this.processImage(inputPath, outputPath, imageData);
        success.push(result);
        
        // 進度回調
        if (progressCallback) {
          progressCallback(i + 1, images.length);
        }
        
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        failed.push({ image: imageData, error: errorMsg });
        this.logger.error(`Failed to process image ${i + 1}:`, error);
      }
    }
    
    this.logger.info(`Batch processing completed: ${success.length} success, ${failed.length} failed`);
    return { success, failed };
  }

  /**
   * 生成檔案名稱
   */
  private generateFilename(imageData: EnhancedImageData, index: number, suffix: string = ''): string {
    const sanitizedKeyword = imageData.keyword.replace(/[^a-zA-Z0-9]/g, '_');
    const indexStr = String(index).padStart(3, '0');
    const suffixStr = suffix ? `_${suffix}` : '';
    return `${sanitizedKeyword}_${indexStr}${suffixStr}.jpg`;
  }

  /**
   * 圖片質量分析
   */
  async analyzeImageQuality(imagePath: string): Promise<{
    sharpness: number;
    brightness: number;
    contrast: number;
    saturation: number;
    fileSize: number;
    dimensions: { width: number; height: number };
  }> {
    try {
      const pipeline = Sharp(imagePath);
      const metadata = await pipeline.metadata();
      const stats = await pipeline.stats();
      
      // 計算圖片質量指標
      const sharpness = this.calculateSharpness(stats);
      const brightness = this.calculateBrightness(stats);
      const contrast = this.calculateContrast(stats);
      const saturation = this.calculateSaturation(stats);
      
      const fileStats = fs.statSync(imagePath);
      
      return {
        sharpness,
        brightness,
        contrast,
        saturation,
        fileSize: fileStats.size,
        dimensions: {
          width: metadata.width || 0,
          height: metadata.height || 0
        }
      };
    } catch (error) {
      this.logger.error(`Failed to analyze image quality for ${imagePath}:`, error);
      throw error;
    }
  }

  /**
   * 計算銳度 (基於統計數據)
   */
  private calculateSharpness(stats: Sharp.Stats): number {
    // 簡化的銳度計算 - 基於標準差
    const channels = stats.channels;
    if (channels.length === 0) return 0;
    
    const avgStdDev = channels.reduce((sum, ch) => sum + (ch.stdev || 0), 0) / channels.length;
    return Math.min(avgStdDev / 50, 1); // 歸一化到 0-1
  }

  /**
   * 計算亮度
   */
  private calculateBrightness(stats: Sharp.Stats): number {
    const channels = stats.channels;
    if (channels.length === 0) return 0;
    
    const avgMean = channels.reduce((sum, ch) => sum + (ch.mean || 0), 0) / channels.length;
    return avgMean / 255; // 歸一化到 0-1
  }

  /**
   * 計算對比度
   */
  private calculateContrast(stats: Sharp.Stats): number {
    const channels = stats.channels;
    if (channels.length === 0) return 0;
    
    const avgStdDev = channels.reduce((sum, ch) => sum + (ch.stdev || 0), 0) / channels.length;
    return Math.min(avgStdDev / 128, 1); // 歸一化到 0-1
  }

  /**
   * 計算飽和度 (RGB 模式的簡化計算)
   */
  private calculateSaturation(stats: Sharp.Stats): number {
    const channels = stats.channels;
    if (channels.length < 3) return 0;
    
    // 簡化的飽和度計算
    const rStd = channels[0].stdev || 0;
    const gStd = channels[1].stdev || 0; 
    const bStd = channels[2].stdev || 0;
    
    const avgColorStd = (rStd + gStd + bStd) / 3;
    return Math.min(avgColorStd / 64, 1); // 歸一化到 0-1
  }

  /**
   * 清理臨時文件
   */
  async cleanup(directory: string): Promise<void> {
    try {
      const files = await fs.promises.readdir(directory, { recursive: true });
      for (const file of files) {
        const filePath = path.join(directory, file);
        const stats = await fs.promises.stat(filePath);
        if (stats.isFile() && path.extname(filePath).toLowerCase() !== '.jpg') {
          await fs.promises.unlink(filePath);
          this.logger.debug(`Cleaned up temporary file: ${file}`);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to cleanup directory ${directory}:`, error);
    }
  }
}