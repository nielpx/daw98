// ============================================================
// threeOscWorklet.js — Polyphonic AudioWorkletProcessor
// Single node handles all voices internally.
// Zero AudioNode creation during playback.
// ============================================================

var TABLE_SIZE = 2048;
var NUM_HARMONICS = TABLE_SIZE >>> 1;
var MAX_VOICES = 32;

function genSine(t) { for (var i = 0; i < t.length; i++) t[i] = Math.sin(2 * Math.PI * i / t.length); return t; }
function genSaw(t) { for (var i = 0; i < t.length; i++) { var s = 0; for (var h = 1; h <= NUM_HARMONICS; h++) s += Math.sin(2 * Math.PI * i * h / t.length) / h; t[i] = s * 0.318309886; } return t; }
function genSquare(t) { for (var i = 0; i < t.length; i++) { var s = 0; for (var h = 1; h <= NUM_HARMONICS; h += 2) s += Math.sin(2 * Math.PI * i * h / t.length) / h; t[i] = s * 0.636619772; } return t; }
function genTriangle(t) { for (var i = 0; i < t.length; i++) { var s = 0; for (var h = 1; h <= NUM_HARMONICS; h += 2) { s += ((h % 4 === 1) ? 1 : -1) * Math.sin(2 * Math.PI * i * h / t.length) / (h * h); } t[i] = s * 0.810569469; } return t; }

var WT = {
  sine: genSine(new Float32Array(TABLE_SIZE)),
  saw: genSaw(new Float32Array(TABLE_SIZE)),
  square: genSquare(new Float32Array(TABLE_SIZE)),
  triangle: genTriangle(new Float32Array(TABLE_SIZE)),
};

