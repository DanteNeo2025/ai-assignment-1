import * as fs from 'fs';
import * as path from 'path';
import { Logger } from './logger';
import { ImageScraper, ImageData } from './ImageScraper';
import { ImageProcessor } from './ImageProcessor';
import { DatabaseManager, ImageRecord } from './DatabaseManager';
import { AppConfig, DEFAULT_CONFIG, KeywordUtils } from './config';

/**
 * Progress callback interface for monitoring collection progress
 */
export interface ProgressCallback {
  onKeywordStart?: (keyword: string, index: number, total: number) => void;
  onImageDownloaded?: (downloaded: number, total: number, url: string) => void;
  onImageProcessed?: (processed: number, total: number, filename: string) => void;
  onCategoryComplete?: (category: string, stats: CategoryStats) => void;
  onError?: (error: Error, context: string) => void;
}

/**
 * Statistics for a single category
 */
export interface CategoryStats {
  category: string;
  keywordsProcessed: number;
  totalKeywords: number;
  imagesFound: number;
  imagesDownloaded: number;
  imagesProcessed: number;
  failures: number;
  avgFileSize: number;
}

/**
 * Overall collection statistics
 */
export interface CollectionStats {
  startTime: Date;
  endTime?: Date;
  totalKeywords: number;
  keywordsCompleted: number;
  totalImagesFound: number;
  totalImagesDownloaded: number;
  totalImagesProcessed: number;
  totalFailures: number;
  avgProcessingTime: number;
  categoriesStats: CategoryStats[];
  errors: string[];
}

/**
 * Main application class that orchestrates the entire image collection process
 */
export class AnimeImageCollectorApp {
  private logger: Logger;
  private config: AppConfig;
  private scraper: ImageScraper;
  private processor: ImageProcessor;
  private database: DatabaseManager;
  private stats: CollectionStats;
  private progressCallback?: ProgressCallback;

  constructor(config: AppConfig = DEFAULT_CONFIG, progressCallback?: ProgressCallback) {
    this.config = config;
    this.progressCallback = progressCallback || undefined;
    this.logger = new Logger('AnimeImageCollectorApp');
    
    // Validate configuration
    const configErrors = KeywordUtils.validateConfig(config);
    if (configErrors.length > 0) {
      throw new Error(`Configuration errors: ${configErrors.join(', ')}`);
    }

    // Initialize components
    this.scraper = new ImageScraper({
      headless: config.scraping.headless,
      maxImages: config.scraping.maxImagesPerKeyword,
      delay: config.scraping.delay,
      timeout: config.scraping.timeout,
      userAgent: config.scraping.userAgent,
      outputDir: config.paths.rawImages
    });

    this.processor = new ImageProcessor({
      maxWidth: config.imageProcessing.maxWidth,
      maxHeight: config.imageProcessing.maxHeight,
      quality: config.imageProcessing.quality.max,
      maxFileSize: config.imageProcessing.maxFileSize,
      format: config.imageProcessing.format,
      outputDir: config.paths.processedImages
    });

    this.database = new DatabaseManager(config.paths.database);

    // Initialize statistics
    this.stats = {
      startTime: new Date(),
      totalKeywords: KeywordUtils.getAllKeywords(config).length,
      keywordsCompleted: 0,
      totalImagesFound: 0,
      totalImagesDownloaded: 0,
      totalImagesProcessed: 0,
      totalFailures: 0,
      avgProcessingTime: 0,
      categoriesStats: [],
      errors: []
    };

    // Ensure directories exist
    this.ensureDirectories();

    this.logger.info('AnimeImageCollectorApp initialized successfully');
  }

