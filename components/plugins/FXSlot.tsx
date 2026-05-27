"use client";
import { useStore } from "@/store/useStore";

export default function FXSlot({ trackId, index }: { trackId: string; index: number }) {
  const track = useStore((s) => s.tracks.find((t) => t.id === trackId));
  const fx = track?.fxChain[index];

  const handleClick = () => {
    if (fx) {
      useStore.getState().openPluginWindow(trackId, "fx", index);
    } else {
      useStore.getState().openPluginBrowser(trackId, "fx", index);
    }
  };

  return (
    <div
      onClick={handleClick}
      className="w-full text-[8px] text-center py-2 cursor-pointer border border-dashed"
      style={{ borderColor: "#808080", color: fx ? "#000" : "#808080" }}
    >
      {fx ? (
        fx.type === "reverb" ? "🌊 Reverb" : "⏳ Delay"
      ) : (
        "+ Add FX"
      )}
    </div>
  );
}