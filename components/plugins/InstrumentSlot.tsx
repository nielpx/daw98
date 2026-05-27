"use client";
import { useStore } from "@/store/useStore";

export default function InstrumentSlot({ trackId }: { trackId: string }) {
  const track = useStore((s) => s.tracks.find((t) => t.id === trackId));
  const instrumentType = track?.instrumentType;

  const handleClick = () => {
    if (instrumentType) {
      // Buka editor
      useStore.getState().openPluginWindow(trackId, "instrument", null);
    } else {
      // Buka browser
      useStore.getState().openPluginBrowser(trackId, "instrument", null);
    }
  };

  return (
    <div
      onClick={handleClick}
      className="w-full text-[8px] text-center py-2 cursor-pointer border border-dashed"
      style={{ borderColor: "#808080", color: instrumentType ? "#000" : "#808080" }}
    >
      {instrumentType ? "🎹 3OSC Synth" : "+ Add Instrument"}
    </div>
  );
}