"use client";
import { useStore } from "@/store/useStore";
import { graphStore } from "@/store/audioGraphStore";
import SVGKnob from "@/components/Knob";

export default function DelayUI({ trackId, fxIndex }: { trackId: string; fxIndex: number }) {
  const track = useStore((s) => s.tracks.find((t) => t.id === trackId));
  const fx = track?.fxChain[fxIndex];
  const params = fx?.params || {};

  const update = (key: string, value: number) => {
    if (!track) return;
    const newParams = { ...params, [key]: value };
    const newChain = [...track.fxChain];
    newChain[fxIndex] = { ...newChain[fxIndex], params: newParams };
    useStore.getState().updateTrack(trackId, { fxChain: newChain });

    const graph = graphStore.get(trackId);
    if (graph?.fxNodes[fxIndex]?.instance) {
      (graph.fxNodes[fxIndex].instance as any).updateParams(newParams);
    }
  };

  return (
    <div className="flex flex-wrap justify-center gap-3 p-2">
      <SVGKnob label="Time" value={params.time ?? 0.3} min={0} max={1} step={0.01} onChange={(v) => update("time", v)} onDoubleClick={() => update("time", 0.3)} />
      <SVGKnob label="Feedback" value={params.feedback ?? 0.4} min={0} max={1} step={0.01} onChange={(v) => update("feedback", v)} onDoubleClick={() => update("feedback", 0.4)} />
      <SVGKnob label="Mix" value={params.mix ?? 0.5} min={0} max={1} step={0.01} onChange={(v) => update("mix", v)} onDoubleClick={() => update("mix", 0.5)} />
    </div>
  );
}
