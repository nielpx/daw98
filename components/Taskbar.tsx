"use client";

import { useStore } from "@/store/useStore";
import TransportControls from "./TransportControls";

export default function Taskbar() {
  const {
    startMenuOpen,
    setStartMenuOpen,
    windows,
    toggleWindow,
    activeWindow,
    setActiveWindow,
  } = useStore();

  const taskbarItems = [
    { id: "trackList" as const, label: "Track List" },
    { id: "timeline" as const, label: "Timeline" },
    { id: "midiEditor" as const, label: "MIDI Editor" },
    { id: "audioEditor" as const, label: "Audio Editor" },
  ];

  return (
    <div
      className="absolute bottom-0 left-0 right-0 h-10 flex items-center px-1 gap-1"
      style={{
        backgroundColor: "#c0c0c0",
        borderTop: "2px solid #fff",
        boxShadow: "inset 0 1px 0 #dfdfdf",
      }}
    >
      {/* Start Button */}
      <button
        onClick={() => setStartMenuOpen(!startMenuOpen)}
        className="flex items-center gap-1 px-2 h-8 font-bold text-sm"
        style={{
          border: "2px solid",
          borderColor: "#fff #808080 #808080 #fff",
          backgroundColor: startMenuOpen ? "#c0c0c0" : "#c0c0c0",
          boxShadow: startMenuOpen
            ? "inset 1px 1px 2px #808080"
            : "none",
        }}
      >
        <span className="text-lg">🖥</span>
        <span>Start</span>
      </button>

      {/* Divider */}
      <div
        className="h-8 w-0.5 mx-1"
        style={{ borderLeft: "1px solid #808080", borderRight: "1px solid #fff" }}
      />

      {/* Transport Controls */}
      <TransportControls />

      {/* Divider */}
      <div
        className="h-8 w-0.5 mx-1"
        style={{ borderLeft: "1px solid #808080", borderRight: "1px solid #fff" }}
      />

      {/* Taskbar window buttons */}
      {taskbarItems.map((item) => {
        const isMinimized = windows[item.id].minimized;
        const isActive = activeWindow === item.id && !isMinimized;
        return (
          <button
            key={item.id}
            onClick={() => {
              if (isActive) {
                toggleWindow(item.id);
              } else {
                if (isMinimized) toggleWindow(item.id);
                setActiveWindow(item.id);
              }
            }}
            className="h-7 px-3 text-xs text-left truncate max-w-[140px]"
            style={{
              border: "2px solid",
              borderColor: isActive
                ? "#808080 #fff #fff #808080"
                : "#fff #808080 #808080 #fff",
              backgroundColor: isActive ? "#c0c0c0" : "#c0c0c0",
              boxShadow: isActive ? "inset 1px 1px 2px #808080" : "none",
            }}
          >
            {item.label}
          </button>
        );
      })}

      {/* System tray */}
      <div className="ml-auto flex items-center h-8 px-2 text-xs" style={{ border: "1px solid #808080" }}>
        <span>120 BPM</span>
      </div>
    </div>
  );
}