export type WaveformType = "sine" | "triangle" | "saw" | "square";
export type PhaseMode = "fixed" | "random" | "free";

export interface OscParams {
  waveform: WaveformType;
  vol: number;
  pan: number;
  detune: number;
  octave: number;
  unisonVoices: number;
  unisonDetune: number;
  unisonPhase: number;
  phaseMode: PhaseMode;
  unisonBlend: number;
  unisonSpread: number;
  driftAmount: number;
}

export interface SynthParams {
  osc1: OscParams;
  osc2: OscParams;
  osc3: OscParams;
  delay: number;
  attack: number;
  hold: number;
  decay: number;
  sustain: number;
  release: number;
  attackCurve: number;
  decayCurve: number;
  releaseCurve: number;
  masterGain: number;
  filterFreq: number;
  filterRes: number;
  filterType: BiquadFilterType;
  filterEnv: number;
}

export class ThreeOscSynth {
  ctx: AudioContext;
  output: GainNode;
  workletNode: AudioWorkletNode | null;
  params: SynthParams;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
    this.output = ctx.createGain();

    this.params = {
      osc1: {
        waveform: "saw", vol: 0.8, pan: -0.5, detune: 0, octave: 0,
        unisonVoices: 1, unisonDetune: 1, unisonPhase: 50,
        phaseMode: "free", unisonBlend: 100, unisonSpread: 50, driftAmount: 0,
      },
      osc2: {
        waveform: "square", vol: 0.4, pan: 0.5, detune: 0, octave: 0,
        unisonVoices: 1, unisonDetune: 1, unisonPhase: 50,
        phaseMode: "free", unisonBlend: 100, unisonSpread: 50, driftAmount: 0,
      },
      osc3: {
        waveform: "sine", vol: 0.2, pan: 0, detune: 0, octave: 0,
        unisonVoices: 1, unisonDetune: 1, unisonPhase: 50,
        phaseMode: "free", unisonBlend: 100, unisonSpread: 50, driftAmount: 0,
      },
      delay: 0, attack: 0, hold: 0, decay: 0, sustain: 1, release: 0, attackCurve: 0.5, decayCurve: 0.5, releaseCurve: 0.5,
      masterGain: 0.7,
      filterFreq: 3000, filterRes: 0.5, filterType: "lowpass", filterEnv: 3000,
    };

    this.output.gain.value = this.params.masterGain;

    // Single shared AudioWorkletNode — all voices inside
    this.workletNode = new AudioWorkletNode(ctx, "three-osc-processor", {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2],
      processorOptions: { params: this.buildOscParams() },
    });
    this.workletNode.connect(this.output);
  }

  private buildOscParams() {
    return {
      osc1: this.params.osc1,
      osc2: this.params.osc2,
      osc3: this.params.osc3,
      delay: this.params.delay,
      attack: this.params.attack,
      hold: this.params.hold,
      decay: this.params.decay,
      sustain: this.params.sustain,
      release: this.params.release,
      attackCurve: this.params.attackCurve,
      decayCurve: this.params.decayCurve,
      releaseCurve: this.params.releaseCurve,
      filterFreq: this.params.filterFreq,
      filterRes: this.params.filterRes,
      filterType: this.params.filterType,
      filterEnv: this.params.filterEnv,
      masterGain: this.params.masterGain,
    };
  }

  noteOn(pitch: number, startTime: number, duration: number, velocity: number = 1.0) {
    if (!this.workletNode) return;
    const now = this.ctx.currentTime;
    const startDelay = Math.max(0, startTime - now);
    this.workletNode.port.postMessage({
      type: "noteOn",
      pitch,
      velocity: Math.max(0, Math.min(1, velocity / 127)),
      startDelay,
      duration: Math.max(0.01, duration),
    });
  }

  noteOff(pitch: number) {
    if (!this.workletNode) return;
    this.workletNode.port.postMessage({ type: "noteOff", pitch });
  }

  stopAllVoices() {
    if (!this.workletNode) return;
    this.workletNode.port.postMessage({ type: "stopAll" });
  }

  connect(dest: AudioNode) {
    this.output.connect(dest);
  }

  disconnect() {
    this.output.disconnect();
  }

  updateParams(newParams: Partial<SynthParams>) {
    if (newParams.osc1) Object.assign(this.params.osc1, newParams.osc1);
    if (newParams.osc2) Object.assign(this.params.osc2, newParams.osc2);
    if (newParams.osc3) Object.assign(this.params.osc3, newParams.osc3);
    if (newParams.delay !== undefined) this.params.delay = newParams.delay;
    if (newParams.attack !== undefined) this.params.attack = newParams.attack;
    if (newParams.hold !== undefined) this.params.hold = newParams.hold;
    if (newParams.decay !== undefined) this.params.decay = newParams.decay;
    if (newParams.sustain !== undefined) this.params.sustain = newParams.sustain;
    if (newParams.release !== undefined) this.params.release = newParams.release;
    if (newParams.attackCurve !== undefined) this.params.attackCurve = newParams.attackCurve;
    if (newParams.decayCurve !== undefined) this.params.decayCurve = newParams.decayCurve;
    if (newParams.releaseCurve !== undefined) this.params.releaseCurve = newParams.releaseCurve;
    if (newParams.masterGain !== undefined) {
      this.params.masterGain = newParams.masterGain;
    }
    if (newParams.filterFreq !== undefined)
      this.params.filterFreq = newParams.filterFreq;
    if (newParams.filterRes !== undefined)
      this.params.filterRes = newParams.filterRes;
    if (newParams.filterType !== undefined)
      this.params.filterType = newParams.filterType;
    if (newParams.filterEnv !== undefined)
      this.params.filterEnv = newParams.filterEnv;

    if (this.workletNode) {
      this.workletNode.port.postMessage({
        type: "updateParams",
        params: this.buildOscParams(),
      });
    }
  }
}
