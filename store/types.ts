export interface MidiNote {
  id: string;
  pitch: number;
  startTime: number;
  duration: number;
  velocity: number;
  clipId?: string; // milik clip tertentu
}

export interface AudioClip {
  id: string;
  bufferKey: string;
  name: string;
  startTime: number;
  duration: number;
  trimStart: number;
  trimEnd: number;
}

export interface MidiClip {
  id: string;
  name: string;
  startTime: number;
  duration: number;
}

export type TrackType = "midi" | "audio";

export interface FXChainItem {
  type: string; // "reverb" | "delay"
  params: Record<string, number>;
  bypass: boolean;
}

export interface Track {
  id: string;
  name: string;
  type: TrackType;
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  midiNotes: MidiNote[]; // semua note (dengan clipId)
  audioClips: AudioClip[];
  clips: MidiClip[]; // clip arrangement
  height?: number;
  eqLow: number; // -12 … 12 dB
  eqMid: number;
  eqHigh: number;
  instrumentType: string | null; // "threeOscSynth" etc.
  instrumentParams: Record<string, any>; // synth parameters
  fxChain: FXChainItem[];
}
export interface WindowRect {
  x: number;
  y: number;
  width: number;
  height: number;
  minimized: boolean; // wajib ada
}

export type WindowId = "trackList" | "timeline" | "midiEditor" | "audioEditor";

export interface TransportState {
  playing: boolean;
  recording: boolean;
  bpm: number;
  playheadPosition: number;
  loopEnabled: boolean;
  loopStart: number;
  loopEnd: number;
  masterVolume: number;
}

export interface AppState {
  tracks: Track[];
  transport: TransportState;
  windows: Record<WindowId, WindowRect>;
  activeWindow: WindowId | null;
  selectedTrackId: string | null;
  selectedNoteIds: string[];
  selectedClipId: string | null;
  snapToGrid: boolean;
  gridResolution: number;
  defaultNoteLength: number;
  nextTrackId: number;
  nextNoteId: number;
  nextClipId: number;
  clipboard: Omit<MidiNote, "id">[];
  undoStack: MidiNote[][];
  redoStack: MidiNote[][];
  undoRedoTrackId: string | null;
  startMenuOpen: boolean;
  audioBuffers: Record<string, AudioBuffer | null>;
  meterLevels: Record<string, { left: number; right: number }>;
  masterMeter: { left: number; right: number };
  // Plugin window
  openPluginTrackId: string | null;
  openPluginType: "instrument" | "fx" | null;
  openPluginFxIndex: number | null;
  // Plugin browser
  pluginBrowserTrackId: string | null;
  pluginBrowserType: "instrument" | "fx" | null;
  pluginBrowserFxIndex: number | null;
}

export interface AppActions {
  // Tracks
  addTrack: (type: TrackType) => void;
  removeTrack: (trackId: string) => void;
  updateTrack: (trackId: string, updates: Partial<Track>) => void;

  // MIDI notes
  addMidiNote: (trackId: string, note: Omit<MidiNote, "id">) => string;
  updateMidiNote: (
    trackId: string,
    noteId: string,
    updates: Partial<MidiNote>,
  ) => void;
  removeMidiNote: (trackId: string, noteId: string) => void;
  removeSelectedNotes: (trackId: string) => void;
  shiftMidiNotes: (trackId: string, deltaBeat: number, clipId?: string) => void;
  duplicateMidiNotes: (
    trackId: string,
    patternStart: number,
    patternLength: number,
    offset: number,
    clipId?: string,
  ) => void;

  // Audio clips
  addAudioClip: (trackId: string, clip: Omit<AudioClip, "id">) => string;
  updateAudioClip: (
    trackId: string,
    clipId: string,
    updates: Partial<AudioClip>,
  ) => void;
  removeAudioClip: (trackId: string, clipId: string) => void;

  // MIDI clips
  addMidiClip: (trackId: string, clip: Omit<MidiClip, "id">) => string;
  updateMidiClip: (
    trackId: string,
    clipId: string,
    updates: Partial<MidiClip>,
  ) => void;
  removeMidiClip: (trackId: string, clipId: string) => void;
  cutMidiClip: (trackId: string, clipId: string, cutBeat: number) => void;
  duplicateMidiClip: (trackId: string, clipId: string) => void;
  trimMidiClip: (trackId: string, clipEnd: number, clipId?: string) => void;

  // Plugin system
  setTrackInstrument: (trackId: string, instrumentType: string) => void;
  addTrackFX: (trackId: string, fxType: string) => void;
  removeTrackFX: (trackId: string, fxIndex: number) => void;
  updateTrackFX: (
    trackId: string,
    fxIndex: number,
    updates: Partial<FXChainItem>,
  ) => void;
  openPluginWindow: (
    trackId: string,
    type: "instrument" | "fx",
    fxIndex: number | null,
  ) => void;
  closePluginWindow: () => void;
  openPluginBrowser: (
    trackId: string,
    type: "instrument" | "fx",
    fxIndex: number | null,
  ) => void;
  closePluginBrowser: () => void;
  // Transport
  setTransport: (updates: Partial<TransportState>) => void;
  setPlayhead: (position: number) => void;
  setLoopEnabled: (enabled: boolean) => void;
  setLoopStart: (start: number) => void;
  setLoopEnd: (end: number) => void;
  setMasterVolume: (vol: number) => void;

  // Meter levels
  setMeterLevels: (
    levels: Record<string, { left: number; right: number }>,
  ) => void;
  setMasterMeter: (level: { left: number; right: number }) => void;

  // Windows
  moveWindow: (id: WindowId, rect: Partial<WindowRect>) => void;
  toggleWindow: (id: WindowId) => void;
  setActiveWindow: (id: WindowId | null) => void;

  // Selection
  setSelectedTrackId: (id: string | null) => void;
  setSelectedNoteIds: (ids: string[]) => void;
  setSelectedClipId: (id: string | null) => void;
  toggleNoteSelection: (noteId: string) => void;

  // Settings
  setSnapToGrid: (snap: boolean) => void;
  setGridResolution: (res: number) => void;
  setDefaultNoteLength: (length: number) => void;
  setClipboard: (notes: Omit<MidiNote, "id">[]) => void;
  pushUndo: (trackId: string) => void;
  undo: () => void;
  redo: () => void;

  // Start menu
  setStartMenuOpen: (open: boolean) => void;

  // Audio buffers
  setAudioBuffer: (key: string, buffer: AudioBuffer | null) => void;

  // ID generators
  getNextTrackId: () => string;
  getNextNoteId: () => string;
  getNextClipId: () => string;
}
