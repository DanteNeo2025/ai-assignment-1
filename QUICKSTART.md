# Quick Start Guide

## 🚀 Getting Started

### 1. Prerequisites
Ensure you have the following installed:
- **Node.js 18+** (Download from [nodejs.org](https://nodejs.org/))
- **Git** (for cloning the repository)
- **Chrome/Chromium** browser (for Playwright automation)

### 2. Installation

```bash
# Clone the repository
git clone <repository-url>
cd anime-character-image-collector

# Install dependencies
npm install

# Install Playwright browsers (required for web scraping)
npx playwright install chromium

# Build the TypeScript project
npm run build
```

### 3. Configuration (Optional)

Copy the example environment file and customize if needed:
```bash
cp .env.example .env
# Edit .env with your preferred settings
```

### 4. Run the Application

```bash
# Start the collection process
npm start

# Or run in development mode with more detailed logging
npm run dev
```

## 📊 Expected Results

The application will:
1. **Search and collect** 3,000-5,000 anime character images
2. **Process each image** to 500x500 pixels, <50KB JPEG
3. **Store metadata** in SQLite database with URLs and alt text
4. **Organize files** in structured directories
5. **Generate reports** with collection statistics

### Sample Output Structure:
```
anime-character-image-collector/
├── images/
│   ├── raw/           # Original downloaded images
│   └── processed/     # Resized and compressed images
├── database/
│   └── images.db      # SQLite database with metadata
└── logs/
    ├── app.log        # Application logs
    └── collection_report_*.json  # Final statistics
```

## 🎯 Keyword Categories

The system automatically searches for:

### Character Types:
- **Male/Female Characters**: General anime characters of different genders
- **Professional Characters**: Doctors, teachers, chefs, police, engineers, artists
- **Fantasy Characters**: Elves, demons, angels, vampires, dragons
- **Age Groups**: Children, teenagers, adults, elderly
- **Style Categories**: Cyberpunk, steampunk, gothic, casual, formal

### Expected Distribution:
- **Total Keywords**: 150+ search terms
- **Images per Keyword**: 50-150 images
- **Quality Filter**: 85-95% success rate
- **Processing Speed**: 100-200 images per minute

## 🔧 Troubleshooting

### Common Issues:

**1. Browser Installation Error**
```bash
# Reinstall Playwright browsers
npx playwright install chromium --force
```

**2. Permission Errors**
```bash
# Create directories with proper permissions
mkdir -p images/{raw,processed} database logs
chmod 755 images database logs
```

**3. Network/Timeout Issues**
- Check your internet connection
- Increase timeout values in `.env` file
- Run with `npm run dev` for detailed logging

**4. Low Success Rate**
- Some keywords may have fewer results
- The system automatically retries failed downloads
- Check logs for specific error details

### Performance Tips:

**Optimize for Speed:**
```bash
# Set environment variables for faster processing
export SCRAPER_DELAY=500
export MAX_IMAGES_PER_KEYWORD=100
npm start
```

**Optimize for Quality:**
```bash
# Set higher quality settings
export JPEG_QUALITY_MIN=60
export JPEG_QUALITY_MAX=90
npm start
```

## 📈 Monitoring Progress

### Real-time Console Output:
```
🎌 Anime Character Image Collection System
==========================================

📋 Configuration Summary:
   Target images: 3000 - 5000
   Image size: 500x500px
   Max file size: 50KB
   Quality range: 50-80

[25%] Processing keyword: "anime female character" (15/60)
  Downloaded: 89/120 (74%)
  Processed: 85/89 (96%)

✅ Category "Female Characters" completed:
   - Images processed: 847
   - Success rate: 89%
```

### Database Queries:
```bash
# Check progress programmatically
node -e "
const db = require('better-sqlite3')('./database/images.db');
const stats = db.prepare('SELECT COUNT(*) as count FROM images WHERE processed = 1').get();
console.log('Processed images:', stats.count);
"
```

## 🛠️ Advanced Usage

### Custom Configuration:
```typescript
import { AnimeImageCollectorApp } from './src';

const customConfig = {
  targetImageCount: { min: 5000, max: 8000 },
  imageProcessing: {
    maxWidth: 512,
    maxHeight: 512,
    quality: { min: 60, max: 85 },
    maxFileSize: 75 * 1024 // 75KB
  },
  // ... other settings
};

const app = new AnimeImageCollectorApp(customConfig);
```

### Progress Monitoring:
```typescript
const progressCallback = {
  onImageDownloaded: (downloaded, total) => {
    console.log(`Downloaded: ${downloaded}/${total}`);
  },
  onCategoryComplete: (category, stats) => {
    console.log(`${category}: ${stats.imagesProcessed} processed`);
  }
};
```

### Selective Keyword Processing:
```typescript
// Process only specific categories
const config = {
  ...DEFAULT_CONFIG,
  keywordCategories: DEFAULT_CONFIG.keywordCategories.filter(
    cat => cat.name === 'Female Characters'
  )
};
```

## 🎉 Success Criteria

Your collection is successful when you achieve:

✅ **3,000-5,000 images** collected and processed  
✅ **All images 500x500 pixels** and under 50KB  
✅ **JPEG quality 50-80** with good visual quality  
✅ **Complete metadata** stored (URLs, alt text, categories)  
✅ **Organized file structure** with proper naming  
✅ **Statistical reports** generated  
✅ **85%+ success rate** across all categories  

## 📞 Support

### Check Application Logs:
```bash
# View recent logs
tail -f logs/app.log

# Check for errors
grep ERROR logs/app.log
```

### Database Statistics:
```bash
# Generate database report
npm run schema  # Creates visual database schema
```

### Performance Monitoring:
```bash
# Monitor system resources
top -p $(pgrep -f "node.*index")
```

The application is designed to be robust and self-recovering. Most issues are automatically handled with retries and graceful error recovery. Check the detailed logs for specific error information if you encounter problems.