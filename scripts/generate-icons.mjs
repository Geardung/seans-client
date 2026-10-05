/**
 * One-off generator for M1 placeholder icons (32x32, 128x128, 128x128@2x, icon.ico).
 * Run: node scripts/generate-icons.mjs
 * Pure Node (zlib only) — no native deps, no network.
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const iconsDir = join(root, "src-tauri", "icons");
mkdirSync(iconsDir, { recursive: true });

/** CRC32 for PNG chunks. */
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function pngRGBA(width, height, pixel) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 4 + 1);
    raw[row] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixel(x, y, width, height);
      const o = row + 1 + x * 4;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
      raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Flat accent square with a lighter inset — placeholder brand mark. */
function pixel(x, y, w, h) {
  const nx = x / w;
  const ny = y / h;
  const inFrame = nx > 0.12 && nx < 0.88 && ny > 0.12 && ny < 0.88;
  if (inFrame) return [107, 155, 255, 255];
  return [47, 111, 237, 255];
}

function icoFromPng(png, size) {
  // ICO container with a single PNG-compressed image (Vista+).
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // icon
  header.writeUInt16LE(1, 4); // count
  const entry = Buffer.alloc(16);
  entry[0] = size >= 256 ? 0 : size;
  entry[1] = size >= 256 ? 0 : size;
  entry[2] = 0;
  entry[3] = 0;
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(22, 12);
  return Buffer.concat([header, entry, png]);
}

const p32 = pngRGBA(32, 32, pixel);
const p128 = pngRGBA(128, 128, pixel);
const p256 = pngRGBA(256, 256, pixel);

writeFileSync(join(iconsDir, "32x32.png"), p32);
writeFileSync(join(iconsDir, "128x128.png"), p128);
writeFileSync(join(iconsDir, "128x128@2x.png"), p256);
writeFileSync(join(iconsDir, "icon.ico"), icoFromPng(p256, 256));
writeFileSync(join(iconsDir, "icon.png"), p256);

console.log("icons written to", iconsDir);
