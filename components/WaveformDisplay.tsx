"use client";

import { useRef, useCallback, useEffect } from "react";
import { useStore } from "@/store/useStore";
import type { Track, AudioClip } from "@/store/types";

const BEAT_WIDTH = 40;
const TOTAL_BEATS = 32;
const TRACK_HEIGHT = 60;

interface WaveformDisplayProps {
  track: Track;
}

export default function WaveformDisplay({ track }: WaveformDisplayProps) {
  const {
    selectedClipId,
    setSelectedClipId,
    updateAudioClip,
    removeAudioClip,
    audioBuffers,
    snapToGrid,
    gridResolution,
  } = useStore();

  const canvasRefs = useRef<Map<string, HTMLCanvasElement>>(new Map());

  // Draw waveform for a clip
  const drawWaveform = useCallback(
    (clip: AudioClip, canvas: HTMLCanvasElement) => {
      const buffer = audioBuffers[clip.bufferKey];
      if (!buffer) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      // Background
      ctx.fillStyle = clip.id === selectedClipId ? "#d0d0ff" : "#a0d0a0";
      ctx.fillRect(0, 0, width, height);

      // Border
      ctx.strokeStyle = clip.id === selectedClipId ? "#0000ff" : "#408040";
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

      // Waveform
      const data = buffer.getChannelData(0);
      const samplesPerPixel = Math.floor(data.length / width);
      ctx.beginPath();
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 0.5;

      for (let x = 0; x < width; x++) {
        const start = Math.floor(x * samplesPerPixel);
        const end = Math.floor(start + samplesPerPixel);
        let min = 0;
        let max = 0;
        for (let i = start; i < end && i < data.length; i++) {
          if (data[i] < min) min = data[i];
          if (data[i] > max) max = data[i];
        }
        const yMid = height / 2;
        ctx.moveTo(x, yMid + min * yMid);
        ctx.lineTo(x, yMid + max * yMid);
      }
      ctx.stroke();

      // Label
      ctx.fillStyle = "#000";
      ctx.font = "10px sans-serif";
      ctx.fillText(clip.name, 4, height - 6);

      // Trim markers
      const trimStartX = (clip.trimStart / buffer.duration) * width;
      const trimEndX = width - (clip.trimEnd / buffer.duration) * width;
      ctx.fillStyle = "rgba(255,0,0,0.5)";
      ctx.fillRect(0, 0, trimStartX, height);
      ctx.fillRect(trimEndX, 0, width - trimEndX, height);
    },
    [audioBuffers, selectedClipId]
  );

  // Redraw all canvases when state changes
  useEffect(() => {
    canvasRefs.current.forEach((canvas, clipId) => {
      const clip = track.audioClips.find((c) => c.id === clipId);
      if (clip) drawWaveform(clip, canvas);
    });
  }, [track.audioClips, selectedClipId, audioBuffers, drawWaveform]);

  // ---- CLIP DRAGGING ----
  const [draggingClip, setDraggingClip] = useState<string | null>(null);
  const dragStartRef = useRef({ x: 0, origStart: 0 });

  const handleClipMouseDown = useCallback(
    (e: React.MouseEvent, clip: AudioClip) => {
      e.stopPropagation();
      setSelectedClipId(clip.id);
      setDraggingClip(clip.id);
      dragStartRef.current = { x: e.clientX, origStart: clip.startTime };
    },
    [setSelectedClipId]
  );

  useEffect(() => {
    if (!draggingClip) return;
    const onMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStartRef.current.x;
      let newStart = dragStartRef.current.origStart + dx / BEAT_WIDTH;
      if (snapToGrid) {
        newStart = Math.round(newStart / gridResolution) * gridResolution;
      }
      updateAudioClip(track.id, draggingClip, { startTime: Math.max(0, newStart) });
    };
    const onMouseUp = () => setDraggingClip(null);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [draggingClip, track.id, snapToGrid, gridResolution, updateAudioClip]);

  const canvasWidth = TOTAL_BEATS * BEAT_WIDTH;

  return (
    <div
      className="relative"
      style={{ width: canvasWidth, height: track.audioClips.length * (TRACK_HEIGHT + 8) + 8 }}
    >
      {track.audioClips.map((clip, idx) => (
        <div
          key={clip.id}
          className="absolute"
          style={{
            left: clip.startTime * BEAT_WIDTH,
            top: idx * (TRACK_HEIGHT + 8),
            width: clip.duration * BEAT_WIDTH,
            height: TRACK_HEIGHT,
            cursor: "pointer",
          }}
          onMouseDown={(e) => handleClipMouseDown(e, clip)}
        >
          <canvas
            ref={(el) => {
              if (el) {
                canvasRefs.current.set(clip.id, el);
                drawWaveform(clip, el);
              }
            }}
            width={clip.duration * BEAT_WIDTH}
            height={TRACK_HEIGHT}
            style={{ width: "100%", height: "100%" }}
          />
          {/* Delete button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              removeAudioClip(track.id, clip.id);
            }}
            className="absolute top-0 right-0 w-4 h-4 flex items-center justify-center text-[10px]"
            style={{
              backgroundColor: "#ff4444",
              color: "#fff",
              border: "1px solid #800000",
            }}
          >
            ×
          </button>

          {/* Trim handles */}
          <div
            className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize"
            style={{ backgroundColor: "rgba(255,0,0,0.3)" }}
            title="Trim start"
          />
          <div
            className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize"
            style={{ backgroundColor: "rgba(255,0,0,0.3)" }}
            title="Trim end"
          />
        </div>
      ))}
    </div>
  );
}

// Need useState for dragging state
import { useState } from "react";