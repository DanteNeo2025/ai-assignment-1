/**
 * Configuration for the anime character image collection system
 */
export interface AppConfig {
  // Target collection settings
  targetImageCount: {
    min: number;
    max: number;
  };
  
  // Image processing settings
  imageProcessing: {
    maxWidth: number;
    maxHeight: number;
    quality: {
      min: number;
      max: number;
    };
    maxFileSize: number; // in bytes
    format: 'jpeg' | 'png' | 'webp';
  };
  
  // Scraping settings
  scraping: {
    headless: boolean;
    delay: number; // milliseconds between requests
    timeout: number; // request timeout
    maxImagesPerKeyword: number;
    userAgent: string;
  };
  
  // File paths
  paths: {
    rawImages: string;
    processedImages: string;
    database: string;
    logs: string;
  };
  
  // Keyword categories and weights
  keywordCategories: KeywordCategory[];
}

/**
 * Keyword category with associated search terms and metadata
 */
export interface KeywordCategory {
  name: string;
  description: string;
  weight: number; // Higher weight = more images collected for this category
  keywords: KeywordEntry[];
}

/**
 * Individual keyword entry with search variations
 */
export interface KeywordEntry {
  primary: string; // Main search term
  variations: string[]; // Alternative search terms
  expectedResults: number; // Expected number of quality results
  category: string; // Gender, profession, etc.
}

/**
 * Default application configuration
 */
