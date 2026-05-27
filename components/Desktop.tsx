"use client";

import { useStore } from "@/store/useStore";
import Taskbar from "./Taskbar";
import StartMenu from "./StartMenu";
import Window from "./Window";
import TrackList from "./TrackList";
import Timeline from "./Timeline";
import MidiEditor from "./MidiEditor";
import AudioEditor from "./AudioEditor";

const DESKTOP_ICONS = [
  { label: "My DAW", icon: "🎵" },
  { label: "Tracks", icon: "📋" },
  { label: "Mixer", icon: "🎚" },
  { label: "Samples", icon: "💾" },
];

export default function Desktop() {
  const { startMenuOpen, windows, activeWindow, setActiveWindow } = useStore();

  const isWindowOpen = (id: string) => !windows[id as keyof typeof windows]?.minimized;

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      {/* Desktop background */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: "#008080" }}
      >
        {/* Desktop icons */}
        <div className="flex flex-col gap-1 p-3">
          {DESKTOP_ICONS.map((item) => (
            <div key={item.label} className="desktop-icon">
              <span className="text-2xl">{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Windows */}
      {isWindowOpen("trackList") && (
        <Window
          windowId="trackList"
          title="Track List"
          icon="📋"
          defaultRect={windows.trackList}
        >
          <TrackList />
        </Window>
      )}

      {isWindowOpen("timeline") && (
        <Window
          windowId="timeline"
          title="Arrangement Timeline"
          icon="⏱"
          defaultRect={windows.timeline}
        >
          <Timeline />
        </Window>
      )}

      {isWindowOpen("midiEditor") && (
        <Window
          windowId="midiEditor"
          title="MIDI Piano Roll Editor"
          icon="🎹"
          defaultRect={windows.midiEditor}
        >
          <MidiEditor />
        </Window>
      )}

      {isWindowOpen("audioEditor") && (
        <Window
          windowId="audioEditor"
          title="Audio Waveform Editor"
          icon="🔊"
          defaultRect={windows.audioEditor}
        >
          <AudioEditor />
        </Window>
      )}

      {/* Start Menu */}
      {startMenuOpen && <StartMenu />}

      {/* Taskbar */}
      <Taskbar />
    </div>
  );
}