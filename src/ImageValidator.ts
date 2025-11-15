/**
 * 圖片驗證工具 - 檢測圖片是否包含完整人物角色
 */

import * as fs from 'fs';
import * as path from 'path';
import { Logger } from './logger';

export interface ValidationResult {
  isValid: boolean;
  confidence: number;
  reason: string;
  suggestions?: string[];
}

export class ImageValidator {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('ImageValidator');
  }

  /**
   * 驗證圖片文件名和相關信息
   */
  async validateImageFile(
    imagePath: string, 
    metadata: {
      altText?: string;
      url?: string;
      keyword?: string;
    }
  ): Promise<ValidationResult> {
    
    const filename = path.basename(imagePath).toLowerCase();
    const altText = (metadata.altText || '').toLowerCase();
    const url = (metadata.url || '').toLowerCase();
    
    // 檢查是否為僅衣服/物品的圖片
    const clothingOnlyResult = this.checkClothingOnly(filename, altText, url);
    if (!clothingOnlyResult.isValid) {
      return clothingOnlyResult;
    }
    
    // 檢查是否包含人物指示
    const characterResult = this.checkCharacterPresence(filename, altText, url);
    if (!characterResult.isValid) {
      return characterResult;
    }
    
    // 檢查圖片文件完整性
    const fileResult = this.checkFileIntegrity(imagePath);
    if (!fileResult.isValid) {
      return fileResult;
    }
    
    return {
      isValid: true,
      confidence: 0.85,
      reason: 'Image appears to contain a valid anime character'
    };
  }

  /**
   * 檢查是否為僅衣服/物品圖片
   */
  private checkClothingOnly(filename: string, altText: string, url: string): ValidationResult {
    const clothingOnlyIndicators = [
      // 明確的僅衣服指示
      'outfit only', 'clothing only', 'costume only', 'dress only',
      'uniform only', 'outfit without', 'clothing without',
      'just outfit', 'just clothing', 'just costume',
      'empty outfit', 'empty costume', 'empty dress',
      
      // 設計/圖案相關
      'outfit design', 'clothing design', 'costume design',
      'pattern', 'texture', 'fabric', 'material',
      'template', 'layout', 'blueprint',
      
      // 展示相關
      'mannequin', 'hanger', 'display', 'showcase',
      'flat lay', 'product shot', 'catalog',
      
      // 無人物指示
      'no character', 'no person', 'no figure',
      'clothing item', 'fashion item', 'accessory only'
    ];
    
    const allText = `${filename} ${altText} ${url}`;
    
    for (const indicator of clothingOnlyIndicators) {
      if (allText.includes(indicator)) {
        return {
          isValid: false,
          confidence: 0.9,
          reason: `Detected clothing-only image: "${indicator}"`,
          suggestions: [
            'Use keywords that emphasize character presence',
            'Add "character" or "person" to search terms',
            'Filter out design/pattern-only results'
          ]
        };
      }
    }
    
    return { isValid: true, confidence: 0.7, reason: 'No clothing-only indicators found' };
  }

  /**
   * 檢查是否包含人物角色指示
   */
  private checkCharacterPresence(filename: string, altText: string, url: string): ValidationResult {
    const characterIndicators = [
      // 明確的人物指示
      'character', 'person', 'people', 'human', 'figure',
      'girl', 'boy', 'woman', 'man', 'child',
      
      // 身體部位 (表示有人物)
      'face', 'portrait', 'body', 'full body',
      'head', 'hair', 'eyes', 'skin', 'hand',
      
      // 動作/姿勢 (表示有人物)
      'standing', 'sitting', 'pose', 'posing',
      'walking', 'running', 'dancing', 'fighting',
      
      // 表情 (表示有人物)
      'smile', 'smiling', 'expression', 'face',
      'happy', 'sad', 'angry', 'surprised',
      
      // 動漫特定人物詞彙
      'anime girl', 'anime boy', 'anime character',
      'manga character', 'waifu', 'husbando',
      'protagonist', 'hero', 'heroine'
    ];
    
    const allText = `${filename} ${altText} ${url}`;
    let foundIndicators = 0;
    const matchedIndicators: string[] = [];
    
    for (const indicator of characterIndicators) {
      if (allText.includes(indicator)) {
        foundIndicators++;
        matchedIndicators.push(indicator);
      }
    }
    
    if (foundIndicators === 0) {
      return {
        isValid: false,
        confidence: 0.8,
        reason: 'No character presence indicators found',
        suggestions: [
          'Add character-specific keywords to search',
          'Include terms like "character", "person", or "figure"',
          'Use more specific character descriptions'
        ]
      };
    }
    
    const confidence = Math.min(0.6 + (foundIndicators * 0.1), 0.95);
    
    return {
      isValid: true,
      confidence,
      reason: `Found ${foundIndicators} character indicators: ${matchedIndicators.slice(0, 3).join(', ')}`
    };
  }

  /**
   * 檢查文件完整性
   */
  private checkFileIntegrity(imagePath: string): ValidationResult {
    try {
      if (!fs.existsSync(imagePath)) {
        return {
          isValid: false,
          confidence: 1.0,
          reason: 'Image file does not exist'
        };
      }
      
      const stats = fs.statSync(imagePath);
      
      // 檢查文件大小 (太小可能是損壞的)
      if (stats.size < 1000) { // 小於 1KB
        return {
          isValid: false,
          confidence: 0.9,
          reason: 'Image file is too small (possibly corrupted)'
        };
      }
      
      // 檢查文件擴展名
      const ext = path.extname(imagePath).toLowerCase();
      const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
      
      if (!validExtensions.includes(ext)) {
        return {
          isValid: false,
          confidence: 0.85,
          reason: `Invalid image extension: ${ext}`
        };
      }
      
      return {
        isValid: true,
        confidence: 0.9,
        reason: 'File integrity check passed'
      };
      
    } catch (error) {
      return {
        isValid: false,
        confidence: 0.95,
        reason: `File access error: ${error}`
      };
    }
  }

  /**
   * 批量驗證目錄中的圖片
   */
  async validateDirectory(dirPath: string): Promise<{
    totalImages: number;
    validImages: number;
    invalidImages: { path: string; reason: string }[];
    validationResults: { path: string; result: ValidationResult }[];
  }> {
    
    const results = {
      totalImages: 0,
      validImages: 0,
      invalidImages: [] as { path: string; reason: string }[],
      validationResults: [] as { path: string; result: ValidationResult }[]
    };
    
    if (!fs.existsSync(dirPath)) {
      this.logger.warn(`Directory does not exist: ${dirPath}`);
      return results;
    }
    
    const files = fs.readdirSync(dirPath);
    const imageFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
    });
    
    results.totalImages = imageFiles.length;
    
    for (const file of imageFiles) {
      const filePath = path.join(dirPath, file);
      const validationResult = await this.validateImageFile(filePath, {
        altText: file, // 使用文件名作為 alt text
        url: filePath
      });
      
      results.validationResults.push({
        path: filePath,
        result: validationResult
      });
      
      if (validationResult.isValid) {
        results.validImages++;
      } else {
        results.invalidImages.push({
          path: filePath,
          reason: validationResult.reason
        });
      }
    }
    
    this.logger.info(`Validation complete: ${results.validImages}/${results.totalImages} images valid`);
    
    return results;
  }
}