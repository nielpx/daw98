"use client";

import { useStore } from "@/store/useStore";
import type { TrackType } from "@/store/types";

export default function StartMenu() {
  const { addTrack, setStartMenuOpen, toggleWindow, windows, setActiveWindow } =
    useStore();

  const handleAddMidiTrack = () => {
    addTrack("midi");
    setStartMenuOpen(false);
  };

  const handleAddAudioTrack = () => {
    addTrack("audio");
    setStartMenuOpen(false);
  };

  const handleOpenWindow = (id: "trackList" | "timeline" | "midiEditor" | "audioEditor") => {
    if (windows[id].minimized) toggleWindow(id);
    setActiveWindow(id);
    setStartMenuOpen(false);
  };

  return (
    <div
      className="absolute bottom-10 left-0 z-50 w-56"
      style={{
        border: "2px solid",
        borderColor: "#fff #808080 #808080 #fff",
        backgroundColor: "#c0c0c0",
      }}
    >
      {/* Banner */}
      <div
        className="flex items-center h-16 px-2 text-white font-bold"
        style={{
          background: "linear-gradient(to right, #000080, #1084d0)",
        }}
      >
        <span className="text-xl">DAW 98</span>
      </div>

      {/* Menu items */}
      <div className="py-1">
        <div className="px-2 py-1 text-xs" style={{ color: "#808080" }}>
          File
        </div>
        <button
          onClick={handleAddMidiTrack}
          className="w-full text-left px-6 py-1 text-sm hover:bg-[#000080] hover:text-white flex items-center gap-2"
        >
          <span>🎹</span> New MIDI Track
        </button>
        <button
          onClick={handleAddAudioTrack}
          className="w-full text-left px-6 py-1 text-sm hover:bg-[#000080] hover:text-white flex items-center gap-2"
        >
          <span>🔊</span> New Audio Track
        </button>

        <div
          className="mx-2 my-1"
          style={{ borderTop: "1px solid #808080", borderBottom: "1px solid #fff" }}
        />

        <div className="px-2 py-1 text-xs" style={{ color: "#808080" }}>
          Windows
        </div>
        {[
          { id: "trackList" as const, label: "Track List", icon: "📋" },
          { id: "timeline" as const, label: "Timeline", icon: "⏱" },
          { id: "midiEditor" as const, label: "MIDI Editor", icon: "🎹" },
          { id: "audioEditor" as const, label: "Audio Editor", icon: "🔊" },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => handleOpenWindow(item.id)}
            className="w-full text-left px-6 py-1 text-sm hover:bg-[#000080] hover:text-white flex items-center gap-2"
          >
            <span>{item.icon}</span> {item.label}
          </button>
        ))}

        <div
          className="mx-2 my-1"
          style={{ borderTop: "1px solid #808080", borderBottom: "1px solid #fff" }}
        />

        <button className="w-full text-left px-6 py-1 text-sm hover:bg-[#000080] hover:text-white flex items-center gap-2">
          <span>❓</span> Help
        </button>
      </div>
    </div>
  );
}