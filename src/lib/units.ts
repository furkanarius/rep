import type { LoadUnit } from '../engine/types';

export const KG_PER_LB = 0.45359237;
export const CM_PER_IN = 2.54;

export const lbToKg = (lb: number) => lb * KG_PER_LB;
export const kgToLb = (kg: number) => kg / KG_PER_LB;

/** Convert canonical kg to the display unit. */
export const fromKg = (kg: number, unit: LoadUnit) => (unit === 'kg' ? kg : kgToLb(kg));
/** Convert a value in the display unit to canonical kg. */
export const toKg = (value: number, unit: LoadUnit) => (unit === 'kg' ? value : lbToKg(value));

/** Round a value (already in display units) to the nearest step. */
export function roundToStep(value: number, step: number, mode: 'nearest' | 'down' | 'up' = 'nearest') {
  if (step <= 0) return value;
  const n = value / step;
  const r = mode === 'down' ? Math.floor(n + 1e-9) : mode === 'up' ? Math.ceil(n - 1e-9) : Math.round(n);
  return Number((r * step).toFixed(4));
}

/** Round canonical kg to a step expressed in the display unit; returns kg. */
export function roundKg(kg: number, stepInUnit: number, unit: LoadUnit, mode: 'nearest' | 'down' | 'up' = 'nearest') {
  return toKg(roundToStep(fromKg(kg, unit), stepInUnit, mode), unit);
}

/** Display a canonical kg weight in the given unit, trimmed ("92.5", "90"). */
export function fmtWeight(kg: number, unit: LoadUnit, digits = 1) {
  const v = fromKg(kg, unit);
  const rounded = Math.round(v * 10 ** digits) / 10 ** digits;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(digits)}`;
}

export const unitLabel = (unit: LoadUnit) => unit;

export function fmtBody(kg: number, unit: 'kg' | 'lb') {
  return `${fmtWeight(kg, unit)} ${unit}`;
}

export function fmtLength(cm: number, unit: 'cm' | 'in') {
  const v = unit === 'cm' ? cm : cm / CM_PER_IN;
  return `${Math.round(v * 10) / 10} ${unit}`;
}

export const lengthToCm = (v: number, unit: 'cm' | 'in') => (unit === 'cm' ? v : v * CM_PER_IN);
export const cmToLength = (cm: number, unit: 'cm' | 'in') => (unit === 'cm' ? cm : cm / CM_PER_IN);
