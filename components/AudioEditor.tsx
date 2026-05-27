"use client";

import { useCallback, useRef, useEffect } from "react";
import { useStore } from "@/store/useStore";
import WaveformDisplay from "./WaveformDisplay";

export default function AudioEditor() {
  const { tracks, selectedTrackId, setSelectedTrackId, audioBuffers, setAudioBuffer } =
    useStore();

  const audioTracks = tracks.filter((t) => t.type === "audio");
  const selectedTrack = tracks.find((t) => t.id === selectedTrackId && t.type === "audio");
  const activeTrack = selectedTrack || audioTracks[0] || null;

  // Generate mock audio buffer on first load
  const mockLoadedRef = useRef(false);

  useEffect(() => {
    if (mockLoadedRef.current) return;
    mockLoadedRef.current = true;

    // Create mock buffers
    const ctx = new AudioContext();
    const createMockBuffer = (freq: number) => {
      const sampleRate = ctx.sampleRate;
      const length = sampleRate * 4; // 4 seconds
      const buffer = ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        data[i] =
          Math.sin(2 * Math.PI * freq * t) * 0.5 +
          Math.sin(2 * Math.PI * freq * 1.5 * t) * 0.3 +
          Math.sin(2 * Math.PI * freq * 2 * t) * 0.2;
        // Apply envelope
        const env = Math.min(1, t * 10) * Math.max(0, 1 - (t - 3.8) * 5);
        data[i] *= env;
      }
      return buffer;
    };

    setAudioBuffer("mock-sine", createMockBuffer(220));
    setAudioBuffer("mock-bass", createMockBuffer(110));
    setAudioBuffer("mock-pad", createMockBuffer(440));
    ctx.close();
  }, [setAudioBuffer]);

  // Add a sample clip to the active track
  const handleAddSample = useCallback(
    (bufferKey: string) => {
      if (!activeTrack) return;
      const store = useStore.getState();
      store.addAudioClip(activeTrack.id, {
        bufferKey,
        name: bufferKey,
        startTime: 0,
        duration: 4, // 4 beats
        trimStart: 0,
        trimEnd: 0,
      });
    },
    [activeTrack]
  );

  return (
    <div className="flex flex-col h-full text-xs">
      {/* Track selector */}
      <div className="flex items-center gap-2 p-1" style={{ borderBottom: "1px solid #808080" }}>
        <span>Track:</span>
        <select
          value={activeTrack?.id || ""}
          onChange={(e) => setSelectedTrackId(e.target.value || null)}
          className="text-xs"
        >
          {audioTracks.length === 0 && <option value="">No audio tracks</option>}
          {audioTracks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {!activeTrack ? (
        <div className="p-4 text-center" style={{ color: "#808080" }}>
          No audio track selected. Create an Audio track first.
        </div>
      ) : (
        <div className="flex-1 flex flex-col">
          {/* Sample library */}
          <div className="flex gap-1 p-1" style={{ borderBottom: "1px solid #808080" }}>
            <span className="py-1">Samples:</span>
            {["mock-sine", "mock-bass", "mock-pad"].map((key) => (
              <button
                key={key}
                onClick={() => handleAddSample(key)}
                className="px-2 py-0.5 text-xs"
                style={{
                  border: "2px solid",
                  borderColor: "#fff #808080 #808080 #fff",
                  backgroundColor: audioBuffers[key] ? "#a0ffa0" : "#c0c0c0",
                }}
              >
                {key}
              </button>
            ))}
          </div>

          {/* Waveform editor */}
          <div className="flex-1 sunken-area overflow-auto p-1">
            <WaveformDisplay track={activeTrack} />
          </div>
        </div>
      )}
    </div>
  );
}