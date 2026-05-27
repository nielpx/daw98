export type EnvelopeStage = 0 | 1 | 2 | 3 | 4 | 5;

export const STAGE: Record<string, EnvelopeStage> = {
  DELAY: 0,
  ATTACK: 1,
  HOLD: 2,
  DECAY: 3,
  SUSTAIN: 4,
  RELEASE: 5,
};

export interface AdsrParams {
  delay: number;
  attack: number;
  hold: number;
  decay: number;
  sustain: number;
  release: number;
  attackCurve: number;
  decayCurve: number;
  releaseCurve: number;
}

export interface EnvelopeState {
  stage: EnvelopeStage;
  value: number;
  releaseValue: number;
  releaseStartTime: number;
}

export interface EnvelopePoint {
  t: number;
  level: number;
  label: string;
  draggableX: boolean;
  draggableY: boolean;
}

export const ENVELOPE_DEFAULTS: AdsrParams = {
  delay: 0,
  attack: 0.01,
  hold: 0,
  decay: 0.1,
  sustain: 0.7,
  release: 0.3,
  attackCurve: 0.5,
  decayCurve: 0.5,
  releaseCurve: 0.5,
};

export const TIME_RANGE = { min: 0.001, max: 10.0 };
export const SUSTAIN_RANGE = { min: 0, max: 1 };
export const CURVE_RANGE = { min: 0, max: 1 };

export function curveToExponent(curve: number): number {
  return Math.pow(2, 2 * (1 - 2 * Math.max(0, Math.min(1, curve))));
}
