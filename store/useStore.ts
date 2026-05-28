"use client";

import { create } from "zustand";
import type {
  AppState,
  AppActions,
  TrackType,
  MidiNote,
  AudioClip,
  MidiClip,
  Track,
} from "./types";

const INITIAL_WINDOWS = {
  trackList: { x: 16, y: 48, width: 240, height: 350, minimized: false },
  timeline: { x: 272, y: 48, width: 650, height: 350, minimized: false },
  midiEditor: { x: 120, y: 420, width: 500, height: 280, minimized: false },
  audioEditor: { x: 640, y: 420, width: 500, height: 280, minimized: false },
};

export const useStore = create<AppState & AppActions>((set, get) => ({
  // ---- State ----
  tracks: [],
  transport: {
    playing: false,
    recording: false,
    bpm: 120,
    playheadPosition: 0,
    loopEnabled: false,
    loopStart: 0,
    loopEnd: 4,
    masterVolume: 80,
  },
  windows: INITIAL_WINDOWS,
  activeWindow: null,
  selectedTrackId: null,
  selectedNoteIds: [],
  selectedClipId: null,
  snapToGrid: true,
  gridResolution: 0.25,
  defaultNoteLength: 0.25,
  clipboard: [],
  undoStack: [],
  redoStack: [],
  undoRedoTrackId: null,
  nextTrackId: 1,
  nextNoteId: 1,
  nextClipId: 1,
  startMenuOpen: false,
  audioBuffers: {},
  meterLevels: {}, // ✅ real‑time track meters
  masterMeter: { left: 0, right: 0 }, // ✅ master meter
  openPluginTrackId: null as string | null,
  openPluginType: null as "instrument" | "fx" | null,
  openPluginFxIndex: null as number | null,
  pluginBrowserTrackId: null as string | null,
  pluginBrowserType: null as "instrument" | "fx" | null,
  pluginBrowserFxIndex: null as number | null,
  // ---- Track Actions ----
  addTrack: (type: TrackType) => {
    const { tracks, getNextTrackId, getNextClipId } = get();
    const trackId = getNextTrackId();
    const newTrack: Track = {
      id: trackId,
      name: `${type === "midi" ? "MIDI" : "Audio"} ${tracks.length + 1}`,
      type,
      volume: 80,
      pan: 0,
      muted: false,
      solo: false,
      midiNotes: [],
      audioClips: [],
      clips: [],
      eqLow: 0,
      eqMid: 0,
      eqHigh: 0,
      instrumentType: null,
      instrumentParams: {},
      fxChain: [],
    };
    if (type === "midi") {
      const clipId = getNextClipId();
      newTrack.clips = [
        { id: clipId, name: "Clip 1", startTime: 0, duration: 4 },
      ];
      set({
        tracks: [...tracks, newTrack],
        selectedTrackId: trackId,
        selectedClipId: clipId,
      });
    } else {
      set({
        tracks: [...tracks, newTrack],
        selectedTrackId: trackId,
      });
    }
  },

  removeTrack: (trackId) => {
    set((s) => ({
      tracks: s.tracks.filter((t) => t.id !== trackId),
      selectedTrackId: s.selectedTrackId === trackId ? null : s.selectedTrackId,
    }));
  },

  updateTrack: (trackId, updates) => {
    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.id === trackId ? { ...t, ...updates } : t,
      ),
    }));
  },

  // ---- MIDI Notes ----
  addMidiNote: (trackId, note) => {
    const { getNextNoteId } = get();
    const id = getNextNoteId();
    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.id === trackId
          ? { ...t, midiNotes: [...t.midiNotes, { ...note, id }] }
          : t,
      ),
    }));
    return id;
  },

  updateMidiNote: (trackId, noteId, updates) => {
    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.id === trackId
          ? {
              ...t,
              midiNotes: t.midiNotes.map((n) =>
                n.id === noteId ? { ...n, ...updates } : n,
              ),
            }
          : t,
      ),
    }));
  },

  removeMidiNote: (trackId, noteId) => {
    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.id === trackId
          ? { ...t, midiNotes: t.midiNotes.filter((n) => n.id !== noteId) }
          : t,
      ),
      selectedNoteIds: s.selectedNoteIds.filter((id) => id !== noteId),
    }));
  },

  removeSelectedNotes: (trackId) => {
    const { selectedNoteIds } = get();
    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.id === trackId
          ? {
              ...t,
              midiNotes: t.midiNotes.filter(
                (n) => !selectedNoteIds.includes(n.id),
              ),
            }
          : t,
      ),
      selectedNoteIds: [],
    }));
  },

  shiftMidiNotes: (trackId, deltaBeat, clipId) => {
    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.id === trackId
          ? {
              ...t,
              midiNotes: t.midiNotes.map((n) =>
                clipId && n.clipId !== clipId
                  ? n
                  : { ...n, startTime: Math.max(0, n.startTime + deltaBeat) },
              ),
            }
          : t,
      ),
    }));
  },

  duplicateMidiNotes: (trackId, patternStart, patternLength, offset, clipId) =>
    set((s) => {
      const track = s.tracks.find((t) => t.id === trackId);
      if (!track) return s;
      const notesInRange = track.midiNotes.filter(
        (n) =>
          n.startTime >= patternStart &&
          n.startTime < patternStart + patternLength &&
          (!clipId || n.clipId === clipId),
      );
      const duplicated = notesInRange.map((n) => ({
        ...n,
        id: `note-${s.nextNoteId++}`,
        startTime: n.startTime + offset,
      }));
      return {
        tracks: s.tracks.map((t) =>
          t.id === trackId
            ? { ...t, midiNotes: [...t.midiNotes, ...duplicated] }
            : t,
        ),
      };
    }),

  trimMidiClip: (trackId, clipEnd, clipId) =>
    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.id === trackId
          ? {
              ...t,
              midiNotes: t.midiNotes.reduce((acc, note) => {
                if (clipId && note.clipId !== clipId) return [...acc, note];
                const noteEnd = note.startTime + note.duration;
                if (note.startTime >= clipEnd) return acc;
                if (noteEnd > clipEnd) {
                  return [
                    ...acc,
                    { ...note, duration: clipEnd - note.startTime },
                  ];
                }
                return [...acc, note];
              }, [] as MidiNote[]),
            }
          : t,
      ),
    })),

  // ---- Audio Clips ----
  addAudioClip: (trackId, clip) => {
    const { getNextClipId } = get();
    const id = getNextClipId();
    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.id === trackId
          ? { ...t, audioClips: [...t.audioClips, { ...clip, id }] }
          : t,
      ),
    }));
    return id;
  },
  updateAudioClip: (trackId, clipId, updates) => {
    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.id === trackId
          ? {
              ...t,
              audioClips: t.audioClips.map((c) =>
                c.id === clipId ? { ...c, ...updates } : c,
              ),
            }
          : t,
      ),
    }));
  },
  removeAudioClip: (trackId, clipId) => {
    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.id === trackId
          ? { ...t, audioClips: t.audioClips.filter((c) => c.id !== clipId) }
          : t,
      ),
    }));
  },

  // ---- MIDI Clips ----
  addMidiClip: (trackId, clip) => {
    const { getNextClipId } = get();
    const id = getNextClipId();
    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.id === trackId ? { ...t, clips: [...t.clips, { ...clip, id }] } : t,
      ),
    }));
    return id;
  },
  updateMidiClip: (trackId, clipId, updates) => {
    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.id === trackId
          ? {
              ...t,
              clips: t.clips.map((c) =>
                c.id === clipId ? { ...c, ...updates } : c,
              ),
            }
          : t,
      ),
    }));
  },
  removeMidiClip: (trackId, clipId) => {
    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.id === trackId
          ? { ...t, clips: t.clips.filter((c) => c.id !== clipId) }
          : t,
      ),
    }));
  },

  cutMidiClip: (trackId, clipId, cutBeat) => {
    const state = get();
    const track = state.tracks.find((t) => t.id === trackId);
    if (!track) return;
    const clip = track.clips.find((c) => c.id === clipId);
    if (!clip) return;

    const clipStart = clip.startTime;
    const clipEnd = clipStart + clip.duration;
    if (cutBeat <= clipStart || cutBeat >= clipEnd) return;

    const leftNotes: MidiNote[] = [];
    const rightNotes: MidiNote[] = [];
    track.midiNotes.forEach((note) => {
      if (note.clipId !== clipId) {
        leftNotes.push(note);
        return;
      }
      const noteEnd = note.startTime + note.duration;
      if (noteEnd <= cutBeat) leftNotes.push(note);
      else if (note.startTime >= cutBeat) rightNotes.push(note);
      else {
        const leftPart = {
          ...note,
          id: `note-${get().nextNoteId++}`,
          duration: cutBeat - note.startTime,
          clipId,
        };
        const rightPart = {
          ...note,
          id: `note-${get().nextNoteId++}`,
          startTime: cutBeat,
          duration: noteEnd - cutBeat,
          clipId,
        };
        leftNotes.push(leftPart);
        rightNotes.push(rightPart);
      }
    });

    const newClip1: MidiClip = {
      id: `clip-${get().nextClipId++}`,
      name: clip.name + " (1)",
      startTime: clipStart,
      duration: cutBeat - clipStart,
    };
    const newClip2: MidiClip = {
      id: `clip-${get().nextClipId++}`,
      name: clip.name + " (2)",
      startTime: cutBeat,
      duration: clipEnd - cutBeat,
    };

    const otherNotes = track.midiNotes.filter((n) => n.clipId !== clipId);
    const updatedLeft = leftNotes
      .filter((n) => n.clipId === clipId)
      .map((n) => ({ ...n, clipId: newClip1.id }));
    const updatedRight = rightNotes
      .filter((n) => n.clipId === clipId)
      .map((n) => ({ ...n, clipId: newClip2.id }));
    const newNotes = [...otherNotes, ...updatedLeft, ...updatedRight];
    const newClips = track.clips
      .filter((c) => c.id !== clipId)
      .concat([newClip1, newClip2]);

    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.id === trackId ? { ...t, clips: newClips, midiNotes: newNotes } : t,
      ),
    }));
  },

  duplicateMidiClip: (trackId, clipId) => {
    const state = get();
    const track = state.tracks.find((t) => t.id === trackId);
    if (!track) return;
    const clip = track.clips.find((c) => c.id === clipId);
    if (!clip) return;

    const clipStart = clip.startTime;
    const clipEnd = clipStart + clip.duration;

    const originalNotes = track.midiNotes.filter(
      (n) =>
        n.clipId === clipId &&
        n.startTime >= clipStart &&
        n.startTime < clipEnd,
    );

    const newClipId = `clip-${get().nextClipId++}`;
    const duplicateNotes = originalNotes.map((n) => ({
      ...n,
      id: `note-${get().nextNoteId++}`,
      startTime: n.startTime + clip.duration,
      clipId: newClipId,
    }));

    const newClip: MidiClip = {
      id: newClipId,
      name: clip.name + " (copy)",
      startTime: clipStart + clip.duration,
      duration: clip.duration,
    };

    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.id === trackId
          ? {
              ...t,
              clips: [...t.clips, newClip],
              midiNotes: [...t.midiNotes, ...duplicateNotes],
            }
          : t,
      ),
    }));
  },

  // ---- Transport ----
  setTransport: (updates) =>
    set((s) => ({ transport: { ...s.transport, ...updates } })),
  setPlayhead: (position) =>
    set((s) => ({ transport: { ...s.transport, playheadPosition: position } })),
  setLoopEnabled: (enabled) =>
    set((s) => ({ transport: { ...s.transport, loopEnabled: enabled } })),
  setLoopStart: (start) =>
    set((s) => ({ transport: { ...s.transport, loopStart: start } })),
  setLoopEnd: (end) =>
    set((s) => ({ transport: { ...s.transport, loopEnd: end } })),

  // ---- Meter levels (updated by audio engine) ----
  setMeterLevels: (levels) =>
    set({ meterLevels: { ...get().meterLevels, ...levels } }),
  setMasterMeter: (level) =>
    set((s) => ({ masterMeter: { ...s.masterMeter, ...level } })),

  // ---- Windows ----
  moveWindow: (id, rect) =>
    set((s) => ({
      windows: { ...s.windows, [id]: { ...s.windows[id], ...rect } },
    })),
  toggleWindow: (id) =>
    set((s) => ({
      windows: {
        ...s.windows,
        [id]: { ...s.windows[id], minimized: !s.windows[id].minimized },
      },
    })),
  setActiveWindow: (id) => set({ activeWindow: id }),

  // ---- Selection ----
  setSelectedTrackId: (id) => set({ selectedTrackId: id }),
  setSelectedNoteIds: (ids) => set({ selectedNoteIds: ids }),
  setSelectedClipId: (id) => set({ selectedClipId: id }),
  toggleNoteSelection: (noteId) =>
    set((s) => ({
      selectedNoteIds: s.selectedNoteIds.includes(noteId)
        ? s.selectedNoteIds.filter((id) => id !== noteId)
        : [...s.selectedNoteIds, noteId],
    })),

  // ---- Settings ----
  setSnapToGrid: (snap) => set({ snapToGrid: snap }),
  setGridResolution: (res) => set({ gridResolution: res }),
  setDefaultNoteLength: (length) => set({ defaultNoteLength: length }),
  setClipboard: (notes) => set({ clipboard: notes }),

  pushUndo: (trackId) => {
    const state = get();
    if (state.undoRedoTrackId !== trackId) {
      // Different track context — clear stacks
      set({ undoStack: [], redoStack: [], undoRedoTrackId: trackId });
    }
    const track = state.tracks.find(t => t.id === trackId);
    if (!track) return;
    const MAX_UNDO = 50;
    const newStack = [...get().undoStack, track.midiNotes];
    if (newStack.length > MAX_UNDO) newStack.shift();
    set({ undoStack: newStack, redoStack: [] });
  },

  undo: () => {
    const state = get();
    if (state.undoStack.length === 0 || !state.undoRedoTrackId) return;
    const currentTrack = state.tracks.find(t => t.id === state.undoRedoTrackId);
    if (!currentTrack) return;
    const prevNotes = state.undoStack[state.undoStack.length - 1];
    set({
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, currentTrack.midiNotes],
      tracks: state.tracks.map(t =>
        t.id === state.undoRedoTrackId ? { ...t, midiNotes: prevNotes } : t
      ),
    });
  },

  redo: () => {
    const state = get();
    if (state.redoStack.length === 0 || !state.undoRedoTrackId) return;
    const currentTrack = state.tracks.find(t => t.id === state.undoRedoTrackId);
    if (!currentTrack) return;
    const nextNotes = state.redoStack[state.redoStack.length - 1];
    set({
      redoStack: state.redoStack.slice(0, -1),
      undoStack: [...state.undoStack, currentTrack.midiNotes],
      tracks: state.tracks.map(t =>
        t.id === state.undoRedoTrackId ? { ...t, midiNotes: nextNotes } : t
      ),
    });
  },

  // ---- Start Menu ----
  setStartMenuOpen: (open) => set({ startMenuOpen: open }),

  // ---- Master Volume ----
  setMasterVolume: (vol) =>
    set((s) => ({ transport: { ...s.transport, masterVolume: vol } })),

  // ---- Audio Buffers ----
  setAudioBuffer: (key, buffer) =>
    set((s) => ({ audioBuffers: { ...s.audioBuffers, [key]: buffer } })),

  // ---- ID Generators ----
  getNextTrackId: () => {
    const id = `track-${get().nextTrackId}`;
    set({ nextTrackId: get().nextTrackId + 1 });
    return id;
  },
  getNextNoteId: () => {
    const id = `note-${get().nextNoteId}`;
    set({ nextNoteId: get().nextNoteId + 1 });
    return id;
  },
  getNextClipId: () => {
    const id = `clip-${get().nextClipId}`;
    set({ nextClipId: get().nextClipId + 1 });
    return id;
  },
  setTrackInstrument: (trackId, instrumentType) =>
    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.id === trackId
          ? {
              ...t,
              instrumentType,
              instrumentParams:
                instrumentType === "threeOscSynth"
                  ? {
                      osc1: { waveform: "saw", vol: 0.8, pan: -0.5, detune: 0, octave: 0, unisonVoices: 1, unisonDetune: 1, unisonPhase: 50, phaseMode: "free", unisonBlend: 100, unisonSpread: 50, driftAmount: 0 },
                      osc2: { waveform: "square", vol: 0.4, pan: 0.5, detune: 0, octave: 0, unisonVoices: 1, unisonDetune: 1, unisonPhase: 50, phaseMode: "free", unisonBlend: 100, unisonSpread: 50, driftAmount: 0 },
                      osc3: { waveform: "sine", vol: 0.2, pan: 0, detune: 0, octave: 0, unisonVoices: 1, unisonDetune: 1, unisonPhase: 50, phaseMode: "free", unisonBlend: 100, unisonSpread: 50, driftAmount: 0 },
                      delay: 0,
                      attack: 0.01,
                      hold: 0,
                      decay: 0.1,
                      sustain: 0.7,
                      release: 0.3,
                      attackCurve: 0.5,
                      decayCurve: 0.5,
                      releaseCurve: 0.5,
                      masterGain: 0.7,
                      filterFreq: 3000,
                      filterRes: 0.5,
                      filterType: "lowpass",
                      filterEnv: 3000,
                    }
                  : {},
            }
          : t,
      ),
    })),

  addTrackFX: (trackId, fxType) =>
    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.id === trackId
          ? {
              ...t,
              fxChain: [
                ...t.fxChain,
                { type: fxType, params: {}, bypass: false },
              ],
            }
          : t,
      ),
    })),

  removeTrackFX: (trackId, fxIndex) =>
    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.id === trackId
          ? { ...t, fxChain: t.fxChain.filter((_, i) => i !== fxIndex) }
          : t,
      ),
    })),

  updateTrackFX: (trackId, fxIndex, updates) =>
    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.id === trackId
          ? {
              ...t,
              fxChain: t.fxChain.map((fx, i) =>
                i === fxIndex ? { ...fx, ...updates } : fx,
              ),
            }
          : t,
      ),
    })),

  openPluginWindow: (trackId, type, fxIndex) =>
    set({
      openPluginTrackId: trackId,
      openPluginType: type,
      openPluginFxIndex: fxIndex,
    }),

  closePluginWindow: () =>
    set({
      openPluginTrackId: null,
      openPluginType: null,
      openPluginFxIndex: null,
    }),

  openPluginBrowser: (trackId, type, fxIndex) =>
    set({
      pluginBrowserTrackId: trackId,
      pluginBrowserType: type,
      pluginBrowserFxIndex: fxIndex,
    }),

  closePluginBrowser: () =>
    set({
      pluginBrowserTrackId: null,
      pluginBrowserType: null,
      pluginBrowserFxIndex: null,
    }),
}));
