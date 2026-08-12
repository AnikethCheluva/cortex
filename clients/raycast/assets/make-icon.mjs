// Generates assets/icon.png (512×512) for the Raycast extension — a small
// "notebook page" mark in the app's palette (charcoal paper, brass page, red
// margin rule). Self-contained: no deps, hand-rolled PNG (RGBA) + CRC32.
//   node assets/make-icon.mjs
import zlib from "node:zlib";
import { writeFileSync } from "node:fs";

const W = 512,
  H = 512;
const buf = Buffer.alloc(W * H * 4);
const hex = (h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];
const CHAR = hex("#14130d"),
  BRASS = hex("#d8b15a"),
  RED = hex("#8a4636"),
  RULE = hex("#b8933f");

function px(x, y, [r, g, b]) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  buf[i] = r;
  buf[i + 1] = g;
  buf[i + 2] = b;
  buf[i + 3] = 255;
}

// charcoal background
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) px(x, y, CHAR);

// rounded brass "page"
const px0 = 128,
  py0 = 88,
  px1 = 384,
  py1 = 424,
  rad = 34;
function inRound(x, y) {
  if (x < px0 || x > px1 || y < py0 || y > py1) return false;
  if ((x >= px0 + rad && x <= px1 - rad) || (y >= py0 + rad && y <= py1 - rad)) return true;
  const cx = Math.min(Math.max(x, px0 + rad), px1 - rad);
  const cy = Math.min(Math.max(y, py0 + rad), py1 - rad);
  const dx = x - cx,
    dy = y - cy;
  return dx * dx + dy * dy <= rad * rad;
}
for (let y = py0; y <= py1; y++)
  for (let x = px0; x <= px1; x++) if (inRound(x, y)) px(x, y, BRASS);

// faint horizontal ruling
for (const ry of [156, 212, 268, 324, 380])
  for (let x = px0 + 60; x <= px1 - 24; x++)
    if (inRound(x, ry)) {
      px(x, ry, RULE);
      px(x, ry + 1, RULE);
    }

// red margin rule
for (let y = py0 + 10; y <= py1 - 10; y++)
  for (let x = px0 + 42; x <= px0 + 46; x++) if (inRound(x, y)) px(x, y, RED);

// ---- encode PNG ----
const crcTable = (() => {
  const t = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (b) => {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = crcTable[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
};

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // color type RGBA
const raw = Buffer.alloc(H * (W * 4 + 1));
for (let y = 0; y < H; y++) {
  raw[y * (W * 4 + 1)] = 0; // filter: none
  buf.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4);
}
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk("IHDR", ihdr),
  chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);
writeFileSync(new URL("./icon.png", import.meta.url), png);
console.log(`wrote icon.png (${png.length} bytes)`);
