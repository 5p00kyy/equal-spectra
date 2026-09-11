/**
 * Exact geometry and failure-risk calculations for the equal-spectra example.
 *
 * This module intentionally has no platform dependencies, so it can be imported
 * by both a browser UI and Node-based tests.
 */

export const ARRAYS = Object.freeze({
  A: Object.freeze([0, 1, 5, 7, 8, 10, 12]),
  B: Object.freeze([0, 1, 2, 5, 7, 9, 12]),
});

export const LAGS = Object.freeze([1, 2, 3, 4, 5]);

const MAX_BLOCKS = 10;
const SCALE = 1000n;
const BASE_SIZE = 7;
const MASK_COUNT = 1 << LAGS.length;

function checkedPositions(positions) {
  if (!Array.isArray(positions)) {
    throw new TypeError("positions must be an array");
  }
  const sorted = positions.slice();
  for (const position of sorted) {
    if (!Number.isSafeInteger(position)) {
      throw new TypeError("positions must contain distinct safe integers");
    }
  }
  sorted.sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i] === sorted[i - 1]) {
      throw new RangeError("positions must contain distinct values");
    }
  }
  return sorted;
}

function checkedLag(lag) {
  if (!Number.isSafeInteger(lag) || lag <= 0) {
    throw new RangeError("lag must be a positive integer");
  }
  return lag;
}

function checkedMaxLag(maxLag) {
  if (!Number.isSafeInteger(maxLag) || maxLag < 1) {
    throw new RangeError("maxLag must be a positive integer");
  }
  return maxLag;
}

function checkedOmega(omega) {
  if (typeof omega !== "number" || !Number.isFinite(omega)) {
    throw new TypeError("omega must be a finite number");
  }
  return omega;
}

function checkedProbability(p) {
  if (typeof p !== "number" || !Number.isFinite(p) || p < 0 || p > 1) {
    throw new RangeError("p must be a number in [0, 1]");
  }
  return p;
}

function checkedQ(q) {
  if (!Number.isSafeInteger(q) || q < 1 || q > MAX_BLOCKS) {
    throw new RangeError("q must be an integer from 1 through 10");
  }
  return q;
}

export function pairs(positions, lag) {
  const sorted = checkedPositions(positions);
  const d = checkedLag(lag);
  const present = new Set(sorted);
  const result = [];
  for (const x of sorted) {
    if (present.has(x + d)) {
      result.push([x, x + d]);
    }
  }
  return result;
}

export function histogram(positions, maxLag = 12) {
  const sorted = checkedPositions(positions);
  const limit = checkedMaxLag(maxLag);
  const counts = Array(limit).fill(0);
  for (let i = 0; i < sorted.length; i += 1) {
    for (let j = i + 1; j < sorted.length; j += 1) {
      const d = sorted[j] - sorted[i];
      if (d >= 1 && d <= limit) {
        counts[d - 1] += 1;
      }
    }
  }
  return counts;
}

export function power(positions, omega) {
  const sorted = checkedPositions(positions);
  const w = checkedOmega(omega);
  if (sorted.length === 0) return 0;

  // Translation does not change the magnitude, and centering the arguments
  // avoids needlessly losing phase precision for translated arrays.
  const origin = sorted[0];
  let real = 0;
  let imaginary = 0;
  let realCompensation = 0;
  let imaginaryCompensation = 0;
  for (const x of sorted) {
    const angle = w * (x - origin);
    const c = Math.cos(angle);
    const s = Math.sin(angle);

    // Kahan summation keeps the small residual reliable near spectral nulls.
    const realY = c - realCompensation;
    const realT = real + realY;
    realCompensation = realT - real - realY;
    real = realT;
    const imaginaryY = s - imaginaryCompensation;
    const imaginaryT = imaginary + imaginaryY;
    imaginaryCompensation = imaginaryT - imaginary - imaginaryY;
    imaginary = imaginaryT;
  }
  return real * real + imaginary * imaginary;
}

export function meanPower(positions, omega, p) {
  const sorted = checkedPositions(positions);
  const w = checkedOmega(omega);
  const failureProbability = checkedProbability(p);
  const survival = 1 - failureProbability;
  return (
    survival * survival * power(sorted, w) +
    survival * (1 - survival) * sorted.length
  );
}

export function lostLags(positions) {
  const sorted = checkedPositions(positions);
  return LAGS.filter((lag) => {
    for (let i = 0; i < sorted.length; i += 1) {
      for (let j = i + 1; j < sorted.length; j += 1) {
        if (sorted[j] - sorted[i] === lag) return false;
      }
    }
    return true;
  });
}

export function expanded(key, q) {
  const blocks = checkedQ(q);
  if (
    typeof key !== "string" ||
    !Object.prototype.hasOwnProperty.call(ARRAYS, key)
  ) {
    throw new RangeError("key must be A or B");
  }
  const base = ARRAYS[key];
  const result = [];
  for (let block = 0; block < blocks; block += 1) {
    const offset = 18 * block;
    for (const x of base) result.push(x + offset);
  }
  return result;
}

function gcd(a, b) {
  let left = a < 0n ? -a : a;
  let right = b < 0n ? -b : b;
  while (right !== 0n) {
    const remainder = left % right;
    left = right;
    right = remainder;
  }
  return left;
}

