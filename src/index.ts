#!/usr/bin/env node

import { AnimeImageCollectorApp, ProgressCallback } from './AnimeImageCollectorApp';
import { DEFAULT_CONFIG, AppConfig, KeywordUtils } from './config';
import { Logger } from './logger';

/**
 * CLI Progress Reporter
 */
class ProgressReporter implements ProgressCallback {
  private logger: Logger;
  private startTime: Date;

  constructor() {
    this.logger = new Logger('ProgressReporter');
    this.startTime = new Date();
  }

  onKeywordStart(keyword: string, index: number, total: number): void {
    const percentage = Math.round((index / total) * 100);
    console.log(`\n[${percentage}%] Processing keyword: "${keyword}" (${index}/${total})`);
  }

  onImageDownloaded(downloaded: number, total: number, url: string): void {
    if (downloaded % 10 === 0 || downloaded === total) {
      const percentage = Math.round((downloaded / total) * 100);
      process.stdout.write(`\r  Downloaded: ${downloaded}/${total} (${percentage}%)`);
      if (downloaded === total) {
        console.log(''); // New line after completion
      }
    }
  }

  onImageProcessed(processed: number, total: number, filename: string): void {
    if (processed % 5 === 0 || processed === total) {
      const percentage = Math.round((processed / total) * 100);
      process.stdout.write(`\r  Processed: ${processed}/${total} (${percentage}%)`);
      if (processed === total) {
        console.log(''); // New line after completion
      }
    }
  }

  onCategoryComplete(category: string, stats: any): void {
    console.log(`✅ Category "${category}" completed:`);
    console.log(`   - Images processed: ${stats.imagesProcessed}`);
    console.log(`   - Success rate: ${Math.round((stats.imagesProcessed / (stats.imagesProcessed + stats.failures)) * 100)}%`);
  }

  onError(error: Error, context: string): void {
    console.error(`❌ Error in ${context}: ${error.message}`);
  }
}

/**
 * Main application entry point
 */
async function main(): Promise<void> {
  console.log('🎌 Anime Character Image Collection System');
  console.log('==========================================\n');

  const logger = new Logger('Main');
  let app: AnimeImageCollectorApp | null = null;

  try {
    // Create progress reporter
    const progressReporter = new ProgressReporter();

    // Create and configure the application
    const config: AppConfig = {
      ...DEFAULT_CONFIG,
      // You can override config values here if needed
      // targetImageCount: { min: 3000, max: 5000 },
      // scraping: { ...DEFAULT_CONFIG.scraping, headless: false } // For debugging
    };

    console.log('📋 Configuration Summary:');
    console.log(`   Target images: ${config.targetImageCount.min} - ${config.targetImageCount.max}`);
    console.log(`   Image size: ${config.imageProcessing.maxWidth}x${config.imageProcessing.maxHeight}px`);
    console.log(`   Max file size: ${Math.round(config.imageProcessing.maxFileSize / 1024)}KB`);
    console.log(`   Quality range: ${config.imageProcessing.quality.min}-${config.imageProcessing.quality.max}`);
    console.log(`   Total keyword categories: ${config.keywordCategories.length}`);
    console.log(`   Total keywords: ${KeywordUtils.getAllKeywords(config).length}\n`);

    // Ask for confirmation in interactive mode
    if (process.stdin.isTTY) {
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      await new Promise<void>((resolve) => {
        rl.question('Continue with collection? (y/N): ', (answer) => {
          rl.close();
          if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
            console.log('Collection cancelled by user.');
            process.exit(0);
          }
          resolve();
        });
      });
    }

    // Initialize application
    console.log('🚀 Starting collection process...\n');
    app = new AnimeImageCollectorApp(config, progressReporter);

    // Set up graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n\n⏹️  Received interrupt signal, shutting down gracefully...');
      if (app) {
        await app.shutdown();
      }
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n\n⏹️  Received termination signal, shutting down gracefully...');
      if (app) {
        await app.shutdown();
      }
      process.exit(0);
    });

    // Run the collection process
    const stats = await app.run();

    // Display final results
    console.log('\n🎉 Collection process completed successfully!');
    console.log(`📊 Final Statistics:`);
    console.log(`   - Total images processed: ${stats.totalImagesProcessed}`);
    console.log(`   - Success rate: ${Math.round((stats.totalImagesProcessed / stats.totalImagesFound) * 100)}%`);
    console.log(`   - Categories completed: ${stats.categoriesStats.length}`);
    console.log(`   - Total runtime: ${stats.endTime ? Math.round((stats.endTime.getTime() - stats.startTime.getTime()) / 1000 / 60) : 0} minutes`);

    if (stats.totalImagesProcessed >= config.targetImageCount.min) {
      console.log('✅ Target image count achieved!');
    } else {
      console.log('⚠️  Target image count not reached. You may want to run the process again or adjust keywords.');
    }

  } catch (error) {
    logger.error('Application failed:', error);
    console.error('\n❌ Application failed:', (error as Error).message);
    
    if (error instanceof Error && error.stack) {
      logger.error('Stack trace:', error.stack);
    }
    
    process.exit(1);
  } finally {
    if (app) {
      await app.shutdown();
    }
  }
}

/**
 * Handle unhandled promise rejections and exceptions
 */
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Run the application
if (require.main === module) {
  main().catch((error) => {
    console.error('Failed to start application:', error);
    process.exit(1);
  });
}

export { main, AnimeImageCollectorApp, DEFAULT_CONFIG };