export const DEFAULT_CONFIG: AppConfig = {
  targetImageCount: {
    min: 3000,
    max: 5000
  },
  
  imageProcessing: {
    maxWidth: 500,
    maxHeight: 500,
    quality: {
      min: 50,
      max: 80
    },
    maxFileSize: 50 * 1024, // 50KB
    format: 'jpeg'
  },
  
  scraping: {
    headless: true,
    delay: 1000,
    timeout: 30000,
    maxImagesPerKeyword: 150,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
  },
  
  paths: {
    rawImages: './images/raw',
    processedImages: './images/processed',
    database: './database/images.db',
    logs: './logs'
  },
  
  keywordCategories: [
    // Male Characters
    {
      name: 'Male Characters',
      description: 'Male anime and human characters of various types',
      weight: 2,
      keywords: [
        {
          primary: 'anime male character',
          variations: ['anime boy', 'manga male character', 'anime man'],
          expectedResults: 200,
          category: 'male'
        },
        {
          primary: 'anime warrior male',
          variations: ['anime soldier boy', 'anime fighter male', 'anime knight character'],
          expectedResults: 150,
          category: 'male_warrior'
        },
        {
          primary: 'anime student boy',
          variations: ['anime school boy', 'anime teenage male', 'high school anime boy'],
          expectedResults: 180,
          category: 'male_student'
        },
        {
          primary: 'anime businessman male',
          variations: ['anime office worker male', 'anime suit character male', 'professional anime man'],
          expectedResults: 100,
          category: 'male_professional'
        },
        {
          primary: 'anime wizard male',
          variations: ['anime mage boy', 'anime sorcerer male', 'anime magic user male'],
          expectedResults: 120,
          category: 'male_magical'
        }
      ]
    },
    
    // Female Characters
    {
      name: 'Female Characters',
      description: 'Female anime and human characters of various types',
      weight: 2,
      keywords: [
        {
          primary: 'anime female character',
          variations: ['anime girl', 'manga female character', 'anime woman'],
          expectedResults: 200,
          category: 'female'
        },
        {
          primary: 'anime warrior female',
          variations: ['anime soldier girl', 'anime fighter female', 'anime knight girl'],
          expectedResults: 150,
          category: 'female_warrior'
        },
        {
          primary: 'anime student girl',
          variations: ['anime school girl', 'anime teenage female', 'high school anime girl'],
          expectedResults: 180,
          category: 'female_student'
        },
        {
          primary: 'anime businesswoman',
          variations: ['anime office worker female', 'anime suit character female', 'professional anime woman'],
          expectedResults: 100,
          category: 'female_professional'
        },
        {
          primary: 'anime witch female',
          variations: ['anime mage girl', 'anime sorceress', 'anime magic user female'],
          expectedResults: 120,
          category: 'female_magical'
        }
      ]
    },
    
    // Professional Characters
    {
      name: 'Professional Characters',
      description: 'Characters representing various professions and occupations',
      weight: 1.5,
      keywords: [
        {
          primary: 'anime doctor character',
          variations: ['anime physician', 'anime medical professional', 'anime nurse character'],
          expectedResults: 80,
          category: 'medical'
        },
        {
          primary: 'anime teacher character',
          variations: ['anime professor', 'anime educator', 'anime instructor'],
          expectedResults: 90,
          category: 'education'
        },
        {
          primary: 'anime chef character',
          variations: ['anime cook', 'anime culinary character', 'anime restaurant worker'],
          expectedResults: 70,
          category: 'culinary'
        },
        {
          primary: 'anime police officer',
          variations: ['anime cop character', 'anime law enforcement', 'anime detective'],
          expectedResults: 85,
          category: 'law_enforcement'
        },
        {
          primary: 'anime engineer character',
          variations: ['anime scientist', 'anime technician', 'anime researcher'],
          expectedResults: 75,
          category: 'technical'
        },
        {
          primary: 'anime artist character',
          variations: ['anime painter', 'anime creative character', 'anime designer'],
          expectedResults: 80,
          category: 'creative'
        }
      ]
    },
    
    // Fantasy Characters
    {
      name: 'Fantasy Characters',
      description: 'Fantasy and supernatural character types',
      weight: 1.5,
      keywords: [
        {
          primary: 'anime elf character',
          variations: ['anime elven character', 'anime fantasy elf', 'anime woodland character'],
          expectedResults: 100,
          category: 'fantasy_elf'
        },
        {
          primary: 'anime demon character',
          variations: ['anime devil character', 'anime dark character', 'anime supernatural being'],
          expectedResults: 90,
          category: 'fantasy_demon'
        },
        {
          primary: 'anime angel character',
          variations: ['anime heavenly character', 'anime winged character', 'anime celestial being'],
          expectedResults: 95,
          category: 'fantasy_angel'
        },
        {
          primary: 'anime vampire character',
          variations: ['anime vampire lord', 'anime undead character', 'anime gothic character'],
          expectedResults: 85,
          category: 'fantasy_vampire'
        },
        {
          primary: 'anime dragon character',
          variations: ['anime dragon humanoid', 'anime reptilian character', 'anime scaled character'],
          expectedResults: 70,
          category: 'fantasy_dragon'
        }
      ]
    },
    
    // Age-based Characters
    {
      name: 'Age-based Characters',
      description: 'Characters of different age groups',
      weight: 1,
      keywords: [
        {
          primary: 'anime child character',
          variations: ['anime kid character', 'anime young character', 'anime chibi character'],
          expectedResults: 120,
          category: 'child'
        },
        {
          primary: 'anime teenager character',
          variations: ['anime teen character', 'anime adolescent', 'anime youth character'],
          expectedResults: 150,
          category: 'teenager'
        },
        {
          primary: 'anime adult character',
          variations: ['anime mature character', 'anime grown-up', 'anime middle-aged character'],
          expectedResults: 130,
          category: 'adult'
        },
        {
          primary: 'anime elderly character',
          variations: ['anime old character', 'anime senior character', 'anime aged character'],
          expectedResults: 60,
          category: 'elderly'
        }
      ]
    },
    
    // Style-based Characters
    {
      name: 'Style-based Characters',
      description: 'Characters with specific visual styles and aesthetics',
      weight: 1,
      keywords: [
        {
          primary: 'anime cyberpunk character',
          variations: ['anime futuristic character', 'anime tech character', 'anime cyber character'],
          expectedResults: 80,
          category: 'cyberpunk'
        },
        {
          primary: 'anime steampunk character',
          variations: ['anime victorian character', 'anime retro-futuristic', 'anime mechanical character'],
          expectedResults: 70,
          category: 'steampunk'
        },
        {
          primary: 'anime gothic character',
          variations: ['anime dark aesthetic', 'anime black clothing', 'anime mysterious character'],
          expectedResults: 85,
          category: 'gothic'
        },
        {
          primary: 'anime casual character',
          variations: ['anime everyday clothing', 'anime modern character', 'anime street clothes'],
          expectedResults: 110,
          category: 'casual'
        },
        {
          primary: 'anime formal character',
          variations: ['anime elegant character', 'anime dressed up', 'anime fancy clothing'],
          expectedResults: 90,
          category: 'formal'
        }
      ]
    }
  ]
};

