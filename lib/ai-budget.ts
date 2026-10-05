export const INFERENCE_RESERVATION = 1200;
export const INFERENCE_DAILY_LIMIT = 8000;
export type InferenceUsage = {
  neurons?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
};

// Llama 4 Scout pricing, checked 2026-10-01:
// developers.cloudflare.com/workers-ai/platform/pricing/
// Keep a 25% cushion; unknown or failed requests retain the whole reservation.
export function inferenceCharge(usage?: InferenceUsage) {
  let neurons = usage?.neurons;
  if (!(
    typeof neurons === "number" &&
    Number.isFinite(neurons) &&
    neurons > 0
  )) {
    const input = usage?.prompt_tokens,
      output = usage?.completion_tokens;
    if (!(
      typeof input === "number" &&
      Number.isSafeInteger(input) &&
      input > 0 &&
      typeof output === "number" &&
      Number.isSafeInteger(output) &&
      output >= 0
    ))
      return INFERENCE_RESERVATION;
    neurons = (input * 24545 + output * 77273) / 1000000;
  }
  return Math.min(INFERENCE_RESERVATION, Math.ceil(neurons * 1.25));
}
