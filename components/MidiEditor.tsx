"use client";

import { useEffect } from "react";
import { useStore } from "@/store/useStore";
import PianoRoll from "./PianoRoll";

export default function MidiEditor() {
  const {
    tracks,
    selectedTrackId,
    setSelectedTrackId,
    selectedClipId,
    setSelectedClipId,
  } = useStore();

  const midiTracks = tracks.filter((t) => t.type === "midi");
  const activeTrack =
    tracks.find((t) => t.id === selectedTrackId && t.type === "midi") ||
    midiTracks[0] ||
    null;

  // ── Pilih clip pertama secara otomatis (pakai useEffect, bukan di render) ──
  useEffect(() => {
    if (!activeTrack) return;
    // Jika sudah ada clip terpilih dan masih milik track ini, biarkan
    if (selectedClipId && activeTrack.clips.some((c) => c.id === selectedClipId)) {
      return;
    }
    // Jika tidak, pilih clip pertama (jika ada)
    const firstClip = activeTrack.clips[0];
    if (firstClip && firstClip.id !== selectedClipId) {
      setSelectedClipId(firstClip.id);
    }
  }, [activeTrack, selectedClipId, setSelectedClipId]);

  // Derive pattern bounds dari clip terpilih
  let patternStart = 0;
  let patternLength = 4;
  let effectiveClipId = selectedClipId;

  if (activeTrack) {
    if (!effectiveClipId || !activeTrack.clips.some((c) => c.id === effectiveClipId)) {
      effectiveClipId = activeTrack.clips[0]?.id ?? null;
    }
    const clip = activeTrack.clips.find((c) => c.id === effectiveClipId);
    if (clip) {
      patternStart = clip.startTime;
      patternLength = clip.duration;
    }
  }

  return (
    <div className="flex flex-col h-full text-xs">
      <div className="flex items-center gap-2 p-1" style={{ borderBottom: "1px solid #808080" }}>
        <span>Track:</span>
        <select
          value={activeTrack?.id || ""}
          onChange={(e) => {
            const id = e.target.value || null;
            setSelectedTrackId(id);
            if (id) {
              const nextTrack = tracks.find((t) => t.id === id);
              if (nextTrack && nextTrack.clips.length > 0) {
                setSelectedClipId(nextTrack.clips[0].id);
              }
            }
          }}
          className="text-xs"
        >
          {midiTracks.length === 0 && <option value="">No MIDI tracks</option>}
          {midiTracks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        {activeTrack && activeTrack.clips.length > 0 && (
          <>
            <span className="ml-2">Clip:</span>
            <select
              value={effectiveClipId || ""}
              onChange={(e) => setSelectedClipId(e.target.value || null)}
              className="text-xs"
            >
              {activeTrack.clips.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      <div className="flex-1 min-h-0">
        {activeTrack ? (
          <PianoRoll
            trackId={activeTrack.id}
            track={activeTrack}
            patternStart={patternStart}
            patternLength={patternLength}
            clipId={effectiveClipId}
          />
        ) : (
          <div className="p-4 text-center" style={{ color: "#808080" }}>
            No MIDI track selected.
          </div>
        )}
      </div>
    </div>
  );
}