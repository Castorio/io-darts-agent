/**
 * Create minimal placeholder icons for Electron builds
 *
 * This creates very basic placeholder PNG files so the build can succeed.
 * For production, replace these with proper icons generated from the SVG.
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import zlib from 'zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const buildDir = join(__dirname, '..', 'build');
const iconsDir = join(buildDir, 'icons');

// Ensure directories exist
if (!existsSync(buildDir)) {
  mkdirSync(buildDir, { recursive: true });
}
if (!existsSync(iconsDir)) {
  mkdirSync(iconsDir, { recursive: true });
}

/**
 * Create a minimal PNG file (1x1 pixel, solid color)
 * This is a valid PNG that can be used as a placeholder
 */
function createMinimalPNG(color = { r: 30, g: 41, b: 59 }) {
  // PNG file format:
  // - PNG signature (8 bytes)
  // - IHDR chunk (image header)
  // - IDAT chunk (image data)
  // - IEND chunk (image end)

  const width = 256;
  const height = 256;

  // PNG signature
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);  // width
  ihdrData.writeUInt32BE(height, 4); // height
  ihdrData.writeUInt8(8, 8);         // bit depth
  ihdrData.writeUInt8(2, 9);         // color type (2 = RGB)
  ihdrData.writeUInt8(0, 10);        // compression
  ihdrData.writeUInt8(0, 11);        // filter
  ihdrData.writeUInt8(0, 12);        // interlace

  const ihdrCrc = crc32(Buffer.concat([Buffer.from('IHDR'), ihdrData]));
  const ihdr = Buffer.concat([
    Buffer.from([0, 0, 0, 13]),  // length
    Buffer.from('IHDR'),
    ihdrData,
    ihdrCrc
  ]);

  // Create raw image data (RGB, one scanline per row with filter byte)
  const rawData = [];
  for (let y = 0; y < height; y++) {
    rawData.push(0); // filter byte (none)
    for (let x = 0; x < width; x++) {
      // Create a simple gradient/dartboard pattern
      const cx = width / 2;
      const cy = height / 2;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxDist = Math.min(cx, cy);

      // Dartboard-like rings
      const ringWidth = maxDist / 5;
      const ring = Math.floor(dist / ringWidth);

      let r, g, b;
      if (dist < ringWidth * 0.4) {
        // Bullseye (red)
        r = 239; g = 68; b = 68;
      } else if (dist < ringWidth * 0.8) {
        // Bull (green)
        r = 34; g = 197; b = 94;
      } else if (ring % 2 === 0) {
        // Green rings
        r = 34; g = 197; b = 94;
      } else {
        // Red rings
        r = 239; g = 68; b = 68;
      }

      // Background outside dartboard
      if (dist > maxDist * 0.95) {
        r = color.r;
        g = color.g;
        b = color.b;
      }

      rawData.push(r, g, b);
    }
  }

  // Compress with zlib (deflate)
  const compressed = zlib.deflateSync(Buffer.from(rawData), { level: 9 });

  const idatCrc = crc32(Buffer.concat([Buffer.from('IDAT'), compressed]));
  const idatLength = Buffer.alloc(4);
  idatLength.writeUInt32BE(compressed.length, 0);

  const idat = Buffer.concat([
    idatLength,
    Buffer.from('IDAT'),
    compressed,
    idatCrc
  ]);

  // IEND chunk
  const iendCrc = crc32(Buffer.from('IEND'));
  const iend = Buffer.concat([
    Buffer.from([0, 0, 0, 0]),  // length
    Buffer.from('IEND'),
    iendCrc
  ]);

  return Buffer.concat([signature, ihdr, idat, iend]);
}

/**
 * CRC32 calculation for PNG chunks
 */
function crc32(buffer) {
  let crc = 0xffffffff;
  const table = [];

  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }

  for (let i = 0; i < buffer.length; i++) {
    crc = table[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }

  const result = Buffer.alloc(4);
  result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 0);
  return result;
}

/**
 * Create a scaled version of the icon
 */
function createScaledPNG(size) {
  // For now, all sizes get the same pattern (scaled via electron-builder)
  return createMinimalPNG();
}

// Create main icon
console.log('Creating placeholder icons...');

const mainIcon = createMinimalPNG();
writeFileSync(join(buildDir, 'icon.png'), mainIcon);
console.log('  Created: build/icon.png');

// Create tray icon (smaller, but same for now)
writeFileSync(join(buildDir, 'tray-icon.png'), mainIcon);
console.log('  Created: build/tray-icon.png');

// Create Linux icon sizes
const sizes = [16, 32, 48, 64, 128, 256, 512];
for (const size of sizes) {
  writeFileSync(join(iconsDir, `${size}x${size}.png`), mainIcon);
  console.log(`  Created: build/icons/${size}x${size}.png`);
}

console.log('');
console.log('Placeholder icons created successfully!');
console.log('');
console.log('Note: These are basic placeholder icons.');
console.log('For production, generate proper icons from build/icon.svg using:');
console.log('  node scripts/generate-icons.js');
console.log('');
console.log('Or use an online tool to convert the SVG to:');
console.log('  - icon.png (512x512)');
console.log('  - icon.ico (256x256) for Windows');
console.log('  - icon.icns for macOS');
