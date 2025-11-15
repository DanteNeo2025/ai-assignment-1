import re

# 讀取檔案
with open('src/ImageScraper.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# 定義要替換的新方法
new_method = '''  async downloadImage(imageData: ImageData, filename: string): Promise<boolean> {
    try {
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
      const filePath = path.join(this.config.outputDir, filename);
      await fs.promises.writeFile(filePath, buffer);
      
      this.logger.debug(`Downloaded image: ${filename}`);
      return true;
      
    } catch (error) {
      this.logger.error(`Failed to download image ${imageData.url}:`, error);
      return false;
    }
  }'''

# 使用正規表達式找到並替換 downloadImage 方法
pattern = r'async downloadImage\(imageData: ImageData, filename: string\): Promise<boolean> \{[^}]*(?:\{[^}]*\}[^}]*)*\}'
content = re.sub(pattern, new_method, content, flags=re.DOTALL)

# 寫回檔案
with open('src/ImageScraper.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("ImageScraper.ts updated successfully")