function normalizeProbability(pPermille) {
  if (!Number.isSafeInteger(pPermille) || pPermille < 1 || pPermille > 500) {
    throw new RangeError("pPermille must be an integer from 1 through 500");
  }
  const failure = BigInt(pPermille);
  const divisor = gcd(failure, SCALE);
  const numerator = failure / divisor;
  const denominator = SCALE / divisor;
  return { failure: numerator, survival: denominator - numerator, denominator };
}

function lostMask(base, failureMask) {
  let mask = 0;
  for (let lagIndex = 0; lagIndex < LAGS.length; lagIndex += 1) {
    const lag = LAGS[lagIndex];
    let represented = false;
    for (let i = 0; i < base.length && !represented; i += 1) {
      if ((failureMask & (1 << i)) !== 0) continue;
      for (let j = i + 1; j < base.length; j += 1) {
        if ((failureMask & (1 << j)) === 0 && base[j] - base[i] === lag) {
          represented = true;
          break;
        }
      }
    }
    if (!represented) mask |= 1 << lagIndex;
  }
  return mask;
}

const BASE_LOST_MASKS = Object.freeze({
  A: Object.freeze(
    Array.from({ length: 1 << BASE_SIZE }, (_, failureMask) =>
      lostMask(ARRAYS.A, failureMask),
    ),
  ),
  B: Object.freeze(
    Array.from({ length: 1 << BASE_SIZE }, (_, failureMask) =>
      lostMask(ARRAYS.B, failureMask),
    ),
  ),
});

function baseDistribution(key, probability) {
  const weights = Array(MASK_COUNT).fill(0n);
  const failures = probability.failure;
  const survivors = probability.survival;
  for (let failureMask = 0; failureMask < 1 << BASE_SIZE; failureMask += 1) {
    let count = 0;
    for (let bit = failureMask; bit !== 0; bit >>>= 1) count += bit & 1;
    const weight =
      failures ** BigInt(count) * survivors ** BigInt(BASE_SIZE - count);
    weights[BASE_LOST_MASKS[key][failureMask]] += weight;
  }
  return weights;
}

function intersectConvolution(left, right) {
  const result = Array(MASK_COUNT).fill(0n);
  for (let leftMask = 0; leftMask < MASK_COUNT; leftMask += 1) {
    if (left[leftMask] === 0n) continue;
    for (let rightMask = 0; rightMask < MASK_COUNT; rightMask += 1) {
      if (right[rightMask] === 0n) continue;
      result[leftMask & rightMask] += left[leftMask] * right[rightMask];
    }
  }
  return result;
}

function scientificRatio(numerator, denominator) {
  if (numerator === 0n) return 0;
  if (denominator === 0n) return Number.NaN;
  const ns = (numerator < 0n ? -numerator : numerator).toString();
  const ds = (denominator < 0n ? -denominator : denominator).toString();
  const significantDigits = 15;
  const nTake = Math.min(significantDigits, ns.length);
  const dTake = Math.min(significantDigits, ds.length);
  const exponent = ns.length - nTake - (ds.length - dTake);
  return (
    (Number(ns.slice(0, nTake)) / Number(ds.slice(0, dTake))) * 10 ** exponent
  );
}

// A cache entry contains the exact q-fold distributions. Keeping the raw
// distributions lets each later slider step add one block in 32-state time.
const RISK_CACHE = new Map();

function riskSeries(pPermille) {
  const probability = normalizeProbability(pPermille);
  const cacheKey =
    probability.failure.toString() + "/" + probability.denominator.toString();
  const cached = RISK_CACHE.get(cacheKey);
  if (cached) return cached;

  const baseA = baseDistribution("A", probability);
  const baseB = baseDistribution("B", probability);
  const seriesA = [];
  const seriesB = [];
  // The identity for mask intersection is the all-lags mask, not zero.
  let distributionA = [...Array(MASK_COUNT - 1).fill(0n), 1n];
  let distributionB = distributionA.slice();
  for (let q = 1; q <= MAX_BLOCKS; q += 1) {
    distributionA = intersectConvolution(distributionA, baseA);
    distributionB = intersectConvolution(distributionB, baseB);
    const numeratorA = distributionA
      .slice(1)
      .reduce((sum, value) => sum + value, 0n);
    const numeratorB = distributionB
      .slice(1)
      .reduce((sum, value) => sum + value, 0n);
    const denominator = probability.denominator ** BigInt(BASE_SIZE * q);
    seriesA.push({ numerator: numeratorA, denominator });
    seriesB.push({ numerator: numeratorB, denominator });
  }
  const result = { seriesA, seriesB };
  RISK_CACHE.set(cacheKey, result);
  return result;
}

export function risk(q, pPermille) {
  const blocks = checkedQ(q);
  const series = riskSeries(pPermille);
  const rawA = series.seriesA[blocks - 1];
  const rawB = series.seriesB[blocks - 1];

  // The per-mille fraction is reduced before enumeration. Keep the common
  // denominator so both returned numerators are exact under the same measure.
  const numeratorA = rawA.numerator;
  const numeratorB = rawB.numerator;
  const denominator = rawA.denominator;
  return {
    riskA: scientificRatio(numeratorA, denominator),
    riskB: scientificRatio(numeratorB, denominator),
    ratio: scientificRatio(numeratorB, numeratorA),
    numeratorA: numeratorA.toString(),
    numeratorB: numeratorB.toString(),
    denominator: denominator.toString(),
  };
}
