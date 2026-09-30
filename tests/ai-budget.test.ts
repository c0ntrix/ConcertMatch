import test from "node:test";
import assert from "node:assert/strict";
import { inferenceCharge, INFERENCE_RESERVATION } from "../lib/ai-budget";
test("model token usage is charged at the published rate with headroom", () => {
  assert.equal(
    inferenceCharge({ prompt_tokens: 4000, completion_tokens: 2000 }),
    646,
  );
  assert.equal(inferenceCharge({ neurons: 100 }), 125);
});
test("missing, invalid or excessive usage never releases an unsafe reservation", () => {
  for (const usage of [
    undefined,
    {},
    { prompt_tokens: -1, completion_tokens: 10 },
    { neurons: NaN },
    { prompt_tokens: 1, completion_tokens: Infinity },
    { prompt_tokens: 1000000, completion_tokens: 1000000 },
  ])
    assert.equal(inferenceCharge(usage), INFERENCE_RESERVATION);
});
