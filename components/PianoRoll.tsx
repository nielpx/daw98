"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import { useStore } from "@/store/useStore";
import type { Track, MidiNote } from "@/store/types";

const PIANO_KEY_WIDTH = 30;
const BASE_NOTE_HEIGHT = 16;
const BASE_BEAT_WIDTH = 60;
const NOTE_MIN_PITCH = 36;
const NOTE_MAX_PITCH = 96;
const RULER_HEIGHT = 18;

const WHITE_KEYS = new Set([0, 2, 4, 5, 7, 9, 11]);
const NOTE_NAMES = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
];

interface PianoRollProps {
  trackId: string;
  track: Track;
  patternStart: number;
  patternLength: number;
  clipId: string | null;
}

export default function PianoRoll({
  trackId, track, patternStart, patternLength, clipId,
}: PianoRollProps) {
  const {
    addMidiNote, transport, updateMidiNote, removeMidiNote,
    removeSelectedNotes, selectedNoteIds, setSelectedNoteIds,
    toggleNoteSelection, snapToGrid, setSnapToGrid,
    defaultNoteLength, setDefaultNoteLength,
    clipboard, setClipboard,
    pushUndo, undo, redo,
  } = useStore();

  const scrollRef = useRef<HTMLDivElement>(null);
  const velocityScrollRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<"draw" | "erase" | "select">("draw");
  const [zoomH, setZoomH] = useState(1.5);
  const [zoomV, setZoomV] = useState(1.5);
  const [velocityPanelHeight, setVelocityPanelHeight] = useState(80);

  const VELOCITY_BAR_WIDTH = 6;

  const effectiveBeatWidth = Math.round(BASE_BEAT_WIDTH * zoomH);
  const effectiveNoteHeight = Math.round(BASE_NOTE_HEIGHT * zoomV);
  const totalPitches = NOTE_MAX_PITCH - NOTE_MIN_PITCH + 1;
  const canvasHeight = totalPitches * effectiveNoteHeight;
  const canvasWidth = Math.ceil(patternLength * effectiveBeatWidth) + 4;

  // ── Interaction state ──
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawNoteId, setDrawNoteId] = useState<string | null>(null);
  const drawDataRef = useRef({ startBeat: 0, pitch: 60, startTime: 0, duration: 0.25 });
  const [resizingId, setResizingId] = useState<string | null>(null);
  const resizeStartRef = useRef({ clientX: 0, origDuration: 0, noteStartBeat: 0 });
  const [movingId, setMovingId] = useState<string | null>(null);
  const moveStartRef = useRef({ clientX: 0, clientY: 0, origStartTime: 0, origPitch: 0 });

  // ── Box‑select state ──
  const [boxSelecting, setBoxSelecting] = useState(false);
  const boxStartRef = useRef<{ beat: number; pitch: number }>({ beat: 0, pitch: 0 });
  const [boxEnd, setBoxEnd] = useState<{ beat: number; pitch: number } | null>(null);

  // ── Copy‑drag state ──
  const lastClickBeatRef = useRef(patternStart);
  const [copyDragData, setCopyDragData] = useState<{
    origNotes: { startTime: number; pitch: number; duration: number; velocity: number }[];
    deltaBeat: number;
    deltaPitch: number;
  } | null>(null);
  const copyDragStartRef = useRef({ clientX: 0, clientY: 0 });

  // ── Auto‑scroll refs ──
  const lastMousePosRef = useRef({ clientX: 0, clientY: 0 });
  const autoScrollTimerRef = useRef<number | null>(null);
  const autoScrollDirRef = useRef({ dirX: 0, dirY: 0 });
  const movingIdRef = useRef(movingId);
  movingIdRef.current = movingId;
  const copyDragDataRef = useRef(copyDragData);
  copyDragDataRef.current = copyDragData;

  const syncingScroll = useRef(false);

  // ── Auto‑scroll function refs (updated each render to avoid stale closures) ──
  const processDragMoveRef = useRef<(clientX: number, clientY: number) => void>(() => {});
  const checkAutoScrollRef = useRef<(clientX: number, clientY: number) => void>(() => {});

  // Update auto‑scroll function refs on every render with latest closure values
  processDragMoveRef.current = (clientX: number, clientY: number) => {
    const mid = movingIdRef.current;
    if (mid) {
      const { beat, pitch } = mouseToWorld(clientX, clientY);
      const startWorld = mouseToWorld(moveStartRef.current.clientX, moveStartRef.current.clientY);
      const deltaBeat = beat - startWorld.beat;
      const deltaPitch = pitch - startWorld.pitch;
      const currentSelection = useStore.getState().selectedNoteIds;
      const idsToMove = currentSelection.length > 1 ? currentSelection : [mid];
      idsToMove.forEach(noteId => {
        const note = track.midiNotes.find(n => n.id === noteId);
        if (!note) return;
        let newStart = note.startTime + deltaBeat;
        if (snapToGrid) newStart = snapBeat(newStart);
        const newPitch = Math.min(NOTE_MAX_PITCH, Math.max(NOTE_MIN_PITCH, note.pitch + deltaPitch));
        updateMidiNote(trackId, noteId, { startTime: Math.max(patternStart, newStart), pitch: newPitch });
      });
    } else if (copyDragDataRef.current) {
      const { beat, pitch } = mouseToWorld(clientX, clientY);
      const startWorld = mouseToWorld(copyDragStartRef.current.clientX, copyDragStartRef.current.clientY);
      setCopyDragData(prev => prev ? { ...prev, deltaBeat: beat - startWorld.beat, deltaPitch: pitch - startWorld.pitch } : null);
    }
  };

  checkAutoScrollRef.current = (clientX: number, clientY: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 40;
    const maxSpeed = 8;
    let dirX = 0, dirY = 0;
    if (clientX < rect.left + margin)
      dirX = -Math.ceil(maxSpeed * (1 - Math.max(0, clientX - rect.left) / margin));
    else if (clientX > rect.right - margin)
      dirX = Math.ceil(maxSpeed * (1 - Math.max(0, rect.right - clientX) / margin));
    if (clientY < rect.top + margin)
      dirY = -Math.ceil(maxSpeed * (1 - Math.max(0, clientY - rect.top) / margin));
    else if (clientY > rect.bottom - margin)
      dirY = Math.ceil(maxSpeed * (1 - Math.max(0, rect.bottom - clientY) / margin));
    autoScrollDirRef.current = { dirX, dirY };
    if (dirX === 0 && dirY === 0) {
      if (autoScrollTimerRef.current !== null) {
        cancelAnimationFrame(autoScrollTimerRef.current);
        autoScrollTimerRef.current = null;
      }
      return;
    }
    if (autoScrollTimerRef.current === null) {
      const tick = () => {
        const el = scrollRef.current;
        if (!el) { autoScrollTimerRef.current = null; return; }
        el.scrollLeft += autoScrollDirRef.current.dirX;
        el.scrollTop += autoScrollDirRef.current.dirY;
        if (movingIdRef.current || copyDragDataRef.current)
          processDragMoveRef.current(lastMousePosRef.current.clientX, lastMousePosRef.current.clientY);
        autoScrollTimerRef.current = requestAnimationFrame(tick);
      };
      autoScrollTimerRef.current = requestAnimationFrame(tick);
    }
  };

  // ── Velocity editing state ──
  const [editingVelocityId, setEditingVelocityId] = useState<string | null>(null);
  const velocityEditStartRef = useRef<{
    clientY: number;
    origVelocity: number;
    allSelectedOrig: Record<string, number>;
  }>({ clientY: 0, origVelocity: 0, allSelectedOrig: {} });

  /* ── Coordinate helpers ── */
  const mouseToWorld = useCallback((clientX: number, clientY: number) => {
    if (!scrollRef.current) return { beat: patternStart, pitch: 60 };
    const rect = scrollRef.current.getBoundingClientRect();
    const borderLeft = 2;
    const borderTop = 2;
    const x = clientX - rect.left + scrollRef.current.scrollLeft - PIANO_KEY_WIDTH - borderLeft;
    const y = clientY - rect.top + scrollRef.current.scrollTop - RULER_HEIGHT - borderTop;
    const beat = patternStart + x / effectiveBeatWidth;
    const row = Math.floor(y / effectiveNoteHeight);
    const pitch = NOTE_MAX_PITCH - row;
    return { beat, pitch };
  }, [effectiveBeatWidth, effectiveNoteHeight, patternStart]);

  const snapPixel = (x: number) => Math.round(x);
  const beatToPixel = (beat: number) => snapPixel((beat - patternStart) * effectiveBeatWidth);
  const pitchToPixel = (pitch: number) => snapPixel((NOTE_MAX_PITCH - pitch) * effectiveNoteHeight);

  /* ── Grid / Snap ── */
  const getGridInterval = useCallback((z: number): number => {
    if (z <= 0.5) return 4;
    if (z <= 1.0) return 1;
    if (z <= 1.75) return 0.25;
    if (z <= 2.25) return 0.125;
    return 0.0625;
  }, []);

  const snapBeat = useCallback((beat: number) => {
    if (!snapToGrid) return beat;
    const interval = getGridInterval(zoomH);
    return Math.floor(beat / interval) * interval;
  }, [snapToGrid, zoomH, getGridInterval]);

  const gridInterval = getGridInterval(zoomH);

  // 4-level grid hierarchy: bar(0), beat(1), subdivision(2), micro(3)
  const gridLines: number[][] = [[], [], [], []];
  const LEVEL_CONFIGS = [
    { baseOpacity: 0.85, minZoom: 0,    fullZoom: 0.5   },
    { baseOpacity: 0.50, minZoom: 0.5,  fullZoom: 1.0   },
    { baseOpacity: 0.25, minZoom: 1.0,  fullZoom: 1.75  },
    { baseOpacity: 0.10, minZoom: 1.75, fullZoom: 2.5   },
  ];
  const levelOpacities = LEVEL_CONFIGS.map(c => {
    const t = Math.min(1, Math.max(0, (zoomH - c.minZoom) / (c.fullZoom - c.minZoom)));
    return c.baseOpacity * t;
  });

  for (let b = 0; b <= patternLength; b += gridInterval) {
    if (Math.abs(b % 4) < 0.001) {
      gridLines[0].push(b);
    } else if (Math.abs(b % 1) < 0.001) {
      gridLines[1].push(b);
    } else if (Math.abs(b % 0.25) < 0.001) {
      gridLines[2].push(b);
    } else {
      gridLines[3].push(b);
    }
  }

  const visibleNotes = track.midiNotes.filter(
    n => n.startTime >= patternStart && n.startTime < patternStart + patternLength
  );

  /* ── Mouse handlers ── */
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Ignore clicks on scrollbar chrome
    if (scrollRef.current) {
      const rect = scrollRef.current.getBoundingClientRect();
      const contentRight = rect.left + (scrollRef.current.clientLeft || 0) + scrollRef.current.clientWidth;
      const contentBottom = rect.top + (scrollRef.current.clientTop || 0) + scrollRef.current.clientHeight;
      if (e.clientX > contentRight || e.clientY > contentBottom) return;
    }

    const target = e.target as HTMLElement;
    const ctrl = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;

    // ── Resize handle ──
    if (target.classList.contains("pr-resize-handle")) {
      pushUndo(trackId);
      e.stopPropagation();
      const noteId = target.dataset.noteId!;
      const note = track.midiNotes.find(n => n.id === noteId);
      if (!note) return;
      setResizingId(noteId);
      resizeStartRef.current = { clientX: e.clientX, origDuration: note.duration, noteStartBeat: note.startTime };
      setSelectedNoteIds([noteId]);
      return;
    }

    // ── Click on note body ──
    const noteBody = target.closest(".pr-note-body") as HTMLElement | null;
    if (noteBody) {
      e.stopPropagation();
      const noteId = noteBody.dataset.noteId!;
      const note = track.midiNotes.find(n => n.id === noteId);
      if (!note) return;

      if (tool === "erase") { removeMidiNote(trackId, noteId); return; }

      // ── Copy‑drag (Ctrl + click selected note in select mode) ──
      if (ctrl && tool === "select") {
        const currentSelection = useStore.getState().selectedNoteIds;
        if (currentSelection.includes(noteId) && currentSelection.length > 0) {
          const selectedNotes = track.midiNotes.filter(n => currentSelection.includes(n.id));
          setCopyDragData({
            origNotes: selectedNotes.map(n => ({ startTime: n.startTime, pitch: n.pitch, duration: n.duration, velocity: n.velocity })),
            deltaBeat: 0,
            deltaPitch: 0,
          });
          copyDragStartRef.current = { clientX: e.clientX, clientY: e.clientY };
          return;
        }
      }

      // ── Multi‑select logic ──
      if (ctrl) {
        toggleNoteSelection(noteId);
        return;
      }
      if (shift) {
        const current = useStore.getState().selectedNoteIds;
        if (!current.includes(noteId)) setSelectedNoteIds([...current, noteId]);
        else setSelectedNoteIds(current.filter(id => id !== noteId));
        return;
      }

      // Normal click — select AND allow immediate move
      pushUndo(trackId);
      const currentSelection = useStore.getState().selectedNoteIds;
      if (currentSelection.includes(noteId) && currentSelection.length > 1) {
        // Keep the multi‑selection and start moving all selected notes
        setMovingId(noteId);
        moveStartRef.current = { clientX: e.clientX, clientY: e.clientY, origStartTime: note.startTime, origPitch: note.pitch };
      } else {
        // Otherwise, select only this note and start moving it
        setSelectedNoteIds([noteId]);
        setMovingId(noteId);
        moveStartRef.current = { clientX: e.clientX, clientY: e.clientY, origStartTime: note.startTime, origPitch: note.pitch };
      }
      return;
    }

    // ── Click on background ──
    if (!ctrl && tool !== "select") setSelectedNoteIds([]);

    const { beat, pitch } = mouseToWorld(e.clientX, e.clientY);
    lastClickBeatRef.current = beat;
    if (beat < patternStart || beat > patternStart + patternLength) return;
    if (pitch < NOTE_MIN_PITCH || pitch > NOTE_MAX_PITCH) return;

    if (tool === "draw" && !ctrl && !shift) {
      pushUndo(trackId);
      const dur = defaultNoteLength;
      let startTime = snapToGrid ? snapBeat(beat) : beat;
      startTime = Math.max(patternStart, startTime);
      if (startTime + dur > patternStart + patternLength) startTime = patternStart + patternLength - dur;
      startTime = Math.max(patternStart, startTime);
      drawDataRef.current = { startBeat: beat, pitch, startTime, duration: dur };
      setIsDrawing(true);
      const id = addMidiNote(trackId, { pitch, startTime, duration: dur, velocity: 80, clipId: clipId || undefined });
      setDrawNoteId(id);
      setSelectedNoteIds([id]);
    } else if (tool === "erase" && !ctrl && !shift) {
      pushUndo(trackId);
      const snappedBeat = snapBeat(beat);
      const note = track.midiNotes.find(n => n.pitch === pitch && snappedBeat >= n.startTime && snappedBeat < n.startTime + n.duration);
      if (note) removeMidiNote(trackId, note.id);
    } else if (tool === "select" || ctrl) {
      // Start box‑select
      setSelectedNoteIds([]);
      setBoxSelecting(true);
      boxStartRef.current = { beat, pitch };
      setBoxEnd({ beat, pitch });
    }
  }, [trackId, track.midiNotes, tool, snapToGrid, zoomH, getGridInterval, defaultNoteLength, mouseToWorld, addMidiNote, removeMidiNote, toggleNoteSelection, setSelectedNoteIds, patternStart, patternLength, clipId, pushUndo]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (copyDragData) {
      const { beat, pitch } = mouseToWorld(e.clientX, e.clientY);
      const startWorld = mouseToWorld(copyDragStartRef.current.clientX, copyDragStartRef.current.clientY);
      setCopyDragData(prev => prev ? { ...prev, deltaBeat: beat - startWorld.beat, deltaPitch: pitch - startWorld.pitch } : null);
      lastMousePosRef.current = { clientX: e.clientX, clientY: e.clientY };
      checkAutoScrollRef.current(e.clientX, e.clientY);
      return;
    }

    if (boxSelecting) {
      const { beat, pitch } = mouseToWorld(e.clientX, e.clientY);
      setBoxEnd({ beat, pitch });
      return;
    }

    if (resizingId) {
      const { beat } = mouseToWorld(e.clientX, 0);
      const endBeat = snapToGrid ? snapBeat(beat) : beat;
      const newDuration = Math.max(0.01, endBeat - resizeStartRef.current.noteStartBeat);
      updateMidiNote(trackId, resizingId, { duration: newDuration });
      return;
    }

    if (movingId) {
      const { beat, pitch } = mouseToWorld(e.clientX, e.clientY);
      const startWorld = mouseToWorld(moveStartRef.current.clientX, moveStartRef.current.clientY);
      const deltaBeat = beat - startWorld.beat;
      const deltaPitch = pitch - startWorld.pitch;

      const currentSelection = useStore.getState().selectedNoteIds;
      const idsToMove = currentSelection.length > 1 ? currentSelection : [movingId];

      idsToMove.forEach(noteId => {
        const note = track.midiNotes.find(n => n.id === noteId);
        if (!note) return;
        let newStart = note.startTime + deltaBeat;
        if (snapToGrid) newStart = snapBeat(newStart);
        const newPitch = Math.min(NOTE_MAX_PITCH, Math.max(NOTE_MIN_PITCH, note.pitch + deltaPitch));
        updateMidiNote(trackId, noteId, { startTime: Math.max(patternStart, newStart), pitch: newPitch });
      });
      lastMousePosRef.current = { clientX: e.clientX, clientY: e.clientY };
      checkAutoScrollRef.current(e.clientX, e.clientY);
      return;
    }

    if (!isDrawing || !drawNoteId) return;
    const { beat } = mouseToWorld(e.clientX, 0);
    let endBeat = beat;
    if (snapToGrid) {
      const interval = getGridInterval(zoomH);
      endBeat = Math.round(endBeat / interval) * interval;
      if (endBeat <= drawDataRef.current.startTime) endBeat = drawDataRef.current.startTime + interval;
    }
    const duration = Math.max(0.01, endBeat - drawDataRef.current.startTime);
    drawDataRef.current.duration = duration;
    updateMidiNote(trackId, drawNoteId, { duration });
  }, [isDrawing, drawNoteId, resizingId, movingId, boxSelecting, copyDragData, trackId, snapToGrid, snapBeat, mouseToWorld, updateMidiNote, patternStart, zoomH, getGridInterval]);

  const handleMouseUp = useCallback(() => {
    if (copyDragData) {
      if (copyDragData.deltaBeat === 0 && copyDragData.deltaPitch === 0) {
        setCopyDragData(null);
        return;
      }
      pushUndo(trackId);
      const newIds: string[] = [];
      copyDragData.origNotes.forEach(note => {
        let newStart = note.startTime + copyDragData.deltaBeat;
        if (snapToGrid) newStart = snapBeat(newStart);
        const newPitch = Math.min(NOTE_MAX_PITCH, Math.max(NOTE_MIN_PITCH, note.pitch + copyDragData.deltaPitch));
        if (newStart >= patternStart && newStart < patternStart + patternLength) {
          const id = addMidiNote(trackId, { pitch: newPitch, startTime: newStart, duration: note.duration, velocity: note.velocity, clipId: clipId || undefined });
          newIds.push(id);
        }
      });
      if (newIds.length > 0) setSelectedNoteIds(newIds);
      setCopyDragData(null);
      return;
    }

    if (boxSelecting && boxEnd) {
      const start = boxStartRef.current;
      const end = boxEnd;
      const minBeat = Math.min(start.beat, end.beat);
      const maxBeat = Math.max(start.beat, end.beat);
      const minPitch = Math.min(start.pitch, end.pitch);
      const maxPitch = Math.max(start.pitch, end.pitch);
      const selected = visibleNotes
        .filter(n => n.startTime < maxBeat && n.startTime + n.duration > minBeat &&
                     n.pitch >= minPitch && n.pitch <= maxPitch)
        .map(n => n.id);
      setSelectedNoteIds(selected);
    }

    if (isDrawing && drawNoteId) {
      if (snapToGrid) {
        const { startTime } = drawDataRef.current;
        const snappedStart = snapBeat(startTime);
        updateMidiNote(trackId, drawNoteId, { startTime: snappedStart });
      }
      const note = track.midiNotes.find(n => n.id === drawNoteId);
      if (note) setDefaultNoteLength(note.duration);
    }

    if (resizingId) {
      const note = track.midiNotes.find(n => n.id === resizingId);
      if (note) setDefaultNoteLength(note.duration);
    }

    if (autoScrollTimerRef.current !== null) {
      cancelAnimationFrame(autoScrollTimerRef.current);
      autoScrollTimerRef.current = null;
    }

    setIsDrawing(false);
    setDrawNoteId(null);
    setResizingId(null);
    setMovingId(null);
    setBoxSelecting(false);
    setBoxEnd(null);
  }, [isDrawing, drawNoteId, resizingId, boxSelecting, boxEnd, copyDragData, snapToGrid, snapBeat, trackId, updateMidiNote, visibleNotes, setSelectedNoteIds, addMidiNote, patternStart, patternLength, clipId, setDefaultNoteLength, track.midiNotes, pushUndo]);

  // ── Velocity editor handlers ──
  const handleVelocityBarMouseDown = useCallback((e: React.MouseEvent, noteId: string) => {
    pushUndo(trackId);
    e.stopPropagation();
    const note = track.midiNotes.find(n => n.id === noteId);
    if (!note) return;

    const currentSelection = useStore.getState().selectedNoteIds;
    const allSelectedOrig: Record<string, number> = {};

    if (currentSelection.length > 1 && currentSelection.includes(noteId)) {
      currentSelection.forEach(id => {
        const n = track.midiNotes.find(nn => nn.id === id);
        if (n) allSelectedOrig[id] = n.velocity;
      });
    } else {
      allSelectedOrig[noteId] = note.velocity;
      if (!currentSelection.includes(noteId)) {
        setSelectedNoteIds([noteId]);
      }
    }

    setEditingVelocityId(noteId);
    velocityEditStartRef.current = { clientY: e.clientY, origVelocity: note.velocity, allSelectedOrig };
  }, [track.midiNotes, setSelectedNoteIds, pushUndo, trackId]);

  useEffect(() => {
    if (!editingVelocityId) return;
    const onMouseMove = (e: MouseEvent) => {
      const deltaY = velocityEditStartRef.current.clientY - e.clientY;
      const velocityChange = Math.round(deltaY / 2);
      const allSelected = velocityEditStartRef.current.allSelectedOrig;
      const store = useStore.getState();

      Object.entries(allSelected).forEach(([id, origVel]) => {
        const newVelocity = Math.max(0, Math.min(127, origVel + velocityChange));
        store.updateMidiNote(trackId, id, { velocity: newVelocity });
      });
    };
    const onMouseUp = () => setEditingVelocityId(null);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [editingVelocityId, trackId, updateMidiNote]);

  /* ── Keyboard shortcuts ── */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      const store = useStore.getState();

      // Undo / Redo
      if (ctrl && e.key === "z" && !shift) { e.preventDefault(); undo(); return; }
      if ((ctrl && e.key === "z" && shift) || (ctrl && e.key === "y")) { e.preventDefault(); redo(); return; }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (store.selectedNoteIds.length > 0) {
          pushUndo(trackId);
          removeSelectedNotes(trackId);
        }
        return;
      }
      if (e.key === "Escape") { setSelectedNoteIds([]); return; }

      // Zoom
      if (e.key === "+") { e.preventDefault(); setZoomH(z => Math.min(4, z+0.25)); return; }
      if (e.key === "-" && !ctrl) { e.preventDefault(); setZoomH(z => Math.max(0.25, z-0.25)); return; }
      if (ctrl && e.key === "+") { e.preventDefault(); setZoomV(z => Math.min(3, z+0.25)); return; }
      if (ctrl && e.key === "-") { e.preventDefault(); setZoomV(z => Math.max(0.5, z-0.25)); return; }

      if (ctrl && e.key === "a") {
        e.preventDefault();
        const currentTrack = store.tracks.find(t => t.id === trackId);
        if (currentTrack) {
          const visible = currentTrack.midiNotes.filter(n => n.startTime >= patternStart && n.startTime < patternStart + patternLength);
          setSelectedNoteIds(visible.map(n => n.id));
        }
        return;
      }

      // Duplicate (Ctrl+D)
      if (ctrl && e.key === "d") {
        e.preventDefault();
        const currentSelection = store.selectedNoteIds;
        if (currentSelection.length === 0) return;
        const currentTrack = store.tracks.find(t => t.id === trackId);
        if (!currentTrack) return;
        const selectedNotes = currentTrack.midiNotes.filter(n => currentSelection.includes(n.id));
        if (selectedNotes.length === 0) return;
        pushUndo(trackId);
        const maxEnd = Math.max(...selectedNotes.map(n => n.startTime + n.duration));
        const minStart = Math.min(...selectedNotes.map(n => n.startTime));
        const offset = maxEnd - minStart;
        const newIds: string[] = [];
        selectedNotes.forEach(note => {
          const newStart = note.startTime + offset;
          if (newStart < patternStart + patternLength) {
            const id = addMidiNote(trackId, { pitch: note.pitch, startTime: newStart, duration: note.duration, velocity: note.velocity, clipId: clipId || undefined });
            newIds.push(id);
          }
        });
        if (newIds.length > 0) setSelectedNoteIds(newIds);
        return;
      }

      // Copy (Ctrl+C)
      if (ctrl && e.key === "c") {
        e.preventDefault();
        const currentSelection = store.selectedNoteIds;
        if (currentSelection.length === 0) return;
        const currentTrack = store.tracks.find(t => t.id === trackId);
        if (!currentTrack) return;
        const selected = currentTrack.midiNotes.filter(n => currentSelection.includes(n.id));
        setClipboard(selected.map(({ id, ...rest }) => rest));
        return;
      }

      // Paste (Ctrl+V)
      if (ctrl && e.key === "v") {
        e.preventDefault();
        const clip = store.clipboard;
        if (clip.length === 0) return;
        pushUndo(trackId);
        const minStart = Math.min(...clip.map(n => n.startTime));
        const pastePos = Math.max(patternStart, lastClickBeatRef.current);
        const offset = pastePos - minStart;
        const newIds: string[] = [];
        clip.forEach(note => {
          const newStart = note.startTime + offset;
          if (newStart >= patternStart && newStart < patternStart + patternLength) {
            const id = addMidiNote(trackId, { pitch: note.pitch, startTime: newStart, duration: note.duration, velocity: note.velocity, clipId: clipId || undefined });
            newIds.push(id);
          }
        });
        if (newIds.length > 0) setSelectedNoteIds(newIds);
        return;
      }

      if (e.key === "1") setTool("draw");
      if (e.key === "2") setTool("erase");
      if (e.key === "3") setTool("select");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [trackId, patternStart, patternLength, clipId, removeSelectedNotes, setSelectedNoteIds, setClipboard, addMidiNote, setZoomH, setZoomV, setTool, pushUndo, undo, redo]);

  // ── Sync horizontal scroll between piano roll and velocity panel ──
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      if (syncingScroll.current) return;
      syncingScroll.current = true;
      if (velocityScrollRef.current) velocityScrollRef.current.scrollLeft = el.scrollLeft;
      syncingScroll.current = false;
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const el = velocityScrollRef.current;
    if (!el) return;
    const onScroll = () => {
      if (syncingScroll.current) return;
      syncingScroll.current = true;
      if (scrollRef.current) scrollRef.current.scrollLeft = el.scrollLeft;
      syncingScroll.current = false;
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // ── Wheel zoom ──
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.altKey) {
        e.preventDefault();
        setZoomH(z => Math.max(0.25, Math.min(4, z + (e.deltaY > 0 ? -0.25 : 0.25))));
        return;
      }
      if (e.ctrlKey) {
        e.preventDefault();
        setZoomV(z => Math.max(0.5, Math.min(3, z + (e.deltaY > 0 ? -0.25 : 0.25))));
        return;
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // ── Cancel copy‑drag on mouseup anywhere ──
  useEffect(() => {
    if (!copyDragData) return;
    const onWindowMouseUp = () => setCopyDragData(null);
    window.addEventListener("mouseup", onWindowMouseUp);
    return () => window.removeEventListener("mouseup", onWindowMouseUp);
  }, [copyDragData]);

  const cursorStyle = copyDragData ? "copy" : boxSelecting ? "crosshair" : resizingId || movingId ? "grabbing" : tool === "draw" ? "crosshair" : tool === "erase" ? "pointer" : "default";

  // ── Box‑select overlay ──
  let boxOverlay = null;
  if (boxSelecting && boxEnd) {
    const start = boxStartRef.current;
    const end = boxEnd;
    const minB = Math.min(start.beat, end.beat);
    const maxB = Math.max(start.beat, end.beat);
    const minP = Math.min(start.pitch, end.pitch);
    const maxP = Math.max(start.pitch, end.pitch);
    boxOverlay = {
      left: beatToPixel(minB),
      width: beatToPixel(maxB) - beatToPixel(minB),
      top: pitchToPixel(maxP),
      height: pitchToPixel(minP) - pitchToPixel(maxP),
    };
  }

  // ── Velocity panel resize logic ──
  const [resizingVelocityPanel, setResizingVelocityPanel] = useState(false);
  const velocityPanelResizeStartRef = useRef({ clientY: 0, origHeight: 0 });

  const handleVelocityPanelResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setResizingVelocityPanel(true);
    velocityPanelResizeStartRef.current = { clientY: e.clientY, origHeight: velocityPanelHeight };
  };

  useEffect(() => {
    if (!resizingVelocityPanel) return;
    const onMouseMove = (e: MouseEvent) => {
      const delta = velocityPanelResizeStartRef.current.clientY - e.clientY;
      const newHeight = Math.max(40, Math.min(200, velocityPanelResizeStartRef.current.origHeight + delta));
      setVelocityPanelHeight(newHeight);
    };
    const onMouseUp = () => setResizingVelocityPanel(false);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [resizingVelocityPanel]);

  return (
    <div className="flex flex-col h-full text-xs">
      {/* ── Toolbar Utama ── */}
      <div className="flex items-center gap-1 p-1 flex-shrink-0 flex-wrap" style={{ borderBottom: "1px solid #808080" }}>
        {(["draw","erase","select"] as const).map(t => (
          <button key={t} onClick={() => setTool(t)} className="px-2 py-0.5 text-[10px]" style={{
            border: "2px solid", borderColor: tool===t ? "#808080 #fff #fff #808080" : "#fff #808080 #808080 #fff",
            backgroundColor: "#c0c0c0", boxShadow: tool===t ? "inset 1px 1px 2px #808080" : "none", fontWeight: tool===t ? "bold" : "normal"
          }}>{t.charAt(0).toUpperCase()+t.slice(1)} ({["1","2","3"][["draw","erase","select"].indexOf(t)]})</button>
        ))}
        <button onClick={() => setSnapToGrid(!snapToGrid)} className="px-2 py-0.5 text-[10px] ml-2" style={{
          border: "2px solid", borderColor: snapToGrid ? "#808080 #fff #fff #808080" : "#fff #808080 #808080 #fff",
          backgroundColor: snapToGrid ? "#c0ffc0" : "#c0c0c0", boxShadow: snapToGrid ? "inset 1px 1px 2px #808080" : "none", fontWeight: "bold"
        }}>Snap {snapToGrid ? "ON" : "OFF"}</button>
        <span className="text-[10px] ml-1">Len:</span>
        <select value={defaultNoteLength} onChange={e => setDefaultNoteLength(parseFloat(e.target.value))} className="text-[10px] px-1 py-0.5" style={{ border: "2px solid", borderColor: "#fff #808080 #808080 #fff", backgroundColor: "#fff" }}>
          <option value={4}>1 Bar</option><option value={2}>1/2 Bar</option><option value={1}>1 Beat</option>
          <option value={0.5}>1/2 Beat</option><option value={0.25}>1/4 Beat</option><option value={0.125}>1/8 Beat</option>
        </select>
        {selectedNoteIds.length > 0 && (
          <button onClick={() => { pushUndo(trackId); removeSelectedNotes(trackId); }} className="px-2 py-0.5 text-[10px]" style={{ border: "2px solid", borderColor: "#fff #808080 #808080 #fff", backgroundColor: "#ffcccc" }}>Del ({selectedNoteIds.length})</button>
        )}
        <button onClick={() => undo()} className="px-2 py-0.5 text-[10px]" style={{ border: "2px solid", borderColor: "#fff #808080 #808080 #fff", backgroundColor: "#c0c0c0" }}>Undo</button>
        <button onClick={() => redo()} className="px-2 py-0.5 text-[10px]" style={{ border: "2px solid", borderColor: "#fff #808080 #808080 #fff", backgroundColor: "#c0c0c0" }}>Redo</button>
        <span className="text-[10px] ml-2 text-gray-600">| Sel: {selectedNoteIds.length}</span>
      </div>

      {/* ── Toolbar Zoom ── */}
      <div className="flex items-center gap-1 p-1 flex-shrink-0 overflow-x-auto" style={{ borderBottom: "1px solid #808080" }}>
        <span className="text-[10px] font-bold">Zoom H:</span>
        <button onClick={() => setZoomH(z => Math.max(0.25, z-0.25))} className="px-2 py-0.5 text-[10px] font-bold" style={{ border: "2px solid", borderColor: "#fff #808080 #808080 #fff", backgroundColor: "#c0c0c0" }}>–</button>
        <span className="text-[10px] w-10 text-center">{Math.round(zoomH*100)}%</span>
        <button onClick={() => setZoomH(z => Math.min(4, z+0.25))} className="px-2 py-0.5 text-[10px] font-bold" style={{ border: "2px solid", borderColor: "#fff #808080 #808080 #fff", backgroundColor: "#c0c0c0" }}>+</button>

        <span className="text-[10px] font-bold ml-2">Zoom V:</span>
        <button onClick={() => setZoomV(z => Math.max(0.5, z-0.25))} className="px-2 py-0.5 text-[10px] font-bold" style={{ border: "2px solid", borderColor: "#fff #808080 #808080 #fff", backgroundColor: "#c0c0c0" }}>–</button>
        <span className="text-[10px] w-10 text-center">{Math.round(zoomV*100)}%</span>
        <button onClick={() => setZoomV(z => Math.min(3, z+0.25))} className="px-2 py-0.5 text-[10px] font-bold" style={{ border: "2px solid", borderColor: "#fff #808080 #808080 #fff", backgroundColor: "#c0c0c0" }}>+</button>
      </div>

      {/* ── Canvas ── */}
      <div ref={scrollRef} className="flex-1 overflow-auto sunken-area min-h-0" onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} style={{ cursor: cursorStyle, position: "relative", transform: "translateZ(0)", willChange: "transform" }}>
        {/* Ruler with hierarchical bibliography labels */}
        <div className="sticky top-0 z-15" style={{ marginLeft: PIANO_KEY_WIDTH, width: canvasWidth, height: RULER_HEIGHT, backgroundColor: "#d4d0c8", borderBottom: "1px solid #808080", position: "relative", overflow: "hidden" }}>
          {/* Bar labels */}
          {gridLines[0].map(b => {
            const bar = Math.floor((patternStart + b) / 4) + 1;
            return (
              <span key={`ruler-bar-${b}`} className="absolute text-[10px] font-bold select-none"
                style={{ left: snapPixel(b * effectiveBeatWidth), transform: "translateX(-50%)", bottom: 2, color: "#000" }}
              >{bar}</span>
            );
          })}
          {/* Beat labels (bar.beat format) */}
          {levelOpacities[1] > 0 && effectiveBeatWidth >= 25 && gridLines[1].map(b => {
            const absBeat = patternStart + b;
            const bar = Math.floor(absBeat / 4) + 1;
            const beat = Math.floor(absBeat % 4) + 1;
            return (
              <span key={`ruler-beat-${b}`} className="absolute text-[8px] select-none"
                style={{ left: snapPixel(b * effectiveBeatWidth), transform: "translateX(-50%)", bottom: 1, color: `rgba(0,0,0,${Math.min(0.4, levelOpacities[1])})` }}
              >{`${bar}.${beat}`}</span>
            );
          })}
          {/* Subdivision labels (bar.beat.sub format) */}
          {levelOpacities[2] > 0.1 && effectiveBeatWidth * 0.25 >= 22 && gridLines[2].map(b => {
            const absBeat = patternStart + b;
            const bar = Math.floor(absBeat / 4) + 1;
            const beat = Math.floor(absBeat % 4) + 1;
            const sub = Math.ceil((absBeat % 1) / 0.25);
            return (
              <span key={`ruler-sub-${b}`} className="absolute text-[7px] select-none"
                style={{ left: snapPixel(b * effectiveBeatWidth), transform: "translateX(-50%)", bottom: 0, color: `rgba(0,0,0,${Math.min(0.3, levelOpacities[2])})` }}
              >{`${bar}.${beat}.${sub}`}</span>
            );
          })}
        </div>

        {/* Area konten */}
        <div style={{ display: "flex", position: "relative", height: canvasHeight, width: PIANO_KEY_WIDTH + canvasWidth }}>
          {/* Piano keys */}
          <div className="sticky left-0 z-20 flex-shrink-0" style={{ width: PIANO_KEY_WIDTH, height: canvasHeight, backgroundColor: "#c0c0c0" }}>
            {Array.from({ length: totalPitches }).map((_, i) => {
              const pitch = NOTE_MAX_PITCH - i;
              const isWhite = WHITE_KEYS.has(pitch % 12);
              return (
                <div key={pitch} className="flex items-center justify-end pr-1 text-[9px] select-none" style={{ height: effectiveNoteHeight, backgroundColor: isWhite ? "#fff" : "#333", color: isWhite ? "#000" : "#fff", borderBottom: "1px solid #c0c0c0", lineHeight: `${effectiveNoteHeight}px` }}>
                  {isWhite ? `${NOTE_NAMES[pitch%12]}${Math.floor(pitch/12)-1}` : ""}
                </div>
              );
            })}
          </div>

          {/* Grid + notes */}
          <div style={{ position: "relative", width: canvasWidth, height: canvasHeight, overflow: "hidden", transform: "translateZ(0)", willChange: "transform" }}>
            {/* Loop/Playhead */}
            {transport.loopEnabled && patternStart<=transport.loopEnd && patternStart+patternLength>=transport.loopStart && (
              <div className="absolute top-0 bottom-0 z-5 pointer-events-none" style={{ left: beatToPixel(Math.max(patternStart, transport.loopStart)), width: beatToPixel(Math.min(patternStart+patternLength, transport.loopEnd)) - beatToPixel(Math.max(patternStart, transport.loopStart)), backgroundColor: "rgba(255,255,0,0.15)", borderLeft: "2px dashed #888800", borderRight: "2px dashed #888800" }} />
            )}
            {transport.playheadPosition >= patternStart && transport.playheadPosition <= patternStart+patternLength && (
              <div className="absolute top-0 bottom-0 z-30 pointer-events-none" style={{ left: beatToPixel(transport.playheadPosition), width:2, backgroundColor:"#ff0000" }}>
                <div style={{ width:0, height:0, borderLeft:"5px solid transparent", borderRight:"5px solid transparent", borderTop:"6px solid #ff0000", marginLeft:-4 }} />
              </div>
            )}
            {/* Alternating bar backgrounds — snapped */}
            {Array.from({ length: Math.ceil(patternLength / 4) }).map((_, i) =>
              i % 2 === 1 ? (
                <div key={`bar-bg-${i}`} className="absolute top-0 bottom-0 pointer-events-none"
                  style={{
                    left: snapPixel(i * 4 * effectiveBeatWidth),
                    width: snapPixel(4 * effectiveBeatWidth),
                    backgroundColor: "rgba(0,0,0,0.08)",
                  }}
                />
              ) : null
            )}
            {/* Black-key note row backgrounds (C#, D#, F#, G#, A#) — snapped */}
            {levelOpacities[0] > 0 && Array.from({ length: totalPitches }).map((_, i) => {
              const pitch = NOTE_MAX_PITCH - i;
              if (WHITE_KEYS.has(pitch % 12)) return null;
              return (
                <div key={`row-shade-${pitch}`} className="absolute left-0 right-0 pointer-events-none"
                  style={{
                    top: snapPixel(i * effectiveNoteHeight),
                    height: effectiveNoteHeight,
                    backgroundColor: "rgba(0,0,0,0.04)",
                  }}
                />
              );
            })}
            {/* Hierarchical vertical grid lines — pixel-snapped with border rendering */}
            {gridLines[0].length > 0 && gridLines[0].map(b => (
              <div key={`bar-${b}`} className="absolute top-0 bottom-0 pointer-events-none"
                style={{ left: snapPixel(b*effectiveBeatWidth), width: 0, borderLeft: `2px solid rgba(0,0,0,${levelOpacities[0]})` }}
              />
            ))}
            {gridLines[1].length > 0 && gridLines[1].map(b => (
              <div key={`beat-${b}`} className="absolute top-0 bottom-0 pointer-events-none"
                style={{ left: snapPixel(b*effectiveBeatWidth), width: 0, borderLeft: `1px solid rgba(0,0,0,${levelOpacities[1]})` }}
              />
            ))}
            {gridLines[2].length > 0 && gridLines[2].map(b => (
              <div key={`sub-${b}`} className="absolute top-0 bottom-0 pointer-events-none"
                style={{ left: snapPixel(b*effectiveBeatWidth), width: 0, borderLeft: `1px solid rgba(0,0,0,${levelOpacities[2]})` }}
              />
            ))}
            {gridLines[3].length > 0 && gridLines[3].map(b => (
              <div key={`mic-${b}`} className="absolute top-0 bottom-0 pointer-events-none"
                style={{ left: snapPixel(b*effectiveBeatWidth), width: 0, borderLeft: `1px solid rgba(0,0,0,${levelOpacities[3]})` }}
              />
            ))}
            {/* Horizontal note-row lines with hierarchy */}
            {Array.from({ length: totalPitches + 1 }).map((_, i) => {
              const pitchBelow = NOTE_MAX_PITCH - i;
              const pitchAbove = NOTE_MAX_PITCH - i + 1;
              const inBounds = (p: number) => p >= NOTE_MIN_PITCH && p <= NOTE_MAX_PITCH;
              const blackKeyAbove = inBounds(pitchAbove) && !WHITE_KEYS.has(pitchAbove % 12);
              const blackKeyBelow = inBounds(pitchBelow) && !WHITE_KEYS.has(pitchBelow % 12);
              const isOctave = i % 12 === 0;
              const isSharpBorder = !isOctave && (blackKeyAbove || blackKeyBelow);
              return (
                <div key={`hl-${i}`} className="absolute left-0 right-0 pointer-events-none"
                  style={{
                    top: snapPixel(i * effectiveNoteHeight), height: 0,
                    borderTop: isOctave ? "1px solid rgba(0,0,0,0.4)" : isSharpBorder ? "1px solid rgba(0,0,0,0.2)" : "1px solid rgba(0,0,0,0.1)",
                  }}
                />
              );
            })}
            {/* Box‑select overlay */}
            {boxOverlay && (
              <div className="absolute z-25 pointer-events-none" style={{
                left: boxOverlay.left, top: boxOverlay.top,
                width: boxOverlay.width, height: boxOverlay.height,
                backgroundColor: "rgba(0,120,215,0.2)", border: "1px solid rgba(0,120,215,0.6)",
              }} />
            )}
            {/* Notes */}
            {visibleNotes.map(note => {
              const isSelected = selectedNoteIds.includes(note.id);
              const displayDuration = Math.min(note.duration, patternStart+patternLength - note.startTime);
              const noteLeft = beatToPixel(note.startTime);
              const noteWidth = Math.max(1, beatToPixel(note.startTime+displayDuration) - noteLeft);
              const noteTop = pitchToPixel(note.pitch);
              const noteHeight = Math.max(1, effectiveNoteHeight - 1);
              return (
                <div key={note.id} className={`pr-note-body absolute ${isSelected ? "selected" : ""}`} data-note-id={note.id}
                  style={{ left: noteLeft, top: noteTop, width: noteWidth, height: noteHeight, backgroundColor: isSelected ? "#ffcc00" : `hsl(210, 70%, 65%)`, border: isSelected ? "2px solid #000" : "1px solid rgba(0,0,0,0.4)", borderRadius:2, cursor: tool==="erase" ? "pointer" : "grab", zIndex: isSelected ? 5 : 1 }}
                  title={`${NOTE_NAMES[note.pitch%12]}${Math.floor(note.pitch/12)-1} | Vel: ${note.velocity} | Len: ${note.duration.toFixed(2)} beat`}>
                  <div className="absolute bottom-0 left-0 h-[3px] rounded-b-sm" style={{ width: `${(note.velocity/127)*100}%`, backgroundColor: "rgba(0,0,0,0.25)" }} />
                  {isSelected && <div className="pr-resize-handle absolute top-0 right-0 w-[6px] h-full cursor-col-resize hover:bg-black/10 z-10" data-note-id={note.id} />}
                </div>
              );
            })}

            {/* Copy-drag ghost notes */}
            {copyDragData && copyDragData.origNotes.map((note, i) => {
              const newStart = note.startTime + copyDragData.deltaBeat;
              const newPitch = note.pitch + copyDragData.deltaPitch;
              if (newStart >= patternStart && newStart < patternStart + patternLength && newPitch >= NOTE_MIN_PITCH && newPitch <= NOTE_MAX_PITCH) {
                const ghostLeft = beatToPixel(newStart);
                const ghostWidth = Math.max(1, beatToPixel(newStart + note.duration) - ghostLeft);
                return (
                  <div key={`ghost-${i}`} className="absolute pointer-events-none"
                    style={{
                      left: ghostLeft,
                      top: pitchToPixel(newPitch),
                      width: ghostWidth,
                      height: effectiveNoteHeight - 1,
                      backgroundColor: "rgba(255,200,0,0.35)",
                      border: "1px dashed #cc9900",
                      borderRadius: 2,
                      zIndex: 20,
                    }}
                  />
                );
              }
              return null;
            })}
          </div>
        </div>
      </div>

      {/* Velocity Panel Resize Handle */}
      <div
        className="flex-shrink-0 h-1.5 bg-gray-400 cursor-row-resize hover:bg-blue-400 z-20 flex items-center justify-center"
        onMouseDown={handleVelocityPanelResizeMouseDown}
        title="Drag to resize velocity panel"
      >
        <span className="text-[8px] text-white opacity-70">Velocity</span>
      </div>

      {/* Velocity Editor Panel */}
      <div
        ref={velocityScrollRef}
        className="flex-shrink-0 overflow-x-hidden sunken-area"
        style={{ height: velocityPanelHeight, position: "relative" }}
      >
        <div style={{ display: "flex", height: "100%", marginLeft: PIANO_KEY_WIDTH, position: "relative", width: canvasWidth }}>
          {/* Velocity background grid */}
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none" style={{ left: 0, right: 0 }}>
            {[127, 96, 64, 32, 0].map(vel => (
              <div key={vel} className="w-full flex items-center" style={{ height: 1, backgroundColor: vel === 0 ? "#808080" : "#d0d0d0" }}>
                <span className="text-[8px] text-gray-500 ml-1">{vel}</span>
              </div>
            ))}
          </div>

          {/* Velocity bars */}
          <div style={{ height: "100%", position: "relative", width: canvasWidth }}>
            {visibleNotes.map(note => {
              const barLeft = beatToPixel(note.startTime) + 1;
              const barHeight = Math.max(4, (note.velocity / 127) * (velocityPanelHeight - 20));
              const isSelected = selectedNoteIds.includes(note.id);
              return (
                <div
                  key={note.id}
                  className="absolute bottom-0 cursor-pointer hover:brightness-110"
                  style={{
                    left: barLeft,
                    width: VELOCITY_BAR_WIDTH,
                    height: barHeight,
                    backgroundColor: isSelected ? "#ff4444" : "#90c0ff",
                    borderLeft: "1px solid #4060a0",
                    borderRight: "1px solid #4060a0",
                    borderTop: "1px solid #4060a0",
                    borderBottom: "none",
                    zIndex: isSelected ? 10 : 1,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedNoteIds([note.id]);
                  }}
                  onMouseDown={(e) => handleVelocityBarMouseDown(e, note.id)}
                  title={`Velocity: ${note.velocity}`}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}