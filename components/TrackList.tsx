"use client";

import { useStore } from "@/store/useStore";
import type { Track } from "@/store/types";
import { useState, useRef, useEffect } from "react";
import InstrumentSlot from "./plugins/InstrumentSlot";
import FXSlot from "./plugins/FXSlot";
import PluginBrowserWindow from "./plugins/PluginBrowserWindow";
import PluginWindow from "./plugins/PluginWindow";
import ThreeOscUI from "./plugins/ThreeOscUI";
import ReverbUI from "./plugins/ReverbUI";
import DelayUI from "./plugins/DelayUI";
import { graphStore } from "@/store/audioGraphStore";

/* ── Helpers ── */
function linearToDb(linear: number): string {
  if (linear <= 0.0001) return "–∞";
  const db = 20 * Math.log10(linear);
  if (db > 0) return "0.0";
  return db.toFixed(1);
}

const DB_SCALE_MARKS = [0, -6, -12, -18, -24];

function dbToTopPercent(db: number): number {
  const maxDb = 0;
  const minDb = -24;
  const fraction = (db - minDb) / (maxDb - minDb);
  return (1 - fraction) * 100;
}

/* ─────────────────────────────────────
   TrackList
   ───────────────────────────────────── */
export default function TrackList() {
  const {
    tracks,
    transport,
    selectedTrackId,
    setSelectedTrackId,
    updateTrack,
    removeTrack,
    addTrack,
    setMasterVolume,
    meterLevels,
    masterMeter,
    openPluginTrackId,
    openPluginType,
    openPluginFxIndex,
    closePluginWindow,
    pluginBrowserTrackId,
    pluginBrowserType,
    pluginBrowserFxIndex,
    closePluginBrowser,
  } = useStore();

  return (
    <div className="flex flex-col h-full text-xs">
      {/* Toolbar */}
      <div
        className="flex gap-2 p-2 items-center flex-shrink-0"
        style={{ borderBottom: "1px solid #808080" }}
      >
        <button
          onClick={() => addTrack("midi")}
          className="px-4 py-1"
          style={{
            border: "2px solid",
            borderColor: "#fff #808080 #808080 #fff",
            backgroundColor: "#c0c0c0",
          }}
        >
          + MIDI Track
        </button>
        <button
          onClick={() => addTrack("audio")}
          className="px-4 py-1"
          style={{
            border: "2px solid",
            borderColor: "#fff #808080 #808080 #fff",
            backgroundColor: "#c0c0c0",
          }}
        >
          + Audio Track
        </button>
      </div>

      {/* Mixer container */}
      <div
        className="flex-1 flex min-h-0 m-2 p-2"
        style={{
          border: "2px solid",
          borderColor: "#808080 #fff #fff #808080",
          backgroundColor: "#c0c0c0",
        }}
      >
        <div className="flex-1 overflow-x-auto overflow-y-hidden pr-2">
          <div className="flex gap-3 h-full">
            {tracks.length === 0 && (
              <div
                className="w-full h-full flex items-center justify-center text-center"
                style={{ color: "#808080" }}
              >
                No tracks.
              </div>
            )}
            {tracks.map((track) => (
              <ChannelStrip
                key={track.id}
                track={track}
                isSelected={selectedTrackId === track.id}
                onSelect={() => setSelectedTrackId(track.id)}
                onVolumeChange={(v) => updateTrack(track.id, { volume: v })}
                onPanChange={(v) => updateTrack(track.id, { pan: v })}
                onMuteToggle={() =>
                  updateTrack(track.id, { muted: !track.muted })
                }
                onSoloToggle={() =>
                  updateTrack(track.id, { solo: !track.solo })
                }
                onRemove={() => removeTrack(track.id)}
                onRename={(name) => updateTrack(track.id, { name })}
                onEqLowChange={(v) => {
                  updateTrack(track.id, { eqLow: v });
                  const g = graphStore.get(track.id);
                  if (g) g.eqNodes.lowShelf.gain.setTargetAtTime(v, g.eqNodes.lowShelf.context.currentTime, 0.005);
                }}
                onEqMidChange={(v) => {
                  updateTrack(track.id, { eqMid: v });
                  const g = graphStore.get(track.id);
                  if (g) g.eqNodes.midPeaking.gain.setTargetAtTime(v, g.eqNodes.midPeaking.context.currentTime, 0.005);
                }}
                onEqHighChange={(v) => {
                  updateTrack(track.id, { eqHigh: v });
                  const g = graphStore.get(track.id);
                  if (g) g.eqNodes.highShelf.gain.setTargetAtTime(v, g.eqNodes.highShelf.context.currentTime, 0.005);
                }}
                meterLevel={meterLevels[track.id] ?? { left: 0, right: 0 }}
              />
            ))}
          </div>
        </div>
        {/* Plugin Browser */}
        {pluginBrowserTrackId && pluginBrowserType && (
          <PluginBrowserWindow
            trackId={pluginBrowserTrackId}
            type={pluginBrowserType}
            fxIndex={pluginBrowserFxIndex}
            onClose={() => closePluginBrowser()}
          />
        )}

        {/* Plugin Editor */}
        {openPluginTrackId && openPluginType && (
          <PluginWindow
            title={
              openPluginType === "instrument"
                ? "3OSC Synth"
                : (() => {
                    const t = useStore
                      .getState()
                      .tracks.find((tr) => tr.id === openPluginTrackId);
                    const fx = t?.fxChain[openPluginFxIndex ?? 0];
                    return fx
                      ? fx.type === "reverb"
                        ? "Reverb"
                        : "Delay"
                      : "FX";
                  })()
            }
            icon={openPluginType === "instrument" ? "🎹" : "🔧"}
            onClose={() => closePluginWindow()}
          >
            {openPluginType === "instrument" && (
              <ThreeOscUI trackId={openPluginTrackId} />
            )}
            {openPluginType === "fx" && openPluginFxIndex !== null && (
              <>
                {(() => {
                  const t = useStore
                    .getState()
                    .tracks.find((tr) => tr.id === openPluginTrackId);
                  const fx = t?.fxChain[openPluginFxIndex];
                  if (!fx) return null;
                  if (fx.type === "reverb")
                    return (
                      <ReverbUI
                        trackId={openPluginTrackId}
                        fxIndex={openPluginFxIndex}
                      />
                    );
                  if (fx.type === "delay")
                    return (
                      <DelayUI
                        trackId={openPluginTrackId}
                        fxIndex={openPluginFxIndex}
                      />
                    );
                  return null;
                })()}
              </>
            )}
          </PluginWindow>
        )}

        {/* Master */}
        <div
          className="flex-shrink-0 flex flex-col items-center gap-1.5 p-2 select-none h-full border-l-2"
          style={{
            borderColor: "#808080",
            backgroundColor: "#e8e8e8",
            minWidth: "100px",
            maxWidth: "120px",
            boxShadow: "inset -2px 0 3px rgba(0,0,0,0.1)",
          }}
        >
          <span className="text-sm font-bold">🎛</span>
          <div className="text-xs font-bold text-center">Master</div>
          <div className="flex-1 w-full flex flex-col items-center gap-1 min-h-0">
            <MeterStereoWithScale
              left={masterMeter.left}
              right={masterMeter.right}
              muted={false}
            />
            <label className="text-[10px] font-bold">Vol</label>
            <input
              type="range"
              min={0}
              max={100}
              value={transport.masterVolume}
              onChange={(e) => setMasterVolume(Number(e.target.value))}
              onDoubleClick={() => setMasterVolume(80)}
              className="w-full"
            />
            <span className="text-[10px]">{transport.masterVolume}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────
   ChannelStrip (width adjusted)
   ───────────────────────────────────── */
function ChannelStrip({
  track,
  isSelected,
  onSelect,
  onVolumeChange,
  onPanChange,
  onMuteToggle,
  onSoloToggle,
  onRemove,
  onRename,
  onEqLowChange,
  onEqMidChange,
  onEqHighChange,
  meterLevel,
}: {
  track: Track;
  isSelected: boolean;
  onSelect: () => void;
  onVolumeChange: (v: number) => void;
  onPanChange: (v: number) => void;
  onMuteToggle: () => void;
  onSoloToggle: () => void;
  onRemove: () => void;
  onRename: (name: string) => void;
  onEqLowChange: (v: number) => void;
  onEqMidChange: (v: number) => void;
  onEqHighChange: (v: number) => void;
  meterLevel: { left: number; right: number };
}) {
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState(track.name);
  const commitRename = () => {
    const trimmed = tempName.trim();
    if (trimmed && trimmed !== track.name) onRename(trimmed);
    setEditingName(false);
  };

  return (
    <div
      onClick={onSelect}
      className="flex flex-col items-center gap-1.5 p-2 select-none h-full"
      style={{
        border: "2px solid",
        borderColor: isSelected ? "#000080" : "#808080",
        backgroundColor: isSelected ? "#c0c0ff" : "#c0c0c0",
        minWidth: "130px", // ⬅ enough for three 36px knobs
        maxWidth: "140px",
        boxShadow: isSelected ? "inset 1px 1px 2px #808080" : "none",
        flexShrink: 0,
      }}
    >
      <span className="text-sm">{track.type === "midi" ? "🎹" : "🔊"}</span>
      {editingName ? (
        <input
          className="w-full text-center text-xs"
          style={{ border: "1px solid #808080", backgroundColor: "#fff" }}
          value={tempName}
          onChange={(e) => setTempName(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") {
              setTempName(track.name);
              setEditingName(false);
            }
          }}
          autoFocus
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <div
          className="w-full text-center text-xs cursor-pointer"
          style={{ border: "1px solid transparent", padding: "1px 0" }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            setTempName(track.name);
            setEditingName(true);
          }}
          title="Double‑click to rename"
        >
          {track.name}
        </div>
      )}
      <div className="flex gap-0.5">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMuteToggle();
          }}
          className="text-xs font-bold"
          style={{
            minWidth: "unset",
            padding: "0 4px",
            backgroundColor: track.muted ? "#ff4444" : "#c0c0c0",
            color: track.muted ? "#fff" : "#000",
            border: "1px solid #808080",
          }}
        >
          M
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSoloToggle();
          }}
          className="text-xs font-bold"
          style={{
            minWidth: "unset",
            padding: "0 4px",
            backgroundColor: track.solo ? "#ffcc00" : "#c0c0c0",
            border: "1px solid #808080",
          }}
        >
          S
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="text-xs"
          style={{
            minWidth: "unset",
            padding: "0 4px",
            backgroundColor: "#fcc",
            border: "1px solid #808080",
          }}
        >
          ×
        </button>
      </div>
      <div className="flex-1 w-full flex flex-col items-center gap-1 min-h-0">
        <MeterStereoWithScale
          left={meterLevel.left}
          right={meterLevel.right}
          muted={track.muted}
        />
        <label className="text-[10px] font-bold">Vol</label>
        <input
          type="range"
          min={0}
          max={100}
          value={track.volume}
          // Volume handler
          onChange={(e) => {
            e.stopPropagation();
            const v = Number(e.target.value);
            onVolumeChange(v);

            // ⚡ Real‑time update ke audio graph
            const graph = graphStore.get(track.id);
            if (graph) {
              graph.gainNode.gain.setTargetAtTime(
                v / 100,
                graph.gainNode.context.currentTime,
                0.005,
              );
            }
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            onVolumeChange(80);
          }}
          className="w-full"
          onClick={(e) => e.stopPropagation()}
        />
        <span className="text-[10px]">{track.volume}</span>
      </div>
      <div className="w-full mt-1">
        <label className="text-[10px] block text-center font-bold">Pan</label>
        <input
          type="range"
          min={-50}
          max={50}
          value={track.pan}
          // Pan handler
          onChange={(e) => {
            e.stopPropagation();
            const p = Number(e.target.value);
            onPanChange(p);

            // ⚡ Real‑time update ke audio graph
            const graph = graphStore.get(track.id);
            if (graph) {
              graph.pannerNode.pan.setTargetAtTime(
                p / 50,
                graph.pannerNode.context.currentTime,
                0.005,
              );
            }
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            onPanChange(0);
          }}
          className="w-full"
          onClick={(e) => e.stopPropagation()}
        />
        <span className="text-[10px] block text-center">
          {track.pan > 0 ? "R" : track.pan < 0 ? "L" : "C"}
          {Math.abs(track.pan)}
        </span>
      </div>

      {/* EQ Section – properly spaced */}
      <div className="w-full mt-1">
        <label className="text-[10px] block text-center font-bold mb-1">
          EQ
        </label>
        <div className="flex justify-center gap-1.5 px-1">
          <SVGKnob
            label="Low"
            value={track.eqLow}
            min={-12}
            max={12}
            onChange={onEqLowChange}
          />
          <SVGKnob
            label="Mid"
            value={track.eqMid}
            min={-12}
            max={12}
            onChange={onEqMidChange}
          />
          <SVGKnob
            label="High"
            value={track.eqHigh}
            min={-12}
            max={12}
            onChange={onEqHighChange}
          />
        </div>
      </div>

      <div className="w-full mt-1 flex flex-col gap-0.5">
        {/* FX slots (up to 3 visible) */}
        {[0, 1, 2].map((idx) => (
          <FXSlot key={idx} trackId={track.id} index={idx} />
        ))}
        {/* Instrument slot */}
        <InstrumentSlot trackId={track.id} />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────
   SVG Knob (unchanged, only label font)
   ───────────────────────────────────── */
