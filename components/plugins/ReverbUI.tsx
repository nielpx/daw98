"use client";
import { useStore } from "@/store/useStore";
import { graphStore } from "@/store/audioGraphStore";
import SVGKnob from "@/components/Knob";

export default function ReverbUI({ trackId, fxIndex }: { trackId: string; fxIndex: number }) {
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
      <SVGKnob label="Wet" value={params.wet ?? 0.3} min={0} max={1} step={0.01} onChange={(v) => update("wet", v)} onDoubleClick={() => update("wet", 0.3)} />
      <SVGKnob label="Dry" value={params.dry ?? 0.7} min={0} max={1} step={0.01} onChange={(v) => update("dry", v)} onDoubleClick={() => update("dry", 0.7)} />
      <SVGKnob label="Decay" value={params.decay ?? 1.5} min={0.1} max={5} step={0.1} onChange={(v) => update("decay", v)} onDoubleClick={() => update("decay", 1.5)} />
      <SVGKnob label="Size" value={params.size ?? 0.5} min={0.1} max={1} step={0.1} onChange={(v) => update("size", v)} onDoubleClick={() => update("size", 0.5)} />
    </div>
  );
}
