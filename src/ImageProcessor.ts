import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from './logger';

/**
 * Configuration for image processing
 */
export interface ProcessingConfig {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxFileSize?: number;
  format?: 'jpeg' | 'png' | 'webp';
  outputDir?: string;
}

/**
 * Result of image processing operation
 */
export interface ProcessingResult {
  success: boolean;
  inputPath: string;
  outputPath?: string;
  originalSize: number;
  processedSize?: number;
  originalDimensions?: { width: number; height: number };
  processedDimensions?: { width: number; height: number };
  error?: string;
}

/**
 * ImageProcessor class for resizing, cropping, and compressing images
 * Uses Sharp library for high-performance image processing
 */
export class ImageProcessor {
  private logger: Logger;
  private config: Required<ProcessingConfig>;

  constructor(config: ProcessingConfig = {}) {
    this.config = {
      maxWidth: config.maxWidth ?? 500,
      maxHeight: config.maxHeight ?? 500,
      quality: config.quality ?? 80,
      maxFileSize: config.maxFileSize ?? 50 * 1024, // 50KB in bytes
      format: config.format ?? 'jpeg',
      outputDir: config.outputDir ?? './processed_images'
    };

    this.logger = new Logger('ImageProcessor');
    this.ensureOutputDirectory();
  }

  /**
   * Process a single image: resize, center crop, and compress
   * @param inputPath - Path to the input image
   * @param outputFilename - Optional custom output filename
   * @returns Promise<ProcessingResult>
   */
  async processImage(inputPath: string, outputFilename?: string): Promise<ProcessingResult> {
    const result: ProcessingResult = {
      success: false,
      inputPath,
      originalSize: 0
    };

    try {
      // Check if input file exists
      if (!fs.existsSync(inputPath)) {
        result.error = 'Input file does not exist';
        return result;
      }

      // Get original file size
      const stats = await fs.promises.stat(inputPath);
      result.originalSize = stats.size;

      // Generate output filename if not provided
      const parsedPath = path.parse(inputPath);
      const finalOutputFilename = outputFilename || 
        `processed_${parsedPath.name}_${Date.now()}.${this.config.format}`;
      const outputPath = path.join(this.config.outputDir, finalOutputFilename);
      result.outputPath = outputPath;

      // Load image with Sharp
      const image = sharp(inputPath);
      const metadata = await image.metadata();
      
      if (!metadata.width || !metadata.height) {
        result.error = 'Unable to read image dimensions';
        return result;
      }

      result.originalDimensions = {
        width: metadata.width,
        height: metadata.height
      };

      // Process the image with multiple quality attempts if needed
      let processed = false;
      let currentQuality = this.config.quality;
      let attempts = 0;
      const maxAttempts = 5;
      const minQuality = 50;

      while (!processed && attempts < maxAttempts && currentQuality >= minQuality) {
        try {
          // Create processing pipeline
          let pipeline = image.clone();

          // Resize and center crop to fit target dimensions
          pipeline = await this.resizeAndCrop(pipeline, metadata.width, metadata.height);

          // Convert to specified format with quality
          switch (this.config.format) {
            case 'jpeg':
              pipeline = pipeline.jpeg({ quality: Math.round(currentQuality) });
              break;
            case 'png':
              pipeline = pipeline.png({ compressionLevel: 9 });
              break;
            case 'webp':
              pipeline = pipeline.webp({ quality: Math.round(currentQuality) });
              break;
          }

          // Process and save
          const processedBuffer = await pipeline.toBuffer();
          
          // Check file size
          if (processedBuffer.length <= this.config.maxFileSize) {
            // File size is acceptable, save it
            await fs.promises.writeFile(outputPath, processedBuffer);
            
            // Get final dimensions
            const finalMetadata = await sharp(processedBuffer).metadata();
            result.processedDimensions = {
              width: finalMetadata.width || 0,
              height: finalMetadata.height || 0
            };
            result.processedSize = processedBuffer.length;
            result.success = true;
            processed = true;

            this.logger.debug(`Processed image: ${inputPath} -> ${outputPath} (${result.originalSize} -> ${result.processedSize} bytes, quality: ${currentQuality})`);
          } else {
            // File too large, reduce quality and try again
            currentQuality -= 10;
            attempts++;
            
            if (attempts < maxAttempts && currentQuality >= minQuality) {
              this.logger.debug(`File too large (${processedBuffer.length} bytes), reducing quality to ${currentQuality} and retrying...`);
            }
          }
        } catch (processingError) {
          result.error = `Processing failed: ${processingError}`;
          break;
        }
      }

      if (!processed) {
        if (currentQuality < minQuality) {
          result.error = `Unable to compress image below ${this.config.maxFileSize} bytes even at minimum quality (${minQuality})`;
        } else {
          result.error = `Failed to process image after ${maxAttempts} attempts`;
        }
      }

    } catch (error) {
      result.error = `Error processing image: ${error}`;
      this.logger.error(`Failed to process image ${inputPath}:`, error);
    }

    return result;
  }

