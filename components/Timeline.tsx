"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import { useStore } from "@/store/useStore";
import type { MidiNote } from "@/store/types";

const BEATS_PER_BAR = 4;
const MIN_BARS = 32;
const BASE_BEAT_WIDTH = 40;
const DEFAULT_TRACK_HEIGHT = 64;

export default function Timeline() {
  const {
    tracks,
    transport,
    setPlayhead,
    snapToGrid,
    setSnapToGrid,
    gridResolution,
    selectedTrackId,
    setSelectedTrackId,
  } = useStore();

  const scrollRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [scrollLeft, setScrollLeft] = useState(0);

  const effectiveBeatWidth = BASE_BEAT_WIDTH * zoom;
  const totalBars = MIN_BARS;
  const totalBeats = totalBars * BEATS_PER_BAR;
  const totalWidth = totalBeats * effectiveBeatWidth;
  const RULER_HEIGHT = 28;
  const LABEL_WIDTH = 100;

  const getGridDivisions = useCallback((z: number): number => {
    if (z <= 0.5) return BEATS_PER_BAR;
    if (z <= 1.5) return 1;
    if (z <= 3) return 0.5;
    return 0.25;
  }, []);

  const gridDiv = getGridDivisions(zoom);
  const gridLines: number[] = [];
  for (let b = 0; b <= totalBeats; b += gridDiv) gridLines.push(b);

  const beatToPixel = (beat: number) => beat * effectiveBeatWidth;

  const snapBeat = useCallback(
    (beat: number) => {
      if (!snapToGrid) return beat;
      return Math.round(beat / gridResolution) * gridResolution;
    },
    [snapToGrid, gridResolution],
  );

  const handleSeek = useCallback(
    (e: React.MouseEvent) => {
      if (!scrollRef.current) return;
      const rect = scrollRef.current.getBoundingClientRect();
      const x =
        e.clientX - rect.left + scrollRef.current.scrollLeft - LABEL_WIDTH;
      let beat = Math.max(0, x / effectiveBeatWidth);
      beat = snapBeat(beat);
      setPlayhead(beat);
    },
    [effectiveBeatWidth, snapBeat, setPlayhead],
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setScrollLeft(el.scrollLeft);
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const zoomIn = () => setZoom((z) => Math.min(8, z + 0.25));
  const zoomOut = () => setZoom((z) => Math.max(0.25, z - 0.25));

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        if (e.deltaY < 0) zoomIn();
        else zoomOut();
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const playheadPx = transport.playheadPosition * effectiveBeatWidth;

  const [clipContextMenu, setClipContextMenu] = useState<{
    x: number;
    y: number;
    trackId: string;
    type: "midi" | "audio";
    clipId?: string;
    start: number;
    duration: number;
  } | null>(null);

  const [trackContextMenu, setTrackContextMenu] = useState<{
    x: number;
    y: number;
    trackId: string;
    beat: number;
  } | null>(null);

  const closeContextMenus = () => {
    setClipContextMenu(null);
    setTrackContextMenu(null);
  };

  useEffect(() => {
    if (!clipContextMenu && !trackContextMenu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeContextMenus();
    };
    const onClick = () => closeContextMenus();
    window.addEventListener("keydown", onKey);
    window.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("click", onClick);
    };
  }, [clipContextMenu, trackContextMenu]);

  const handleClipContextMenu = useCallback(
    (e: React.MouseEvent, data: typeof clipContextMenu) => {
      e.preventDefault();
      e.stopPropagation();
      setClipContextMenu(data);
      setTrackContextMenu(null);
    },
    [],
  );

  const handleTrackContextMenu = useCallback(
    (e: React.MouseEvent, trackId: string) => {
      e.preventDefault();
      e.stopPropagation();
      if (!scrollRef.current) return;
      const rect = scrollRef.current.getBoundingClientRect();
      const x =
        e.clientX - rect.left + scrollRef.current.scrollLeft - LABEL_WIDTH;
      let beat = Math.max(0, x / effectiveBeatWidth);
      beat = snapBeat(beat);
      setTrackContextMenu({ x: e.clientX, y: e.clientY, trackId, beat });
      setClipContextMenu(null);
    },
    [effectiveBeatWidth, snapBeat],
  );

  const [resizingTrackId, setResizingTrackId] = useState<string | null>(null);
  const resizeTrackStartRef = useRef({ clientY: 0, origHeight: 0 });

  const handleTrackResizeMouseDown = (
    e: React.MouseEvent,
    trackId: string,
    currentHeight: number,
  ) => {
    e.stopPropagation();
    e.preventDefault();
    setResizingTrackId(trackId);
    resizeTrackStartRef.current = {
      clientY: e.clientY,
      origHeight: currentHeight,
    };
  };

  useEffect(() => {
    if (!resizingTrackId) return;
    const onMouseMove = (e: MouseEvent) => {
      const delta = e.clientY - resizeTrackStartRef.current.clientY;
      const newHeight = Math.max(
        40,
        resizeTrackStartRef.current.origHeight + delta,
      );
      useStore.getState().updateTrack(resizingTrackId, { height: newHeight });
    };
    const onMouseUp = () => setResizingTrackId(null);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [resizingTrackId]);

  return (
    <div className="flex flex-col h-full text-[11px]">
      {/* Toolbar */}
      <div
        className="flex items-center gap-1 p-1 flex-shrink-0 flex-wrap"
        style={{ borderBottom: "1px solid #808080" }}
      >
        <button
          onClick={zoomOut}
          className="px-2 py-0.5 text-[10px] font-bold"
          style={{
            border: "2px solid",
            borderColor: "#fff #808080 #808080 #fff",
            backgroundColor: "#c0c0c0",
          }}
        >
          –
        </button>
        <span className="text-[10px] w-12 text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={zoomIn}
          className="px-2 py-0.5 text-[10px] font-bold"
          style={{
            border: "2px solid",
            borderColor: "#fff #808080 #808080 #fff",
            backgroundColor: "#c0c0c0",
          }}
        >
          +
        </button>

        <button
          onClick={() => setSnapToGrid(!snapToGrid)}
          className="px-2 py-0.5 text-[10px] ml-2"
          style={{
            border: "2px solid",
            borderColor: snapToGrid
              ? "#808080 #fff #fff #808080"
              : "#fff #808080 #808080 #fff",
            backgroundColor: snapToGrid ? "#c0ffc0" : "#c0c0c0",
            boxShadow: snapToGrid ? "inset 1px 1px 2px #808080" : "none",
            fontWeight: "bold",
          }}
        >
          Snap: {snapToGrid ? "ON" : "OFF"}
        </button>

        {snapToGrid && (
          <select
            value={gridResolution}
            onChange={(e) =>
              useStore.getState().setGridResolution(parseFloat(e.target.value))
            }
            className="text-[10px] px-1 py-0.5 ml-1"
            style={{
              border: "2px solid",
              borderColor: "#fff #808080 #808080 #fff",
              backgroundColor: "#fff",
            }}
          >
            <option value={4}>1 Bar</option>
            <option value={2}>1/2 Bar</option>
            <option value={1}>1 Beat</option>
            <option value={0.5}>1/2 Beat</option>
            <option value={0.25}>1/4 Beat</option>
          </select>
        )}

        <div className="flex-1" />
        <span className="text-[10px]" style={{ color: "#808080" }}>
          {Math.floor(transport.playheadPosition / 4) + 1}:
          {(transport.playheadPosition % 4).toFixed(1)}
        </span>
      </div>

      {/* Scrollable timeline */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto sunken-area min-h-0"
        onClick={handleSeek}
        style={{ position: "relative", cursor: "pointer" }}
      >
        <div
          style={{
            width: totalWidth + LABEL_WIDTH,
            minHeight: "100%",
            position: "relative",
          }}
        >
          {/* Ruler (dengan LoopBar) */}
          <div
            className="sticky top-0 z-15 flex"
            style={{
              height: RULER_HEIGHT,
              backgroundColor: "#d4d0c8",
              borderBottom: "1px solid #808080",
            }}
          >
            <div
              className="flex-shrink-0"
              style={{ width: LABEL_WIDTH, borderRight: "2px solid #808080" }}
            />
            <div style={{ position: "relative", flex: 1 }}>
              {gridLines.map((beat) => {
                const isBar = beat % BEATS_PER_BAR === 0;
                const beatNumber = (beat % BEATS_PER_BAR) + 1;
                return (
                  <div
                    key={`rule-${beat}`}
                    className="absolute top-0 bottom-0 flex items-end pb-0.5"
                    style={{
                      left: beatToPixel(beat),
                      width: isBar ? 2 : 1,
                      borderRight: isBar
                        ? "2px solid #404040"
                        : "1px solid #a0a0a0",
                    }}
                  >
                    {isBar && (
                      <span
                        className="text-[9px] font-bold"
                        style={{ marginLeft: 2, color: "#000" }}
                      >
                        {beat / BEATS_PER_BAR + 1}
                      </span>
                    )}
                    {!isBar && gridDiv <= 1 && (
                      <span
                        className="text-[8px] select-none"
                        style={{
                          marginLeft: 1,
                          color: "rgba(0,0,0,0.35)",
                        }}
                      >
                        {`${Math.floor(beat / BEATS_PER_BAR) + 1}.${beatNumber}`}
                      </span>
                    )}
                  </div>
                );
              })}

              {/* ═══════════════════════════════════════ */}
              {/*           LOOP BAR (DRAGGABLE)           */}
              {/* ═══════════════════════════════════════ */}
              {transport.loopEnabled && (
                <LoopBar
                  start={transport.loopStart}
                  end={transport.loopEnd}
                  effectiveBeatWidth={effectiveBeatWidth}
                  snapToGrid={snapToGrid}
                  gridResolution={gridResolution}
                  onStartChange={(v) =>
                    useStore.getState().setLoopStart(v)
                  }
                  onEndChange={(v) =>
                    useStore.getState().setLoopEnd(v)
                  }
                />
              )}
            </div>
          </div>

          {/* Grid lines */}
          {gridLines.map((beat) => (
            <div
              key={`gl-${beat}`}
              className="absolute top-0 bottom-0 pointer-events-none"
              style={{
                left: LABEL_WIDTH + beatToPixel(beat),
                width: 1,
                backgroundColor:
                  beat % BEATS_PER_BAR === 0 ? "#808080" : "#d0d0d0",
              }}
            />
          ))}

          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 z-20 pointer-events-none"
            style={{
              left: LABEL_WIDTH + playheadPx,
              width: 2,
              backgroundColor: "#ff0000",
            }}
          >
            <div
              style={{
                width: 0,
                height: 0,
                borderLeft: "5px solid transparent",
                borderRight: "5px solid transparent",
                borderTop: "6px solid #ff0000",
                marginLeft: -4,
              }}
            />
          </div>

          {/* Loop region (highlight) */}
          {transport.loopEnabled && (
            <div
              className="absolute top-0 bottom-0 z-5 pointer-events-none"
              style={{
                left: LABEL_WIDTH + transport.loopStart * effectiveBeatWidth,
                width:
                  (transport.loopEnd - transport.loopStart) *
                  effectiveBeatWidth,
                backgroundColor: "rgba(255,255,0,0.15)",
                borderLeft: "2px dashed #888800",
                borderRight: "2px dashed #888800",
              }}
            />
          )}

          {/* Tracks */}
          {tracks.map((track) => {
            const isSelected = selectedTrackId === track.id;
            const trackHeight = track.height ?? DEFAULT_TRACK_HEIGHT;

            return (
              <div
                key={track.id}
                className="relative"
                style={{
                  height: trackHeight,
                  borderBottom: "1px solid #808080",
                  backgroundColor: isSelected
                    ? "rgba(0,0,128,0.08)"
                    : "transparent",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedTrackId(track.id);
                }}
                onContextMenu={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.closest(".clipbox")) return;
                  handleTrackContextMenu(e, track.id);
                }}
              >
                <div
                  className="absolute left-0 top-0 bottom-0 z-10 flex flex-col justify-center px-2"
                  style={{
                    width: LABEL_WIDTH,
                    backgroundColor: "#d4d0c8",
                    borderRight: "2px solid #808080",
                  }}
                >
                  <span className="text-[10px] font-bold truncate">
                    {track.type === "midi" ? "🎹" : "🔊"} {track.name}
                  </span>
                  <span className="text-[8px]" style={{ color: "#808080" }}>
                    {track.type.toUpperCase()}
                  </span>
                </div>

                <div
                  className="h-full relative"
                  style={{ marginLeft: LABEL_WIDTH }}
                >
                  {track.type === "midi" &&
                    track.clips.map((clip) => {
                      const clipNotes = track.midiNotes.filter(
                        (n) => n.clipId === clip.id,
                      );
                      return (
                        <ClipBox
                          key={clip.id}
                          type="midi"
                          trackId={track.id}
                          clipId={clip.id}
                          startTime={clip.startTime}
                          duration={clip.duration}
                          label={clip.name}
                          effectiveBeatWidth={effectiveBeatWidth}
                          notes={clipNotes}
                          playheadPosition={transport.playheadPosition}
                          snapBeat={snapBeat}
                          trackHeight={trackHeight}
                          onMove={(delta) => {
                            const newStart = Math.max(
                              0,
                              clip.startTime + delta,
                            );
                            useStore
                              .getState()
                              .updateMidiClip(track.id, clip.id, {
                                startTime: newStart,
                              });
                            useStore
                              .getState()
                              .shiftMidiNotes(track.id, delta, clip.id);
                          }}
                          onMoveToPlayhead={() => {
                            const snapped = snapBeat(
                              transport.playheadPosition,
                            );
                            const delta = snapped - clip.startTime;
                            useStore
                              .getState()
                              .updateMidiClip(track.id, clip.id, {
                                startTime: snapped,
                              });
                            if (delta !== 0)
                              useStore
                                .getState()
                                .shiftMidiNotes(track.id, delta, clip.id);
                          }}
                          onResize={(newDuration) => {
                            useStore
                              .getState()
                              .updateMidiClip(track.id, clip.id, {
                                duration: Math.max(0.25, newDuration),
                              });
                          }}
                          onCut={() => {
                            const cutBeat = snapBeat(
                              transport.playheadPosition,
                            );
                            useStore
                              .getState()
                              .cutMidiClip(track.id, clip.id, cutBeat);
                          }}
                          onDuplicate={() => {
                            useStore
                              .getState()
                              .duplicateMidiClip(track.id, clip.id);
                          }}
                          onDelete={() => {
                            track.midiNotes.forEach((n) => {
                              if (n.clipId === clip.id)
                                useStore
                                  .getState()
                                  .removeMidiNote(track.id, n.id);
                            });
                            useStore
                              .getState()
                              .removeMidiClip(track.id, clip.id);
                          }}
                          onOpenEditor={() => {
                            const store = useStore.getState();
                            if (store.windows.midiEditor.minimized)
                              store.toggleWindow("midiEditor");
                            store.setActiveWindow("midiEditor");
                            store.setSelectedTrackId(track.id);
                            store.setSelectedClipId(clip.id);
                          }}
                          onContextMenu={(e) =>
                            handleClipContextMenu(e, {
                              x: e.clientX,
                              y: e.clientY,
                              trackId: track.id,
                              type: "midi",
                              clipId: clip.id,
                              start: clip.startTime,
                              duration: clip.duration,
                            })
                          }
                        />
                      );
                    })}

                  {track.type === "audio" &&
                    track.audioClips.map((clip) => (
                      <ClipBox
                        key={clip.id}
                        type="audio"
                        trackId={track.id}
                        clipId={clip.id}
                        startTime={clip.startTime}
                        duration={clip.duration}
                        label={clip.name}
                        effectiveBeatWidth={effectiveBeatWidth}
                        notes={undefined}
                        playheadPosition={transport.playheadPosition}
                        snapBeat={snapBeat}
                        trackHeight={trackHeight}
                        onMove={(delta) => {
                          const newStart = Math.max(0, clip.startTime + delta);
                          useStore
                            .getState()
                            .updateAudioClip(track.id, clip.id, {
                              startTime: newStart,
                            });
                        }}
                        onMoveToPlayhead={() => {
                          const snapped = snapBeat(transport.playheadPosition);
                          useStore
                            .getState()
                            .updateAudioClip(track.id, clip.id, {
                              startTime: snapped,
                            });
                        }}
                        onResize={(newDuration) => {
                          useStore
                            .getState()
                            .updateAudioClip(track.id, clip.id, {
                              duration: newDuration,
                            });
                        }}
                        onCut={() => {}}
                        onDuplicate={() => {
                          const store = useStore.getState();
                          const audioClip = store.tracks
                            .find((t) => t.id === track.id)
                            ?.audioClips.find((c) => c.id === clip.id);
                          if (audioClip) {
                            store.addAudioClip(track.id, {
                              bufferKey: audioClip.bufferKey,
                              name: audioClip.name + " (copy)",
                              startTime:
                                audioClip.startTime + audioClip.duration,
                              duration: audioClip.duration,
                              trimStart: audioClip.trimStart,
                              trimEnd: audioClip.trimEnd,
                            });
                          }
                        }}
                        onDelete={() => {
                          useStore
                            .getState()
                            .removeAudioClip(track.id, clip.id);
                        }}
                        onOpenEditor={() => {
                          const store = useStore.getState();
                          if (store.windows.audioEditor.minimized)
                            store.toggleWindow("audioEditor");
                          store.setActiveWindow("audioEditor");
                          store.setSelectedTrackId(track.id);
                        }}
                        onContextMenu={(e) =>
                          handleClipContextMenu(e, {
                            x: e.clientX,
                            y: e.clientY,
                            trackId: track.id,
                            type: "audio",
                            clipId: clip.id,
                            start: clip.startTime,
                            duration: clip.duration,
                          })
                        }
                      />
                    ))}
                </div>

                <div
                  className="absolute bottom-0 left-0 right-0 h-1.5 cursor-row-resize hover:bg-blue-200/30 z-20"
                  onMouseDown={(e) =>
                    handleTrackResizeMouseDown(e, track.id, trackHeight)
                  }
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Context menus (unchanged) */}
      {clipContextMenu && (
        <div
          className="fixed z-50"
          style={{ left: clipContextMenu.x, top: clipContextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              border: "2px solid",
              borderColor: "#fff #808080 #808080 #fff",
              backgroundColor: "#c0c0c0",
              padding: 2,
              minWidth: 140,
            }}
          >
            <button
              className="w-full text-left px-4 py-1 text-xs hover:bg-[#000080] hover:text-white"
              onClick={() => {
                if (clipContextMenu.type === "midi" && clipContextMenu.clipId) {
                  const cutBeat = snapBeat(transport.playheadPosition);
                  useStore
                    .getState()
                    .cutMidiClip(
                      clipContextMenu.trackId,
                      clipContextMenu.clipId,
                      cutBeat,
                    );
                }
                closeContextMenus();
              }}
            >
              ✂ Cut at Playhead
            </button>
            <button
              className="w-full text-left px-4 py-1 text-xs hover:bg-[#000080] hover:text-white"
              onClick={() => {
                if (clipContextMenu.type === "midi" && clipContextMenu.clipId) {
                  useStore
                    .getState()
                    .duplicateMidiClip(
                      clipContextMenu.trackId,
                      clipContextMenu.clipId,
                    );
                } else if (
                  clipContextMenu.type === "audio" &&
                  clipContextMenu.clipId
                ) {
                  const store = useStore.getState();
                  const clip = store.tracks
                    .find((t) => t.id === clipContextMenu.trackId)
                    ?.audioClips.find((c) => c.id === clipContextMenu.clipId);
                  if (clip) {
                    store.addAudioClip(clipContextMenu.trackId, {
                      bufferKey: clip.bufferKey,
                      name: clip.name + " (copy)",
                      startTime: clip.startTime + clip.duration,
                      duration: clip.duration,
                      trimStart: clip.trimStart,
                      trimEnd: clip.trimEnd,
                    });
                  }
                }
                closeContextMenus();
              }}
            >
              📄 Duplicate
            </button>
            <button
              className="w-full text-left px-4 py-1 text-xs hover:bg-[#000080] hover:text-white"
              onClick={() => {
                if (clipContextMenu.clipId) {
                  const event = new CustomEvent("rename-clip", {
                    detail: { clipId: clipContextMenu.clipId },
                  });
                  window.dispatchEvent(event);
                }
                closeContextMenus();
              }}
            >
              ✏ Rename
            </button>
            <button
              className="w-full text-left px-4 py-1 text-xs hover:bg-[#000080] hover:text-white"
              onClick={() => {
                if (clipContextMenu.type === "midi" && clipContextMenu.clipId) {
                  const store = useStore.getState();
                  const track = store.tracks.find(
                    (t) => t.id === clipContextMenu.trackId,
                  );
                  if (track) {
                    track.midiNotes.forEach((n) => {
                      if (n.clipId === clipContextMenu.clipId)
                        store.removeMidiNote(clipContextMenu.trackId, n.id);
                    });
                    store.removeMidiClip(
                      clipContextMenu.trackId,
                      clipContextMenu.clipId,
                    );
                  }
                } else if (
                  clipContextMenu.type === "audio" &&
                  clipContextMenu.clipId
                ) {
                  useStore
                    .getState()
                    .removeAudioClip(
                      clipContextMenu.trackId,
                      clipContextMenu.clipId,
                    );
                }
                closeContextMenus();
              }}
            >
              🗑 Delete
            </button>
          </div>
        </div>
      )}

      {trackContextMenu && (
        <div
          className="fixed z-50"
          style={{ left: trackContextMenu.x, top: trackContextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              border: "2px solid",
              borderColor: "#fff #808080 #808080 #fff",
              backgroundColor: "#c0c0c0",
              padding: 2,
              minWidth: 140,
            }}
          >
            <button
              className="w-full text-left px-4 py-1 text-xs hover:bg-[#000080] hover:text-white"
              onClick={() => {
                const store = useStore.getState();
                const track = store.tracks.find(
                  (t) => t.id === trackContextMenu.trackId,
                );
                if (track && track.type === "midi") {
                  const newName = `Clip ${track.clips.length + 1}`;
                  store.addMidiClip(trackContextMenu.trackId, {
                    name: newName,
                    startTime: trackContextMenu.beat,
                    duration: 4,
                  });
                }
                closeContextMenus();
              }}
            >
              ➕ Add empty clip (1 bar)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── LoopBar Component ── */
function LoopBar({
  start,
  end,
  effectiveBeatWidth,
  snapToGrid,
  gridResolution,
  onStartChange,
  onEndChange,
}: {
  start: number;
  end: number;
  effectiveBeatWidth: number;
  snapToGrid: boolean;
  gridResolution: number;
  onStartChange: (newStart: number) => void;
  onEndChange: (newEnd: number) => void;
}) {
  const [displayStart, setDisplayStart] = useState(start);
  const [displayEnd, setDisplayEnd] = useState(end);
  const [isDragging, setIsDragging] = useState(false);
  const dragType = useRef<"move" | "resizeStart" | "resizeEnd" | null>(null);
  const dragOrigin = useRef({ clientX: 0, start: 0, end: 0 });

  useEffect(() => {
    if (!isDragging) {
      setDisplayStart(start);
      setDisplayEnd(end);
    }
  }, [start, end, isDragging]);

  const snapBeatLocal = useCallback(
    (beat: number) => {
      if (!snapToGrid) return beat;
      return Math.round(beat / gridResolution) * gridResolution;
    },
    [snapToGrid, gridResolution],
  );

  const handleBarMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    dragType.current = "move";
    dragOrigin.current = { clientX: e.clientX, start: displayStart, end: displayEnd };
    setIsDragging(true);
  };

  const handleLeftMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    dragType.current = "resizeStart";
    dragOrigin.current = { clientX: e.clientX, start: displayStart, end: displayEnd };
    setIsDragging(true);
  };

  const handleRightMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    dragType.current = "resizeEnd";
    dragOrigin.current = { clientX: e.clientX, start: displayStart, end: displayEnd };
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const onMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragOrigin.current.clientX;
      const deltaBeat = dx / effectiveBeatWidth;

      if (dragType.current === "move") {
        let newStart = dragOrigin.current.start + deltaBeat;
        let newEnd = dragOrigin.current.end + deltaBeat;
        newStart = snapBeatLocal(newStart);
        newEnd = snapBeatLocal(newEnd);
        newStart = Math.max(0, newStart);
        newEnd = Math.max(newStart + 0.25, newEnd);
        setDisplayStart(newStart);
        setDisplayEnd(newEnd);
      } else if (dragType.current === "resizeStart") {
        let newStart = dragOrigin.current.start + deltaBeat;
        newStart = snapBeatLocal(newStart);
        newStart = Math.max(0, newStart);
        if (newStart >= displayEnd - 0.25) newStart = displayEnd - 0.25;
        setDisplayStart(newStart);
      } else if (dragType.current === "resizeEnd") {
        let newEnd = dragOrigin.current.end + deltaBeat;
        newEnd = snapBeatLocal(newEnd);
        newEnd = Math.max(displayStart + 0.25, newEnd);
        setDisplayEnd(newEnd);
      }
    };

    const onMouseUp = () => {
      if (dragType.current === "move") {
        onStartChange(displayStart);
        onEndChange(displayEnd);
      } else if (dragType.current === "resizeStart") {
        onStartChange(displayStart);
      } else if (dragType.current === "resizeEnd") {
        onEndChange(displayEnd);
      }
      setIsDragging(false);
      dragType.current = null;
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isDragging, displayStart, displayEnd, effectiveBeatWidth, snapBeatLocal, onStartChange, onEndChange]);

  const left = displayStart * effectiveBeatWidth;
  const width = (displayEnd - displayStart) * effectiveBeatWidth;

  return (
    <div
      className="absolute top-0 bottom-0 z-20"
      style={{
        left,
        width,
        backgroundColor: "rgba(255,255,0,0.15)",
        borderLeft: "2px dashed #888800",
        borderRight: "2px dashed #888800",
        cursor: isDragging ? "grabbing" : "grab",
        pointerEvents: "auto",
      }}
      onMouseDown={handleBarMouseDown}
    >
      <div
        className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize"
        style={{ backgroundColor: "rgba(200,200,0,0.4)" }}
        onMouseDown={handleLeftMouseDown}
      />
      <div
        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize"
        style={{ backgroundColor: "rgba(200,200,0,0.4)" }}
        onMouseDown={handleRightMouseDown}
      />
      <span className="absolute left-1 top-1 text-[8px] opacity-70 pointer-events-none">
        {displayStart.toFixed(1)}
      </span>
      <span className="absolute right-1 bottom-1 text-[8px] opacity-70 pointer-events-none">
        {displayEnd.toFixed(1)}
      </span>
    </div>
  );
}
/* ── ClipBox with inline rename input ── */
function ClipBox({
  type,
  trackId,
  clipId,
  startTime,
  duration,
  label,
  effectiveBeatWidth,
  notes,
  playheadPosition,
  snapBeat,
  trackHeight,
  onMove,
  onMoveToPlayhead,
  onResize,
  onCut,
  onDuplicate,
  onDelete,
  onOpenEditor,
  onContextMenu,
}: {
  type: "midi" | "audio";
  trackId: string;
  clipId?: string;
  startTime: number;
  duration: number;
  label: string;
  effectiveBeatWidth: number;
  notes?: MidiNote[];
  playheadPosition: number;
  snapBeat: (beat: number) => number;
  trackHeight: number;
  onMove: (deltaBeat: number) => void;
  onMoveToPlayhead: () => void;
  onResize: (newDuration: number) => void;
  onCut: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onOpenEditor: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [displayStart, setDisplayStart] = useState(startTime);
  const [displayDuration, setDisplayDuration] = useState(duration);
  const dragStart = useRef({ clientX: 0, origStart: 0 });
  const resizeStart = useRef({ clientX: 0, origDuration: 0 });
  const { snapToGrid, gridResolution } = useStore();

  // Rename state
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!dragging && !resizing) {
      setDisplayStart(startTime);
      setDisplayDuration(duration);
    }
  }, [startTime, duration, dragging, resizing]);

  // Listen for rename event
  useEffect(() => {
    const onRename = (e: Event) => {
      const ce = e as CustomEvent;
      if (ce.detail.clipId === clipId) {
        setIsRenaming(true);
        setNewName(label);
        setTimeout(() => inputRef.current?.focus(), 10);
      }
    };
    window.addEventListener("rename-clip", onRename);
    return () => window.removeEventListener("rename-clip", onRename);
  }, [clipId, label]);

  const commitRename = () => {
    const trimmed = newName.trim();
    if (trimmed && trimmed !== label && clipId) {
      useStore.getState().updateMidiClip(trackId, clipId, { name: trimmed });
    }
    setIsRenaming(false);
  };

  const cancelRename = () => {
    setNewName(label);
    setIsRenaming(false);
  };

  const handleLabelDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!clipId) return;
    setIsRenaming(true);
    setNewName(label);
    setTimeout(() => inputRef.current?.focus(), 10);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.button === 2) return;
    if (e.detail === 2) {
      onOpenEditor();
      return;
    }
    setDragging(true);
    dragStart.current = { clientX: e.clientX, origStart: startTime };
  };

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setResizing(true);
    resizeStart.current = { clientX: e.clientX, origDuration: duration };
  };

  useEffect(() => {
    if (!dragging && !resizing) return;
    const onMouseMove = (e: MouseEvent) => {
      if (dragging) {
        const dx = e.clientX - dragStart.current.clientX;
        let deltaBeat = dx / effectiveBeatWidth;
        if (snapToGrid)
          deltaBeat = Math.round(deltaBeat / gridResolution) * gridResolution;
        setDisplayStart(Math.max(0, dragStart.current.origStart + deltaBeat));
      }
      if (resizing) {
        const dx = e.clientX - resizeStart.current.clientX;
        let deltaBeat = dx / effectiveBeatWidth;
        if (snapToGrid)
          deltaBeat = Math.round(deltaBeat / gridResolution) * gridResolution;
        setDisplayDuration(
          Math.max(0.01, resizeStart.current.origDuration + deltaBeat),
        );
      }
    };
    const onMouseUp = () => {
      if (dragging) {
        const totalDelta = displayStart - dragStart.current.origStart;
        if (totalDelta !== 0) onMove(totalDelta);
      }
      if (resizing) onResize(displayDuration);
      setDragging(false);
      setResizing(false);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [
    dragging,
    resizing,
    effectiveBeatWidth,
    snapToGrid,
    gridResolution,
    displayStart,
    displayDuration,
    onMove,
    onResize,
  ]);

  const left = displayStart * effectiveBeatWidth;
  const width = displayDuration * effectiveBeatWidth;

  const renderMiniNotes = () => {
    if (!notes || notes.length === 0 || type !== "midi") return null;

    const visibleNotes = notes.filter(
      (n) =>
        n.startTime + n.duration > displayStart &&
        n.startTime < displayStart + displayDuration,
    );
    if (visibleNotes.length === 0) return null;

    const MIN_MIDI = 0;
    const MAX_MIDI = 127;
    const RANGE = MAX_MIDI - MIN_MIDI;

    const labelHeight = 14;
    const areaTop = labelHeight + 2;
    const noteAreaHeight = trackHeight - areaTop - 6;

    const noteHeight = Math.max(
      2,
      Math.min(noteAreaHeight / (RANGE / 4), noteAreaHeight * 0.8),
    );

    return (
      <div
        className="absolute left-0 right-0 overflow-hidden"
        style={{ top: areaTop, height: noteAreaHeight }}
      >
        {visibleNotes.map((note) => {
          const relLeft = (note.startTime - displayStart) / displayDuration;
          const relWidth = note.duration / displayDuration;
          const noteLeft = relLeft * width;
          const noteWidth = Math.max(2, relWidth * width);

          const normalized = (note.pitch - MIN_MIDI) / RANGE;
          const noteTop = (1 - normalized) * (noteAreaHeight - noteHeight);
          const maxTop = noteAreaHeight - noteHeight;
          const clampedTop = Math.max(0, Math.min(maxTop, noteTop));

          return (
            <div
              key={note.id}
              className="absolute rounded-[1px]"
              style={{
                left: noteLeft,
                width: noteWidth,
                top: Math.round(clampedTop),
                height: noteHeight,
                backgroundColor: "#ffdd44",
                border: "1px solid #000000",
                pointerEvents: "none",
              }}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div
      className="clipbox absolute rounded-sm cursor-grab active:cursor-grabbing group"
      style={{
        left,
        width,
        top: 6,
        bottom: 6,
        backgroundColor: type === "midi" ? "#80b0e0" : "#a0d0a0",
        border: `1px solid ${type === "midi" ? "#4060a0" : "#408040"}`,
        minWidth: 4,
        overflow: "hidden",
      }}
      onMouseDown={handleMouseDown}
      onContextMenu={onContextMenu}
      onClick={(e) => {
        e.stopPropagation();
        if (e.detail === 1) onOpenEditor();
      }}
    >
      {/* Label / Rename input */}
      {isRenaming ? (
        <input
          ref={inputRef}
          className="absolute top-0 left-1 h-4 text-[9px] bg-white border border-gray-500 px-1 z-20"
          style={{ width: Math.min(200, width - 10) }}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") cancelRename();
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        />
      ) : (
        <span
          className="text-[9px] absolute top-0 left-1 truncate max-w-[calc(100%-58px)] z-10 select-none"
          onDoubleClick={handleLabelDoubleClick}
          title="Double‑click to rename"
        >
          {label}
        </span>
      )}

      {/* Action buttons */}
      <div className="absolute top-0 right-0 hidden group-hover:flex items-center gap-0.5 z-10 pr-0.5">
        <button
          style={{
            width: 18,
            height: 18,
            padding: 0,
            minWidth: 0,
            minHeight: 0,
          }}
          className="inline-flex items-center justify-center text-[8px] bg-blue-600 text-white cursor-pointer border-none rounded-[1px] leading-none"
          title="Move to playhead"
          onClick={(e) => {
            e.stopPropagation();
            onMoveToPlayhead();
          }}
        >
          ⏱
        </button>
        <button
          style={{
            width: 18,
            height: 18,
            padding: 0,
            minWidth: 0,
            minHeight: 0,
          }}
          className="inline-flex items-center justify-center text-[8px] bg-red-500 text-white cursor-pointer border-none rounded-[1px] leading-none"
          title="Cut at playhead"
          onClick={(e) => {
            e.stopPropagation();
            onCut();
          }}
        >
          ✂
        </button>
        <button
          style={{
            width: 18,
            height: 18,
            padding: 0,
            minWidth: 0,
            minHeight: 0,
          }}
          className="inline-flex items-center justify-center text-[8px] bg-green-600 text-white cursor-pointer border-none rounded-[1px] leading-none"
          title="Duplicate"
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate();
          }}
        >
          📄
        </button>
      </div>

      {/* Resize handle */}
      <div
        className="absolute top-0 bottom-0 right-0 w-2 cursor-col-resize hover:bg-black/10 z-10"
        onMouseDown={handleResizeMouseDown}
      />

      {/* Mini MIDI notes */}
      {renderMiniNotes()}
    </div>
  );
}
