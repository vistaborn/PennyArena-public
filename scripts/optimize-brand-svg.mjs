import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const brandDir = path.join(__dirname, "..", "public", "brand");

const RECT_RE =
  /<rect x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)" fill="([^"]*)"(?: fill-opacity="([^"]*)")?\/>/g;

function optimize(file, factor) {
  const src = path.join(brandDir, file);
  const content = fs.readFileSync(src, "utf8");
  const raw = [];

  for (const m of content.matchAll(RECT_RE)) {
    const opacity = m[6] ? parseFloat(m[6]) : 1;
    if (opacity < 0.45) continue;
    const fill = m[5].toLowerCase();
    if (fill === "#000000" || fill === "#000") continue;
    raw.push({ x: +m[1], y: +m[2], fill: m[5] });
  }

  if (!raw.length) {
    console.warn("No rects in", file);
    return;
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = 0;
  let maxY = 0;
  for (const r of raw) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x);
    maxY = Math.max(maxY, r.y);
  }

  const grid = new Map();
  for (const r of raw) {
    const gx = Math.floor((r.x - minX) / factor);
    const gy = Math.floor((r.y - minY) / factor);
    grid.set(`${gx},${gy}`, r.fill);
  }

  let gMaxX = 0;
  let gMaxY = 0;
  for (const key of grid.keys()) {
    const [gx, gy] = key.split(",").map(Number);
    gMaxX = Math.max(gMaxX, gx);
    gMaxY = Math.max(gMaxY, gy);
  }

  const w = gMaxX + 1;
  const h = gMaxY + 1;
  const body = [...grid.entries()]
    .map(([key, fill]) => {
      const [gx, gy] = key.split(",").map(Number);
      return `<rect x="${gx}" y="${gy}" width="1" height="1" fill="${fill}"/>`;
    })
    .join("");

  const out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">${body}</svg>`;
  fs.writeFileSync(src, out);
  console.log(`${file}: ${grid.size} px → ${w}x${h} (${Math.round(out.length / 1024)} KB)`);
}

optimize("pixel_coin.svg", 10);
optimize("pixel_cat.svg", 8);