function pBLEP(t, dt) {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t + t + t * t + 1; }
  return 0;
}
function wtLookup(tab, ph, sz) { var i = ph * sz | 0, f = ph * sz - i; return tab[i] + f * (tab[(i + 1) % sz] - tab[i]); }
function vPos(i, t) { if (t <= 1) return 0; var h = (t - 1) / 2; return (i - h) / h; }
function vDet(i, t, dc, bd) { if (t <= 1) return bd; var p = vPos(i, t); return bd + ((p >= 0 ? 1 : -1) * Math.pow(Math.abs(p), 1.8)) * dc; }
function rSaw(ph, inc) { return 2 * ph - 1 - pBLEP(ph, inc); }
function rSqr(ph, inc) { var r = ph < 0.5 ? 1 : -1; var p2 = ph + 0.5; if (p2 >= 1) p2 -= 1; return r + pBLEP(ph, inc) - pBLEP(p2, inc); }
function rTri(ph) { return wtLookup(WT.triangle, ph, TABLE_SIZE); }
function rSin(ph) { return Math.sin(2 * Math.PI * ph); }
function cl(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

// --------------- Biquad ---------------
var BQ = {
  lpCoefs: function(cut, res, sr) {
    var w = 2 * Math.PI * cl(cut, 1, sr / 2) / sr;
    var c = Math.cos(w), s = Math.sin(w), a = s / cl(res < 0.001 ? 0.5 : res, 0.05, 50);
    var a0i = 1 / (1 + a);
    return { b0: (1 - c) / 2 * a0i, b1: (1 - c) * a0i, b2: (1 - c) / 2 * a0i, a1: -2 * c * a0i, a2: (1 - a) * a0i, };
  },
  hpCoefs: function(cut, res, sr) {
    var w = 2 * Math.PI * cl(cut, 1, sr / 2) / sr;
    var c = Math.cos(w), s = Math.sin(w), a = s / cl(res < 0.001 ? 0.5 : res, 0.05, 50);
    var a0i = 1 / (1 + a);
    return { b0: (1 + c) / 2 * a0i, b1: -(1 + c) * a0i, b2: (1 + c) / 2 * a0i, a1: -2 * c * a0i, a2: (1 - a) * a0i, };
  },
  bpCoefs: function(cut, res, sr) {
    var w = 2 * Math.PI * cl(cut, 1, sr / 2) / sr;
    var s = Math.sin(w), a = s / cl(res < 0.001 ? 0.5 : res, 0.05, 50);
    var a0i = 1 / (1 + a);
    return { b0: a * a0i, b1: 0, b2: -a * a0i, a1: -2 * Math.cos(w) * a0i, a2: (1 - a) * a0i, };
  },
  tick: function(s, c, st) {
    var o = c.b0 * s + c.b1 * st.x1 + c.b2 * st.x2 - c.a1 * st.y1 - c.a2 * st.y2;
    st.x2 = st.x1; st.x1 = s; st.y2 = st.y1; st.y1 = o; return o;
  },
};

// --------------- Polyphonic Processor ---------------
class ThreeOscProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    var opts = options.processorOptions || {};
    this.sr = sampleRate;

    this.p = {
      osc1: { waveform: 'saw', vol: 0.8, pan: -0.5, detune: 0, octave: 0, unisonVoices: 1, unisonDetune: 1, unisonPhase: 50, phaseMode: 'free', unisonBlend: 100, driftAmount: 0 },
      osc2: { waveform: 'square', vol: 0.4, pan: 0.5, detune: 0, octave: 0, unisonVoices: 1, unisonDetune: 1, unisonPhase: 50, phaseMode: 'free', unisonBlend: 100, driftAmount: 0 },
      osc3: { waveform: 'sine', vol: 0.2, pan: 0, detune: 0, octave: 0, unisonVoices: 1, unisonDetune: 1, unisonPhase: 50, phaseMode: 'free', unisonBlend: 100, driftAmount: 0 },
      delay: 0, attack: 0.01, hold: 0, decay: 0.1, sustain: 0.7, release: 0.3, attackCurve: 0.5, decayCurve: 0.5, releaseCurve: 0.5,
      filterFreq: 3000, filterRes: 0.5, filterType: 0, filterEnv: 3000,
      masterGain: 0.7,
    };
    if (opts.params) this.loadParams(opts.params);

    this.vOn = new Uint8Array(MAX_VOICES);
    this.vPch = new Float64Array(MAX_VOICES);
    this.vVel = new Float64Array(MAX_VOICES);
    this.vSf = new Float64Array(MAX_VOICES);
    this.vEf = new Float64Array(MAX_VOICES);
    this.vRf = new Float64Array(MAX_VOICES);
    this.vRv = new Float64Array(MAX_VOICES);
    this.vEp = new Uint8Array(MAX_VOICES);
    this.vEv = new Float64Array(MAX_VOICES);
    this.vFb = new Float64Array(MAX_VOICES);
    // Biquad state: x1L,x2L,y1L,y2L, x1R,x2R,y1R,y2R
    this.vBq = new Float64Array(MAX_VOICES * 8);
    // Phases: [voice*24 + osc*8 + unison]
    this.vPh = new Float64Array(MAX_VOICES * 24);
    // Drift offsets
    this.vDr = new Float64Array(MAX_VOICES * 24);
    // Unison count per osc: [voice*3 + osc]
    this.vUn = new Uint8Array(MAX_VOICES * 3);

    this.port.onmessage = this.onMessage.bind(this);
  }

  loadParams(p) {
    if (p.osc1) { this.p.osc1 = p.osc1; this.p.osc1.waveform = p.osc1.waveform || 'saw'; }
    if (p.osc2) { this.p.osc2 = p.osc2; this.p.osc2.waveform = p.osc2.waveform || 'square'; }
    if (p.osc3) { this.p.osc3 = p.osc3; this.p.osc3.waveform = p.osc3.waveform || 'sine'; }
    if (p.delay !== undefined) this.p.delay = p.delay;
    if (p.attack !== undefined) this.p.attack = p.attack;
    if (p.hold !== undefined) this.p.hold = p.hold;
    if (p.decay !== undefined) this.p.decay = p.decay;
    if (p.sustain !== undefined) this.p.sustain = p.sustain;
    if (p.release !== undefined) this.p.release = p.release;
    if (p.attackCurve !== undefined) this.p.attackCurve = p.attackCurve;
    if (p.decayCurve !== undefined) this.p.decayCurve = p.decayCurve;
    if (p.releaseCurve !== undefined) this.p.releaseCurve = p.releaseCurve;
    if (p.filterFreq !== undefined) this.p.filterFreq = p.filterFreq;
    if (p.filterRes !== undefined) this.p.filterRes = p.filterRes;
    if (p.filterType !== undefined) {
      if (p.filterType === 'lowpass' || p.filterType === 0) this.p.filterType = 0;
      else if (p.filterType === 'highpass') this.p.filterType = 1;
      else if (p.filterType === 'bandpass') this.p.filterType = 2;
    }
    if (p.filterEnv !== undefined) this.p.filterEnv = p.filterEnv;
    if (p.masterGain !== undefined) this.p.masterGain = p.masterGain;
  }

  allocV() {
    for (var v = 0; v < MAX_VOICES; v++) if (!this.vOn[v]) return v;
    var o = 0, f = this.vSf[0];
    for (var v = 1; v < MAX_VOICES; v++) { if (this.vSf[v] < f) { o = v; f = this.vSf[v]; } }
    return o;
  }

  initV(v, pch, vel, sf, ef) {
    this.vOn[v] = 1;
    this.vPch[v] = pch; this.vVel[v] = vel;
    this.vSf[v] = sf; this.vEf[v] = ef;
    this.vRf[v] = -1; this.vRv[v] = 0;
    this.vEp[v] = 0; this.vEv[v] = 0;
    this.vFb[v] = this.p.filterFreq;
    for (var i = 0; i < 8; i++) this.vBq[v * 8 + i] = 0;

    var on = ['osc1','osc2','osc3'];
    for (var o = 0; o < 3; o++) {
      var osc = this.p[on[o]];
      var n = Math.max(1, Math.min(8, (osc && osc.unisonVoices) || 1));
      this.vUn[v * 3 + o] = n;
      var pm = (osc && osc.phaseMode) || 'free';
      var pa = ((osc && osc.unisonPhase !== undefined ? osc.unisonPhase : 50) / 100);
      var da = (osc && osc.driftAmount !== undefined ? osc.driftAmount : 0) / 100;
      var ms = 0.001;
      for (var u = 0; u < n; u++) {
        var idx = v * 24 + o * 8 + u;
        if (pm === 'fixed') { var pos = vPos(u, n); this.vPh[idx] = (pos * 0.5 + 0.5) * Math.max(ms, pa); }
        else if (pm === 'random') this.vPh[idx] = Math.random();
        else this.vPh[idx] = Math.random() * Math.max(ms, pa);
        this.vDr[idx] = (Math.random() * 2 - 1) * da * 0.05;
      }
    }
  }

  onMessage(e) {
    var m = e.data;
    if (m.type === 'noteOn') {
      var v = this.allocV();
      var nf = currentFrame;
      var df = Math.max(0, Math.round(m.startDelay * this.sr));
      var durF = Math.max(64, Math.round(m.duration * this.sr));
      this.initV(v, m.pitch, m.velocity, nf + df, nf + df + durF);
    } else if (m.type === 'noteOff') {
      var pch = m.pitch, nf = currentFrame;
      for (var v = 0; v < MAX_VOICES; v++) {
        if (this.vOn[v] && this.vPch[v] === pch && this.vEp[v] < 5) {
          this.vRf[v] = nf; this.vRv[v] = this.vEv[v]; this.vEp[v] = 5;
        }
      }
    } else if (m.type === 'updateParams') {
      this.loadParams(m.params);
    } else if (m.type === 'stopAll') {
      var nf = currentFrame;
      for (var v = 0; v < MAX_VOICES; v++) {
        if (this.vOn[v] && this.vEp[v] < 5) {
          this.vRf[v] = nf; this.vRv[v] = this.vEv[v]; this.vEp[v] = 5;
        }
      }
    }
  }

  process(inputs, outputs, parameters) {
    var o = outputs[0];
    if (!o || !o[0] || !o[1]) return true;
    var L = o[0], R = o[1], n = L.length;
    L.fill(0); R.fill(0);
    var sr = this.sr, on = ['osc1','osc2','osc3'];

    for (var v = 0; v < MAX_VOICES; v++) {
      if (!this.vOn[v]) continue;

      var pch = this.vPch[v], vel = this.vVel[v];
      var sf = this.vSf[v], ef = this.vEf[v];
      var rf = this.vRf[v];
      var ep = this.vEp[v], ev = this.vEv[v];
      var fb = this.vFb[v];
      var bqOff = v * 8;
      var pDelay = this.p.delay, pA = this.p.attack, pHold = this.p.hold, pD = this.p.decay, pS = this.p.sustain, pR = this.p.release;
      var pAC = this.p.attackCurve, pDC = this.p.decayCurve, pRC = this.p.releaseCurve;
      var aExp = Math.pow(2, 2 * (1 - 2 * pAC));
      var dExp = Math.pow(2, 2 * (1 - 2 * pDC));
      var rExp = Math.pow(2, 2 * (1 - 2 * pRC));
      var fEnv = this.p.filterEnv, fRes = this.p.filterRes, fTyp = this.p.filterType;
      var mg = this.p.masterGain;

      for (var i = 0; i < n; i++) {
        var af = currentFrame + i;
        if (af < sf) continue;

        // Auto-release on note end
        if (af >= ef && rf < 0) { rf = af; this.vRf[v] = af; this.vRv[v] = ev; this.vEp[v] = 5; ep = 5; }

        var lf = af - sf;
        var ls = lf / sr;
        var rs = rf >= 0 ? (af - rf) / sr : 0;

        // ADSR (6-stage: delay → attack → hold → decay → sustain → release)
        if (ep === 0) { ev = 0; if (ls >= pDelay) { ep = 1; this.vEp[v] = 1; } }
        if (ep === 1) { var aT = ls - pDelay; var aP = pA > 0 ? aT / pA : 1; ev = Math.pow(Math.min(1, aP), aExp); if (aT >= pA) { ep = 2; this.vEp[v] = 2; } }
        if (ep === 2) { var hT = ls - pDelay - pA; ev = 1; if (hT >= pHold) { ep = 3; this.vEp[v] = 3; } }
        if (ep === 3) { var dT = ls - pDelay - pA - pHold; var dP = pD > 0 ? dT / pD : 1; ev = pS + (1 - pS) * Math.max(0, Math.pow(1 - dP, dExp)); if (dP >= 1) { ep = 4; this.vEp[v] = 4; } }
        if (ep === 4) { ev = pS; }
        if (ep === 5) { var rv = this.vRv[v]; var rP = pR > 0 ? rs / pR : 1; ev = rv * Math.max(0, Math.pow(1 - rP, rExp)); if (rP >= 1) { this.vOn[v] = 0; break; } }

        // Filter cutoff with envelope
        var cut = fb;
        if (fEnv !== 0) cut = cl(fb + fEnv * ev, 20, 20000);

        // Compute biquad coefs once if envelope changes, else per voice
        var coefs;
        if (fTyp === 1) coefs = BQ.hpCoefs(cut, fRes, sr);
        else if (fTyp === 2) coefs = BQ.bpCoefs(cut, fRes, sr);
        else coefs = BQ.lpCoefs(cut, fRes, sr);

        var sL = 0, sR = 0;

        for (var oi = 0; oi < 3; oi++) {
          var osc = this.p[on[oi]];
          if (!osc) continue;
          var vol = osc.vol || 0;
          if (vol <= 0) continue;

          var wf = osc.waveform || 'saw';
          var nu = this.vUn[v * 3 + oi];
          var bp = osc.pan || 0;
          var dc = osc.unisonDetune || 0;
          var bd = osc.detune || 0;
          var oct = osc.octave || 0;
          var bl = ((osc.unisonBlend !== undefined ? osc.unisonBlend : 100) / 100);
          var bf = 440 * Math.pow(2, (pch + oct * 12 - 69) / 12);

          for (var u = 0; u < nu; u++) {
            var idx = v * 24 + oi * 8 + u;
            var ph = this.vPh[idx];
            var pos = vPos(u, nu);
            var vd = vDet(u, nu, dc, bd);
            var dr = this.vDr[idx];
            var vf = bf * Math.pow(2, (vd + dr * 1200) / 1200);
            var vi = vf / sr;

            var val;
            if (wf === 'sine') val = rSin(ph);
            else if (wf === 'saw') val = rSaw(ph, vi);
            else if (wf === 'square') val = rSqr(ph, vi);
            else val = rTri(ph);

            var bg = vol / Math.sqrt(nu);
            var gt = 1 - 0.3 * Math.abs(pos);
            var vg = bg * gt * (0.3 + 0.7 * bl);
            var ps = Math.min(0.9, (dc / 100) * 0.9) * bl;
            var pt = nu > 1 ? u / (nu - 1) : 0.5;
            var vp = cl(bp + (pt * 2 - 1) * ps, -1, 1);
            var va = 0.2 + 0.8 * vel;
            var sv = val * vg * va * ev;
            sL += sv * 0.707106781 * (1 - vp);
            sR += sv * 0.707106781 * (1 + vp);

            var np = ph + vi;
            if (np >= 1) np -= 1;
            if (np < 0) np += 1;
            this.vPh[idx] = np;
          }
        }

        // Biquad per voice (stereo)
        var stL = { x1: this.vBq[bqOff], x2: this.vBq[bqOff+1], y1: this.vBq[bqOff+2], y2: this.vBq[bqOff+3] };
        var stR = { x1: this.vBq[bqOff+4], x2: this.vBq[bqOff+5], y1: this.vBq[bqOff+6], y2: this.vBq[bqOff+7] };
        sL = BQ.tick(sL, coefs, stL);
        sR = BQ.tick(sR, coefs, stR);
        this.vBq[bqOff] = stL.x1; this.vBq[bqOff+1] = stL.x2; this.vBq[bqOff+2] = stL.y1; this.vBq[bqOff+3] = stL.y2;
        this.vBq[bqOff+4] = stR.x1; this.vBq[bqOff+5] = stR.x2; this.vBq[bqOff+6] = stR.y1; this.vBq[bqOff+7] = stR.y2;

        L[i] += sL * mg;
        R[i] += sR * mg;
      }
      this.vEv[v] = ev;
    }
    return true;
  }
}
registerProcessor('three-osc-processor', ThreeOscProcessor);
