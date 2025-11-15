import { AdvancedImageScraper, AdvancedScrapingConfig, EnhancedImageData } from './AdvancedImageScraper';
import { ProxyDatabaseManager, ImageRecord } from './ProxyDatabaseManager';
import { AdvancedImageProcessor, ProcessingOptions } from './AdvancedImageProcessor';
import { Logger } from './logger';
import { 
  ANIME_CHARACTER_CATEGORIES, 
  COLLECTION_CONFIG, 
  getAllKeywords, 
  getHighRelevanceKeywords 
} from './advanced-config';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 動漫角色圖片收集系統 - 高級版本
 * 目標：收集 3000-5000 張高質量動漫角色圖片
 * 特點：90%+ 相關度、完整 metadata、分類存儲、專業級圖片處理
 */
class AnimeCollectionSystem {
  private scraper!: AdvancedImageScraper;
  private database!: ProxyDatabaseManager;
  private processor!: AdvancedImageProcessor;
  private logger: Logger;
  
  private config = {
    rawImagesDir: './raw_images',
    processedImagesDir: './processed_images',
    databasePath: './data/anime_collection.db',
    logDir: './logs'
  };

  constructor() {
    this.logger = new Logger();
    this.initializeDirectories();
    this.initializeComponents();
  }

  /**
   * 初始化目錄結構
   */
  private initializeDirectories(): void {
    const dirs = [
      this.config.rawImagesDir,
      this.config.processedImagesDir,
      this.config.logDir,
      './data'
    ];

    // 為每個類別創建子目錄
    ANIME_CHARACTER_CATEGORIES.forEach(category => {
      dirs.push(
        path.join(this.config.rawImagesDir, category.folder),
        path.join(this.config.processedImagesDir, category.folder)
      );
    });

    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        this.logger.debug(`Created directory: ${dir}`);
      }
    });

    this.logger.info('Directory structure initialized');
  }

  /**
   * 初始化組件
   */
  private initializeComponents(): void {
    // 配置圖片搜索器
    const scrapingConfig: AdvancedScrapingConfig = {
      maxImages: COLLECTION_CONFIG.maxImagesPerKeyword,
      outputBaseDir: this.config.rawImagesDir,
      timeout: 30000,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      scrollDelay: COLLECTION_CONFIG.scrollDelay,
      downloadDelay: COLLECTION_CONFIG.downloadDelay,
      maxScrolls: 8,
      relevanceThreshold: 0.85, // 85% 最低相關度
      enableImageAnalysis: true
    };

    this.scraper = new AdvancedImageScraper(scrapingConfig);

    // 初始化數據庫
    this.database = new ProxyDatabaseManager(this.config.databasePath);

    // 配置圖片處理器
    const processingOptions: ProcessingOptions = {
      targetWidth: COLLECTION_CONFIG.imageSize.width,
      targetHeight: COLLECTION_CONFIG.imageSize.height,
      jpegQuality: COLLECTION_CONFIG.jpegQuality,
      maxFileSize: COLLECTION_CONFIG.maxFileSize,
      preserveAspectRatio: true,
      enableSharpening: true,
      enableNoiseReduction: true
    };

    this.processor = new AdvancedImageProcessor(processingOptions);

    this.logger.info('All components initialized successfully');
  }

  /**
   * 執行完整的收集流程
   */
  async runCollection(): Promise<void> {
    try {
      this.logger.info('🎌 Starting Anime Character Image Collection System');
      
      // 1. 初始化關鍵字到數據庫
      await this.initializeKeywords();

      // 2. 初始化瀏覽器
      await this.scraper.initialize();

      // 3. 獲取需要收集的關鍵字
      const incompleteKeywords = this.database.getIncompleteKeywords();
      this.logger.info(`Found ${incompleteKeywords.length} keywords to process`);

      if (incompleteKeywords.length === 0) {
        this.logger.info('All keywords completed! Collection target achieved.');
        return;
      }

      // 4. 逐個處理關鍵字
      for (let i = 0; i < incompleteKeywords.length; i++) {
        const keyword = incompleteKeywords[i];
        await this.processKeyword(keyword, i + 1, incompleteKeywords.length);

        // 檢查是否達到總目標
        const stats = this.database.getCollectionStatistics();
        if (stats.totalImages >= COLLECTION_CONFIG.totalTargetImages) {
          this.logger.info(`🎉 Target achieved! Collected ${stats.totalImages} images`);
          break;
        }

        // 關鍵字間暫停
        await this.delay(3000);
      }

      // 5. 批量處理圖片
      await this.processBatchImages();

      // 6. 生成最終報告
      await this.generateFinalReport();

    } catch (error) {
      this.logger.error('Collection system failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * 初始化關鍵字到數據庫
   */
  private async initializeKeywords(): Promise<void> {
    const allKeywords = getHighRelevanceKeywords();
    this.database.insertKeywords(allKeywords);
    this.logger.info(`Initialized ${allKeywords.length} high-relevance keywords`);
  }

  /**
   * 處理單個關鍵字
   */
  private async processKeyword(keyword: any, current: number, total: number): Promise<void> {
    try {
      const stats = this.database.getKeywordStats(keyword.keyword);
      const needed = keyword.targetCount - stats.collected;

      if (needed <= 0) {
        this.logger.info(`[${current}/${total}] ✅ ${keyword.keyword} - Already completed (${stats.collected}/${keyword.targetCount})`);
        return;
      }

      this.logger.info(`[${current}/${total}] 🔍 Processing: ${keyword.keyword} (need ${needed} more images)`);

      // 搜索圖片
      const images = await this.scraper.searchImages(keyword);
      
      if (images.length === 0) {
        this.logger.warn(`No images found for: ${keyword.keyword}`);
        return;
      }

      // 過濾已存在的圖片
      const newImages = images.filter(img => !this.database.urlExists(img.url));
      this.logger.info(`Found ${images.length} images, ${newImages.length} are new`);

      if (newImages.length === 0) {
        this.logger.warn(`All images already exist for: ${keyword.keyword}`);
        return;
      }

      // 限制數量
      const imagesToDownload = newImages.slice(0, needed);

      // 下載圖片
      const downloadResult = await this.scraper.batchDownload(imagesToDownload);
      
      // 保存到數據庫
      const imageRecords: ImageRecord[] = downloadResult.downloaded.map(img => ({
        keyword: img.keyword,
        category: img.category,
        subcategory: img.subcategory,
        originalUrl: img.url,
        altText: img.altText || '',
        localPath: this.buildImagePath(img),
        fileSize: img.fileSize || 0,
        width: img.width || 0,
        height: img.height || 0,
        format: 'jpg',
        jpegQuality: 0,
        relevanceScore: img.relevanceScore,
        collectedAt: new Date(),
        processingStatus: 'pending'
      }));

      if (imageRecords.length > 0) {
        await this.database.insertImagesBatch(imageRecords);
        this.logger.info(`✅ Saved ${imageRecords.length} images for: ${keyword.keyword}`);
      }

    } catch (error) {
      this.logger.error(`Failed to process keyword ${keyword.keyword}:`, error);
    }
  }

  /**
   * 批量處理圖片
   */
  private async processBatchImages(): Promise<void> {
    this.logger.info('🖼️  Starting batch image processing...');

    // 獲取所有待處理的圖片
    const stats = this.database.getCollectionStatistics();
    const pendingCount = stats.processingStatusStats.pending || 0;

    if (pendingCount === 0) {
      this.logger.info('No images pending processing');
      return;
    }

    this.logger.info(`Processing ${pendingCount} images...`);

    // 這裡應該實現批量處理邏輯
    // 由於複雜性，這裡先提供框架
    const categories = ANIME_CHARACTER_CATEGORIES;
    
    for (const category of categories) {
      const categoryImages = await this.getImagesByCategory(category.name);
      if (categoryImages.length === 0) continue;

      this.logger.info(`Processing ${categoryImages.length} images for category: ${category.name}`);

      // 處理該類別的圖片
      const result = await this.processor.processBatch(
        categoryImages,
        path.join(this.config.rawImagesDir, category.folder),
        path.join(this.config.processedImagesDir, category.folder),
        (processed, total) => {
          if (processed % 10 === 0 || processed === total) {
            this.logger.info(`Progress: ${processed}/${total} images processed`);
          }
        }
      );

      // 更新處理狀態
      for (const processedImg of result.success) {
        // 這裡需要根據實際的 ID 更新狀態
        // this.database.updateProcessingStatus(imageId, 'completed', new Date());
      }

      this.logger.info(`Category ${category.name}: ${result.success.length} success, ${result.failed.length} failed`);
    }
  }

  /**
   * 根據類別獲取圖片 (這是一個示例方法，需要根據實際數據庫結構實現)
   */
  private async getImagesByCategory(categoryName: string): Promise<EnhancedImageData[]> {
    // 這裡需要實現從數據庫獲取指定類別圖片的邏輯
    // 暫時返回空數組
    return [];
  }

  /**
   * 生成最終報告
   */
  private async generateFinalReport(): Promise<void> {
    this.logger.info('📊 Generating final collection report...');

    const stats = this.database.getCollectionStatistics();
    
    const report = {
      collectionDate: new Date().toISOString(),
      totalImages: stats.totalImages,
      totalSize: `${(stats.totalSizeBytes / 1024 / 1024).toFixed(2)} MB`,
      averageFileSize: `${(stats.averageFileSizeBytes / 1024).toFixed(2)} KB`,
      averageRelevanceScore: `${(stats.averageRelevanceScore * 100).toFixed(1)}%`,
      categories: stats.categoryStats,
      subcategories: stats.subcategoryStats,
      processingStatus: stats.processingStatusStats,
      qualityDistribution: stats.qualityStats.qualityDistribution,
      sizeDistribution: {
        'Under 10KB': stats.sizeStats.under10KB,
        '10-25KB': stats.sizeStats.under25KB,
        '25-50KB': stats.sizeStats.under50KB,
        'Over 50KB': stats.sizeStats.over50KB
      }
    };

    // 保存報告到文件
    const reportPath = path.join(this.config.logDir, `collection_report_${new Date().toISOString().split('T')[0]}.json`);
    await fs.promises.writeFile(reportPath, JSON.stringify(report, null, 2));

    // 打印摘要
    this.logger.info('📈 Collection Summary:');
    this.logger.info(`  Total Images: ${report.totalImages}`);
    this.logger.info(`  Total Size: ${report.totalSize}`);
    this.logger.info(`  Average Relevance: ${report.averageRelevanceScore}`);
    this.logger.info(`  Report saved to: ${reportPath}`);
  }

  /**
   * 構建圖片路徑
   */
  private buildImagePath(imageData: EnhancedImageData): string {
    const sanitizedKeyword = imageData.keyword.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${sanitizedKeyword}_001.jpg`; // 簡化的檔名
    return path.join(this.config.rawImagesDir, imageData.category, imageData.subcategory, filename);
  }

  /**
   * 延遲函數
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 清理資源
   */
  private async cleanup(): Promise<void> {
    try {
      await this.scraper.close();
      this.database.close();
      this.logger.info('System cleanup completed');
    } catch (error) {
      this.logger.error('Failed during cleanup:', error);
    }
  }

  /**
   * 獲取系統狀態
   */
  public getSystemStatus(): any {
    const stats = this.database.getCollectionStatistics();
    const targetProgress = (stats.totalImages / COLLECTION_CONFIG.totalTargetImages) * 100;

    return {
      targetImages: COLLECTION_CONFIG.totalTargetImages,
      collectedImages: stats.totalImages,
      progressPercentage: Math.round(targetProgress * 100) / 100,
      categories: Object.keys(stats.categoryStats).length,
      averageRelevance: Math.round(stats.averageRelevanceScore * 1000) / 10,
      processingStatus: stats.processingStatusStats
    };
  }
}

/**
 * 主程序入口
 */
async function main() {
  const system = new AnimeCollectionSystem();
  
  try {
    await system.runCollection();
  } catch (error) {
    console.error('System failed:', error);
    process.exit(1);
  }
}

// 如果是直接執行此文件
if (require.main === module) {
  main().catch(console.error);
}

export { AnimeCollectionSystem };