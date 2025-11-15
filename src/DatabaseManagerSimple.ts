import * as sqlite3 from 'sqlite3';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from './logger';

/**
 * Image record interface matching database schema
 */
export interface ImageRecord {
  id?: number;
  keyword: string;
  originalUrl: string;
  localPath: string;
  altText?: string;
  fileSize: number;
  width: number;
  height: number;
  format: string;
  collectedAt: Date;
  processedAt?: Date;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
}

/**
 * Collection statistics interface
 */
export interface CollectionStats {
  totalImages: number;
  totalSizeBytes: number;
  averageFileSizeBytes: number;
  keywordCounts: Record<string, number>;
  formatCounts: Record<string, number>;
  processingStatusCounts: Record<string, number>;
  collectionDateCounts: Record<string, number>;
}

/**
 * Database manager class for handling anime image collection data
 */
export class DatabaseManager {
  private db: sqlite3.Database;
  private logger: Logger;
  
  // Promisified methods
  private dbRun: (sql: string, params?: any[]) => Promise<sqlite3.RunResult>;
  private dbGet: (sql: string, params?: any[]) => Promise<any>;
  private dbAll: (sql: string, params?: any[]) => Promise<any[]>;

  constructor(dbPath: string = './data/images.db') {
    this.logger = new Logger();
    
    // Ensure directory exists
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Initialize database
    this.db = new sqlite3.Database(dbPath);
    
    // Promisify database methods
    this.dbRun = promisify(this.db.run.bind(this.db));
    this.dbGet = promisify(this.db.get.bind(this.db));
    this.dbAll = promisify(this.db.all.bind(this.db));
    
    this.initializeDatabase();
  }

  /**
   * Initialize database schema
   */
  private async initializeDatabase(): Promise<void> {
    const schema = `
      CREATE TABLE IF NOT EXISTS images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        keyword TEXT NOT NULL,
        original_url TEXT NOT NULL UNIQUE,
        local_path TEXT NOT NULL,
        alt_text TEXT,
        file_size INTEGER NOT NULL,
        width INTEGER NOT NULL,
        height INTEGER NOT NULL,
        format TEXT NOT NULL,
        collected_at TEXT NOT NULL,
        processed_at TEXT,
        processing_status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_keyword ON images(keyword);
      CREATE INDEX IF NOT EXISTS idx_status ON images(processing_status);
      CREATE INDEX IF NOT EXISTS idx_collected_at ON images(collected_at);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_original_url ON images(original_url);
    `;

    try {
      await this.dbRun(schema);
      this.logger.info('Database schema initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize database schema:', error);
      throw error;
    }
  }

