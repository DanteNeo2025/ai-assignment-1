import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from './logger';
import { CharacterKeyword } from './advanced-config';
import { proxySchema } from 'better-sqlite3-proxy';

/**
 * 圖片記錄接口
 */
export interface ImageRecord {
  id?: number;
  keyword: string;
  category: string;
  subcategory: string;
  originalUrl: string;
  altText: string;
  localPath: string;
  fileSize: number;
  width: number;
  height: number;
  format: string;
  jpegQuality: number;
  relevanceScore: number;
  collectedAt: Date;
  processedAt?: Date;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
}

/**
 * 收集統計接口
 */
export interface CollectionStatistics {
  totalImages: number;
  totalSizeBytes: number;
  averageFileSizeBytes: number;
  averageRelevanceScore: number;
  categoryStats: Record<string, number>;
  subcategoryStats: Record<string, number>;
  processingStatusStats: Record<string, number>;
  qualityStats: {
    averageQuality: number;
    qualityDistribution: Record<string, number>;
  };
  sizeStats: {
    under10KB: number;
    under25KB: number;
    under50KB: number;
    over50KB: number;
  };
}

/**
 * 高級數據庫管理器 - 使用 better-sqlite3-proxy
 */
export class AdvancedDatabaseManager {
  private db: Database.Database;
  private proxy: any;
  private logger: Logger;

  constructor(dbPath: string = './data/anime_collection.db') {
    this.logger = new Logger();
    
    // 確保數據庫目錄存在
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // 初始化數據庫
    this.db = new Database(dbPath);
    this.initializeSchema();
    this.configureDatabase();
    
    // 設置 better-sqlite3-proxy
    this.proxy = proxySchema(this.db, {
      images: {
        id: 'INTEGER PRIMARY KEY AUTOINCREMENT',
        keyword: 'TEXT NOT NULL',
        category: 'TEXT NOT NULL', 
        subcategory: 'TEXT NOT NULL',
        originalUrl: 'TEXT NOT NULL UNIQUE',
        altText: 'TEXT',
        localPath: 'TEXT NOT NULL',
        fileSize: 'INTEGER NOT NULL',
        width: 'INTEGER NOT NULL',
        height: 'INTEGER NOT NULL',
        format: 'TEXT NOT NULL',
        jpegQuality: 'INTEGER',
        relevanceScore: 'REAL NOT NULL',
        collectedAt: 'TEXT NOT NULL',
        processedAt: 'TEXT',
        processingStatus: 'TEXT NOT NULL DEFAULT "pending"'
      }
    });
    
    this.logger.info(`Advanced database initialized with proxy: ${dbPath}`);
  }

  /**
   * 配置數據庫性能
   */
  private configureDatabase(): void {
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = 1000');
    this.db.pragma('temp_store = memory');
    this.logger.info('Database performance optimized');
  }

