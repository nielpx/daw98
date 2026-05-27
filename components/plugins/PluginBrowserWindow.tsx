"use client";
import { useStore } from "@/store/useStore";

const INSTRUMENTS = [
  { type: "threeOscSynth", name: "3OSC Synth", icon: "🎹" },
];

const FX_LIST = [
  { type: "reverb", name: "Reverb", icon: "🌊" },
  { type: "delay", name: "Delay", icon: "⏳" },
];

export default function PluginBrowserWindow({
  trackId,
  type,
  fxIndex,
  onClose,
}: {
  trackId: string;
  type: "instrument" | "fx";
  fxIndex: number | null;
  onClose: () => void;
}) {
  const list = type === "instrument" ? INSTRUMENTS : FX_LIST;

  const handleSelect = (pluginType: string) => {
    if (type === "instrument") {
      useStore.getState().setTrackInstrument(trackId, pluginType);
      useStore.getState().closePluginBrowser();
      useStore.getState().openPluginWindow(trackId, "instrument", null);
    } else {
      useStore.getState().addTrackFX(trackId, pluginType);
      useStore.getState().closePluginBrowser();
      // Buka editor FX yang baru ditambahkan (index terakhir)
      const newIndex = useStore.getState().tracks.find(t => t.id === trackId)!.fxChain.length - 1;
      useStore.getState().openPluginWindow(trackId, "fx", newIndex);
    }
  };

  return (
    <div className="absolute window z-50" style={{ left: 300, top: 100, width: 200, height: 200 }}>
      <div className="title-bar">
        <div className="title-bar-text">
          {type === "instrument" ? "Add Instrument" : "Add FX"}
        </div>
        <div className="title-bar-controls">
          <button aria-label="Close" onClick={onClose} />
        </div>
      </div>
      <div className="window-body">
        <div className="flex flex-col gap-1 p-2">
          {list.map((item) => (
            <button
              key={item.type}
              onClick={() => handleSelect(item.type)}
              className="text-left px-2 py-1 hover:bg-[#000080] hover:text-white flex items-center gap-2"
              style={{ border: "1px solid #808080", backgroundColor: "#c0c0c0" }}
            >
              <span>{item.icon}</span> {item.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}