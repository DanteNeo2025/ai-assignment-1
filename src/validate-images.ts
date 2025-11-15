#!/usr/bin/env node

/**
 * 圖片驗證腳本 - 檢查已下載的圖片是否符合人物角色要求
 */

import * as path from 'path';
import * as fs from 'fs';
import { ImageValidator } from './ImageValidator';
import { Logger } from './logger';

async function main() {
  const logger = new Logger('ImageValidation');
  const validator = new ImageValidator();
  
  console.log('🔍 開始驗證已下載的動漫角色圖片...\n');
  
  // 檢查 raw_images 目錄
  const rawImagesDir = './raw_images';
  
  if (!fs.existsSync(rawImagesDir)) {
    console.log('❌ raw_images 目錄不存在');
    return;
  }
  
  // 統計信息
  let totalImages = 0;
  let validImages = 0;
  let invalidImages = 0;
  const invalidReasons: { [key: string]: number } = {};
  
  // 遍歷所有分類目錄
  const categories = ['female', 'male', 'special'];
  
  for (const category of categories) {
    const categoryPath = path.join(rawImagesDir, category);
    
    if (!fs.existsSync(categoryPath)) {
      console.log(`⚠️  分類目錄不存在: ${category}`);
      continue;
    }
    
    console.log(`\n📁 檢查分類: ${category.toUpperCase()}`);
    
    const subcategories = fs.readdirSync(categoryPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    
    for (const subcategory of subcategories) {
      const subcategoryPath = path.join(categoryPath, subcategory);
      
      console.log(`  📂 檢查子分類: ${subcategory}`);
      
      const validationResult = await validator.validateDirectory(subcategoryPath);
      
      totalImages += validationResult.totalImages;
      validImages += validationResult.validImages;
      invalidImages += validationResult.invalidImages.length;
      
      // 統計無效原因
      for (const invalid of validationResult.invalidImages) {
        const reason = invalid.reason;
        invalidReasons[reason] = (invalidReasons[reason] || 0) + 1;
      }
      
      // 顯示結果
      const validPercentage = validationResult.totalImages > 0 
        ? Math.round((validationResult.validImages / validationResult.totalImages) * 100)
        : 0;
        
      console.log(`    ✅ 有效圖片: ${validationResult.validImages}/${validationResult.totalImages} (${validPercentage}%)`);
      
      // 顯示無效圖片的詳細信息
      if (validationResult.invalidImages.length > 0) {
        console.log(`    ❌ 無效圖片:`);
        for (const invalid of validationResult.invalidImages.slice(0, 5)) { // 只顯示前5個
          const filename = path.basename(invalid.path);
          console.log(`      - ${filename}: ${invalid.reason}`);
        }
        if (validationResult.invalidImages.length > 5) {
          console.log(`      ... 還有 ${validationResult.invalidImages.length - 5} 個無效圖片`);
        }
      }
    }
  }
  
  // 總結報告
  console.log('\n' + '='.repeat(60));
  console.log('📊 驗證總結報告');
  console.log('='.repeat(60));
  
  const totalValidPercentage = totalImages > 0 
    ? Math.round((validImages / totalImages) * 100)
    : 0;
    
  console.log(`總圖片數量: ${totalImages}`);
  console.log(`有效圖片: ${validImages} (${totalValidPercentage}%)`);
  console.log(`無效圖片: ${invalidImages} (${100 - totalValidPercentage}%)`);
  
  if (Object.keys(invalidReasons).length > 0) {
    console.log('\n❌ 無效原因統計:');
    for (const [reason, count] of Object.entries(invalidReasons)) {
      const percentage = Math.round((count / invalidImages) * 100);
      console.log(`  - ${reason}: ${count} 張 (${percentage}%)`);
    }
  }
  
  // 建議改進
  console.log('\n💡 改進建議:');
  
  if (totalValidPercentage < 80) {
    console.log('  🔧 相關性過低，建議：');
    console.log('     - 改進關鍵字，加入更多人物特徵詞彙');
    console.log('     - 提高相關性閾值篩選');
    console.log('     - 增加人物檢測邏輯');
  }
  
  if (invalidReasons['No character presence indicators found']) {
    console.log('  👤 缺少人物指示，建議：');
    console.log('     - 在關鍵字中添加 "character", "person", "figure"');
    console.log('     - 使用更具體的人物描述詞彙');
  }
  
  if (invalidReasons['Detected clothing-only image']) {
    console.log('  👕 發現僅衣服圖片，建議：');
    console.log('     - 在搜索中排除 "outfit only", "clothing design" 等詞彙');
    console.log('     - 強化人物存在的關鍵字');
  }
  
  console.log('\n✨ 驗證完成！');
  
  // 如果有很多無效圖片，建議清理
  if (totalValidPercentage < 70) {
    console.log('\n🗑️  建議清理無效圖片以節省空間和提高質量');
    console.log('   可以運行: npm run clean-invalid-images');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { main as validateImages };