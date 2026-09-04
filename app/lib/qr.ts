/**
 * Compact QR Code (byte mode, ECC M) → SVG.
 * Good enough for table URLs like https://host/t/04
 */
const GF_EXP = new Array<number>(512);
const GF_LOG = new Array<number>(256);
(function initGf() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 256) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsGenerator(n: number): number[] {
  let poly = [1];
  for (let i = 0; i < n; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], GF_EXP[i]);
    }
    poly = next;
  }
  return poly;
}

function rsEncode(data: number[], nsym: number): number[] {
  const gen = rsGenerator(nsym);
  const ecc = new Array(nsym).fill(0);
  for (const b of data) {
    const coef = b ^ ecc[0];
    ecc.shift();
    ecc.push(0);
    if (coef !== 0) {
      for (let i = 0; i < nsym; i++) ecc[i] ^= gfMul(gen[i + 1], coef);
    }
  }
  return ecc;
}

// Version 1–6 ECC-M: [total modules side, data codewords, ecc per block, blocks]
const VERSIONS: { v: number; size: number; data: number; ecc: number; blocks: number }[] = [
  { v: 1, size: 21, data: 16, ecc: 10, blocks: 1 },
  { v: 2, size: 25, data: 28, ecc: 16, blocks: 1 },
  { v: 3, size: 29, data: 44, ecc: 26, blocks: 1 },
  { v: 4, size: 33, data: 64, ecc: 18, blocks: 2 },
  { v: 5, size: 37, data: 86, ecc: 24, blocks: 2 },
  { v: 6, size: 41, data: 108, ecc: 16, blocks: 4 },
];

const ALIGN: Record<number, number[]> = {
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
};

function chooseVersion(len: number) {
  for (const spec of VERSIONS) {
    // byte mode: 4 mode + 8 count + data + 4 terminator, rounded to bytes, plus pad
    const need = 1 + 1 + len + 1; // conservative
    if (need <= spec.data) return spec;
  }
  return VERSIONS[VERSIONS.length - 1];
}

function bitsToBytes(bits: number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let v = 0;
    for (let j = 0; j < 8; j++) v = (v << 1) | (bits[i + j] || 0);
    out.push(v);
  }
  return out;
}

function pushBits(bits: number[], val: number, n: number) {
  for (let i = n - 1; i >= 0; i--) bits.push((val >> i) & 1);
}

function buildData(text: string, spec: (typeof VERSIONS)[0]): number[] {
  const bytes = Array.from(text).map((c) => c.charCodeAt(0) & 255);
  const bits: number[] = [];
  pushBits(bits, 0b0100, 4); // byte
  pushBits(bits, bytes.length, 8);
  for (const b of bytes) pushBits(bits, b, 8);
  pushBits(bits, 0, 4);
  while (bits.length % 8) bits.push(0);
  const data = bitsToBytes(bits);
  const pad = [0xec, 0x11];
  let p = 0;
  while (data.length < spec.data) {
    data.push(pad[p % 2]);
    p++;
  }
  return data.slice(0, spec.data);
}

function interleave(data: number[], spec: (typeof VERSIONS)[0]): number[] {
  const blocks = spec.blocks;
  const dataPer = Math.floor(spec.data / blocks);
  const eccPer = spec.ecc;
  const ds: number[][] = [];
  const es: number[][] = [];
  let off = 0;
  for (let i = 0; i < blocks; i++) {
    const chunk = data.slice(off, off + dataPer);
    off += dataPer;
    ds.push(chunk);
    es.push(rsEncode(chunk, eccPer));
  }
  const out: number[] = [];
  for (let i = 0; i < dataPer; i++) for (let b = 0; b < blocks; b++) out.push(ds[b][i]);
  for (let i = 0; i < eccPer; i++) for (let b = 0; b < blocks; b++) out.push(es[b][i]);
  return out;
}

function inFinder(x: number, y: number, size: number): boolean {
  const hit = (ox: number, oy: number) => x >= ox && x < ox + 8 && y >= oy && y < oy + 8;
  return hit(0, 0) || hit(size - 8, 0) || hit(0, size - 8);
}

function setFinder(m: number[][], ox: number, oy: number) {
  for (let y = 0; y < 7; y++)
    for (let x = 0; x < 7; x++) {
      const edge = x === 0 || x === 6 || y === 0 || y === 6;
      const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
      m[oy + y][ox + x] = edge || core ? 1 : 0;
    }
}

function maskFn(id: number, x: number, y: number): boolean {
  switch (id) {
    case 0:
      return (x + y) % 2 === 0;
    case 1:
      return y % 2 === 0;
    case 2:
      return x % 3 === 0;
    case 3:
      return (x + y) % 3 === 0;
    case 4:
      return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0;
    case 5:
      return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6:
      return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    default:
      return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
  }
}

