"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { useStore } from "@/store/useStore";
import type { WaveformType, PhaseMode } from "@/audio/instruments/ThreeOscSynth";
import { graphStore } from "@/store/audioGraphStore";
import SVGKnob from "@/components/Knob";

const WAVEFORMS: WaveformType[] = ["sine", "triangle", "saw", "square"];

interface PresetData {
  name: string;
  osc1: Record<string, any>;
  osc2: Record<string, any>;
  osc3: Record<string, any>;
  delay: number;
  attack: number;
  hold: number;
  decay: number;
  sustain: number;
  release: number;
  attackCurve: number;
  decayCurve: number;
  releaseCurve: number;
  masterGain: number;
  filterFreq: number;
  filterRes: number;
  filterType: string;
  filterEnv: number;
}

const PRESETS: PresetData[] = [
  {
    name: "Init",
    osc1: { waveform: "saw", vol: 0.8, pan: -0.5, detune: 0, octave: 0, unisonVoices: 1, unisonDetune: 1, unisonPhase: 50, phaseMode: "free", unisonBlend: 100, unisonSpread: 50, driftAmount: 0 },
    osc2: { waveform: "square", vol: 0.4, pan: 0.5, detune: 0, octave: 0, unisonVoices: 1, unisonDetune: 1, unisonPhase: 50, phaseMode: "free", unisonBlend: 100, unisonSpread: 50, driftAmount: 0 },
    osc3: { waveform: "sine", vol: 0.2, pan: 0, detune: 0, octave: 0, unisonVoices: 1, unisonDetune: 1, unisonPhase: 50, phaseMode: "free", unisonBlend: 100, unisonSpread: 50, driftAmount: 0 },
    delay: 0, attack: 0.01, hold: 0, decay: 0.1, sustain: 0.7, release: 0.3, attackCurve: 0.5, decayCurve: 0.5, releaseCurve: 0.5,
    masterGain: 0.7, filterFreq: 3000, filterRes: 0.5, filterType: "lowpass", filterEnv: 3000,
  },
  {
    name: "Warm Pad",
    osc1: { waveform: "triangle", vol: 0.7, pan: -0.3, detune: 0, octave: 0, unisonVoices: 2, unisonDetune: 2, unisonPhase: 50, phaseMode: "free", unisonBlend: 80, unisonSpread: 50, driftAmount: 5 },
    osc2: { waveform: "saw", vol: 0.3, pan: 0.5, detune: 0, octave: 0, unisonVoices: 1, unisonDetune: 1, unisonPhase: 50, phaseMode: "free", unisonBlend: 100, unisonSpread: 50, driftAmount: 0 },
    osc3: { waveform: "sine", vol: 0.15, pan: 0, detune: 0, octave: -1, unisonVoices: 1, unisonDetune: 1, unisonPhase: 50, phaseMode: "free", unisonBlend: 100, unisonSpread: 50, driftAmount: 0 },
    delay: 0, attack: 0.3, hold: 0, decay: 0.5, sustain: 0.8, release: 1.0, attackCurve: 0.5, decayCurve: 0.5, releaseCurve: 0.5,
    masterGain: 0.6, filterFreq: 2000, filterRes: 0.3, filterType: "lowpass", filterEnv: 4000,
  },
  {
    name: "Lead",
    osc1: { waveform: "saw", vol: 0.7, pan: -0.3, detune: 0, octave: 0, unisonVoices: 2, unisonDetune: 3, unisonPhase: 30, phaseMode: "free", unisonBlend: 100, unisonSpread: 50, driftAmount: 2 },
    osc2: { waveform: "square", vol: 0.4, pan: 0.3, detune: 0, octave: 1, unisonVoices: 1, unisonDetune: 1, unisonPhase: 50, phaseMode: "free", unisonBlend: 100, unisonSpread: 50, driftAmount: 0 },
    osc3: { waveform: "sine", vol: 0.15, pan: 0, detune: 7, octave: 0, unisonVoices: 1, unisonDetune: 1, unisonPhase: 50, phaseMode: "free", unisonBlend: 100, unisonSpread: 50, driftAmount: 0 },
    delay: 0, attack: 0.01, hold: 0, decay: 0.1, sustain: 0.8, release: 0.2, attackCurve: 0.5, decayCurve: 0.5, releaseCurve: 0.5,
    masterGain: 0.7, filterFreq: 5000, filterRes: 0.4, filterType: "lowpass", filterEnv: 5000,
  },
  {
    name: "Sub Bass",
    osc1: { waveform: "sine", vol: 0.8, pan: 0, detune: 0, octave: -1, unisonVoices: 1, unisonDetune: 1, unisonPhase: 50, phaseMode: "free", unisonBlend: 100, unisonSpread: 50, driftAmount: 0 },
    osc2: { waveform: "triangle", vol: 0.3, pan: 0, detune: 0, octave: -1, unisonVoices: 1, unisonDetune: 1, unisonPhase: 50, phaseMode: "free", unisonBlend: 100, unisonSpread: 50, driftAmount: 0 },
    osc3: { waveform: "saw", vol: 0.15, pan: 0, detune: 0, octave: -1, unisonVoices: 1, unisonDetune: 1, unisonPhase: 50, phaseMode: "free", unisonBlend: 100, unisonSpread: 50, driftAmount: 0 },
    delay: 0, attack: 0.02, hold: 0, decay: 0.2, sustain: 0.9, release: 0.1, attackCurve: 0.5, decayCurve: 0.5, releaseCurve: 0.5,
    masterGain: 0.8, filterFreq: 800, filterRes: 0.5, filterType: "lowpass", filterEnv: 1200,
  },
  {
    name: "Pluck",
    osc1: { waveform: "saw", vol: 0.5, pan: -0.2, detune: 0, octave: 0, unisonVoices: 1, unisonDetune: 1, unisonPhase: 50, phaseMode: "free", unisonBlend: 100, unisonSpread: 50, driftAmount: 0 },
    osc2: { waveform: "square", vol: 0.3, pan: 0.2, detune: 0, octave: 1, unisonVoices: 1, unisonDetune: 1, unisonPhase: 50, phaseMode: "free", unisonBlend: 100, unisonSpread: 50, driftAmount: 0 },
    osc3: { waveform: "sine", vol: 0.1, pan: 0, detune: 12, octave: 0, unisonVoices: 1, unisonDetune: 1, unisonPhase: 50, phaseMode: "free", unisonBlend: 100, unisonSpread: 50, driftAmount: 0 },
    delay: 0, attack: 0.001, hold: 0, decay: 0.05, sustain: 0, release: 0.1, attackCurve: 0.5, decayCurve: 0.5, releaseCurve: 0.5,
    masterGain: 0.6, filterFreq: 4000, filterRes: 0.6, filterType: "lowpass", filterEnv: 6000,
  },
  {
    name: "Brass",
    osc1: { waveform: "saw", vol: 0.6, pan: -0.5, detune: 0, octave: 0, unisonVoices: 3, unisonDetune: 4, unisonPhase: 50, phaseMode: "free", unisonBlend: 90, unisonSpread: 50, driftAmount: 3 },
    osc2: { waveform: "saw", vol: 0.3, pan: 0.5, detune: 0, octave: 0, unisonVoices: 3, unisonDetune: 4, unisonPhase: 50, phaseMode: "free", unisonBlend: 90, unisonSpread: 50, driftAmount: 3 },
    osc3: { waveform: "square", vol: 0.2, pan: 0, detune: 0, octave: 0, unisonVoices: 1, unisonDetune: 1, unisonPhase: 50, phaseMode: "free", unisonBlend: 100, unisonSpread: 50, driftAmount: 0 },
    delay: 0, attack: 0.1, hold: 0, decay: 0.3, sustain: 0.7, release: 0.3, attackCurve: 0.5, decayCurve: 0.5, releaseCurve: 0.5,
    masterGain: 0.7, filterFreq: 3000, filterRes: 0.4, filterType: "lowpass", filterEnv: 4000,
  },
];

function KnobGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        border: "1px solid #808080",
        padding: "6px 4px",
        marginBottom: "4px",
      }}
    >
      <div
        style={{
          fontSize: "8px",
          fontWeight: "bold",
          textAlign: "center",
          marginBottom: "4px",
        }}
      >
        {label}
      </div>
      <div className="flex justify-center gap-3">{children}</div>
    </div>
  );
}

export default function ThreeOscUI({ trackId }: { trackId: string }) {
  const track = useStore((s) => s.tracks.find((t) => t.id === trackId));
  const params = track?.instrumentParams || {};
  const [tab, setTab] = useState<"osc1" | "osc2" | "osc3" | "env" | "filter">("osc1");

  const paramsRef = useRef(params);
  paramsRef.current = params;

  const update = useCallback(
    (path: string, key: string, value: any) => {
      const current = paramsRef.current;
      let newParams: any;
      if (path) {
        newParams = {
          ...current,
          [path]: { ...(current[path] || {}), [key]: value },
        };
      } else {
        newParams = { ...current, [key]: value };
      }

      useStore.getState().updateTrack(trackId, { instrumentParams: newParams });

      const graph = graphStore.get(trackId);
      if (graph?.instrumentInstance) {
        (graph.instrumentInstance as any).updateParams(newParams);
      }
    },
    [trackId],
  );

  const oscCallbacks = useRef<
    Record<
      string,
      {
        vol: (v: number) => void;
        pan: (v: number) => void;
        detune: (v: number) => void;
        octave: (v: number) => void;
        wave: (e: any) => void;
        unisonVoices: (v: number) => void;
        unisonDetune: (v: number) => void;
        unisonPhase: (v: number) => void;
        phaseMode: (e: any) => void;
        unisonBlend: (v: number) => void;
        unisonSpread: (v: number) => void;
        driftAmount: (v: number) => void;
      }
    >
  >({});
  if (!oscCallbacks.current["osc1"]) {
    ["osc1", "osc2", "osc3"].forEach((oscName) => {
      oscCallbacks.current[oscName] = {
        vol: (v: number) => update(oscName, "vol", v),
        pan: (v: number) => update(oscName, "pan", v),
        detune: (v: number) => update(oscName, "detune", v),
        octave: (v: number) => update(oscName, "octave", v),
        wave: (e: any) => update(oscName, "waveform", e.target.value),
        unisonVoices: (v: number) => update(oscName, "unisonVoices", v),
        unisonDetune: (v: number) => update(oscName, "unisonDetune", v),
        unisonPhase: (v: number) => update(oscName, "unisonPhase", v),
        phaseMode: (e: any) => update(oscName, "phaseMode", e.target.value),
        unisonBlend: (v: number) => update(oscName, "unisonBlend", v),
        unisonSpread: (v: number) => update(oscName, "unisonSpread", v),
        driftAmount: (v: number) => update(oscName, "driftAmount", v),
      };
    });
  }

  const envUpdate = useCallback(
    (key: string, value: number) => {
      update("", key, value);
    },
    [update],
  );

  const loadPreset = useCallback(
    (presetName: string) => {
      const preset = PRESETS.find((p) => p.name === presetName);
      if (!preset) return;
      const { name: _, ...vals } = preset;
      const newParams = {
        osc1: { ...vals.osc1 },
        osc2: { ...vals.osc2 },
        osc3: { ...vals.osc3 },
        delay: vals.delay,
        attack: vals.attack,
        hold: vals.hold,
        decay: vals.decay,
        sustain: vals.sustain,
        release: vals.release,
        attackCurve: vals.attackCurve ?? 0.5,
        decayCurve: vals.decayCurve ?? 0.5,
        releaseCurve: vals.releaseCurve ?? 0.5,
        masterGain: vals.masterGain,
        filterFreq: vals.filterFreq,
        filterRes: vals.filterRes,
        filterType: vals.filterType,
        filterEnv: vals.filterEnv,
      };
      useStore.getState().updateTrack(trackId, { instrumentParams: newParams as any });
      const graph = graphStore.get(trackId);
      if (graph?.instrumentInstance) {
        (graph.instrumentInstance as any).updateParams(newParams);
      }
      setTab("osc1");
    },
    [trackId],
  );

  const oscDefaults: Record<string, { waveform: string; vol: number; pan: number }> = {
    osc1: { waveform: "saw", vol: 0.8, pan: -0.5 },
    osc2: { waveform: "square", vol: 0.4, pan: 0.5 },
    osc3: { waveform: "sine", vol: 0.2, pan: 0 },
  };

  const renderOsc = (oscName: string) => {
    const def = oscDefaults[oscName];
    const osc = params[oscName] || {
      waveform: def.waveform,
      vol: def.vol,
      pan: def.pan,
      detune: 0,
      octave: 0,
      unisonVoices: 1,
      unisonDetune: 1,
      unisonPhase: 50,
      phaseMode: "free" as PhaseMode,
      unisonBlend: 100,
      unisonSpread: 50,
      driftAmount: 0,
    };
    const cb = oscCallbacks.current[oscName];
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "4px",
        }}
      >
        {/* Wave — full width */}
        <div
          style={{
            gridColumn: "1 / -1",
            border: "1px solid #808080",
            padding: "4px",
            textAlign: "center",
          }}
        >
          <div className="text-[8px] font-bold">Wave</div>
          <div
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <select
              value={osc.waveform}
              onChange={cb.wave}
              className="text-[9px]"
            >
              {WAVEFORMS.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Level */}
        <KnobGroup label="Level">
          <SVGKnob
            label="Vol"
            value={osc.vol ?? def.vol}
            min={0}
            max={1}
            step={0.01}
            onChange={cb.vol}
            onDoubleClick={() => update(oscName, "vol", 0)}
          />
          <SVGKnob
            label="Pan"
            value={osc.pan ?? def.pan}
            min={-1}
            max={1}
            step={0.01}
            onChange={cb.pan}
            onDoubleClick={() => update(oscName, "pan", 0)}
          />
        </KnobGroup>

        {/* Pitch */}
        <KnobGroup label="Pitch">
          <SVGKnob
            label="Det"
            value={osc.detune ?? 0}
            min={-1200}
            max={1200}
            step={1}
            onChange={cb.detune}
            onDoubleClick={() => update(oscName, "detune", 0)}
          />
          <SVGKnob
            label="Oct"
            value={osc.octave ?? 0}
            min={-3}
            max={3}
            step={1}
            onChange={cb.octave}
            onDoubleClick={() => update(oscName, "octave", 0)}
          />
        </KnobGroup>

        {/* Unison row 1 — full width */}
        <div style={{ gridColumn: "1 / -1" }}>
          <KnobGroup label="Unison">
            <SVGKnob
              label="Uni"
              value={osc.unisonVoices ?? 1}
              min={1}
              max={16}
              step={1}
              onChange={cb.unisonVoices}
              onDoubleClick={() => update(oscName, "unisonVoices", 1)}
            />
            <SVGKnob
              label="Dtn"
              value={osc.unisonDetune ?? 6}
              min={0}
              max={100}
              step={1}
              onChange={cb.unisonDetune}
              onDoubleClick={() => update(oscName, "unisonDetune", 1)}
            />
            <SVGKnob
              label="Pha"
              value={osc.unisonPhase ?? 50}
              min={0}
              max={100}
              step={1}
              onChange={cb.unisonPhase}
              onDoubleClick={() => update(oscName, "unisonPhase", 50)}
            />
            <SVGKnob
              label="Drft"
              value={osc.driftAmount ?? 0}
              min={0}
              max={100}
              step={1}
              onChange={cb.driftAmount}
              onDoubleClick={() => update(oscName, "driftAmount", 0)}
            />
            <SVGKnob
              label="Bld"
              value={osc.unisonBlend ?? 100}
              min={0}
              max={100}
              step={1}
              onChange={cb.unisonBlend}
              onDoubleClick={() => update(oscName, "unisonBlend", 100)}
            />
            <SVGKnob
              label="Sprd"
              value={osc.unisonSpread ?? 50}
              min={0}
              max={100}
              step={1}
              onChange={cb.unisonSpread}
              onDoubleClick={() => update(oscName, "unisonSpread", 50)}
            />
          </KnobGroup>
        </div>

        {/* Phase Mode — full width */}
        <div
          style={{
            gridColumn: "1 / -1",
            border: "1px solid #808080",
            padding: "4px",
            textAlign: "center",
          }}
        >
          <div className="text-[8px] font-bold">Phase Mode</div>
          <div
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <select
              value={osc.phaseMode}
              onChange={cb.phaseMode}
              className="text-[9px]"
            >
              <option value="free">Free</option>
              <option value="random">Random</option>
              <option value="fixed">Fixed</option>
            </select>
          </div>
        </div>
      </div>
    );
  };

  const renderEnvelope = () => {
    const dl = params.delay ?? 0;
    const a = params.attack ?? 0.01;
    const h = params.hold ?? 0;
    const d = params.decay ?? 0.1;
    const s = params.sustain ?? 0.7;
    const r = params.release ?? 0.3;
    const ac = params.attackCurve ?? 0.5;
    const dc = params.decayCurve ?? 0.5;
    const rc = params.releaseCurve ?? 0.5;
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="flex flex-wrap justify-center gap-2">
          <SVGKnob label="Delay" value={dl} min={0} max={5} step={0.001} onChange={(v) => envUpdate("delay", v)} onDoubleClick={() => envUpdate("delay", 0)} />
          <SVGKnob label="Attack" value={a} min={0.001} max={10} step={0.001} onChange={(v) => envUpdate("attack", v)} onDoubleClick={() => envUpdate("attack", 0.01)} />
          <SVGKnob label="Hold" value={h} min={0} max={5} step={0.001} onChange={(v) => envUpdate("hold", v)} onDoubleClick={() => envUpdate("hold", 0)} />
          <SVGKnob label="Decay" value={d} min={0.001} max={10} step={0.001} onChange={(v) => envUpdate("decay", v)} onDoubleClick={() => envUpdate("decay", 0.1)} />
          <SVGKnob label="Sustain" value={s} min={0} max={1} step={0.01} onChange={(v) => envUpdate("sustain", v)} onDoubleClick={() => envUpdate("sustain", 0.7)} />
          <SVGKnob label="Release" value={r} min={0.001} max={10} step={0.001} onChange={(v) => envUpdate("release", v)} onDoubleClick={() => envUpdate("release", 0.3)} />
          <SVGKnob label="A.Crv" value={ac} min={0} max={1} step={0.01} onChange={(v) => envUpdate("attackCurve", v)} onDoubleClick={() => envUpdate("attackCurve", 0.5)} />
          <SVGKnob label="D.Crv" value={dc} min={0} max={1} step={0.01} onChange={(v) => envUpdate("decayCurve", v)} onDoubleClick={() => envUpdate("decayCurve", 0.5)} />
          <SVGKnob label="R.Crv" value={rc} min={0} max={1} step={0.01} onChange={(v) => envUpdate("releaseCurve", v)} onDoubleClick={() => envUpdate("releaseCurve", 0.5)} />
        </div>
      </div>
    );
  };

  const renderFilter = () => {
    const freq = params.filterFreq ?? 20000;
    const res = params.filterRes ?? 0.5;
    const env = params.filterEnv ?? 0;
    const type = params.filterType ?? "lowpass";
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="flex gap-3">
          <SVGKnob
            label="Cutoff"
            value={freq}
            min={20}
            max={20000}
            step={1}
            onChange={(v) => update("", "filterFreq", v)}
            onDoubleClick={() => update("", "filterFreq", 20000)}
          />
          <SVGKnob
            label="Res"
            value={res}
            min={0}
            max={20}
            step={0.1}
            onChange={(v) => update("", "filterRes", v)}
            onDoubleClick={() => update("", "filterRes", 0.5)}
          />
          <SVGKnob
            label="Env"
            value={env}
            min={-12000}
            max={12000}
            step={1}
            onChange={(v) => update("", "filterEnv", v)}
            onDoubleClick={() => update("", "filterEnv", 0)}
          />
        </div>
        <select
          value={type}
          onChange={(e) => update("", "filterType", e.target.value)}
          className="text-[9px]"
        >
          <option value="lowpass">Low-pass</option>
          <option value="highpass">High-pass</option>
          <option value="bandpass">Band-pass</option>
          <option value="notch">Notch</option>
        </select>
      </div>
    );
  };

  return (
    <div
      className="flex flex-col text-xs"
    >
      <div className="flex items-center gap-1 p-1 border-b border-gray-400">
        <select
          defaultValue=""
          onChange={(e) => { const v = e.target.value; if (v) loadPreset(v); }}
          className="text-[9px] w-full"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <option value="" disabled>Presets</option>
          {PRESETS.map((p) => (
            <option key={p.name} value={p.name}>{p.name}</option>
          ))}
        </select>
      </div>
      <div className="flex gap-0.5 p-1 border-b border-gray-400">
        {(["osc1", "osc2", "osc3", "env", "filter"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-2 py-0.5 text-[9px] ${tab === t ? "bg-[#000080] text-white" : ""}`}
            style={{
              border: "1px solid #808080",
              backgroundColor: tab === t ? "#000080" : "#c0c0c0",
            }}
          >
            {t === "env" ? "ENV" : t === "filter" ? "FILT" : t.toUpperCase()}
          </button>
        ))}
      </div>
      <div className="p-2">
        {tab === "osc1" && renderOsc("osc1")}
        {tab === "osc2" && renderOsc("osc2")}
        {tab === "osc3" && renderOsc("osc3")}
        {tab === "env" && renderEnvelope()}
        {tab === "filter" && renderFilter()}
      </div>
    </div>
  );
}
