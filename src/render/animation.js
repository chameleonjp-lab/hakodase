export const DEFAULT_RESPONSE = 18;
export const MAX_DT = 0.05;
export const SNAP_EPSILON = 0.002;

export function clampDt(dt, maxDt = MAX_DT) {
  if (!Number.isFinite(dt) || dt < 0) return 0;
  return Math.min(dt, maxDt);
}

export function approachValue(value, target, dt, options = {}) {
  const safeDt = clampDt(dt, options.maxDt ?? MAX_DT);
  const response = options.response ?? DEFAULT_RESPONSE;
  if (!Number.isFinite(value) || !Number.isFinite(target)) return target;
  const alpha = 1 - Math.exp(-Math.max(0, response) * safeDt);
  const next = value + (target - value) * alpha;
  if (!Number.isFinite(next)) return target;
  if (Math.abs(next - target) <= (options.snapEpsilon ?? SNAP_EPSILON)) return target;
  return next;
}

export function approachPoint(point, target, dt, options = {}) {
  return {
    x: approachValue(point.x, target.x, dt, options),
    y: approachValue(point.y, target.y, dt, options),
  };
}

export function pointReached(point, target, epsilon = SNAP_EPSILON) {
  return Math.abs(point.x - target.x) <= epsilon && Math.abs(point.y - target.y) <= epsilon;
}
