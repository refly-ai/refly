import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

// Get the directory name of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const imagesDir = path.join(rootDir, 'public', 'images');

// Create a mapping of original image paths to WebP paths
const imageMap = new Map();

async function convertImagesToWebp() {
  try {
    const files = await fs.readdir(imagesDir);
    const imageFiles = files.filter((file) => {
      const ext = path.extname(file).toLowerCase();
      return ['.png', '.jpg', '.jpeg', '.gif'].includes(ext);
    });

    console.log(`Found ${imageFiles.length} images to convert`);

    for (const file of imageFiles) {
      const inputPath = path.join(imagesDir, file);
      const fileInfo = path.parse(file);
      const outputPath = path.join(imagesDir, `${fileInfo.name}.webp`);

      try {
        // Convert to WebP
        await sharp(inputPath).webp({ quality: 80 }).toFile(outputPath);

        // Store the mapping from original path to WebP path (for use in Markdown replacements)
        const originalRelativePath = path.join('/images', file);
        const webpRelativePath = path.join('/images', `${fileInfo.name}.webp`);
        imageMap.set(originalRelativePath, webpRelativePath);

        // Remove the original file
        await fs.unlink(inputPath);

        console.log(`Converted and replaced: ${file} -> ${fileInfo.name}.webp`);
      } catch (error) {
        console.error(`Error converting ${file}: ${error.message}`);
      }
    }
  } catch (error) {
    console.error(`Error reading images directory: ${error.message}`);
  }
}

async function findMarkdownFiles(dir) {
  const result = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip node_modules and .git directories
      if (entry.name !== 'node_modules' && entry.name !== '.git') {
        const nestedFiles = await findMarkdownFiles(fullPath);
        result.push(...nestedFiles);
      }
    } else if (entry.name.endsWith('.md')) {
      result.push(fullPath);
    }
  }

  return result;
}

async function updateMarkdownFiles() {
  try {
    const markdownFiles = await findMarkdownFiles(rootDir);
    console.log(`Found ${markdownFiles.length} Markdown files to update`);

    for (const file of markdownFiles) {
      let content = await fs.readFile(file, 'utf-8');
      let modified = false;

      // Replace image links in Markdown
      // This regex matches Markdown image syntax: ![alt text](/images/image.png)
      const regex = /!\[([^\]]*)\]\(([^)]+)\)/g;

      content = content.replace(regex, (match, alt, imagePath) => {
        // Normalize the path to handle different formats
        const normalizedPath = imagePath.trim();

        // Check if this image is in our map
        for (const [originalPath, webpPath] of imageMap.entries()) {
          if (normalizedPath.includes(originalPath)) {
            modified = true;
            return `![${alt}](${webpPath})`;
          }
        }

        // If no match found, return the original
        return match;
      });

      // Also handle HTML img tags
      const imgTagRegex = /<img\s+[^>]*src=["']([^"']+)["'][^>]*>/g;

      content = content.replace(imgTagRegex, (match, imagePath) => {
        // Normalize the path to handle different formats
        const normalizedPath = imagePath.trim();

        // Check if this image is in our map
        for (const [originalPath, webpPath] of imageMap.entries()) {
          if (normalizedPath.includes(originalPath)) {
            modified = true;
            return match.replace(imagePath, webpPath);
          }
        }

        // If no match found, return the original
        return match;
      });

      if (modified) {
        await fs.writeFile(file, content, 'utf-8');
        console.log(`Updated: ${file}`);
      }
    }
  } catch (error) {
    console.error(`Error updating Markdown files: ${error.message}`);
  }
}

async function main() {
  console.log('Starting image conversion and Markdown update process...');

  await convertImagesToWebp();
  await updateMarkdownFiles();

  console.log('Process completed successfully!');
}

main().catch((error) => {
  console.error('An error occurred:', error);
  process.exit(1);
});
