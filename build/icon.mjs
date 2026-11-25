// Selbst erzeugtes Icon: SVG und PNG (nur Node-Built-ins, ohne Fremdpakete).
import zlib from 'node:zlib';

export const BG = [18, 53, 91];
export const FG = [255, 255, 255];
export const SPARK = [255, 159, 28];

// Form in Einheitskoordinaten: "L" aus zwei Balken plus runder Funke.
const RECTS = [[0.30, 0.20, 0.42, 0.76], [0.30, 0.64, 0.70, 0.76]];
const SPARK_C = { x: 0.64, y: 0.32, r: 0.09 };

export function iconSvg() {
  const px = (v) => (v * 512).toFixed(1);
  const rects = RECTS.map(([x0, y0, x1, y1]) =>
    `<rect x="${px(x0)}" y="${px(y0)}" width="${px(x1 - x0)}" height="${px(y1 - y0)}" rx="12" fill="#fff"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#12355b"/>` +
    `${rects}<circle cx="${px(SPARK_C.x)}" cy="${px(SPARK_C.y)}" r="${px(SPARK_C.r)}" fill="#ff9f1c"/></svg>`;
}

function colorAt(u, v) {
  const dx = u - SPARK_C.x, dy = v - SPARK_C.y;
  if (dx * dx + dy * dy <= SPARK_C.r * SPARK_C.r) return SPARK;
  for (const [x0, y0, x1, y1] of RECTS) if (u >= x0 && u <= x1 && v >= y0 && v <= y1) return FG;
  return BG;
}

function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(Buffer.concat([t, data])) >>> 0);
  return Buffer.concat([len, t, data, crc]);
}

export function iconPng(size) {
  const ss = 3; // 3x3 Supersampling
  const raw = Buffer.alloc(size * (size * 3 + 1));
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0;
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
        const c = colorAt((x + (sx + 0.5) / ss) / size, (y + (sy + 0.5) / ss) / size);
        r += c[0]; g += c[1]; b += c[2];
      }
      const n = ss * ss;
      raw[o++] = Math.round(r / n); raw[o++] = Math.round(g / n); raw[o++] = Math.round(b / n);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2; // 8 Bit, RGB
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
