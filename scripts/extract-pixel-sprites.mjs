import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const assetsDir = process.env.PENNY_ASSETS_DIR ?? path.join(root, "scripts", "brand-source");
const outFile = path.join(root, "lib", "brand-sprites.ts");

const mascotsSrc = path.join(assetsDir, "mascots.png");
const coinSrc = path.join(assetsDir, "coin.png");

function isBg(r, g, b, a) {
  if (a < 16) return true;
  return r >= 248 && g >= 248 && b >= 248;
}

function floodBackground(mask, w, h) {
  const bg = new Uint8Array(w * h);
  const q = [];
  const push = (x, y) => {
    const i = y * w + x;
    if (x < 0 || y < 0 || x >= w || y >= h || bg[i] || !mask[i]) return;
    bg[i] = 1;
    q.push([x, y]);
  };
  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }
  while (q.length) {
    const [x, y] = q.pop();
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
  return bg;
}

function boundsFromMask(mask, w, h) {
  let minX = w,
    minY = h,
    maxX = 0,
    maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < minX) return null;
  return { minX, minY, maxX, maxY };
}

async function loadRgba(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

function extractRegion(data, w, h, box) {
  const rw = box.maxX - box.minX + 1;
  const rh = box.maxY - box.minY + 1;
  const out = Buffer.alloc(rw * rh * 4);
  for (let y = 0; y < rh; y++) {
    for (let x = 0; x < rw; x++) {
      const si = ((box.minY + y) * w + (box.minX + x)) * 4;
      const di = (y * rw + x) * 4;
      out[di] = data[si];
      out[di + 1] = data[si + 1];
      out[di + 2] = data[si + 2];
      out[di + 3] = data[si + 3];
    }
  }
  return { buffer: out, w: rw, h: rh };
}

async function toPixelGrid(buffer, w, h, maxH) {
  const targetH = h <= maxH ? h : maxH;
  const scale = targetH / h;
  const tw = h <= maxH ? w : Math.max(1, Math.round(w * scale));

  let data;
  if (h <= maxH) {
    data = buffer;
  } else {
    const resized = await sharp(buffer, { raw: { width: w, height: h, channels: 4 } })
      .resize(tw, targetH, { kernel: sharp.kernel.nearest })
      .raw()
      .toBuffer({ resolveWithObject: true });
    data = resized.data;
  }

  const grid = [];
  for (let y = 0; y < targetH; y++) {
    const row = [];
    for (let x = 0; x < tw; x++) {
      const i = (y * tw + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a < 16) row.push(null);
      else row.push(`#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`);
    }
    grid.push(row);
  }
  return grid;
}

async function extractHalf(file, side) {
  const { data, w, h } = await loadRgba(file);
  const halfW = Math.floor(w / 2);
  const ox = side === "left" ? 0 : halfW;
  const hw = side === "left" ? halfW : w - halfW;

  const whiteMask = new Uint8Array(hw * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < hw; x++) {
      const i = (y * w + (ox + x)) * 4;
      whiteMask[y * hw + x] = isBg(data[i], data[i + 1], data[i + 2], data[i + 3]) ? 1 : 0;
    }
  }
  const bg = floodBackground(whiteMask, hw, h);
  const fgMask = new Uint8Array(hw * h);
  for (let i = 0; i < hw * h; i++) fgMask[i] = bg[i] ? 0 : 1;

  const box = boundsFromMask(fgMask, hw, h);
  if (!box) throw new Error(`No content for ${side}`);

  const rw = box.maxX - box.minX + 1;
  const rh = box.maxY - box.minY + 1;
  const buffer = Buffer.alloc(rw * rh * 4);
  for (let y = 0; y < rh; y++) {
    for (let x = 0; x < rw; x++) {
      const maskI = (box.minY + y) * hw + (box.minX + x);
      const si = ((box.minY + y) * w + (ox + box.minX + x)) * 4;
      const di = (y * rw + x) * 4;
      if (!fgMask[maskI]) {
        buffer[di] = 0;
        buffer[di + 1] = 0;
        buffer[di + 2] = 0;
        buffer[di + 3] = 0;
        continue;
      }
      buffer[di] = data[si];
      buffer[di + 1] = data[si + 1];
      buffer[di + 2] = data[si + 2];
      buffer[di + 3] = data[si + 3];
    }
  }

  return toPixelGrid(buffer, rw, rh, 52);
}

async function extractCoin(file) {
  const { data, w, h } = await loadRgba(file);
  const whiteMask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const p = i * 4;
    whiteMask[i] = isBg(data[p], data[p + 1], data[p + 2], data[p + 3]) ? 1 : 0;
  }
  const bg = floodBackground(whiteMask, w, h);
  const fgMask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) fgMask[i] = bg[i] ? 0 : 1;
  const box = boundsFromMask(fgMask, w, h);
  if (!box) throw new Error("No coin content");
  const sub = extractRegion(data, w, h, box);
  const masked = Buffer.alloc(sub.buffer.length);
  for (let y = 0; y < sub.h; y++) {
    for (let x = 0; x < sub.w; x++) {
      const srcI = (y * sub.w + x) * 4;
      const globalX = box.minX + x;
      const globalY = box.minY + y;
      const maskI = globalY * w + globalX;
      if (!fgMask[maskI]) {
        masked[srcI] = 0;
        masked[srcI + 1] = 0;
        masked[srcI + 2] = 0;
        masked[srcI + 3] = 0;
        continue;
      }
      masked[srcI] = sub.buffer[srcI];
      masked[srcI + 1] = sub.buffer[srcI + 1];
      masked[srcI + 2] = sub.buffer[srcI + 2];
      masked[srcI + 3] = sub.buffer[srcI + 3];
    }
  }
  return toPixelGrid(masked, sub.w, sub.h, 24);
}

function emitTs(name, grid) {
  const rows = grid.map((row) => `  ${JSON.stringify(row)},`).join("\n");
  return `export const ${name} = [\n${rows}\n] as const;\n`;
}

async function main() {
  const cat = await extractHalf(mascotsSrc, "left");
  const dog = await extractHalf(mascotsSrc, "right");
  const coin = await extractCoin(coinSrc);

  const ts =
    "// Auto-generated from user reference art — run: node scripts/extract-pixel-sprites.mjs\n\n" +
    emitTs("CAT_SPRITE", cat) +
    "\n" +
    emitTs("DOG_SPRITE", dog) +
    "\n" +
    emitTs("COIN_SPRITE", coin);

  fs.writeFileSync(outFile, ts);
  console.log("Wrote", outFile);
  console.log("cat", cat[0].length, "x", cat.length);
  console.log("dog", dog[0].length, "x", dog.length);
  console.log("coin", coin[0].length, "x", coin.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
