import { ImageScraper } from '../src/ImageScraper';
import { ImageProcessor } from '../src/ImageProcessor';
import { DatabaseManager } from '../src/DatabaseManager';
import { DEFAULT_CONFIG, KeywordUtils } from '../src/config';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Comprehensive test suite for the anime image collection system
 */
describe('Anime Image Collection System', () => {
  const testOutputDir = './test_output';
  const testDbPath = './test_output/test.db';
  
  beforeAll(() => {
    // Create test directories
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }
  });

  afterAll(() => {
    // Cleanup test files
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  describe('Configuration System', () => {
    test('should have valid default configuration', () => {
      expect(DEFAULT_CONFIG.targetImageCount.min).toBeLessThan(DEFAULT_CONFIG.targetImageCount.max);
      expect(DEFAULT_CONFIG.keywordCategories.length).toBeGreaterThan(0);
      expect(DEFAULT_CONFIG.imageProcessing.maxFileSize).toBe(50 * 1024);
    });

    test('should validate configuration correctly', () => {
      const errors = KeywordUtils.validateConfig(DEFAULT_CONFIG);
      expect(errors).toHaveLength(0);
    });

    test('should get all keywords', () => {
      const keywords = KeywordUtils.getAllKeywords(DEFAULT_CONFIG);
      expect(keywords.length).toBeGreaterThan(50);
      expect(keywords[0]).toHaveProperty('primary');
      expect(keywords[0]).toHaveProperty('variations');
    });

    test('should calculate weighted distribution', () => {
      const distribution = KeywordUtils.getWeightedKeywordDistribution(1000, DEFAULT_CONFIG);
      expect(distribution.length).toBeGreaterThan(0);
      expect(distribution[0]).toHaveProperty('targetCount');
    });
  });

  describe('Database Manager', () => {
    let db: DatabaseManager;

    beforeAll(() => {
      db = new DatabaseManager(testDbPath);
    });

    afterAll(() => {
      db.close();
    });

    test('should initialize database with correct schema', () => {
      const stats = db.getDatabaseStats();
      expect(stats.tableInfo).toHaveLength(2);
      expect(stats.tableInfo[0].name).toBe('images');
      expect(stats.tableInfo[1].name).toBe('collection_stats');
    });

    test('should insert and retrieve image records', () => {
      const imageRecord = {
        url: 'https://example.com/test.jpg',
        alt_text: 'Test anime character',
        filename: 'test_001.jpg',
        file_path: '/path/to/test_001.jpg',
        file_size: 45000,
        width: 500,
        height: 500,
        keyword: 'anime character',
        category: 'test',
        processed: true,
        processing_date: new Date().toISOString()
      };

      const id = db.insertImage(imageRecord);
      expect(id).toBeGreaterThan(0);

      const retrieved = db.getImageById(id);
      expect(retrieved).toBeTruthy();
      expect(retrieved!.url).toBe(imageRecord.url);
      expect(retrieved!.keyword).toBe(imageRecord.keyword);
    });

    test('should handle duplicate URLs', () => {
      const url = 'https://example.com/duplicate.jpg';
      
      // Insert first record
      db.insertImage({
        url,
        filename: 'duplicate1.jpg',
        file_path: '/path/to/duplicate1.jpg',
        file_size: 45000,
        width: 500,
        height: 500,
        keyword: 'test',
        processed: true
      });

      expect(db.urlExists(url)).toBe(true);
      expect(db.urlExists('https://example.com/nonexistent.jpg')).toBe(false);
    });

    test('should get collection summary', () => {
      const summary = db.getCollectionSummary();
      expect(summary).toHaveProperty('totalImages');
      expect(summary).toHaveProperty('keywordStats');
      expect(summary.totalImages).toBeGreaterThan(0);
    });
  });

  describe('Image Processor', () => {
    let processor: ImageProcessor;
    const testImagePath = path.join(testOutputDir, 'test_image.jpg');

    beforeAll(() => {
      processor = new ImageProcessor({
        outputDir: testOutputDir,
        maxWidth: 500,
        maxHeight: 500,
        quality: 80,
        maxFileSize: 50 * 1024
      });

      // Create a simple test image (placeholder)
      // In a real test, you'd use an actual image file
    });

    test('should validate configuration', () => {
      const config = processor.getConfig();
      expect(config.maxWidth).toBe(500);
      expect(config.maxHeight).toBe(500);
      expect(config.maxFileSize).toBe(50 * 1024);
    });

    test('should handle non-existent files gracefully', async () => {
      const result = await processor.processImage('/non/existent/file.jpg');
      expect(result.success).toBe(false);
      expect(result.error).toContain('does not exist');
    });

    // Note: Actual image processing tests would require sample images
  });

  describe('Image Scraper', () => {
    let scraper: ImageScraper;

    beforeAll(() => {
      scraper = new ImageScraper({
        headless: true,
        maxImages: 5, // Small number for testing
        outputDir: testOutputDir
      });
    });

    afterAll(async () => {
      await scraper.close();
    });

    test('should initialize with correct configuration', () => {
      const config = scraper.getConfig();
      expect(config.maxImages).toBe(5);
      expect(config.headless).toBe(true);
      expect(config.outputDir).toBe(testOutputDir);
    });

    test('should update configuration', () => {
      scraper.updateConfig({ maxImages: 10 });
      const config = scraper.getConfig();
      expect(config.maxImages).toBe(10);
    });

    // Note: Actual web scraping tests would require network access and browser setup
    // These would be integration tests rather than unit tests
  });

  describe('Keyword System', () => {
    test('should have comprehensive keyword coverage', () => {
      const keywords = KeywordUtils.getAllKeywords(DEFAULT_CONFIG);
      
      // Check for male character keywords
      const maleKeywords = keywords.filter(k => k.category.includes('male'));
      expect(maleKeywords.length).toBeGreaterThan(0);

      // Check for female character keywords
      const femaleKeywords = keywords.filter(k => k.category.includes('female'));
      expect(femaleKeywords.length).toBeGreaterThan(0);

      // Check for professional keywords
      const professionalKeywords = keywords.filter(k => 
        ['medical', 'education', 'technical', 'creative'].includes(k.category)
      );
      expect(professionalKeywords.length).toBeGreaterThan(0);
    });

    test('should have proper keyword variations', () => {
      const keywords = KeywordUtils.getAllKeywords(DEFAULT_CONFIG);
      
      keywords.forEach(keyword => {
        expect(keyword.primary).toBeTruthy();
        expect(keyword.variations).toBeInstanceOf(Array);
        expect(keyword.expectedResults).toBeGreaterThan(0);
      });
    });

    test('should calculate category totals correctly', () => {
      DEFAULT_CONFIG.keywordCategories.forEach(category => {
        const total = KeywordUtils.getCategoryExpectedTotal(category);
        expect(total).toBeGreaterThan(0);
      });
    });
  });

  describe('System Integration', () => {
    test('should have all required directories in config', () => {
      expect(DEFAULT_CONFIG.paths.rawImages).toBeTruthy();
      expect(DEFAULT_CONFIG.paths.processedImages).toBeTruthy();
      expect(DEFAULT_CONFIG.paths.database).toBeTruthy();
      expect(DEFAULT_CONFIG.paths.logs).toBeTruthy();
    });

    test('should have compatible image processing settings', () => {
      const { imageProcessing } = DEFAULT_CONFIG;
      
      expect(imageProcessing.maxWidth).toBeLessThanOrEqual(500);
      expect(imageProcessing.maxHeight).toBeLessThanOrEqual(500);
      expect(imageProcessing.maxFileSize).toBeLessThanOrEqual(50 * 1024);
      expect(imageProcessing.quality.min).toBeLessThan(imageProcessing.quality.max);
      expect(imageProcessing.quality.min).toBeGreaterThanOrEqual(50);
      expect(imageProcessing.quality.max).toBeLessThanOrEqual(80);
    });

    test('should have reasonable scraping settings', () => {
      const { scraping } = DEFAULT_CONFIG;
      
      expect(scraping.delay).toBeGreaterThanOrEqual(500); // Respectful scraping
      expect(scraping.timeout).toBeGreaterThan(10000); // Reasonable timeout
      expect(scraping.maxImagesPerKeyword).toBeGreaterThan(50);
      expect(scraping.userAgent).toContain('Mozilla');
    });

    test('should target appropriate image count', () => {
      const { targetImageCount } = DEFAULT_CONFIG;
      
      expect(targetImageCount.min).toBeGreaterThanOrEqual(3000);
      expect(targetImageCount.max).toBeLessThanOrEqual(5000);
      expect(targetImageCount.min).toBeLessThan(targetImageCount.max);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid configuration gracefully', () => {
      const invalidConfig = {
        ...DEFAULT_CONFIG,
        targetImageCount: { min: 5000, max: 3000 } // Invalid: min > max
      };

      const errors = KeywordUtils.validateConfig(invalidConfig);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('Minimum target count must be less than maximum');
    });

    test('should handle empty keyword categories', () => {
      const emptyConfig = {
        ...DEFAULT_CONFIG,
        keywordCategories: []
      };

      const errors = KeywordUtils.validateConfig(emptyConfig);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('At least one keyword category is required');
    });

    test('should handle categories with no keywords', () => {
      const noKeywordsConfig = {
        ...DEFAULT_CONFIG,
        keywordCategories: [{
          name: 'Empty Category',
          description: 'Category with no keywords',
          weight: 1,
          keywords: []
        }]
      };

      const errors = KeywordUtils.validateConfig(noKeywordsConfig);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('has no keywords');
    });
  });
});

/**
 * Performance and Load Testing (Optional)
 */
describe('Performance Tests', () => {
  test('should handle large keyword lists efficiently', () => {
    const startTime = Date.now();
    const keywords = KeywordUtils.getAllKeywords(DEFAULT_CONFIG);
    const distribution = KeywordUtils.getWeightedKeywordDistribution(10000, DEFAULT_CONFIG);
    const endTime = Date.now();

    expect(keywords.length).toBeGreaterThan(0);
    expect(distribution.length).toBeGreaterThan(0);
    expect(endTime - startTime).toBeLessThan(100); // Should complete in <100ms
  });

  test('should handle database operations efficiently', () => {
    const db = new DatabaseManager(':memory:'); // In-memory database for testing
    
    const startTime = Date.now();
    
    // Insert multiple records
    const records = Array.from({ length: 100 }, (_, i) => ({
      url: `https://example.com/image_${i}.jpg`,
      filename: `image_${i}.jpg`,
      file_path: `/path/to/image_${i}.jpg`,
      file_size: 45000 + i,
      width: 500,
      height: 500,
      keyword: 'test keyword',
      processed: true
    }));

    db.batchInsertImages(records);
    
    // Query records
    const retrieved = db.getImages({ keyword: 'test keyword' });
    
    const endTime = Date.now();

    expect(retrieved.length).toBe(100);
    expect(endTime - startTime).toBeLessThan(500); // Should complete in <500ms

    db.close();
  });
});