  /**
   * Start the complete image collection and processing workflow
   */
  async run(): Promise<CollectionStats> {
    this.logger.info('Starting anime character image collection process...');
    this.stats.startTime = new Date();

    try {
      // Initialize browser
      await this.scraper.initialize();

      // Get weighted keyword distribution
      const keywordDistribution = KeywordUtils.getWeightedKeywordDistribution(
        this.config.targetImageCount.max,
        this.config
      );

      this.logger.info(`Processing ${keywordDistribution.length} keyword combinations`);

      // Process each category
      for (const category of this.config.keywordCategories) {
        await this.processCategory(category.name, keywordDistribution);
      }

      // Final statistics
      this.stats.endTime = new Date();
      const duration = this.stats.endTime.getTime() - this.stats.startTime.getTime();
      this.stats.avgProcessingTime = duration / this.stats.keywordsCompleted;

      // Generate final report
      await this.generateFinalReport();

      this.logger.info('Image collection process completed successfully');
      return this.stats;

    } catch (error) {
      this.logger.error('Fatal error during collection process:', error);
      this.stats.errors.push(`Fatal error: ${error}`);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Process a single category of keywords
   */
  private async processCategory(
    categoryName: string,
    keywordDistribution: Array<{ keyword: any; targetCount: number; category: string }>
  ): Promise<void> {
    const categoryKeywords = keywordDistribution.filter(kd => kd.category === categoryName);
    
    const categoryStats: CategoryStats = {
      category: categoryName,
      keywordsProcessed: 0,
      totalKeywords: categoryKeywords.length,
      imagesFound: 0,
      imagesDownloaded: 0,
      imagesProcessed: 0,
      failures: 0,
      avgFileSize: 0
    };

    this.logger.info(`Processing category: ${categoryName} (${categoryKeywords.length} keywords)`);

    for (const keywordDist of categoryKeywords) {
      try {
        await this.processKeyword(keywordDist.keyword, keywordDist.targetCount, categoryStats);
        categoryStats.keywordsProcessed++;
        this.stats.keywordsCompleted++;

        // Progress callback
        if (this.progressCallback?.onKeywordStart) {
          this.progressCallback.onKeywordStart(
            keywordDist.keyword.primary,
            categoryStats.keywordsProcessed,
            categoryStats.totalKeywords
          );
        }

      } catch (error) {
        categoryStats.failures++;
        this.stats.totalFailures++;
        const errorMsg = `Failed to process keyword ${keywordDist.keyword.primary}: ${error}`;
        this.stats.errors.push(errorMsg);
        this.logger.error(errorMsg);

        if (this.progressCallback?.onError) {
          this.progressCallback.onError(error as Error, `Keyword: ${keywordDist.keyword.primary}`);
        }
      }
    }

    // Calculate average file size for category
    if (categoryStats.imagesProcessed > 0) {
      const categoryImages = this.database.getImages({ keyword: categoryKeywords[0]?.keyword.primary });
      if (categoryImages.length > 0) {
        categoryStats.avgFileSize = categoryImages.reduce((sum, img) => sum + img.file_size, 0) / categoryImages.length;
      }
    }

    this.stats.categoriesStats.push(categoryStats);

    if (this.progressCallback?.onCategoryComplete) {
      this.progressCallback.onCategoryComplete(categoryName, categoryStats);
    }

    this.logger.info(`Category ${categoryName} completed: ${categoryStats.imagesProcessed} images processed`);
  }

  /**
   * Process a single keyword and its variations
   */
  private async processKeyword(keyword: any, targetCount: number, categoryStats: CategoryStats): Promise<void> {
    const searchTerms = KeywordUtils.getAllSearchTerms(keyword);
    let totalCollected = 0;

    for (const searchTerm of searchTerms) {
      if (totalCollected >= targetCount) break;

      try {
        // Search for images
        const imageDataArray = await this.scraper.searchImages(searchTerm, keyword.category);
        categoryStats.imagesFound += imageDataArray.length;
        this.stats.totalImagesFound += imageDataArray.length;

        if (imageDataArray.length === 0) {
          this.logger.warn(`No images found for search term: ${searchTerm}`);
          continue;
        }

        // Filter out already downloaded URLs
        const newImageData = imageDataArray.filter(imgData => !this.database.urlExists(imgData.url));
        
        if (newImageData.length === 0) {
          this.logger.info(`All images for "${searchTerm}" already in database`);
          continue;
        }

        // Download images
        const downloadedFiles = await this.downloadImages(newImageData, searchTerm);
        const downloadedCount = downloadedFiles.length;
        
        categoryStats.imagesDownloaded += downloadedCount;
        this.stats.totalImagesDownloaded += downloadedCount;
        totalCollected += downloadedCount;

        // Process downloaded images
        if (downloadedCount > 0) {
          const processedCount = await this.processDownloadedImages(
            downloadedFiles,
            newImageData,
            searchTerm,
            keyword.category
          );
          
          categoryStats.imagesProcessed += processedCount;
          this.stats.totalImagesProcessed += processedCount;
        }

        // Respect rate limiting
        await this.sleep(this.config.scraping.delay);

      } catch (error) {
        categoryStats.failures++;
        this.logger.error(`Error processing search term "${searchTerm}":`, error);
      }
    }

    this.logger.info(`Keyword "${keyword.primary}" completed: ${totalCollected} images collected`);
  }

  /**
   * Download images from image data array
   */
  private async downloadImages(imageDataArray: ImageData[], searchTerm: string): Promise<string[]> {
    const downloadedFiles: string[] = [];
    let downloadIndex = 0;

    for (const imageData of imageDataArray) {
      try {
        const filename = this.generateUniqueFilename(searchTerm, downloadIndex);
        const success = await this.scraper.downloadImage(imageData, filename);
        
        if (success) {
          downloadedFiles.push(filename);
          
          if (this.progressCallback?.onImageDownloaded) {
            this.progressCallback.onImageDownloaded(
              downloadedFiles.length,
              imageDataArray.length,
              imageData.url
            );
          }
        }
        
        downloadIndex++;
        
        // Small delay between downloads
        await this.sleep(Math.random() * 500 + 200);
        
      } catch (error) {
        this.logger.error(`Failed to download image from ${imageData.url}:`, error);
      }
    }

    return downloadedFiles;
  }

  /**
   * Process downloaded images and save to database
   */
  private async processDownloadedImages(
    filenames: string[],
    imageDataArray: ImageData[],
    searchTerm: string,
    category: string
  ): Promise<number> {
    const imageRecords: Array<Omit<ImageRecord, 'id' | 'download_date'>> = [];
    let processedCount = 0;

    for (let i = 0; i < filenames.length; i++) {
      const filename = filenames[i];
      const imageData = imageDataArray[i];
      const rawPath = path.join(this.config.paths.rawImages, filename);

      try {
        // Process the image
        const result = await this.processor.processImage(rawPath, undefined);
        
        if (result.success && result.outputPath && result.processedSize) {
          // Create database record
          const record: Omit<ImageRecord, 'id' | 'download_date'> = {
            url: imageData.url,
            alt_text: imageData.altText || undefined,
            filename: path.basename(result.outputPath),
            file_path: result.outputPath,
            file_size: result.processedSize,
            width: result.processedDimensions?.width || 0,
            height: result.processedDimensions?.height || 0,
            keyword: searchTerm,
            category: category,
            processed: true,
            processing_date: new Date().toISOString()
          };

          imageRecords.push(record);
          processedCount++;

          if (this.progressCallback?.onImageProcessed) {
            this.progressCallback.onImageProcessed(
              processedCount,
              filenames.length,
              filename
            );
          }

        } else {
          this.logger.warn(`Failed to process image ${filename}: ${result.error}`);
        }

      } catch (error) {
        this.logger.error(`Error processing image ${filename}:`, error);
      }
    }

    // Batch insert records
    if (imageRecords.length > 0) {
      try {
        this.database.batchInsertImages(imageRecords);
        this.logger.info(`Inserted ${imageRecords.length} image records for search term: ${searchTerm}`);
      } catch (error) {
        this.logger.error('Failed to insert image records:', error);
      }
    }

    return processedCount;
  }

  /**
   * Generate a unique filename for downloaded images
   */
  private generateUniqueFilename(searchTerm: string, index: number): string {
    const sanitized = searchTerm.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `${sanitized}_${String(index).padStart(4, '0')}_${timestamp}_${random}.jpg`;
  }

  /**
   * Generate final collection report
   */
  private async generateFinalReport(): Promise<void> {
    const reportPath = path.join(this.config.paths.logs, `collection_report_${Date.now()}.json`);
    
    // Get database summary
    const dbSummary = this.database.getCollectionSummary();
    
    const report = {
      collectionStats: this.stats,
      databaseSummary: dbSummary,
      configuration: {
        targetImageCount: this.config.targetImageCount,
        imageProcessing: this.config.imageProcessing,
        keywordCategories: this.config.keywordCategories.map(cat => ({
          name: cat.name,
          weight: cat.weight,
          keywordCount: cat.keywords.length
        }))
      },
      timestamp: new Date().toISOString()
    };

    try {
      await fs.promises.writeFile(reportPath, JSON.stringify(report, null, 2));
      this.logger.info(`Final report saved to: ${reportPath}`);
      
      // Also log summary to console
      this.logCollectionSummary();
      
    } catch (error) {
      this.logger.error('Failed to save final report:', error);
    }
  }

  /**
   * Log collection summary to console
   */
  private logCollectionSummary(): void {
    const duration = this.stats.endTime 
      ? this.stats.endTime.getTime() - this.stats.startTime.getTime() 
      : 0;

    console.log('\n' + '='.repeat(60));
    console.log('ANIME CHARACTER IMAGE COLLECTION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Duration: ${Math.floor(duration / 1000 / 60)} minutes`);
    console.log(`Keywords Processed: ${this.stats.keywordsCompleted}/${this.stats.totalKeywords}`);
    console.log(`Images Found: ${this.stats.totalImagesFound}`);
    console.log(`Images Downloaded: ${this.stats.totalImagesDownloaded}`);
    console.log(`Images Processed: ${this.stats.totalImagesProcessed}`);
    console.log(`Total Failures: ${this.stats.totalFailures}`);
    console.log('\nCategory Breakdown:');
    
    for (const catStats of this.stats.categoriesStats) {
      console.log(`  ${catStats.category}: ${catStats.imagesProcessed} processed (${catStats.failures} failures)`);
    }
    
    if (this.stats.errors.length > 0) {
      console.log('\nErrors:');
      this.stats.errors.slice(0, 5).forEach(error => console.log(`  - ${error}`));
      if (this.stats.errors.length > 5) {
        console.log(`  ... and ${this.stats.errors.length - 5} more errors`);
      }
    }
    
    console.log('='.repeat(60) + '\n');
  }

  /**
   * Ensure all required directories exist
   */
  private ensureDirectories(): void {
    const directories = [
      this.config.paths.rawImages,
      this.config.paths.processedImages,
      path.dirname(this.config.paths.database),
      this.config.paths.logs
    ];

    for (const dir of directories) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        this.logger.debug(`Created directory: ${dir}`);
      }
    }
  }

  /**
   * Sleep utility function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current collection statistics
   */
  getStats(): CollectionStats {
    return { ...this.stats };
  }

  /**
   * Get configuration
   */
  getConfig(): AppConfig {
    return { ...this.config };
  }

  /**
   * Cleanup resources
   */
  private async cleanup(): Promise<void> {
    try {
      await this.scraper.close();
      this.database.close();
      this.logger.info('Cleanup completed successfully');
    } catch (error) {
      this.logger.error('Error during cleanup:', error);
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down application...');
    await this.cleanup();
  }
}