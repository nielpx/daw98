export class DelayFX {
  ctx: AudioContext;
  input: GainNode;
  output: GainNode;
  delay: DelayNode;
  feedback: GainNode;
  mix: GainNode;
  dry: GainNode;

  params: { time: number; feedback: number; mix: number };

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.delay = ctx.createDelay(5);
    this.feedback = ctx.createGain();
    this.mix = ctx.createGain();
    this.dry = ctx.createGain();
    this.params = { time: 0.3, feedback: 0.4, mix: 0.5 };

    this.delay.delayTime.value = this.params.time;
    this.feedback.gain.value = this.params.feedback;
    this.mix.gain.value = this.params.mix;
    this.dry.gain.value = 1 - this.params.mix;

    this.input.connect(this.dry);
    this.input.connect(this.delay);
    this.delay.connect(this.feedback);
    this.feedback.connect(this.delay);
    this.delay.connect(this.mix);
    this.dry.connect(this.output);
    this.mix.connect(this.output);
  }

  connect(dest: AudioNode) { this.output.connect(dest); }
  disconnect() { this.output.disconnect(); }

  updateParams(p: Partial<{ time: number; feedback: number; mix: number }>) {
    Object.assign(this.params, p);
    this.delay.delayTime.value = this.params.time;
    this.feedback.gain.value = this.params.feedback;
    this.mix.gain.value = this.params.mix;
    this.dry.gain.value = 1 - this.params.mix;
  }
}