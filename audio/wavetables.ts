export type WaveformType = "sine" | "triangle" | "saw" | "square";

export interface WavetableSet {
  sine: Float32Array;
  saw: Float32Array;
  square: Float32Array;
  triangle: Float32Array;
  size: number;
}

const TABLE_SIZE = 2048;
const NUM_HARMONICS = Math.floor(TABLE_SIZE / 2);

function generateSine(size: number): Float32Array {
  const t = new Float32Array(size);
  for (let i = 0; i < size; i++) t[i] = Math.sin(2 * Math.PI * i / size);
  return t;
}

function generateBandlimitedSaw(size: number): Float32Array {
  const t = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    let s = 0;
    for (let h = 1; h <= NUM_HARMONICS; h++) s += Math.sin(2 * Math.PI * i * h / size) / h;
    t[i] = s * (2 / Math.PI) * 0.5;
  }
  return t;
}

function generateBandlimitedSquare(size: number): Float32Array {
  const t = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    let s = 0;
    for (let h = 1; h <= NUM_HARMONICS; h += 2) s += Math.sin(2 * Math.PI * i * h / size) / h;
    t[i] = s * (4 / Math.PI) * 0.5;
  }
  return t;
}

function generateBandlimitedTriangle(size: number): Float32Array {
  const t = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    let s = 0;
    for (let h = 1; h <= NUM_HARMONICS; h += 2) {
      const sign = (h % 4 === 1) ? 1 : -1;
      s += sign * Math.sin(2 * Math.PI * i * h / size) / (h * h);
    }
    t[i] = s * (8 / (Math.PI * Math.PI));
  }
  return t;
}

let cached: WavetableSet | null = null;

export function getWavetables(): WavetableSet {
  if (cached) return cached;
  cached = {
    sine: generateSine(TABLE_SIZE),
    saw: generateBandlimitedSaw(TABLE_SIZE),
    square: generateBandlimitedSquare(TABLE_SIZE),
    triangle: generateBandlimitedTriangle(TABLE_SIZE),
    size: TABLE_SIZE,
  };
  return cached;
}