  /**
   * Insert a new image record
   */
  public async insertImage(record: ImageRecord): Promise<number> {
    const sql = `
      INSERT INTO images (
        keyword, original_url, local_path, alt_text, file_size,
        width, height, format, collected_at, processed_at, processing_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      record.keyword,
      record.originalUrl,
      record.localPath,
      record.altText || null,
      record.fileSize,
      record.width,
      record.height,
      record.format,
      record.collectedAt.toISOString(),
      record.processedAt?.toISOString() || null,
      record.processingStatus
    ];

    try {
      const result = await this.dbRun(sql, params);
      const imageId = result.lastID!;
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
   * Insert multiple image records in a transaction
   */
  public async insertImages(records: ImageRecord[]): Promise<number[]> {
    const sql = `
      INSERT OR IGNORE INTO images (
        keyword, original_url, local_path, alt_text, file_size,
        width, height, format, collected_at, processed_at, processing_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    try {
      await this.dbRun('BEGIN TRANSACTION');
      const results: number[] = [];

      for (const record of records) {
        const params = [
          record.keyword,
          record.originalUrl,
          record.localPath,
          record.altText || null,
          record.fileSize,
          record.width,
          record.height,
          record.format,
          record.collectedAt.toISOString(),
          record.processedAt?.toISOString() || null,
          record.processingStatus
        ];

        const result = await this.dbRun(sql, params);
        results.push(result.lastID || -1);
      }

      await this.dbRun('COMMIT');
      this.logger.info(`Batch inserted ${results.length} image records`);
      return results;
    } catch (error) {
      await this.dbRun('ROLLBACK');
      this.logger.error('Failed to batch insert image records:', error);
      throw error;
    }
  }

  /**
   * Update image processing status
   */
  public async updateProcessingStatus(
    id: number,
    status: 'pending' | 'processing' | 'completed' | 'failed',
    processedAt?: Date
  ): Promise<void> {
    const sql = `
      UPDATE images 
      SET processing_status = ?, processed_at = ?
      WHERE id = ?
    `;

    const params = [
      status,
      processedAt?.toISOString() || null,
      id
    ];

    try {
      await this.dbRun(sql, params);
      this.logger.debug(`Updated processing status for image ${id}: ${status}`);
    } catch (error) {
      this.logger.error(`Failed to update processing status for image ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get images by keyword
   */
  public async getImagesByKeyword(keyword: string, limit: number = 100): Promise<ImageRecord[]> {
    const sql = `
      SELECT * FROM images 
      WHERE keyword = ? 
      ORDER BY collected_at DESC 
      LIMIT ?
    `;

    try {
      const rows = await this.dbAll(sql, [keyword, limit]);
      return rows.map(this.mapRowToRecord);
    } catch (error) {
      this.logger.error(`Failed to get images for keyword ${keyword}:`, error);
      throw error;
    }
  }

  /**
   * Get images by processing status
   */
  public async getImagesByStatus(
    status: 'pending' | 'processing' | 'completed' | 'failed',
    limit: number = 100
  ): Promise<ImageRecord[]> {
    const sql = `
      SELECT * FROM images 
      WHERE processing_status = ? 
      ORDER BY collected_at DESC 
      LIMIT ?
    `;

    try {
      const rows = await this.dbAll(sql, [status, limit]);
      return rows.map(this.mapRowToRecord);
    } catch (error) {
      this.logger.error(`Failed to get images with status ${status}:`, error);
      throw error;
    }
  }

  /**
   * Get collection statistics
   */
  public async getCollectionStatistics(): Promise<CollectionStats> {
    try {
      // Basic stats
      const basicStats = await this.dbGet(`
        SELECT 
          COUNT(*) as total_images,
          SUM(file_size) as total_size,
          AVG(file_size) as avg_size
        FROM images
      `) as { total_images: number; total_size: number; avg_size: number };

      // Keyword distribution
      const keywordStats = await this.dbAll(`
        SELECT keyword, COUNT(*) as count
        FROM images
        GROUP BY keyword
        ORDER BY count DESC
      `) as { keyword: string; count: number }[];

      // Format distribution
      const formatStats = await this.dbAll(`
        SELECT format, COUNT(*) as count
        FROM images
        GROUP BY format
      `) as { format: string; count: number }[];

      // Status distribution
      const statusStats = await this.dbAll(`
        SELECT processing_status, COUNT(*) as count
        FROM images
        GROUP BY processing_status
      `) as { processing_status: string; count: number }[];

      // Date distribution
      const dateStats = await this.dbAll(`
        SELECT DATE(collected_at) as date, COUNT(*) as count
        FROM images
        GROUP BY DATE(collected_at)
        ORDER BY date DESC
      `) as { date: string; count: number }[];

      return {
        totalImages: basicStats?.total_images || 0,
        totalSizeBytes: basicStats?.total_size || 0,
        averageFileSizeBytes: basicStats?.avg_size || 0,
        keywordCounts: Object.fromEntries(
          keywordStats.map(item => [item.keyword, item.count])
        ),
        formatCounts: Object.fromEntries(
          formatStats.map(item => [item.format, item.count])
        ),
        processingStatusCounts: Object.fromEntries(
          statusStats.map(item => [item.processing_status, item.count])
        ),
        collectionDateCounts: Object.fromEntries(
          dateStats.map(item => [item.date, item.count])
        )
      };
    } catch (error) {
      this.logger.error('Failed to get collection statistics:', error);
      throw error;
    }
  }

  /**
   * Get total image count
   */
  public async getImageCount(): Promise<number> {
    try {
      const result = await this.dbGet('SELECT COUNT(*) as count FROM images') as { count: number };
      return result?.count || 0;
    } catch (error) {
      this.logger.error('Failed to get image count:', error);
      throw error;
    }
  }

  /**
   * Check if image URL already exists
   */
  public async imageExists(originalUrl: string): Promise<boolean> {
    try {
      const result = await this.dbGet(
        'SELECT id FROM images WHERE original_url = ? LIMIT 1',
        [originalUrl]
      );
      return !!result;
    } catch (error) {
      this.logger.error(`Failed to check if image exists: ${originalUrl}`, error);
      return false;
    }
  }

  /**
   * Map database row to ImageRecord
   */
  private mapRowToRecord(row: any): ImageRecord {
    return {
      id: row.id,
      keyword: row.keyword,
      originalUrl: row.original_url,
      localPath: row.local_path,
      altText: row.alt_text,
      fileSize: row.file_size,
      width: row.width,
      height: row.height,
      format: row.format,
      collectedAt: new Date(row.collected_at),
      processedAt: row.processed_at ? new Date(row.processed_at) : undefined,
      processingStatus: row.processing_status
    };
  }

  /**
   * Close database connection
   */
  public async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          this.logger.error('Failed to close database:', err);
          reject(err);
        } else {
          this.logger.info('Database connection closed');
          resolve();
        }
      });
    });
  }
}