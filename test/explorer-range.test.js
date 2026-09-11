import test from "node:test";
import assert from "node:assert/strict";
import { risk } from "../src/math.js";

test("all 5,000 explorer settings have valid exact probabilities and falling absolute risks", () => {
  for (let p = 1; p <= 500; p++) {
    let previous;
    for (let q = 1; q <= 10; q++) {
      const r = risk(q, p),
        a = BigInt(r.numeratorA),
        b = BigInt(r.numeratorB),
        d = BigInt(r.denominator);
      assert.ok(0n < a && a < b && b < d, "exact ordering at " + p + "/" + q);
      assert.ok(
        Number.isFinite(r.ratio) && r.riskA > 0 && r.riskB > 0,
        "finite display at " + p + "/" + q,
      );
      if (previous) {
        assert.ok(a * previous.d < previous.a * d);
        assert.ok(b * previous.d < previous.b * d);
      }
      previous = { a, b, d };
    }
  }
});
