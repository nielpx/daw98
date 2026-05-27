"use client";

import { useCallback, useEffect, useRef } from "react";
import { useStore } from "@/store/useStore";
import { useAudioEngine } from "@/hooks/useAudioEngine";

export default function TransportControls() {
  const { transport, setTransport, setLoopEnabled, setLoopStart, setLoopEnd } =
    useStore();
  const { togglePlay, stopPlayback } = useAudioEngine();
  const bpmRef = useRef(transport.bpm);

  // Keep BPM in sync
  useEffect(() => {
    bpmRef.current = transport.bpm;
  }, [transport.bpm]);

  const handlePlay = useCallback(() => {
    togglePlay();
  }, [togglePlay]);

  const handleStop = useCallback(() => {
    stopPlayback();
    setTransport({ playheadPosition: 0 });
  }, [stopPlayback, setTransport]);

  const handleRecord = useCallback(() => {
    setTransport({ recording: !transport.recording });
  }, [transport.recording, setTransport]);

  const handleBpmChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseInt(e.target.value) || 120;
      setTransport({ bpm: Math.max(20, Math.min(300, val)) });
    },
    [setTransport],
  );

  const formatTime = (beats: number, bpm: number) => {
    const totalSec = (beats / bpm) * 60;
    const min = Math.floor(totalSec / 60);
    const sec = Math.floor(totalSec % 60);
    return `${min}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-2 px-2 h-full">
      {/* Play */}
      <button
        onClick={handlePlay}
        className="w-8 h-8 flex items-center justify-center text-sm"
        style={{
          border: "2px solid",
          borderColor: transport.playing
            ? "#808080 #fff #fff #808080"
            : "#fff #808080 #808080 #fff",
          backgroundColor: "#c0c0c0",
          boxShadow: transport.playing ? "inset 1px 1px 2px #808080" : "none",
        }}
        title={transport.playing ? "Pause" : "Play"}
      >
        {transport.playing ? "⏸" : "▶"}
      </button>

      {/* Stop */}
      <button
        onClick={handleStop}
        className="w-8 h-8 flex items-center justify-center text-sm"
        style={{
          border: "2px solid",
          borderColor: "#fff #808080 #808080 #fff",
          backgroundColor: "#c0c0c0",
        }}
        title="Stop"
      >
        ⏹
      </button>

      {/* Record */}
      <button
        onClick={handleRecord}
        className="w-8 h-8 flex items-center justify-center text-sm"
        style={{
          border: "2px solid",
          borderColor: transport.recording
            ? "#808080 #fff #fff #808080"
            : "#fff #808080 #808080 #fff",
          backgroundColor: transport.recording ? "#ff4444" : "#c0c0c0",
          boxShadow: transport.recording ? "inset 1px 1px 2px #808080" : "none",
        }}
        title="Record"
      >
        <span
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: transport.recording ? "#fff" : "#800000" }}
        />
      </button>
      <div className="flex items-center gap-1">
        <button
          onClick={() => setLoopEnabled(!transport.loopEnabled)}
          className={`px-2 py-0.5 text-xs font-bold ${transport.loopEnabled ? "bg-yellow-200" : ""}`}
          style={{
            border: "2px solid",
            borderColor: transport.loopEnabled
              ? "#808080 #fff #fff #808080"
              : "#fff #808080 #808080 #fff",
            backgroundColor: transport.loopEnabled ? "#ffff88" : "#c0c0c0",
            boxShadow: transport.loopEnabled
              ? "inset 1px 1px 2px #808080"
              : "none",
          }}
          title="Toggle loop"
        >
          Loop
        </button>

        {transport.loopEnabled && (
          <>
            <input
              type="number"
              min={0}
              max={transport.loopEnd - 1}
              value={transport.loopStart}
              onChange={(e) => setLoopStart(Number(e.target.value))}
              className="w-12 h-6 text-xs text-center"
              style={{
                border: "2px solid",
                borderColor: "#808080 #fff #fff #808080",
                backgroundColor: "#fff",
              }}
            />
            <span>-</span>
            <input
              type="number"
              min={transport.loopStart + 1}
              value={transport.loopEnd}
              onChange={(e) => setLoopEnd(Number(e.target.value))}
              className="w-12 h-6 text-xs text-center"
              style={{
                border: "2px solid",
                borderColor: "#808080 #fff #fff #808080",
                backgroundColor: "#fff",
              }}
            />
          </>
        )}
      </div>

      {/* BPM */}
      <div className="flex items-center gap-1 text-xs">
        <span>BPM:</span>
        <input
          type="number"
          value={transport.bpm}
          onChange={handleBpmChange}
          className="w-12 h-6 text-xs text-center"
          style={{
            border: "2px solid",
            borderColor: "#808080 #fff #fff #808080",
            backgroundColor: "#fff",
          }}
          min={20}
          max={300}
        />
      </div>

      {/* Time display */}
      <div
        className="text-xs px-2 h-6 flex items-center"
        style={{
          border: "1px solid #808080",
          backgroundColor: "#fff",
          minWidth: "60px",
        }}
      >
        {formatTime(transport.playheadPosition, transport.bpm)} / bar{" "}
        {Math.floor(transport.playheadPosition / 4) + 1}
      </div>
    </div>
  );
}
