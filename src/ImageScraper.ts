import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from './logger';

export interface ImageData {
  url: string;
  altText: string;
  keyword: string;
}

export interface ScrapingConfig {
  maxImages: number;
  outputDir: string;
  timeout: number;
  userAgent: string;
  scrollDelay: number;
}

export class ImageScraper {
  private config: ScrapingConfig;
  private logger: Logger;
  private browser?: Browser;

  constructor(config: ScrapingConfig) {
    this.config = config;
    this.logger = new Logger();
    
    // Ensure output directory exists
    if (!fs.existsSync(this.config.outputDir)) {
      fs.mkdirSync(this.config.outputDir, { recursive: true });
    }
  }

  /**
   * Initialize browser
   */
  async initialize(): Promise<void> {
    try {
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      this.logger.info('Browser initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize browser:', error);
      throw error;
    }
  }

  /**
   * Search for images on Google Images
   */
  async searchImages(keyword: string): Promise<ImageData[]> {
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const page = await this.browser.newPage();
    const images: ImageData[] = [];

    try {
      // Set user agent
      await page.setExtraHTTPHeaders({ "User-Agent": this.config.userAgent });

      // Navigate to Google Images
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(keyword)}&tbm=isch`;
      this.logger.info(`Searching for images: ${keyword}`);
      await page.goto(searchUrl, { waitUntil: 'networkidle' });

      // Wait for images to load
      await page.waitForSelector('img', { timeout: 10000 });

      // Scroll and collect images
      let scrollCount = 0;
      const maxScrolls = 5;

      while (scrollCount < maxScrolls && images.length < this.config.maxImages) {
        // Extract image URLs and alt text
        const newImages = await page.evaluate((keyword: string) => {
          const imgElements = document.querySelectorAll('img[src]');
          const results: { url: string; altText: string; keyword: string }[] = [];

          imgElements.forEach((img) => {
            const htmlImg = img as HTMLImageElement;
            if (htmlImg.src && htmlImg.src.startsWith('http') && !htmlImg.src.includes('logo')) {
              results.push({
                url: htmlImg.src,
                altText: htmlImg.alt || '',
                keyword: keyword
              });
            }
          });

          return results;
        }, keyword);

        // Add new unique images
        for (const img of newImages) {
          if (!images.some(existing => existing.url === img.url) && images.length < this.config.maxImages) {
            images.push(img);
          }
        }

        // Scroll down
        await page.evaluate(() => {
          window.scrollBy(0, window.innerHeight);
        });

        // Wait for new images to load
        await page.waitForTimeout(this.config.scrollDelay);
        scrollCount++;
      }

      this.logger.info(`Found ${images.length} images for keyword: ${keyword}`);
      return images;

    } catch (error) {
      this.logger.error(`Failed to search images for keyword ${keyword}:`, error);
      return [];
    } finally {
      await page.close();
    }
  }

  /**
   * Download image from URL
   */
  async downloadImage(imageData: ImageData, filename: string): Promise<boolean> {
    try {
      const response = await fetch(imageData.url, {
        method: 'GET',
        headers: {
          'User-Agent': this.config.userAgent,
          'Referer': 'https://www.google.com/',
          'Accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
        }
      });

      if (!response.ok) {
        this.logger.warn(`Failed to download image: HTTP ${response.status} for ${imageData.url}`);
        return false;
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const filePath = path.join(this.config.outputDir, filename);
      await fs.promises.writeFile(filePath, buffer);
      
      this.logger.debug(`Downloaded image: ${filename}`);
      return true;
      
    } catch (error) {
      this.logger.error(`Failed to download image ${imageData.url}:`, error);
      return false;
    }
  }

  /**
   * Batch download images
   */
  async batchDownload(images: ImageData[]): Promise<string[]> {
    const downloadedFiles: string[] = [];
    
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      const filename = `${image.keyword}_${i + 1}.jpg`;
      
      const success = await this.downloadImage(image, filename);
      if (success) {
        downloadedFiles.push(filename);
      }
      
      // Add delay between downloads
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    this.logger.info(`Downloaded ${downloadedFiles.length}/${images.length} images`);
    return downloadedFiles;
  }

  /**
   * Close browser
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.logger.info('Browser closed');
    }
  }
}