  /**
   * 初始化數據庫架構
   */
  private initializeSchema(): void {
    const createImagesTable = `
      CREATE TABLE IF NOT EXISTS images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        keyword TEXT NOT NULL,
        category TEXT NOT NULL,
        subcategory TEXT NOT NULL,
        original_url TEXT NOT NULL UNIQUE,
        alt_text TEXT,
        local_path TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        width INTEGER NOT NULL,
        height INTEGER NOT NULL,
        format TEXT NOT NULL,
        jpeg_quality INTEGER,
        relevance_score REAL NOT NULL,
        collected_at TEXT NOT NULL,
        processed_at TEXT,
        processing_status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const createIndexes = `
      CREATE INDEX IF NOT EXISTS idx_images_keyword ON images(keyword);
      CREATE INDEX IF NOT EXISTS idx_images_category ON images(category);
      CREATE INDEX IF NOT EXISTS idx_images_subcategory ON images(subcategory);
      CREATE INDEX IF NOT EXISTS idx_images_status ON images(processing_status);
      CREATE INDEX IF NOT EXISTS idx_images_relevance ON images(relevance_score);
      CREATE INDEX IF NOT EXISTS idx_images_size ON images(file_size);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_images_url ON images(original_url);
    `;

    const createKeywordsTable = `
      CREATE TABLE IF NOT EXISTS keywords (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        keyword TEXT NOT NULL UNIQUE,
        category TEXT NOT NULL,
        subcategory TEXT NOT NULL,
        target_count INTEGER NOT NULL,
        relevance_score REAL NOT NULL,
        collected_count INTEGER DEFAULT 0,
        success_rate REAL DEFAULT 0.0,
        last_collected TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `;

    try {
      this.db.exec(createImagesTable);
      this.db.exec(createIndexes);
      this.db.exec(createKeywordsTable);
      this.logger.info('Database schema initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize database schema:', error);
      throw error;
    }
  }

  /**
   * 插入關鍵字配置
   */
  public insertKeywords(keywords: CharacterKeyword[]): void {
    const insertStmt = this.db.prepare(`
      INSERT OR REPLACE INTO keywords 
      (keyword, category, subcategory, target_count, relevance_score)
      VALUES (?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction((keywords: CharacterKeyword[]) => {
      for (const kw of keywords) {
        insertStmt.run(kw.keyword, kw.category, kw.subcategory, kw.targetCount, kw.relevanceScore);
      }
    });

    try {
      transaction(keywords);
      this.logger.info(`Inserted ${keywords.length} keywords into database`);
    } catch (error) {
      this.logger.error('Failed to insert keywords:', error);
      throw error;
    }
  }

  /**
   * 插入圖片記錄
   */
  public async insertImage(record: ImageRecord): Promise<number> {
    const insertStmt = this.db.prepare(`
      INSERT INTO images (
        keyword, category, subcategory, original_url, alt_text, local_path,
        file_size, width, height, format, jpeg_quality, relevance_score,
        collected_at, processed_at, processing_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    try {
      const result = insertStmt.run(
        record.keyword,
        record.category,
        record.subcategory,
        record.originalUrl,
        record.altText || '',
        record.localPath,
        record.fileSize,
        record.width,
        record.height,
        record.format,
        record.jpegQuality || 75,
        record.relevanceScore,
        record.collectedAt.toISOString(),
        record.processedAt?.toISOString() || null,
        record.processingStatus
      );

      const imageId = result.lastInsertRowid as number;
      this.logger.debug(`Inserted image record with ID: ${imageId}`);
      return imageId;
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE constraint')) {
        this.logger.warn(`Duplicate image URL: ${record.originalUrl}`);
        return -1;
      }
      this.logger.error('Failed to insert image record:', error);
      throw error;
    }
  }

  /**
   * 批量插入圖片記錄
   */
  public async insertImagesBatch(records: ImageRecord[]): Promise<number[]> {
    const insertStmt = this.db.prepare(`
      INSERT OR IGNORE INTO images (
        keyword, category, subcategory, original_url, alt_text, local_path,
        file_size, width, height, format, jpeg_quality, relevance_score,
        collected_at, processed_at, processing_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction((records: ImageRecord[]) => {
      const results: number[] = [];
      for (const record of records) {
        const result = insertStmt.run(
          record.keyword,
          record.category,
          record.subcategory,
          record.originalUrl,
          record.altText || '',
          record.localPath,
          record.fileSize,
          record.width,
          record.height,
          record.format,
          record.jpegQuality || 75,
          record.relevanceScore,
          record.collectedAt.toISOString(),
          record.processedAt?.toISOString() || null,
          record.processingStatus
        );
        results.push(result.lastInsertRowid as number);
      }
      return results;
    });

    try {
      const results = transaction(records);
      this.logger.info(`Batch inserted ${results.length} image records`);
      return results;
    } catch (error) {
      this.logger.error('Failed to batch insert image records:', error);
      throw error;
    }
  }

  /**
   * 更新處理狀態
   */
  public updateProcessingStatus(
    imageId: number, 
    status: 'pending' | 'processing' | 'completed' | 'failed',
    processedAt?: Date
  ): void {
    const updateStmt = this.db.prepare(`
      UPDATE images 
      SET processing_status = ?, processed_at = ?
      WHERE id = ?
    `);

    try {
      updateStmt.run(status, processedAt?.toISOString() || null, imageId);
      this.logger.debug(`Updated processing status for image ${imageId}: ${status}`);
    } catch (error) {
      this.logger.error(`Failed to update processing status for image ${imageId}:`, error);
      throw error;
    }
  }

  /**
   * 檢查 URL 是否已存在
   */
  public urlExists(originalUrl: string): boolean {
    const selectStmt = this.db.prepare('SELECT id FROM images WHERE original_url = ? LIMIT 1');
    try {
      const result = selectStmt.get(originalUrl);
      return !!result;
    } catch (error) {
      this.logger.error(`Failed to check URL existence: ${originalUrl}`, error);
      return false;
    }
  }

  /**
   * 獲取關鍵字統計
   */
  public getKeywordStats(keyword: string): { collected: number; target: number; progress: number } {
    const statsStmt = this.db.prepare(`
      SELECT 
        k.target_count,
        COUNT(i.id) as collected_count
      FROM keywords k
      LEFT JOIN images i ON k.keyword = i.keyword AND i.processing_status = 'completed'
      WHERE k.keyword = ?
      GROUP BY k.keyword, k.target_count
    `);

    try {
      const result = statsStmt.get(keyword) as { target_count: number; collected_count: number } | undefined;
      if (!result) {
        return { collected: 0, target: 0, progress: 0 };
      }
      
      const progress = result.target_count > 0 ? (result.collected_count / result.target_count) * 100 : 0;
      return {
        collected: result.collected_count,
        target: result.target_count,
        progress: Math.round(progress * 100) / 100
      };
    } catch (error) {
      this.logger.error(`Failed to get keyword stats for ${keyword}:`, error);
      return { collected: 0, target: 0, progress: 0 };
    }
  }

  /**
   * 獲取收集統計
   */
  public getCollectionStatistics(): CollectionStatistics {
    try {
      // 基本統計
      const basicStats = this.db.prepare(`
        SELECT 
          COUNT(*) as total_images,
          SUM(file_size) as total_size,
          AVG(file_size) as avg_size,
          AVG(relevance_score) as avg_relevance
        FROM images WHERE processing_status = 'completed'
      `).get() as { 
        total_images: number; 
        total_size: number; 
        avg_size: number; 
        avg_relevance: number; 
      };

      // 類別統計
      const categoryStats = this.db.prepare(`
        SELECT category, COUNT(*) as count
        FROM images WHERE processing_status = 'completed'
        GROUP BY category
      `).all() as { category: string; count: number }[];

      // 子類別統計  
      const subcategoryStats = this.db.prepare(`
        SELECT subcategory, COUNT(*) as count
        FROM images WHERE processing_status = 'completed'
        GROUP BY subcategory
      `).all() as { subcategory: string; count: number }[];

      // 處理狀態統計
      const statusStats = this.db.prepare(`
        SELECT processing_status, COUNT(*) as count
        FROM images GROUP BY processing_status
      `).all() as { processing_status: string; count: number }[];

      // 質量統計
      const qualityStats = this.db.prepare(`
        SELECT 
          AVG(jpeg_quality) as avg_quality,
          jpeg_quality,
          COUNT(*) as count
        FROM images 
        WHERE processing_status = 'completed' AND jpeg_quality IS NOT NULL
        GROUP BY jpeg_quality
      `).all() as { avg_quality: number; jpeg_quality: number; count: number }[];

      // 大小分佈
      const sizeStats = this.db.prepare(`
        SELECT 
          SUM(CASE WHEN file_size < 10240 THEN 1 ELSE 0 END) as under_10kb,
          SUM(CASE WHEN file_size >= 10240 AND file_size < 25600 THEN 1 ELSE 0 END) as under_25kb,
          SUM(CASE WHEN file_size >= 25600 AND file_size < 51200 THEN 1 ELSE 0 END) as under_50kb,
          SUM(CASE WHEN file_size >= 51200 THEN 1 ELSE 0 END) as over_50kb
        FROM images WHERE processing_status = 'completed'
      `).get() as { under_10kb: number; under_25kb: number; under_50kb: number; over_50kb: number };

      return {
        totalImages: basicStats?.total_images || 0,
        totalSizeBytes: basicStats?.total_size || 0,
        averageFileSizeBytes: basicStats?.avg_size || 0,
        averageRelevanceScore: basicStats?.avg_relevance || 0,
        categoryStats: Object.fromEntries(
          categoryStats.map(item => [item.category, item.count])
        ),
        subcategoryStats: Object.fromEntries(
          subcategoryStats.map(item => [item.subcategory, item.count])
        ),
        processingStatusStats: Object.fromEntries(
          statusStats.map(item => [item.processing_status, item.count])
        ),
        qualityStats: {
          averageQuality: qualityStats.length > 0 ? qualityStats[0].avg_quality : 0,
          qualityDistribution: Object.fromEntries(
            qualityStats.map(item => [item.jpeg_quality.toString(), item.count])
          )
        },
        sizeStats: {
          under10KB: sizeStats?.under_10kb || 0,
          under25KB: sizeStats?.under_25kb || 0,
          under50KB: sizeStats?.under_50kb || 0,
          over50KB: sizeStats?.over_50kb || 0
        }
      };
    } catch (error) {
      this.logger.error('Failed to get collection statistics:', error);
      throw error;
    }
  }

  /**
   * 獲取需要收集的關鍵字
   */
  public getIncompleteKeywords(): CharacterKeyword[] {
    const selectStmt = this.db.prepare(`
      SELECT 
        k.keyword, k.category, k.subcategory, k.target_count, k.relevance_score,
        COUNT(i.id) as collected_count
      FROM keywords k
      LEFT JOIN images i ON k.keyword = i.keyword AND i.processing_status = 'completed'
      GROUP BY k.keyword, k.category, k.subcategory, k.target_count, k.relevance_score
      HAVING collected_count < k.target_count
      ORDER BY (collected_count * 1.0 / k.target_count) ASC
    `);

    try {
      const results = selectStmt.all() as Array<{
        keyword: string;
        category: string;
        subcategory: string;
        target_count: number;
        relevance_score: number;
        collected_count: number;
      }>;

      return results.map(row => ({
        keyword: row.keyword,
        category: row.category,
        subcategory: row.subcategory,
        targetCount: row.target_count,
        relevanceScore: row.relevance_score
      }));
    } catch (error) {
      this.logger.error('Failed to get incomplete keywords:', error);
      throw error;
    }
  }

  /**
   * 關閉數據庫連接
   */
  public close(): void {
    try {
      this.db.close();
      this.logger.info('Database connection closed');
    } catch (error) {
      this.logger.error('Failed to close database connection:', error);
    }
  }
}