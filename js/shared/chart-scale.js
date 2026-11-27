/**
 * "Nice" numeric scale for a chart axis that counts things (integers, starting at 0). Pure.
 * Steps are 1, 2 or 5 × 10^k, so tick labels are round numbers people read at a glance.
 */

const STEP_FACTORS = Object.freeze([1, 2, 5, 10]);

/**
 * @param {number} maxValue largest value to show (negative / NaN count as 0)
 * @param {number} [targetTicks] wanted number of intervals (the result has between 2 and ~6)
 * @returns {{ max: number, step: number, ticks: number[] }} ticks from 0 to max, inclusive
 */
export function niceScale(maxValue, targetTicks = 4) {
  const value = Number.isFinite(maxValue) && maxValue > 0 ? maxValue : 0;
  if (value === 0) return { max: 1, step: 1, ticks: [0, 1] };
  const rough = value / Math.max(1, targetTicks);
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const factor = STEP_FACTORS.find((f) => f * magnitude >= rough) ?? 10;
  const step = Math.max(1, factor * magnitude); // counts: never a fractional step
  const max = Math.ceil(value / step) * step;
  const ticks = [];
  for (let tick = 0; tick <= max; tick += step) ticks.push(tick);
  return { max, step, ticks };
}
