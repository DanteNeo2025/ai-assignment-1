# Anime Character Image Collection System

## Overview

This TypeScript application automatically collects and processes anime character images from the web, specifically targeting human and humanoid anime characters of various genders and professions. The system uses modern web scraping techniques, image processing, and database management to create a high-quality dataset of 3,000-5,000 images.

## Features

### 🔍 **Intelligent Web Scraping**
- **Playwright Integration**: Uses Playwright for robust browser automation
- **Google Images Search**: Automatically searches Google Images with optimized keywords
- **Smart Image Discovery**: Collects both image URLs and alt text metadata
- **Duplicate Detection**: Prevents downloading the same image multiple times
- **Rate Limiting**: Respectful scraping with configurable delays

### 🖼️ **Advanced Image Processing**
- **Sharp Library**: High-performance image processing using Sharp
- **Smart Resizing**: Intelligent center crop and resize to 500x500 pixels
- **Dynamic Compression**: Automatically adjusts JPEG quality (50-80) to meet size requirements
- **Size Optimization**: Ensures all images are under 50KB while maintaining quality
- **Format Standardization**: Converts all images to optimized JPEG format

### 🗄️ **Robust Database Management**
- **SQLite Database**: Efficient storage using better-sqlite3
- **Comprehensive Metadata**: Stores URLs, alt text, file paths, dimensions, and processing info
- **Statistical Tracking**: Monitors collection progress and success rates
- **Query Optimization**: Indexed database for fast searches and filtering

### 🎯 **Targeted Content Collection**
- **Diverse Character Types**: Male, female, and various profession categories
- **Keyword Optimization**: 150+ carefully curated search terms
- **Balanced Distribution**: Weighted collection across different character types
- **Quality Filtering**: Automatic filtering of low-quality or irrelevant images

## Project Structure

```
src/
├── ImageScraper.ts          # Web scraping with Playwright
├── ImageProcessor.ts        # Image processing with Sharp
├── DatabaseManager.ts       # Database operations
├── AnimeImageCollectorApp.ts # Main application controller
├── config.ts               # Configuration and keywords
├── logger.ts               # Logging system
└── index.ts                # CLI entry point

database/
├── schema.json             # Database schema design
└── images.db              # SQLite database (created at runtime)

images/
├── raw/                   # Downloaded images (original)
└── processed/             # Processed images (500x500, <50KB)

logs/                      # Application and error logs
```

## Installation & Setup

### Prerequisites
- Node.js 18+ 
- NPM or Yarn
- Chrome/Chromium browser (for Playwright)

### Installation

```bash
# Clone or download the project
cd anime-character-image-collector

# Install dependencies
npm install

# Install Playwright browsers
npx playwright install chromium

# Build the TypeScript project
npm run build
```

### Configuration

The application uses a comprehensive configuration system defined in `src/config.ts`. Key settings include:

```typescript
{
  targetImageCount: { min: 3000, max: 5000 },
  imageProcessing: {
    maxWidth: 500,
    maxHeight: 500,
    quality: { min: 50, max: 80 },
    maxFileSize: 50 * 1024 // 50KB
  },
  // ... additional settings
}
```

## Usage

### Basic Usage

```bash
# Run the complete collection process
npm start

# Or run with development mode
npm run dev
```

### Programmatic Usage

```typescript
import { AnimeImageCollectorApp, DEFAULT_CONFIG } from './src';

const app = new AnimeImageCollectorApp(DEFAULT_CONFIG, {
  onImageDownloaded: (downloaded, total) => {
    console.log(`Progress: ${downloaded}/${total}`);
  }
});

const stats = await app.run();
console.log(`Collected ${stats.totalImagesProcessed} images`);
```

## Keyword Categories

The system uses a sophisticated keyword system targeting various character types:

### 👨 **Male Characters**
- General male anime characters
- Warriors and fighters
- Students and teenagers  
- Business professionals
- Magical characters (wizards, mages)

### 👩 **Female Characters**  
- General female anime characters
- Warriors and fighters
- Students and teenagers
- Business professionals
- Magical characters (witches, sorceresses)

### 💼 **Professional Characters**
- Medical professionals (doctors, nurses)
- Educators (teachers, professors)
- Culinary professionals (chefs, cooks)
- Law enforcement (police, detectives)
- Technical professionals (engineers, scientists)
- Creative professionals (artists, designers)

### 🧙 **Fantasy Characters**
- Elves and woodland characters
- Demons and dark characters
- Angels and celestial beings
- Vampires and gothic characters
- Dragons and reptilian characters

### 👶 **Age-based Characters**
- Children and chibi characters
- Teenagers and adolescents
- Adults and mature characters
- Elderly characters

