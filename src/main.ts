import { ImageScraper, ScrapingConfig } from './ImageScraper';
import { DatabaseManager } from './DatabaseManager';
import { Logger } from './logger';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const logger = new Logger();
  
  try {
    // 配置
    const config: ScrapingConfig = {
      maxImages: 20,
      outputDir: './images',
      timeout: 30000,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      scrollDelay: 2000
    };

    // 初始化組件
    const scraper = new ImageScraper(config);
    const database = new DatabaseManager('./data/images.db');
    
    logger.info('Starting anime image collection...');
    
    // 動漫角色關鍵字
    const keywords = [
      'anime girl',
      'anime boy', 
      'naruto',
      'one piece luffy',
      'demon slayer',
      'attack on titan',
      'my hero academia',
      'dragon ball'
    ];
    
    // 初始化瀏覽器
    await scraper.initialize();
    
    let totalDownloaded = 0;
    
    for (const keyword of keywords) {
      logger.info(`Processing keyword: ${keyword}`);
      
      // 搜尋圖片
      const images = await scraper.searchImages(keyword);
      logger.info(`Found ${images.length} images for "${keyword}"`);
      
      if (images.length === 0) {
        logger.warn(`No images found for keyword: ${keyword}`);
        continue;
      }
      
      // 下載圖片
      const downloadedFiles = await scraper.batchDownload(images);
      logger.info(`Downloaded ${downloadedFiles.length} images for "${keyword}"`);
      
      // 儲存到資料庫
      for (let i = 0; i < downloadedFiles.length; i++) {
        const filename = downloadedFiles[i];
        const filePath = path.join(config.outputDir, filename);
        
        try {
          const stats = fs.statSync(filePath);
          await database.insertImage({
            keyword: keyword,
            originalUrl: images[i]?.url || '',
            localPath: filePath,
            altText: images[i]?.altText || '',
            fileSize: stats.size,
            width: 500, // 假設值，實際應該檢測
            height: 500,
            format: 'jpg',
            collectedAt: new Date(),
            processingStatus: 'completed'
          });
          
          totalDownloaded++;
        } catch (error) {
          logger.error(`Failed to process file ${filename}:`, error);
        }
      }
      
      logger.info(`Total downloaded so far: ${totalDownloaded}`);
      
      // 每個關鍵字間暫停
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    // 顯示統計
    const stats = await database.getCollectionStatistics();
    logger.info('Collection completed!');
    logger.info(`Total images: ${stats.totalImages}`);
    logger.info(`Total size: ${(stats.totalSizeBytes / 1024 / 1024).toFixed(2)} MB`);
    
    // 清理
    await scraper.close();
    await database.close();
    
  } catch (error) {
    logger.error('Main process failed:', error);
  }
}

// 執行主程式
if (require.main === module) {
  main().catch(console.error);
}