function formatBits(mask: number): number {
  // ECC M = 00, 15-bit BCH
  const data = (0b00 << 3) | mask;
  let d = data << 10;
  const gen = 0b10100110111;
  for (let i = 14; i >= 10; i--) {
    if ((d >>> i) & 1) d ^= gen << (i - 10);
  }
  return ((data << 10) | d) ^ 0b101010000010010;
}

function placeFormat(m: number[][], bits: number) {
  const size = m.length;
  for (let i = 0; i < 15; i++) {
    const bit = (bits >> (14 - i)) & 1;
    // horizontal near top-left
    if (i < 6) m[8][i] = bit;
    else if (i < 8) m[8][i + 1] = bit;
    else m[8][size - 15 + i] = bit;
    // vertical
    if (i < 8) m[size - 1 - i][8] = bit;
    else if (i < 9) m[15 - i][8] = bit;
    else m[14 - i][8] = bit;
  }
  m[size - 8][8] = 1; // dark module
}

function reserve(m: number[][], reserved: boolean[][], x: number, y: number) {
  if (y >= 0 && y < m.length && x >= 0 && x < m.length) reserved[y][x] = true;
}

function buildMatrix(text: string): number[][] {
  const spec = chooseVersion(text.length);
  const size = spec.size;
  const data = interleave(buildData(text, spec), spec);
  const m = Array.from({ length: size }, () => new Array(size).fill(0));
  const reserved = Array.from({ length: size }, () => new Array(size).fill(false));

  const mark = (x: number, y: number) => reserve(m, reserved, x, y);

  setFinder(m, 0, 0);
  setFinder(m, size - 7, 0);
  setFinder(m, 0, size - 7);
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      mark(x, y);
      mark(size - 8 + x, y);
      mark(x, size - 8 + y);
    }

  // separators already reserved as 8x8
  // timing
  for (let i = 8; i < size - 8; i++) {
    m[6][i] = i % 2 === 0 ? 1 : 0;
    m[i][6] = i % 2 === 0 ? 1 : 0;
    mark(i, 6);
    mark(6, i);
  }
  mark(8, 6);
  mark(6, 8);

  const align = ALIGN[spec.v] || [];
  for (const ay of align)
    for (const ax of align) {
      if ((ax < 9 && ay < 9) || (ax > size - 10 && ay < 9) || (ax < 9 && ay > size - 10)) continue;
      for (let y = -2; y <= 2; y++)
        for (let x = -2; x <= 2; x++) {
          const v = Math.max(Math.abs(x), Math.abs(y));
          m[ay + y][ax + x] = v === 0 || v === 2 ? 1 : 0;
          mark(ax + x, ay + y);
        }
    }

  // format reserve
  for (let i = 0; i < 8; i++) {
    mark(i, 8);
    mark(8, i);
    mark(size - 1 - i, 8);
    mark(8, size - 1 - i);
  }
  mark(8, 8);

  const bits: number[] = [];
  for (const b of data) pushBits(bits, b, 8);

  // zigzag placement
  let bi = 0;
  let dirUp = true;
  for (let x = size - 1; x > 0; x -= 2) {
    if (x === 6) x--;
    for (let yb = 0; yb < size; yb++) {
      const y = dirUp ? size - 1 - yb : yb;
      for (let dx = 0; dx < 2; dx++) {
        const xx = x - dx;
        if (reserved[y][xx]) continue;
        m[y][xx] = bits[bi] || 0;
        bi++;
      }
    }
    dirUp = !dirUp;
  }

  // apply mask 0 (simple, reliable enough for demo URLs)
  const mask = 0;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      if (!reserved[y][x] && maskFn(mask, x, y)) m[y][x] ^= 1;
    }
  placeFormat(m, formatBits(mask));
  return m;
}

export function qrSvg(text: string, moduleSize = 6, color = "#111111"): string {
  const m = buildMatrix(text);
  const quiet = 2;
  const dim = (m.length + quiet * 2) * moduleSize;
  let path = "";
  for (let y = 0; y < m.length; y++)
    for (let x = 0; x < m.length; x++) {
      if (m[y][x]) {
        const px = (x + quiet) * moduleSize;
        const py = (y + quiet) * moduleSize;
        path += `M${px} ${py}h${moduleSize}v${moduleSize}h${-moduleSize}z`;
      }
    }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" width="${dim}" height="${dim}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path fill="${color}" d="${path}"/></svg>`;
}

export function qrDataUri(text: string, color = "#111111"): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(qrSvg(text, 6, color))}`;
}