### 🎨 **Style-based Characters**
- Cyberpunk and futuristic
- Steampunk and retro-futuristic
- Gothic and dark aesthetic
- Casual and modern
- Formal and elegant

## Technical Implementation

### Web Scraping Architecture

```typescript
class ImageScraper {
  // Playwright browser automation
  // Google Images search optimization
  // Image metadata extraction
  // Respectful rate limiting
}
```

### Image Processing Pipeline

```typescript
class ImageProcessor {
  // Sharp-based image processing
  // Center crop and resize algorithms
  // Dynamic quality adjustment
  // File size optimization
}
```

### Database Schema

```sql
CREATE TABLE images (
  id INTEGER PRIMARY KEY,
  url TEXT UNIQUE NOT NULL,
  alt_text TEXT,
  filename TEXT UNIQUE NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  keyword TEXT NOT NULL,
  category TEXT,
  download_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed BOOLEAN DEFAULT FALSE,
  processing_date DATETIME
);
```

## Performance & Quality

### Expected Results
- **Collection Rate**: ~100-200 images per minute
- **Success Rate**: 85-95% (depending on keyword effectiveness)
- **Image Quality**: High-quality anime character images
- **File Size**: Optimized to <50KB while maintaining visual quality
- **Format Consistency**: All images standardized to 500x500 JPEG

### Quality Assurance
- Automatic duplicate detection and removal
- Size and dimension validation
- Alt text and metadata preservation
- Comprehensive error logging and recovery
- Statistical tracking and reporting

## Monitoring & Logging

The application provides comprehensive monitoring:

```typescript
interface CollectionStats {
  totalImagesFound: number;
  totalImagesDownloaded: number;
  totalImagesProcessed: number;
  totalFailures: number;
  categoriesStats: CategoryStats[];
  // ... additional metrics
}
```

### Real-time Progress Tracking
- Live console updates during collection
- Per-category progress reporting
- Error tracking and recovery
- Performance metrics and timing

## Error Handling & Recovery

- **Network Resilience**: Automatic retry with exponential backoff
- **Resource Management**: Proper cleanup of browser instances and file handles
- **Graceful Shutdown**: Signal handling for clean termination
- **Comprehensive Logging**: Detailed error logs for debugging and monitoring

## Compliance & Ethics

### Respectful Scraping
- Configurable request delays
- User-agent rotation
- Robots.txt compliance awareness
- Rate limiting to prevent server overload

### Content Guidelines
- Focus on publicly available anime character images
- Avoids copyrighted or inappropriate content
- Respects website terms of service
- Implements proper attribution through alt text preservation

## Development & Maintenance

### Code Quality
- **TypeScript**: Full type safety and modern language features
- **Modular Architecture**: Clean separation of concerns
- **Comprehensive Logging**: Winston-based logging system
- **Error Handling**: Robust error handling and recovery
- **Documentation**: Extensive inline documentation

### Testing & Validation
```bash
# Run tests (if implemented)
npm test

# Lint code
npm run lint

# Format code
npm run format
```

### Database Maintenance
```typescript
// Backup database
database.backup('./backups/images_backup.db');

// Optimize database
database.optimize();

// Get statistics
const stats = database.getCollectionSummary();
```

## Scaling & Customization

### Horizontal Scaling
- Multiple instances can target different keyword sets
- Database supports concurrent access
- Configurable batch sizes for processing

### Customization Options
- Custom keyword sets and categories
- Adjustable image processing parameters
- Configurable output formats and quality
- Extensible progress reporting system

## Troubleshooting

### Common Issues

1. **Browser Launch Failures**
   ```bash
   npx playwright install chromium
   ```

2. **Permission Errors**
   - Ensure write permissions for `images/` and `database/` directories

3. **Network Issues**
   - Adjust timeout and retry settings in configuration
   - Check firewall and proxy settings

4. **Memory Issues**
   - Reduce batch sizes in configuration
   - Monitor system resources during operation

### Support & Maintenance

For issues and questions:
- Check the comprehensive logging output
- Review configuration settings
- Monitor system resources
- Consult the database statistics for collection progress

## Future Enhancements

### Planned Features
- Additional image sources (Pixiv, DeviantArt APIs)
- Advanced image classification and tagging
- Web interface for monitoring and control
- Distributed processing support
- Advanced duplicate detection using image hashing

### Extension Points
- Plugin system for custom image sources
- Configurable image processing pipelines  
- External database support (PostgreSQL, MongoDB)
- Real-time web dashboard
- API endpoints for programmatic access

This system represents a comprehensive solution for automated anime character image collection, balancing quality, performance, and ethical scraping practices.