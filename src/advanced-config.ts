/**
 * 高精度動漫角色關鍵字配置
 * 設計用於獲得90%以上相關圖像的精確搜索
 */

export interface CharacterKeyword {
  keyword: string;
  category: string;
  subcategory: string;
  targetCount: number;
  relevanceScore: number; // 預期相關度 (0.9+ for 90%+)
}

export interface CategoryConfig {
  name: string;
  folder: string;
  description: string;
  keywords: CharacterKeyword[];
}

export const ANIME_CHARACTER_CATEGORIES: CategoryConfig[] = [
  // 女性角色 - 學生類
  {
    name: "Female Students",
    folder: "female/students",
    description: "女學生動漫角色",
    keywords: [
      { keyword: "anime schoolgirl character uniform", category: "female", subcategory: "student", targetCount: 200, relevanceScore: 0.95 },
      { keyword: "anime girl student character sailor", category: "female", subcategory: "student", targetCount: 150, relevanceScore: 0.92 },
      { keyword: "anime high school girl character", category: "female", subcategory: "student", targetCount: 150, relevanceScore: 0.94 },
      { keyword: "anime student girl figure backpack", category: "female", subcategory: "student", targetCount: 100, relevanceScore: 0.90 }
    ]
  },
  
  // 女性角色 - 戰士/冒險者
  {
    name: "Female Warriors",
    folder: "female/warriors",
    description: "女戰士/冒險者角色",
    keywords: [
      { keyword: "anime girl warrior character armor", category: "female", subcategory: "warrior", targetCount: 200, relevanceScore: 0.93 },
      { keyword: "anime female knight character armor", category: "female", subcategory: "warrior", targetCount: 150, relevanceScore: 0.94 },
      { keyword: "anime girl adventurer character fantasy", category: "female", subcategory: "warrior", targetCount: 150, relevanceScore: 0.91 },
      { keyword: "anime female paladin character holy", category: "female", subcategory: "warrior", targetCount: 100, relevanceScore: 0.90 }
    ]
  },

  // 女性角色 - 魔法師
  {
    name: "Female Mages",
    folder: "female/mages",
    description: "女魔法師角色",
    keywords: [
      { keyword: "anime girl wizard staff magic", category: "female", subcategory: "mage", targetCount: 200, relevanceScore: 0.94 },
      { keyword: "anime female mage robe hat", category: "female", subcategory: "mage", targetCount: 150, relevanceScore: 0.93 },
      { keyword: "anime girl witch magic circle", category: "female", subcategory: "mage", targetCount: 150, relevanceScore: 0.92 },
      { keyword: "anime sorceress spell casting", category: "female", subcategory: "mage", targetCount: 100, relevanceScore: 0.90 }
    ]
  },

  // 女性角色 - 現代職業
  {
    name: "Female Professionals", 
    folder: "female/professionals",
    description: "現代職業女性角色",
    keywords: [
      { keyword: "anime girl office worker suit", category: "female", subcategory: "professional", targetCount: 150, relevanceScore: 0.92 },
      { keyword: "anime female doctor coat", category: "female", subcategory: "professional", targetCount: 120, relevanceScore: 0.91 },
      { keyword: "anime girl nurse uniform", category: "female", subcategory: "professional", targetCount: 150, relevanceScore: 0.95 },
      { keyword: "anime female teacher classroom", category: "female", subcategory: "professional", targetCount: 100, relevanceScore: 0.90 }
    ]
  },

  // 男性角色 - 學生類
  {
    name: "Male Students",
    folder: "male/students", 
    description: "男學生動漫角色",
    keywords: [
      { keyword: "anime schoolboy uniform male", category: "male", subcategory: "student", targetCount: 150, relevanceScore: 0.93 },
      { keyword: "anime boy school uniform tie", category: "male", subcategory: "student", targetCount: 150, relevanceScore: 0.94 },
      { keyword: "anime male high school student", category: "male", subcategory: "student", targetCount: 120, relevanceScore: 0.92 },
      { keyword: "anime boy student bag uniform", category: "male", subcategory: "student", targetCount: 100, relevanceScore: 0.90 }
    ]
  },

  // 男性角色 - 戰士/冒險者
  {
    name: "Male Warriors",
    folder: "male/warriors",
    description: "男戰士/冒險者角色", 
    keywords: [
      { keyword: "anime boy warrior character sword", category: "male", subcategory: "warrior", targetCount: 200, relevanceScore: 0.94 },
      { keyword: "anime male knight character armor", category: "male", subcategory: "warrior", targetCount: 150, relevanceScore: 0.93 },
      { keyword: "anime boy adventurer character fantasy", category: "male", subcategory: "warrior", targetCount: 150, relevanceScore: 0.91 },
      { keyword: "anime male samurai character katana", category: "male", subcategory: "warrior", targetCount: 120, relevanceScore: 0.95 }
    ]
  },

  // 男性角色 - 魔法師
  {
    name: "Male Mages",
    folder: "male/mages",
    description: "男魔法師角色",
    keywords: [
      { keyword: "anime boy wizard staff magic", category: "male", subcategory: "mage", targetCount: 150, relevanceScore: 0.92 },
      { keyword: "anime male mage robe magic", category: "male", subcategory: "mage", targetCount: 120, relevanceScore: 0.91 },
      { keyword: "anime boy sorcerer spell", category: "male", subcategory: "mage", targetCount: 120, relevanceScore: 0.90 },
      { keyword: "anime male warlock dark magic", category: "male", subcategory: "mage", targetCount: 100, relevanceScore: 0.90 }
    ]
  },

  // 男性角色 - 現代職業
  {
    name: "Male Professionals",
    folder: "male/professionals", 
    description: "現代職業男性角色",
    keywords: [
      { keyword: "anime boy office worker suit", category: "male", subcategory: "professional", targetCount: 120, relevanceScore: 0.91 },
      { keyword: "anime male doctor white coat", category: "male", subcategory: "professional", targetCount: 100, relevanceScore: 0.92 },
      { keyword: "anime boy businessman tie", category: "male", subcategory: "professional", targetCount: 100, relevanceScore: 0.90 },
      { keyword: "anime male chef uniform", category: "male", subcategory: "professional", targetCount: 80, relevanceScore: 0.93 }
    ]
  },

  // 特殊角色類型
  {
    name: "Special Characters",
    folder: "special",
    description: "特殊類型角色",
    keywords: [
      { keyword: "anime catgirl nekomimi ears", category: "special", subcategory: "catgirl", targetCount: 200, relevanceScore: 0.96 },
      { keyword: "anime angel girl character wings", category: "special", subcategory: "angel", targetCount: 150, relevanceScore: 0.94 },
      { keyword: "anime demon girl character horns", category: "special", subcategory: "demon", targetCount: 150, relevanceScore: 0.93 },
      { keyword: "anime elf girl character ears", category: "special", subcategory: "elf", targetCount: 150, relevanceScore: 0.95 }
    ]
  }
];

export const COLLECTION_CONFIG = {
  totalTargetImages: 4000,
  imageSize: { width: 500, height: 500 },
  jpegQuality: { min: 50, max: 80 },
  maxFileSize: 50000, // 50KB
  batchSize: 50,
  scrollDelay: 2000,
  downloadDelay: 500,
  maxImagesPerKeyword: 200
};

/**
 * 獲取所有關鍵字的平面列表
 */
export function getAllKeywords(): CharacterKeyword[] {
  return ANIME_CHARACTER_CATEGORIES.flatMap(category => category.keywords);
}

/**
 * 根據類別獲取關鍵字
 */
export function getKeywordsByCategory(categoryName: string): CharacterKeyword[] {
  const category = ANIME_CHARACTER_CATEGORIES.find(cat => cat.name === categoryName);
  return category ? category.keywords : [];
}

/**
 * 獲取高相關度關鍵字 (90%+)
 */
export function getHighRelevanceKeywords(): CharacterKeyword[] {
  return getAllKeywords().filter(keyword => keyword.relevanceScore >= 0.90);
}

/**
 * 計算總目標圖片數量
 */
export function getTotalTargetCount(): number {
  return getAllKeywords().reduce((total, keyword) => total + keyword.targetCount, 0);
}
