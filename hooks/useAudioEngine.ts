"use client";

import { useRef, useCallback, useEffect } from "react";
import { useStore } from "@/store/useStore";
import { createAudioGraph, AudioGraph } from "@/audio/AudioGraph";
import { graphStore } from "@/store/audioGraphStore";
import { ThreeOscSynth } from "@/audio/instruments/ThreeOscSynth";

const LOOK_AHEAD = 0.1;
const SCHEDULE_INTERVAL = 25;
const FADE_DURATION = 0.01;

let workletLoaded = false;

export function useAudioEngine() {
  const ctxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rafRef = useRef<number | null>(null);
  const startAudioTimeRef = useRef(0);
  const startBeatRef = useRef(0);
  const scheduledNodesRef = useRef<{ stop: () => void }[]>([]);
  const scheduledNoteIdsRef = useRef<Set<string>>(new Set());
  const masterGainRef = useRef<GainNode | null>(null);
  const masterAnalyserLeftRef = useRef<AnalyserNode | null>(null);
  const masterAnalyserRightRef = useRef<AnalyserNode | null>(null);

  const getCtx = useCallback(() => {
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    return ctxRef.current;
  }, []);

  const beatsToSeconds = (beats: number, bpm: number) => (beats / bpm) * 60;

  /* ── Pastikan graph ada ── */
  const ensureGraph = useCallback(
    (trackId: string) => {
      const ctx = getCtx();
      if (!graphStore.has(trackId)) {
        const graph = createAudioGraph(ctx, trackId);
        if (!masterGainRef.current) {
          const masterGain = ctx.createGain();
          masterGain.gain.value = 0.8;
          const masterSplitter = ctx.createChannelSplitter(2);
          const masterAnalyserLeft = ctx.createAnalyser();
          masterAnalyserLeft.fftSize = 256;
          masterAnalyserLeft.smoothingTimeConstant = 0.8;
          const masterAnalyserRight = ctx.createAnalyser();
          masterAnalyserRight.fftSize = 256;
          masterAnalyserRight.smoothingTimeConstant = 0.8;
          const masterMerger = ctx.createChannelMerger(2);
          masterGain.connect(masterSplitter);
          masterSplitter.connect(masterAnalyserLeft, 0, 0);
          masterSplitter.connect(masterAnalyserRight, 1, 0);
          masterAnalyserLeft.connect(masterMerger, 0, 0);
          masterAnalyserRight.connect(masterMerger, 0, 1);
          masterMerger.connect(ctx.destination);
          masterGainRef.current = masterGain;
          masterAnalyserLeftRef.current = masterAnalyserLeft;
          masterAnalyserRightRef.current = masterAnalyserRight;
        }
        graph.connect(masterGainRef.current);
        graphStore.set(trackId, graph);
      }
      return graphStore.get(trackId)!;
    },
    [getCtx],
  );

  /* ── Sinkronisasi instrument + FX ── */
  const syncPluginChain = useCallback(
    (trackId: string) => {
      try {
        const graph = graphStore.get(trackId);
        if (!graph) return;
        const track = useStore.getState().tracks.find((t) => t.id === trackId);
        if (!track) return;

        const currentInstType = track.instrumentType;
        const instChanged =
          (!graph.instrumentInstance && currentInstType) ||
          (graph.instrumentInstance && !currentInstType) ||
          (graph.instrumentInstance && currentInstType !== "threeOscSynth");

        const fxChanged =
          graph.fxNodes.length !== track.fxChain.length ||
          track.fxChain.some((fx, i) => graph.fxNodes[i]?.type !== fx.type);

        if (instChanged || fxChanged) {
          if (graph.instrumentInstance) {
            graph.instrumentInstance.disconnect();
            graph.instrumentInstance = null;
          }
          if (currentInstType === "threeOscSynth") {
            const synth = new ThreeOscSynth(getCtx());
            synth.updateParams(track.instrumentParams);
            graph.instrumentInstance = synth;
          }
          graph.rebuildFXChain(track);
        } else {
          if (graph.instrumentInstance) {
            graph.instrumentInstance.updateParams(track.instrumentParams);
          }
          graph.fxNodes.forEach((fn, i) => {
            if (fn.instance && track.fxChain[i]) {
              fn.instance.updateParams(track.fxChain[i].params);
            }
          });
        }
      } catch (err) {
        console.warn("syncPluginChain error", err);
      }
    },
    [getCtx],
  );

  /* ── Update volume, pan, EQ, plugin params ── */
  const updateTrackNodes = useCallback(() => {
    const state = useStore.getState();
    const { tracks, transport } = state;
    const ctx = getCtx();
    const hasSolo = tracks.some((t) => t.solo);

    tracks.forEach((track) => {
      const graph = graphStore.get(track.id);
      if (!graph) return;
      graph.updateFromTrack(track);
      if (track.muted) graph.gainNode.gain.value = 0;
      else if (hasSolo && !track.solo) graph.gainNode.gain.value = 0;
      else
        graph.gainNode.gain.setTargetAtTime(
          track.volume / 100,
          ctx.currentTime,
          0.01,
        );
    });

    if (masterGainRef.current) {
      masterGainRef.current.gain.setTargetAtTime(
        transport.masterVolume / 100,
        ctx.currentTime,
        0.01,
      );
    }
  }, [getCtx]);

  /* ── Penjadwalan note / audio ── */
  const scheduleAhead = useCallback(() => {
    const state = useStore.getState();
    const { tracks, transport, audioBuffers } = state;
    const ctx = getCtx();
    const bpm = transport.bpm;
    const now = ctx.currentTime;
    const windowEnd = now + LOOK_AHEAD;
    const loopEnabled = transport.loopEnabled;
    const loopStart = transport.loopStart;
    const loopEnd = transport.loopEnd;

    updateTrackNodes();
    tracks.forEach((t) => syncPluginChain(t.id));

    tracks.forEach((track) => {
      const graph = graphStore.get(track.id);
      if (!graph) return;

      if (track.type === "midi") {
        track.midiNotes.forEach((note) => {
          if (loopEnabled) {
            const noteEndBeat = note.startTime + note.duration;
            if (noteEndBeat <= loopStart || note.startTime >= loopEnd) return;
          }
          const noteTime =
            startAudioTimeRef.current +
            beatsToSeconds(note.startTime - startBeatRef.current, bpm);
          const noteEnd =
            startAudioTimeRef.current +
            beatsToSeconds(
              note.startTime + note.duration - startBeatRef.current,
              bpm,
            );
          const noteDurSec = noteEnd - noteTime;
          if (noteDurSec < 0.02) return;
          if (noteTime + 0.05 >= now && noteTime < windowEnd) {
            if (!scheduledNoteIdsRef.current.has(note.id)) {
              scheduledNoteIdsRef.current.add(note.id);
              graph.noteOn(note.pitch, note.velocity, noteTime, noteDurSec);
            }
          }
        });
      }

      if (track.type === "audio") {
        track.audioClips.forEach((clip) => {
          if (loopEnabled) {
            const clipEndBeat = clip.startTime + clip.duration;
            if (clipEndBeat <= loopStart || clip.startTime >= loopEnd) return;
          }
          const buf = audioBuffers[clip.bufferKey];
          if (!buf) return;
          const clipStart =
            startAudioTimeRef.current +
            beatsToSeconds(clip.startTime - startBeatRef.current, bpm);
          const clipEnd =
            startAudioTimeRef.current +
            beatsToSeconds(
              clip.startTime + clip.duration - startBeatRef.current,
              bpm,
            );
          const clipDurSec = clipEnd - clipStart;
          if (clipDurSec < 0.02) return;
          if (clipStart + 0.05 >= now && clipStart < windowEnd) {
            const src = ctx.createBufferSource();
            const clipGain = ctx.createGain();
            src.buffer = buf;
            clipGain.gain.setValueAtTime(0, clipStart);
            clipGain.gain.linearRampToValueAtTime(
              0.8,
              clipStart + FADE_DURATION,
            );
            clipGain.gain.setValueAtTime(0.8, clipEnd - FADE_DURATION);
            clipGain.gain.linearRampToValueAtTime(0, clipEnd);
            src.connect(clipGain);
            if (graph.fxNodes.length > 0 && graph.fxNodes[0].instance) {
              clipGain.connect(graph.fxNodes[0].instance.input);
            } else {
              clipGain.connect(graph.input);
            }
            src.start(clipStart, clip.trimStart, clipDurSec + FADE_DURATION);
            src.stop(clipEnd + FADE_DURATION);
            scheduledNodesRef.current.push({
              stop: () => {
                try {
                  src.stop();
                } catch {}
              },
            });
          }
        });
      }
    });
  }, [getCtx, beatsToSeconds, updateTrackNodes, syncPluginChain]);

  const stopAllNodes = () => {
    scheduledNodesRef.current.forEach((n) => n.stop());
    scheduledNodesRef.current.length = 0;
  };

  const updatePlayhead = useCallback(() => {
    const state = useStore.getState();
    if (!state.transport.playing) return;
    const ctx = ctxRef.current;
    if (!ctx) return;
    const bpm = state.transport.bpm;
    const elapsedSec = ctx.currentTime - startAudioTimeRef.current;
    const elapsedBeats = (elapsedSec / 60) * bpm;
    let newPos = startBeatRef.current + elapsedBeats;

    if (state.transport.loopEnabled && newPos >= state.transport.loopEnd) {
      const overshoot = newPos - state.transport.loopEnd;
      startAudioTimeRef.current = ctx.currentTime;
      startBeatRef.current = state.transport.loopStart + overshoot;
      scheduledNoteIdsRef.current.clear();
      scheduleAhead();
      useStore.getState().setPlayhead(state.transport.loopStart + overshoot);
      return;
    }

    useStore.getState().setPlayhead(newPos);
  }, [scheduleAhead]);

  const updateMeterLevels = useCallback(() => {
    const state = useStore.getState();
    const tracks = state.tracks;
    const meterData: Record<string, { left: number; right: number }> = {};

    const readAnalyser = (analyser: AnalyserNode) => {
      const bufLen = analyser.frequencyBinCount;
      const data = new Uint8Array(bufLen);
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < bufLen; i++) {
        const normalized = (data[i] - 128) / 128;
        sum += normalized * normalized;
      }
      return Math.min(1, Math.sqrt(sum / bufLen));
    };

    tracks.forEach((track) => {
      const graph = graphStore.get(track.id);
      if (!graph) return;
      meterData[track.id] = {
        left: readAnalyser(graph.analyserLeft),
        right: readAnalyser(graph.analyserRight),
      };
    });

    if (masterAnalyserLeftRef.current && masterAnalyserRightRef.current) {
      useStore.getState().setMasterMeter({
        left: readAnalyser(masterAnalyserLeftRef.current),
        right: readAnalyser(masterAnalyserRightRef.current),
      });
    }

    useStore.getState().setMeterLevels(meterData);
  }, []);

  const rafLoop = useCallback(() => {
    updatePlayhead();
    updateMeterLevels();
    rafRef.current = requestAnimationFrame(rafLoop);
  }, [updatePlayhead, updateMeterLevels]);

  const startPlayback = useCallback(async () => {
    const ctx = getCtx();
    if (ctx.state === "suspended") await ctx.resume();

    if (!workletLoaded) {
      try {
        await ctx.audioWorklet.addModule("/threeOscWorklet.js");
        workletLoaded = true;
      } catch (err) {
        console.error("AudioWorklet load failed:", err);
      }
    }

    const state = useStore.getState();
    let playhead = state.transport.playheadPosition;
    if (state.transport.loopEnabled) {
      if (
        playhead < state.transport.loopStart ||
        playhead >= state.transport.loopEnd
      ) {
        playhead = state.transport.loopStart;
        useStore.getState().setPlayhead(playhead);
      }
    }

    scheduledNoteIdsRef.current.clear();

    startAudioTimeRef.current = ctx.currentTime;
    startBeatRef.current = playhead;

    state.tracks.forEach((t) => {
      ensureGraph(t.id);
      syncPluginChain(t.id);
    });

    updateTrackNodes();
    scheduleAhead();

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(scheduleAhead, SCHEDULE_INTERVAL);

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(rafLoop);

    useStore.getState().setTransport({ playing: true });
  }, [
    getCtx,
    ensureGraph,
    syncPluginChain,
    updateTrackNodes,
    scheduleAhead,
    rafLoop,
  ]);

  const stopPlayback = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    stopAllNodes();
    scheduledNoteIdsRef.current.clear();

    graphStore.forEach((graph) => {
      if (graph.instrumentInstance) {
        graph.instrumentInstance.stopAllVoices();
      }
    });

    useStore.getState().setTransport({ playing: false });
    useStore.getState().setMeterLevels({});
    useStore.getState().setMasterMeter({ left: 0, right: 0 });
  }, []);

  const togglePlay = useCallback(() => {
    const { playing } = useStore.getState().transport;
    if (playing) stopPlayback();
    else startPlayback();
  }, [startPlayback, stopPlayback]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      stopAllNodes();
    };
  }, []);

  return { togglePlay, stopPlayback, startPlayback };
}