function SVGKnob({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const startYRef = useRef(0);
  const startValueRef = useRef(value);

  useEffect(() => {
    if (!dragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = startYRef.current - e.clientY;
      const range = max - min;
      const sensitivity = 40;
      const deltaValue = (deltaY / sensitivity) * range;
      const newValue = Math.round(startValueRef.current + deltaValue);
      onChange(Math.min(max, Math.max(min, newValue)));
    };
    const handleMouseUp = () => setDragging(false);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging, min, max, onChange]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    startYRef.current = e.clientY;
    startValueRef.current = value;
    setDragging(true);
  };

  const handleDoubleClick = () => onChange(0);

  const angle = ((value - min) / (max - min)) * 270 - 135;

  return (
    <div className="flex flex-col items-center gap-0.5 select-none">
      <span className="text-[8px] font-semibold">{label}</span>
      <svg
        width="36"
        height="36"
        viewBox="0 0 140 140"
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        style={{ cursor: "pointer" }}
      >
        <g transform="translate(70 70)">
          <g stroke="#444" strokeWidth="2">
            {Array.from({ length: 19 }, (_, i) => {
              const a = -135 + i * 15;
              return (
                <line
                  key={i}
                  x1="0"
                  y1="-58"
                  x2="0"
                  y2="-64"
                  transform={`rotate(${a})`}
                />
              );
            })}
          </g>
          <circle cx="3" cy="4" r="44" fill="#6f6f6f" />
          <circle
            cx="0"
            cy="0"
            r="44"
            fill="#c0c0c0"
            stroke="#000"
            strokeWidth="2"
          />
          <path
            d="M -30 -30 A 42 42 0 0 1 30 -30"
            stroke="#ffffff"
            strokeWidth="4"
            fill="none"
          />
          <path
            d="M 30 30 A 42 42 0 0 1 -30 30"
            stroke="#555"
            strokeWidth="4"
            fill="none"
          />
          <circle
            cx="0"
            cy="0"
            r="35"
            fill="#d6d6d6"
            stroke="#9a9a9a"
            strokeWidth="1"
          />
          <g transform={`rotate(${angle})`}>
            <rect x="-3" y="-34" width="6" height="18" rx="1" fill="#111" />
          </g>
          <circle cx="0" cy="0" r="5" fill="#8a8a8a" />
        </g>
      </svg>
      {/* Value label – now matches the UI font */}
      <span className="text-[10px]">
        {value > 0 ? "+" : ""}
        {value}
      </span>
    </div>
  );
}

/* ─────────────────────────────────────
   Stereo Meter (identical to before)
   ───────────────────────────────────── */
function MeterStereoWithScale({
  left,
  right,
  muted,
}: {
  left: number;
  right: number;
  muted: boolean;
}) {
  const leftVisual = Math.min(100, Math.pow(left, 0.6) * 100);
  const rightVisual = Math.min(100, Math.pow(right, 0.6) * 100);

  const greenStop = `${(100 - dbToTopPercent(-18)).toFixed(1)}%`;
  const orangeStop = `${(100 - dbToTopPercent(-6)).toFixed(1)}%`;

  const gradient = `linear-gradient(
    to top,
    #00aa00 0%,
    #00aa00 ${greenStop},
    #ffaa00 ${greenStop},
    #ffaa00 ${orangeStop},
    #ff0000 ${orangeStop},
    #ff0000 100%
  )`;

  const ScaleMarks = () => (
    <>
      {DB_SCALE_MARKS.map((db) => (
        <span
          key={db}
          className="absolute left-0 w-full text-[6px] text-gray-400 text-right pr-0.5 pointer-events-none"
          style={{ top: `${dbToTopPercent(db)}%` }}
        >
          {db}
        </span>
      ))}
    </>
  );

  const renderChannel = (level: number, visualPct: number, lbl: string) => {
    const coverHeight = muted ? 100 : 100 - visualPct;
    return (
      <div className="flex-1 flex flex-col items-center gap-0.5">
        <span className="text-[7px] text-gray-600">{lbl}</span>
        <div
          className="flex-1 w-full border relative overflow-hidden"
          style={{
            borderColor: "#808080",
            backgroundColor: "#000",
            border: "1px solid #808080",
          }}
        >
          <div
            className="absolute top-0 left-0 w-full h-full"
            style={{ background: gradient }}
          />
          <div
            className="absolute top-0 left-0 w-full bg-black"
            style={{ height: `${coverHeight}%` }}
          />
          <ScaleMarks />
          <span className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[6px] text-white/60 select-none">
            {linearToDb(level)}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex gap-1 flex-1 w-full" style={{ minHeight: 30 }}>
      {renderChannel(left, leftVisual, "L")}
      {renderChannel(right, rightVisual, "R")}
    </div>
  );
}
