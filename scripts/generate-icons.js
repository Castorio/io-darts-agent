/**
 * Icon Generation Script for IO-Darts-Agent
 *
 * This script generates all required icon formats from the source SVG.
 * You need to have ImageMagick or sharp installed to run this script.
 *
 * Required icons:
 * - icon.png (512x512) - Base PNG for Linux
 * - icon.ico (256x256) - Windows
 * - icon.icns - macOS
 * - tray-icon.png (22x22 or 16x16) - System tray
 *
 * To generate icons manually without this script:
 *
 * 1. Using ImageMagick:
 *    convert build/icon.svg -resize 512x512 build/icon.png
 *    convert build/icon.svg -resize 256x256 build/icon.ico
 *    convert build/icon.svg -resize 22x22 build/tray-icon.png
 *
 * 2. For macOS .icns, use iconutil:
 *    mkdir build/icon.iconset
 *    convert build/icon.svg -resize 16x16 build/icon.iconset/icon_16x16.png
 *    convert build/icon.svg -resize 32x32 build/icon.iconset/icon_16x16@2x.png
 *    convert build/icon.svg -resize 32x32 build/icon.iconset/icon_32x32.png
 *    convert build/icon.svg -resize 64x64 build/icon.iconset/icon_32x32@2x.png
 *    convert build/icon.svg -resize 128x128 build/icon.iconset/icon_128x128.png
 *    convert build/icon.svg -resize 256x256 build/icon.iconset/icon_128x128@2x.png
 *    convert build/icon.svg -resize 256x256 build/icon.iconset/icon_256x256.png
 *    convert build/icon.svg -resize 512x512 build/icon.iconset/icon_256x256@2x.png
 *    convert build/icon.svg -resize 512x512 build/icon.iconset/icon_512x512.png
 *    convert build/icon.svg -resize 1024x1024 build/icon.iconset/icon_512x512@2x.png
 *    iconutil -c icns build/icon.iconset
 *
 * 3. For Linux .deb icons (multiple sizes):
 *    mkdir -p build/icons
 *    convert build/icon.svg -resize 16x16 build/icons/16x16.png
 *    convert build/icon.svg -resize 32x32 build/icons/32x32.png
 *    convert build/icon.svg -resize 48x48 build/icons/48x48.png
 *    convert build/icon.svg -resize 64x64 build/icons/64x64.png
 *    convert build/icon.svg -resize 128x128 build/icons/128x128.png
 *    convert build/icon.svg -resize 256x256 build/icons/256x256.png
 *    convert build/icon.svg -resize 512x512 build/icons/512x512.png
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const buildDir = join(__dirname, '..', 'build');
const iconsDir = join(buildDir, 'icons');

// Create directories
if (!existsSync(iconsDir)) {
  mkdirSync(iconsDir, { recursive: true });
}

const svgPath = join(buildDir, 'icon.svg');

// Check if ImageMagick is available
function hasImageMagick() {
  try {
    execSync('which convert', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function generateIcons() {
  if (!hasImageMagick()) {
    console.log('ImageMagick not found. Please install it to generate icons:');
    console.log('  macOS: brew install imagemagick');
    console.log('  Ubuntu: sudo apt install imagemagick');
    console.log('  Windows: choco install imagemagick');
    console.log('');
    console.log('Or create the following files manually from build/icon.svg:');
    console.log('  - build/icon.png (512x512)');
    console.log('  - build/icon.ico (256x256)');
    console.log('  - build/icon.icns (macOS bundle)');
    console.log('  - build/tray-icon.png (22x22)');
    console.log('  - build/icons/*.png (16, 32, 48, 64, 128, 256, 512)');
    return;
  }

  console.log('Generating icons from SVG...');

  // Generate main PNG
  execSync(`convert "${svgPath}" -resize 512x512 "${join(buildDir, 'icon.png')}"`);
  console.log('  Created: icon.png');

  // Generate ICO for Windows
  execSync(`convert "${svgPath}" -resize 256x256 "${join(buildDir, 'icon.ico')}"`);
  console.log('  Created: icon.ico');

  // Generate tray icon
  execSync(`convert "${svgPath}" -resize 22x22 "${join(buildDir, 'tray-icon.png')}"`);
  console.log('  Created: tray-icon.png');

  // Generate Linux icon sizes
  const sizes = [16, 32, 48, 64, 128, 256, 512];
  for (const size of sizes) {
    execSync(`convert "${svgPath}" -resize ${size}x${size} "${join(iconsDir, `${size}x${size}.png`)}"`);
    console.log(`  Created: icons/${size}x${size}.png`);
  }

  // Generate macOS iconset
  if (process.platform === 'darwin') {
    const iconsetDir = join(buildDir, 'icon.iconset');
    if (!existsSync(iconsetDir)) {
      mkdirSync(iconsetDir, { recursive: true });
    }

    const macSizes = [
      { size: 16, name: 'icon_16x16.png' },
      { size: 32, name: 'icon_16x16@2x.png' },
      { size: 32, name: 'icon_32x32.png' },
      { size: 64, name: 'icon_32x32@2x.png' },
      { size: 128, name: 'icon_128x128.png' },
      { size: 256, name: 'icon_128x128@2x.png' },
      { size: 256, name: 'icon_256x256.png' },
      { size: 512, name: 'icon_256x256@2x.png' },
      { size: 512, name: 'icon_512x512.png' },
      { size: 1024, name: 'icon_512x512@2x.png' },
    ];

    for (const { size, name } of macSizes) {
      execSync(`convert "${svgPath}" -resize ${size}x${size} "${join(iconsetDir, name)}"`);
    }

    execSync(`iconutil -c icns "${iconsetDir}"`);
    console.log('  Created: icon.icns');
  }

  console.log('Icon generation complete!');
}

generateIcons();
