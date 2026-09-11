import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ARRAYS,
  LAGS,
  expanded,
  histogram,
  lostLags,
  meanPower,
  pairs,
  power,
  risk,
} from "../src/math.js";

const retained = JSON.parse(
  readFileSync(
    new URL("../research/risk-amplification-output.json", import.meta.url),
    "utf8",
  ),
);

function close(actual, expected, tolerance = 1e-12) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)),
    "expected " + actual + " ≈ " + expected,
  );
}

function deletionMask(positions, failureMask) {
  return positions.filter((_, index) => (failureMask & (1 << index)) === 0);
}

function maskFor(positions) {
  let mask = 0;
  const missing = lostLags(positions);
  for (let lagIndex = 0; lagIndex < LAGS.length; lagIndex += 1) {
    if (missing.includes(LAGS[lagIndex])) mask |= 1 << lagIndex;
  }
  return mask;
}

test("exports, pairs, histograms, protected losses, and expansion match the construction", () => {
  assert.deepEqual(ARRAYS, {
    A: [0, 1, 5, 7, 8, 10, 12],
    B: [0, 1, 2, 5, 7, 9, 12],
  });
  assert.deepEqual(LAGS, [1, 2, 3, 4, 5]);
  assert.deepEqual(pairs(ARRAYS.A, 1), [
    [0, 1],
    [7, 8],
  ]);
  assert.deepEqual(pairs(ARRAYS.B, 1), [
    [0, 1],
    [1, 2],
  ]);
  assert.deepEqual(histogram(ARRAYS.A), [2, 3, 2, 2, 3, 1, 3, 1, 1, 1, 1, 1]);
  assert.deepEqual(histogram(ARRAYS.B), histogram(ARRAYS.A));
  assert.deepEqual(lostLags(ARRAYS.A), []);
  assert.deepEqual(lostLags(ARRAYS.B), []);
  assert.deepEqual(expanded("A", 2), [
    ...ARRAYS.A,
    ...ARRAYS.A.map((x) => x + 18),
  ]);
  assert.deepEqual(expanded("B", 1), ARRAYS.B);
  assert.equal(expanded("A", 10).length, 70);
});

test("all single-deletion claims and intact q-family protected coverage hold", () => {
  const failures = (positions) =>
    positions.flatMap((_, index) => {
      const missing = lostLags(deletionMask(positions, 1 << index));
      return missing.length ? [{ position: positions[index], missing }] : [];
    });
  assert.deepEqual(failures(ARRAYS.A), []);
  assert.deepEqual(failures(ARRAYS.B), [
    { position: 1, missing: [1] },
    { position: 5, missing: [4] },
  ]);

  for (let q = 1; q <= 10; q += 1) {
    assert.deepEqual(lostLags(expanded("A", q)), []);
    assert.deepEqual(lostLags(expanded("B", q)), []);
  }
});

test("complete spectra and mean damaged power are equal", () => {
  for (const omega of [0, 0.1, 0.37, Math.PI / 3, Math.PI, 7.25]) {
    close(power(ARRAYS.A, omega), power(ARRAYS.B, omega), 2e-13);
    for (const p of [0, 0.01, 0.25, 0.5, 1]) {
      close(
        meanPower(ARRAYS.A, omega, p),
        meanPower(ARRAYS.B, omega, p),
        2e-13,
      );
    }
  }
  assert.equal(power([], 1), 0);
  assert.equal(meanPower([], 1, 0.5), 0);
  assert.equal(power(ARRAYS.A, 0), 49);
  assert.equal(meanPower(ARRAYS.A, 0, 0.5), 14);
});

test("p=.01 q=1..10 agrees with retained exact BigInt fixture", () => {
  const expected = retained.results[0].rows;
  for (let q = 1; q <= 10; q += 1) {
    const row = expected[q - 1];
    const actual = risk(q, 10);
    assert.deepEqual(actual, {
      riskA: row.riskA,
      riskB: row.riskB,
      ratio: row.riskRatio,
      numeratorA: row.numeratorA,
      numeratorB: row.numeratorB,
      denominator: row.denominator,
    });
  }
});

test("q=2 risk agrees with separate direct 14-sensor enumeration", () => {
  const pNumerator = 1n;
  const pDenominator = 100n;
  const denominator = pDenominator ** 14n;
  const direct = {};
  for (const key of ["A", "B"]) {
    const positions = expanded(key, 2);
    let numerator = 0n;
    for (
      let failureMask = 0;
      failureMask < 1 << positions.length;
      failureMask += 1
    ) {
      const remaining = deletionMask(positions, failureMask);
      if (maskFor(remaining) === 0) continue;
      let failures = 0;
      for (let bit = failureMask; bit !== 0; bit >>>= 1) failures += bit & 1;
      numerator +=
        pNumerator ** BigInt(failures) *
        (pDenominator - pNumerator) ** BigInt(positions.length - failures);
    }
    direct[key] = numerator;
  }
  const actual = risk(2, 10);
  assert.equal(actual.numeratorA, direct.A.toString());
  assert.equal(actual.numeratorB, direct.B.toString());
  assert.equal(actual.denominator, denominator.toString());
});

test("invalid inputs are rejected and endpoint probabilities are exact", () => {
  assert.throws(() => pairs(ARRAYS.A, 0));
  assert.throws(() => pairs(ARRAYS.A, 1.5));
  assert.throws(() => pairs([0, 0], 1));
  assert.throws(() => histogram(ARRAYS.A, 0));
  assert.throws(() => histogram(ARRAYS.A, Number.POSITIVE_INFINITY));
  assert.throws(() => power(ARRAYS.A, Number.NaN));
  assert.throws(() => meanPower(ARRAYS.A, 0, -0.01));
  assert.throws(() => meanPower(ARRAYS.A, 0, 1.01));
  assert.throws(() => expanded("C", 1));
  assert.throws(() => expanded("A", 0));
  assert.throws(() => expanded("A", 11));
  assert.throws(() => risk(0, 10));
  assert.throws(() => risk(11, 10));
  assert.throws(() => risk(1, 0));
  assert.throws(() => risk(1, 501));
  assert.throws(() => risk(1, 1.5));

  const half = risk(1, 500);
  assert.equal(half.denominator, "128");
  assert.equal(half.numeratorA, "109");
  assert.equal(half.numeratorB, "115");
  close(half.riskA, 109 / 128);
  close(half.riskB, 115 / 128);
});
