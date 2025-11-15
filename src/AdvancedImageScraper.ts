import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from './logger';
import { CharacterKeyword, COLLECTION_CONFIG } from './advanced-config';

export interface EnhancedImageData {
  url: string;
  altText: string;
  keyword: string;
  category: string;
  subcategory: string;
  relevanceScore: number;
  width?: number;
  height?: number;
  fileSize?: number;
}

export interface AdvancedScrapingConfig {
  maxImages: number;
  outputBaseDir: string;
  timeout: number;
  userAgent: string;
  scrollDelay: number;
  downloadDelay: number;
  maxScrolls: number;
  relevanceThreshold: number; // 最低相關度閾值
  enableImageAnalysis: boolean;
}

/**
 * 高級圖片搜索器 - 專為獲得90%+相關圖片設計
 */
export class AdvancedImageScraper {
  private config: AdvancedScrapingConfig;
  private logger: Logger;
  private browser?: Browser;

  constructor(config: AdvancedScrapingConfig) {
    this.config = config;
    this.logger = new Logger();
    
    // 確保輸出目錄存在
    if (!fs.existsSync(this.config.outputBaseDir)) {
      fs.mkdirSync(this.config.outputBaseDir, { recursive: true });
    }
  }

  /**
   * 初始化瀏覽器
   */
  async initialize(): Promise<void> {
    try {
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });
      this.logger.info('Advanced browser initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize browser:', error);
      throw error;
    }
  }

  /**
   * 搜索高相關度圖片
   */
  async searchImages(keywordData: CharacterKeyword): Promise<EnhancedImageData[]> {
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const page = await this.browser.newPage();
    const images: EnhancedImageData[] = [];

    try {
      // 設置視窗大小和用戶代理
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.setExtraHTTPHeaders({ 
        'User-Agent': this.config.userAgent,
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      });

      // 導航到 Google Images 搜索
      const searchUrl = this.buildSearchUrl(keywordData.keyword);
      this.logger.info(`Searching for: ${keywordData.keyword} (target: ${keywordData.targetCount})`);
      
      await page.goto(searchUrl, { 
        waitUntil: 'networkidle',
        timeout: this.config.timeout 
      });

      // 等待圖片加載
      await this.waitForImages(page);

      // 多次滾動收集圖片
      let scrollCount = 0;
      const maxScrolls = Math.min(this.config.maxScrolls, Math.ceil(keywordData.targetCount / 20));

      while (scrollCount < maxScrolls && images.length < keywordData.targetCount) {
        // 提取當前頁面的圖片信息
        const newImages = await this.extractImageData(page, keywordData);
        
        // 過濾和評分圖片相關度
        const relevantImages = this.filterRelevantImages(newImages, keywordData);
        
        // 添加新的唯一圖片
        for (const img of relevantImages) {
          if (!images.some(existing => existing.url === img.url) && 
              images.length < keywordData.targetCount) {
            images.push(img);
          }
        }

        this.logger.debug(`Scroll ${scrollCount + 1}: Found ${newImages.length} images, ${relevantImages.length} relevant, total: ${images.length}`);

        // 滾動到底部加載更多圖片
        await this.scrollAndWait(page);
        scrollCount++;

        // 檢查是否有"顯示更多結果"按鈕
        await this.clickShowMoreIfAvailable(page);
      }

      this.logger.info(`Collected ${images.length}/${keywordData.targetCount} images for "${keywordData.keyword}"`);
      return images;

    } catch (error) {
      this.logger.error(`Failed to search images for keyword ${keywordData.keyword}:`, error);
      return [];
    } finally {
      await page.close();
    }
  }

  /**
   * 構建搜索 URL (優化用於動漫角色)
   */
  private buildSearchUrl(keyword: string): string {
    const baseUrl = 'https://www.google.com/search';
    const params = new URLSearchParams({
      q: keyword,
      tbm: 'isch',
      safe: 'off',
      tbs: 'isz:m,ift:jpg', // 中等大小，JPEG 格式
      hl: 'en'
    });
    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * 等待圖片加載
   */
  private async waitForImages(page: Page): Promise<void> {
    try {
      await page.waitForSelector('img[src*="http"]', { timeout: 10000 });
      await page.waitForTimeout(2000); // 給圖片更多加載時間
    } catch (error) {
      this.logger.warn('Timeout waiting for images to load');
    }
  }

  /**
   * 提取圖片數據 (包含完整的 src 和 alt 信息)
   */
  private async extractImageData(page: Page, keywordData: CharacterKeyword): Promise<EnhancedImageData[]> {
    return await page.evaluate((keywordInfo) => {
      const { keyword, category, subcategory } = keywordInfo;
      const results: any[] = [];
      
      // 查找所有圖片元素
      const imgElements = document.querySelectorAll('img[src*="http"]');
      
      imgElements.forEach((img) => {
        const htmlImg = img as HTMLImageElement;
        
        // 過濾掉 logo、按鈕等不相關圖片
        if (htmlImg.src && 
            !htmlImg.src.includes('logo') && 
            !htmlImg.src.includes('button') &&
            !htmlImg.src.includes('icon') &&
            !htmlImg.className.includes('logo') &&
            htmlImg.naturalWidth > 100 && 
            htmlImg.naturalHeight > 100) {
          
          // 獲取 alt 文本
          let altText = htmlImg.alt || '';
          
          // 嘗試從父元素獲取更多上下文信息
          const parentElement = htmlImg.closest('div, a, figure');
          if (parentElement && !altText) {
            const titleAttr = parentElement.getAttribute('title');
            const ariaLabel = parentElement.getAttribute('aria-label');
            altText = titleAttr || ariaLabel || '';
          }
          
          // 從 URL 或周圍文本推斷更多信息
          if (!altText) {
            const urlPath = htmlImg.src.toLowerCase();
            if (urlPath.includes('anime') || urlPath.includes('manga')) {
              altText = 'anime character';
            }
          }

          results.push({
            url: htmlImg.src,
            altText: altText,
            keyword: keyword,
            category: category,
            subcategory: subcategory,
            width: htmlImg.naturalWidth,
            height: htmlImg.naturalHeight
          });
        }
      });

      return results;
    }, { 
      keyword: keywordData.keyword, 
      category: keywordData.category, 
      subcategory: keywordData.subcategory 
    });
  }

  /**
   * 過濾相關圖片並評分
   */
  private filterRelevantImages(images: EnhancedImageData[], keywordData: CharacterKeyword): EnhancedImageData[] {
    return images.map(img => {
      // 計算相關度分數
      let score = keywordData.relevanceScore; // 基礎分數
      
      // 基於 alt 文本的相關度評分
      const altLower = img.altText.toLowerCase();
      const keywordLower = keywordData.keyword.toLowerCase();
      
      // 關鍵字匹配加分
      if (altLower.includes(keywordLower.split(' ')[0])) score += 0.1;
      if (altLower.includes('anime')) score += 0.05;
      if (altLower.includes('character')) score += 0.05;
      if (altLower.includes(keywordData.category)) score += 0.05;
      if (altLower.includes(keywordData.subcategory)) score += 0.05;
      
      // 圖片尺寸評分 (適中尺寸更好)
      if (img.width && img.height) {
        const aspectRatio = img.width / img.height;
        if (aspectRatio >= 0.7 && aspectRatio <= 1.5) score += 0.05; // 接近正方形
        if (img.width >= 300 && img.width <= 800) score += 0.05; // 適中大小
      }
      
      // URL 相關度評分
      const urlLower = img.url.toLowerCase();
      if (urlLower.includes('anime')) score += 0.05;
      if (urlLower.includes('character')) score += 0.03;
      
      img.relevanceScore = Math.min(score, 1.0); // 最高 1.0
      return img;
    }).filter(img => img.relevanceScore >= this.config.relevanceThreshold);
  }

  /**
   * 滾動頁面並等待
   */
  private async scrollAndWait(page: Page): Promise<void> {
    await page.evaluate(() => {
      window.scrollBy(0, window.innerHeight);
    });
    await page.waitForTimeout(this.config.scrollDelay);
  }

  /**
   * 點擊"顯示更多結果"按鈕 (如果存在)
   */
  private async clickShowMoreIfAvailable(page: Page): Promise<void> {
    try {
      const showMoreButton = page.locator('input[value*="Show more"], button:has-text("Show more results")').first();
      if (await showMoreButton.isVisible()) {
        await showMoreButton.click();
        await page.waitForTimeout(2000);
        this.logger.debug('Clicked "Show more results" button');
      }
    } catch (error) {
      // 忽略錯誤，按鈕可能不存在
    }
  }

  /**
   * 下載圖片到指定分類目錄
   */
  async downloadImage(imageData: EnhancedImageData, filename: string): Promise<boolean> {
    try {
      // 創建分類目錄
      const categoryDir = path.join(this.config.outputBaseDir, imageData.category, imageData.subcategory);
      if (!fs.existsSync(categoryDir)) {
        fs.mkdirSync(categoryDir, { recursive: true });
      }

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
      const filePath = path.join(categoryDir, filename);
      await fs.promises.writeFile(filePath, buffer);
      
      // 更新圖片數據中的檔案大小
      imageData.fileSize = buffer.length;
      
      this.logger.debug(`Downloaded image: ${filename} (${buffer.length} bytes)`);
      return true;
      
    } catch (error) {
      this.logger.error(`Failed to download image ${imageData.url}:`, error);
      return false;
    }
  }

  /**
   * 批量下載圖片
   */
  async batchDownload(images: EnhancedImageData[]): Promise<{ downloaded: EnhancedImageData[]; failed: EnhancedImageData[] }> {
    const downloaded: EnhancedImageData[] = [];
    const failed: EnhancedImageData[] = [];
    
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      const filename = this.generateFilename(image, i + 1);
      
      const success = await this.downloadImage(image, filename);
      if (success) {
        downloaded.push(image);
      } else {
        failed.push(image);
      }
      
      // 下載間延遲
      if (i < images.length - 1) {
        await new Promise(resolve => setTimeout(resolve, this.config.downloadDelay));
      }
    }
    
    this.logger.info(`Download completed: ${downloaded.length} success, ${failed.length} failed`);
    return { downloaded, failed };
  }

  /**
   * 生成檔案名稱
   */
  private generateFilename(imageData: EnhancedImageData, index: number): string {
    const sanitizedKeyword = imageData.keyword.replace(/[^a-zA-Z0-9]/g, '_');
    return `${sanitizedKeyword}_${String(index).padStart(3, '0')}.jpg`;
  }

  /**
   * 獲取搜索建議 (用於優化關鍵字)
   */
  async getSearchSuggestions(baseKeyword: string): Promise<string[]> {
    if (!this.browser) return [];
    
    const page = await this.browser.newPage();
    try {
      await page.goto(`https://www.google.com/search?q=${encodeURIComponent(baseKeyword)}&tbm=isch`);
      
      const suggestions = await page.evaluate(() => {
        const chips = document.querySelectorAll('div[data-ved] span');
        return Array.from(chips)
          .map(chip => chip.textContent?.trim())
          .filter(text => text && text.length > 2)
          .slice(0, 10);
      });
      
      return suggestions.filter(s => s) as string[];
    } catch (error) {
      this.logger.error(`Failed to get search suggestions for ${baseKeyword}:`, error);
      return [];
    } finally {
      await page.close();
    }
  }

  /**
   * 關閉瀏覽器
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.logger.info('Advanced browser closed');
    }
  }
}