  /**
   * Resize and center crop image to target dimensions
   */
  private async resizeAndCrop(pipeline: sharp.Sharp, originalWidth: number, originalHeight: number): Promise<sharp.Sharp> {
    const targetWidth = this.config.maxWidth;
    const targetHeight = this.config.maxHeight;

    // Calculate aspect ratios
    const originalAspect = originalWidth / originalHeight;
    const targetAspect = targetWidth / targetHeight;

    let resizeWidth: number;
    let resizeHeight: number;

    if (originalAspect > targetAspect) {
      // Image is wider than target aspect ratio
      // Resize based on height, then crop width
      resizeHeight = targetHeight;
      resizeWidth = Math.round(targetHeight * originalAspect);
    } else {
      // Image is taller than target aspect ratio
      // Resize based on width, then crop height
      resizeWidth = targetWidth;
      resizeHeight = Math.round(targetWidth / originalAspect);
    }

    // Resize the image
    pipeline = pipeline.resize(resizeWidth, resizeHeight, {
      kernel: sharp.kernel.lanczos3,
      withoutEnlargement: false
    });

    // Center crop to exact target dimensions
    const left = Math.max(0, Math.floor((resizeWidth - targetWidth) / 2));
    const top = Math.max(0, Math.floor((resizeHeight - targetHeight) / 2));

    pipeline = pipeline.extract({
      left,
      top,
      width: Math.min(targetWidth, resizeWidth),
      height: Math.min(targetHeight, resizeHeight)
    });

    return pipeline;
  }

  /**
   * Process multiple images in batch
   * @param inputPaths - Array of input image paths
   * @param progressCallback - Optional callback for progress updates
   * @returns Promise<ProcessingResult[]>
   */
  async batchProcess(
    inputPaths: string[], 
    progressCallback?: (processed: number, total: number, current: string) => void
  ): Promise<ProcessingResult[]> {
    const results: ProcessingResult[] = [];
    
    this.logger.info(`Starting batch processing of ${inputPaths.length} images`);

    for (let i = 0; i < inputPaths.length; i++) {
      const inputPath = inputPaths[i];
      
      if (progressCallback) {
        progressCallback(i, inputPaths.length, inputPath);
      }

      const result = await this.processImage(inputPath);
      results.push(result);

      // Small delay to prevent overwhelming the system
      if (i % 10 === 0 && i > 0) {
        await this.sleep(100);
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;
    
    this.logger.info(`Batch processing completed: ${successful} successful, ${failed} failed`);

    return results;
  }

  /**
   * Process all images in a directory
   * @param inputDir - Directory containing images to process
   * @param extensions - Image file extensions to process
   * @param progressCallback - Optional progress callback
   * @returns Promise<ProcessingResult[]>
   */
  async processDirectory(
    inputDir: string,
    extensions: string[] = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff'],
    progressCallback?: (processed: number, total: number, current: string) => void
  ): Promise<ProcessingResult[]> {
    if (!fs.existsSync(inputDir)) {
      throw new Error(`Input directory does not exist: ${inputDir}`);
    }

    // Find all image files in directory
    const files = await fs.promises.readdir(inputDir);
    const imageFiles = files.filter((file: string) => {
      const ext = path.extname(file).toLowerCase();
      return extensions.includes(ext);
    }).map((file: string) => path.join(inputDir, file));

    this.logger.info(`Found ${imageFiles.length} images in directory: ${inputDir}`);

    return await this.batchProcess(imageFiles, progressCallback);
  }

  /**
   * Get processing statistics from results
   */
  getProcessingStats(results: ProcessingResult[]): {
    total: number;
    successful: number;
    failed: number;
    totalOriginalSize: number;
    totalProcessedSize: number;
    averageCompressionRatio: number;
    errors: string[];
  } {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    const totalOriginalSize = results.reduce((sum, r) => sum + r.originalSize, 0);
    const totalProcessedSize = successful.reduce((sum, r) => sum + (r.processedSize || 0), 0);
    
    const compressionRatio = totalOriginalSize > 0 ? totalProcessedSize / totalOriginalSize : 0;
    
    const errors = failed.map(r => r.error || 'Unknown error');

    return {
      total: results.length,
      successful: successful.length,
      failed: failed.length,
      totalOriginalSize,
      totalProcessedSize,
      averageCompressionRatio: compressionRatio,
      errors: [...new Set(errors)] // Remove duplicates
    };
  }

  /**
   * Validate that an image meets the size requirements
   */
  async validateImage(imagePath: string): Promise<{
    valid: boolean;
    fileSize: number;
    dimensions: { width: number; height: number } | null;
    errors: string[];
  }> {
    const result = {
      valid: true,
      fileSize: 0,
      dimensions: null as { width: number; height: number } | null,
      errors: [] as string[]
    };

    try {
      if (!fs.existsSync(imagePath)) {
        result.valid = false;
        result.errors.push('File does not exist');
        return result;
      }

      const stats = await fs.promises.stat(imagePath);
      result.fileSize = stats.size;

      if (stats.size > this.config.maxFileSize) {
        result.valid = false;
        result.errors.push(`File size (${stats.size} bytes) exceeds maximum (${this.config.maxFileSize} bytes)`);
      }

      const metadata = await sharp(imagePath).metadata();
      if (metadata.width && metadata.height) {
        result.dimensions = { width: metadata.width, height: metadata.height };

        if (metadata.width > this.config.maxWidth) {
          result.valid = false;
          result.errors.push(`Width (${metadata.width}px) exceeds maximum (${this.config.maxWidth}px)`);
        }

        if (metadata.height > this.config.maxHeight) {
          result.valid = false;
          result.errors.push(`Height (${metadata.height}px) exceeds maximum (${this.config.maxHeight}px)`);
        }
      } else {
        result.valid = false;
        result.errors.push('Unable to read image dimensions');
      }

    } catch (error) {
      result.valid = false;
      result.errors.push(`Error validating image: ${error}`);
    }

    return result;
  }

  /**
   * Ensure output directory exists
   */
  private ensureOutputDirectory(): void {
    if (!fs.existsSync(this.config.outputDir)) {
      fs.mkdirSync(this.config.outputDir, { recursive: true });
      this.logger.info(`Created output directory: ${this.config.outputDir}`);
    }
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<ProcessingConfig> {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ProcessingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.ensureOutputDirectory();
  }
}