/**
 * Utility functions for working with keywords
 */
export class KeywordUtils {
  /**
   * Get all keywords from all categories
   */
  static getAllKeywords(config: AppConfig = DEFAULT_CONFIG): KeywordEntry[] {
    return config.keywordCategories.flatMap(category => category.keywords);
  }
  
  /**
   * Get keywords by category name
   */
  static getKeywordsByCategory(categoryName: string, config: AppConfig = DEFAULT_CONFIG): KeywordEntry[] {
    const category = config.keywordCategories.find(cat => cat.name === categoryName);
    return category ? category.keywords : [];
  }
  
  /**
   * Get all search terms (primary + variations) for a keyword
   */
  static getAllSearchTerms(keyword: KeywordEntry): string[] {
    return [keyword.primary, ...keyword.variations];
  }
  
  /**
   * Calculate total expected images for a category
   */
  static getCategoryExpectedTotal(category: KeywordCategory): number {
    return category.keywords.reduce((total, keyword) => total + keyword.expectedResults, 0);
  }
  
  /**
   * Calculate total expected images across all categories
   */
  static getTotalExpectedImages(config: AppConfig = DEFAULT_CONFIG): number {
    return config.keywordCategories.reduce((total, category) => {
      return total + (this.getCategoryExpectedTotal(category) * category.weight);
    }, 0);
  }
  
  /**
   * Get weighted keyword distribution for balanced collection
   */
  static getWeightedKeywordDistribution(
    targetTotal: number, 
    config: AppConfig = DEFAULT_CONFIG
  ): Array<{ keyword: KeywordEntry; targetCount: number; category: string }> {
    const totalWeight = config.keywordCategories.reduce((sum, cat) => sum + cat.weight, 0);
    const distribution: Array<{ keyword: KeywordEntry; targetCount: number; category: string }> = [];
    
    for (const category of config.keywordCategories) {
      const categoryTarget = Math.floor((targetTotal * category.weight) / totalWeight);
      const keywordTarget = Math.floor(categoryTarget / category.keywords.length);
      
      for (const keyword of category.keywords) {
        distribution.push({
          keyword,
          targetCount: keywordTarget,
          category: category.name
        });
      }
    }
    
    return distribution;
  }
  
  /**
   * Validate configuration
   */
  static validateConfig(config: AppConfig): string[] {
    const errors: string[] = [];
    
    if (config.targetImageCount.min >= config.targetImageCount.max) {
      errors.push('Minimum target count must be less than maximum');
    }
    
    if (config.keywordCategories.length === 0) {
      errors.push('At least one keyword category is required');
    }
    
    for (const category of config.keywordCategories) {
      if (category.keywords.length === 0) {
        errors.push(`Category "${category.name}" has no keywords`);
      }
      
      if (category.weight <= 0) {
        errors.push(`Category "${category.name}" has invalid weight`);
      }
    }
    
    if (config.imageProcessing.quality.min >= config.imageProcessing.quality.max) {
      errors.push('Minimum quality must be less than maximum quality');
    }
    
    return errors;
  }
}