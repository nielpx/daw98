import type { AdsrParams, EnvelopeStage, EnvelopeState } from "./EnvelopeTypes";
import { STAGE, curveToExponent } from "./EnvelopeTypes";

export function computeEnvelopeValue(
  params: AdsrParams,
  state: EnvelopeState,
  elapsedNoteTime: number,
  releaseTime: number,
): { value: number; stage: EnvelopeStage } {
  const { delay, attack, hold, decay, sustain, release } = params;
  const t = elapsedNoteTime;
  const rs = releaseTime;

  if (state.stage < STAGE.RELEASE) {
    if (t < delay) {
      return { value: 0, stage: STAGE.DELAY };
    }

    const tAfterDelay = t - delay;

    if (tAfterDelay < attack) {
      const exp = curveToExponent(params.attackCurve);
      const progress = attack > 0 ? tAfterDelay / attack : 1;
      const v = Math.pow(Math.min(1, progress), exp);
      return { value: v, stage: STAGE.ATTACK };
    }

    const tAfterAttack = tAfterDelay - attack;

    if (tAfterAttack < hold) {
      return { value: 1, stage: STAGE.HOLD };
    }

    const tAfterHold = tAfterAttack - hold;

    if (decay > 0 && tAfterHold < decay) {
      const exp = curveToExponent(params.decayCurve);
      const progress = tAfterHold / decay;
      const v = sustain + (1 - sustain) * Math.max(0, Math.pow(1 - progress, exp));
      return { value: v, stage: STAGE.DECAY };
    }

    return { value: sustain, stage: STAGE.SUSTAIN };
  }

  if (release > 0 && rs < release) {
    const exp = curveToExponent(params.releaseCurve);
    const progress = rs / release;
    const v = state.releaseValue * Math.max(0, Math.pow(1 - progress, exp));
    return { value: v, stage: STAGE.RELEASE };
  }

  return { value: 0, stage: STAGE.RELEASE };
}

export function getStageEndTimes(params: AdsrParams): number[] {
  const { delay, attack, hold, decay, release } = params;
  const dEnd = delay;
  const aEnd = dEnd + attack;
  const hEnd = aEnd + hold;
  const dcyEnd = hEnd + decay;
  const rEnd = dcyEnd + release;
  return [0, dEnd, aEnd, hEnd, dcyEnd, dcyEnd, rEnd];
}

export function normalizedTimeToSeconds(
  normalized: number,
  min = 0.001,
  max = 10.0,
): number {
  if (normalized <= 0) return min;
  if (normalized >= 1) return max;
  const logMin = Math.log(min);
  const logMax = Math.log(max);
  return Math.exp(logMin + normalized * (logMax - logMin));
}

export function secondsToNormalizedTime(
  seconds: number,
  min = 0.001,
  max = 10.0,
): number {
  if (seconds <= min) return 0;
  if (seconds >= max) return 1;
  const logMin = Math.log(min);
  const logMax = Math.log(max);
  return (Math.log(seconds) - logMin) / (logMax - logMin);
}
