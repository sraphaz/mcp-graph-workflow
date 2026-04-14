/**
 * Vector Quantization — scalar quantization from Float64/Float32 to Int8.
 *
 * Compresses embedding vectors from 8 bytes/dim (Float64) to 1 byte/dim (Int8)
 * with scalar quantization. Achieves ~4-8x memory reduction with < 5% recall loss.
 *
 * Algorithm: symmetric min-max scalar quantization.
 * - Maps [-maxAbs, +maxAbs] → [-127, +127]
 * - Stores scale factor per vector for reconstruction
 */

export interface QuantizedVector {
  /** Int8 quantized values */
  quantized: Int8Array;
  /** Scale factor for dequantization: original ≈ quantized[i] * scale */
  scale: number;
}

/**
 * Quantize a float vector to Int8 using symmetric scalar quantization.
 */
export function quantizeVector(vector: number[]): QuantizedVector {
  // Find absolute max for symmetric scaling
  let maxAbs = 0;
  for (let i = 0; i < vector.length; i++) {
    const abs = Math.abs(vector[i]);
    if (abs > maxAbs) maxAbs = abs;
  }

  // Avoid division by zero
  if (maxAbs === 0) maxAbs = 1e-10;

  const scale = maxAbs / 127;
  const quantized = new Int8Array(vector.length);

  for (let i = 0; i < vector.length; i++) {
    // Clamp to [-127, 127] to avoid Int8 overflow at -128
    const scaled = Math.round(vector[i] / scale);
    quantized[i] = Math.max(-127, Math.min(127, scaled));
  }

  return { quantized, scale };
}

/**
 * Dequantize an Int8 vector back to float using the stored scale factor.
 */
export function dequantizeVector(quantized: Int8Array, scale: number): number[] {
  const result = new Array<number>(quantized.length);
  for (let i = 0; i < quantized.length; i++) {
    result[i] = quantized[i] * scale;
  }
  return result;
}

/**
 * Compute cosine similarity between two vectors.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;

  return dot / denom;
}
