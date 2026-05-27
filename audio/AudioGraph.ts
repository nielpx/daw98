import type { Track, FXChainItem } from "@/store/types";
import { ThreeOscSynth } from "./instruments/ThreeOscSynth";
import { ReverbFX } from "./fx/ReverbFX";
import { DelayFX } from "./fx/DelayFX";

export interface AudioGraph {
  input: AudioNode;
  output: GainNode;
  gainNode: GainNode;
  pannerNode: StereoPannerNode;
  eqNodes: {
    lowShelf: BiquadFilterNode;
    midPeaking: BiquadFilterNode;
    highShelf: BiquadFilterNode;
  };
  analyserLeft: AnalyserNode;
  analyserRight: AnalyserNode;
  fxNodes: {
    instance: ReverbFX | DelayFX | null;
    type: string;
    bypass: boolean;
  }[];
  instrumentInstance: ThreeOscSynth | null;
  connect: (dest: AudioNode) => void;
  disconnect: () => void;
  updateFromTrack: (track: Track) => void;
  noteOn: (pitch: number, velocity: number, startTime: number, duration: number) => void;
  noteOff: (pitch: number) => void;
  rebuildFXChain: (track: Track) => void;
}

export function createAudioGraph(ctx: AudioContext, trackId: string): AudioGraph {
  const gainNode = ctx.createGain();
  const pannerNode = ctx.createStereoPanner();
  const lowShelf = ctx.createBiquadFilter();
  lowShelf.type = "lowshelf";
  lowShelf.frequency.value = 200;
  const midPeaking = ctx.createBiquadFilter();
  midPeaking.type = "peaking";
  midPeaking.frequency.value = 1000;
  midPeaking.Q.value = 1;
  const highShelf = ctx.createBiquadFilter();
  highShelf.type = "highshelf";
  highShelf.frequency.value = 5000;

  const splitter = ctx.createChannelSplitter(2);
  const analyserLeft = ctx.createAnalyser();
  analyserLeft.fftSize = 256;
  analyserLeft.smoothingTimeConstant = 0.8;
  const analyserRight = ctx.createAnalyser();
  analyserRight.fftSize = 256;
  analyserRight.smoothingTimeConstant = 0.8;
  const merger = ctx.createChannelMerger(2);

  lowShelf.connect(midPeaking);
  midPeaking.connect(highShelf);
  highShelf.connect(pannerNode);
  pannerNode.connect(gainNode);
  gainNode.connect(splitter);
  splitter.connect(analyserLeft, 0, 0);
  splitter.connect(analyserRight, 1, 0);
  analyserLeft.connect(merger, 0, 0);
  analyserRight.connect(merger, 0, 1);

  const graph: AudioGraph = {
    input: lowShelf,
    output: gainNode,
    gainNode,
    pannerNode,
    eqNodes: { lowShelf, midPeaking, highShelf },
    analyserLeft,
    analyserRight,
    fxNodes: [],
    instrumentInstance: null,

    connect: (dest) => merger.connect(dest),
    disconnect: () => merger.disconnect(),

    updateFromTrack: (track: Track) => {
      const vol = track.volume / 100;
      const pan = Math.max(-1, Math.min(1, track.pan / 50));
      gainNode.gain.setTargetAtTime(vol, ctx.currentTime, 0.01);
      pannerNode.pan.setTargetAtTime(pan, ctx.currentTime, 0.01);
      lowShelf.gain.setTargetAtTime(track.eqLow, ctx.currentTime, 0.01);
      midPeaking.gain.setTargetAtTime(track.eqMid, ctx.currentTime, 0.01);
      highShelf.gain.setTargetAtTime(track.eqHigh, ctx.currentTime, 0.01);

      graph.fxNodes.forEach((fn, i) => {
        if (fn.instance && track.fxChain[i]) {
          fn.bypass = track.fxChain[i].bypass;
        }
      });
    },

    noteOn: (pitch, velocity, startTime, duration) => {
      if (graph.instrumentInstance) {
        graph.instrumentInstance.noteOn(pitch, startTime, duration, velocity);
        return;
      }

      const t0 = Math.max(0, startTime);
      const dur = Math.max(0.01, duration);
      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = 440 * Math.pow(2, (pitch - 69) / 12);
      const vel = velocity / 127;
      noteGain.gain.setValueAtTime(0, t0);
      noteGain.gain.linearRampToValueAtTime(vel * 0.15, t0 + 0.005);
      noteGain.gain.setValueAtTime(vel * 0.15, t0 + dur - 0.005);
      noteGain.gain.linearRampToValueAtTime(0, t0 + dur);
      osc.connect(noteGain);
      if (graph.fxNodes.length > 0 && graph.fxNodes[0].instance) {
        noteGain.connect(graph.fxNodes[0].instance.input);
      } else {
        noteGain.connect(graph.input);
      }
      osc.start(t0);
      osc.stop(t0 + dur + 0.01);
    },

    noteOff: (pitch) => {
      graph.instrumentInstance?.noteOff(pitch);
    },

    rebuildFXChain: (track: Track) => {
      graph.fxNodes.forEach((fn) => fn.instance?.disconnect());
      graph.fxNodes.length = 0;

      let previousNode: AudioNode | null = graph.instrumentInstance?.output || null;
      if (graph.instrumentInstance) {
        graph.instrumentInstance.disconnect();
      }

      track.fxChain.forEach((fxDef: FXChainItem) => {
        let fxInstance: ReverbFX | DelayFX | null = null;

        if (fxDef.type === "reverb") {
          fxInstance = new ReverbFX(ctx);
          fxInstance.updateParams(fxDef.params);
        } else if (fxDef.type === "delay") {
          fxInstance = new DelayFX(ctx);
          fxInstance.updateParams(fxDef.params);
        }

        if (fxInstance) {
          if (previousNode) {
            previousNode.connect(fxInstance.input);
          }
          previousNode = fxInstance.output;
          graph.fxNodes.push({
            instance: fxInstance,
            type: fxDef.type,
            bypass: fxDef.bypass,
          });
        }
      });

      if (previousNode) {
        previousNode.connect(lowShelf);
      }
    },
  };

  return graph;
}
