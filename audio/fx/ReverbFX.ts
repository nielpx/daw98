export class ReverbFX {
  ctx: AudioContext;
  input: GainNode;
  output: GainNode;
  dry: GainNode;
  wet: GainNode;
  convolver: ConvolverNode;
  params: { wet: number; dry: number; decay: number; size: number };

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.dry = ctx.createGain();
    this.wet = ctx.createGain();
    this.convolver = ctx.createConvolver();
    this.params = { wet: 0.3, dry: 0.7, decay: 1.5, size: 0.5 };

    // Generate impulse response
    this.convolver.buffer = this.buildImpulse();

    this.input.connect(this.dry);
    this.input.connect(this.wet);
    this.wet.connect(this.convolver);
    this.dry.connect(this.output);
    this.convolver.connect(this.output);

    this.dry.gain.value = this.params.dry;
    this.wet.gain.value = this.params.wet;
  }

  buildImpulse(): AudioBuffer {
    const rate = this.ctx.sampleRate;
    const length = rate * this.params.decay;
    const buffer = this.ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, this.params.size * 2);
      }
    }
    return buffer;
  }

  connect(dest: AudioNode) { this.output.connect(dest); }
  disconnect() { this.output.disconnect(); }

  updateParams(p: Partial<{ wet: number; dry: number; decay: number; size: number }>) {
    const prevDecay = this.params.decay;
    const prevSize = this.params.size;
    Object.assign(this.params, p);
    this.dry.gain.value = this.params.dry;
    this.wet.gain.value = this.params.wet;
    if (this.params.decay !== prevDecay || this.params.size !== prevSize) {
      this.convolver.buffer = this.buildImpulse();
    }
  }
}