"use client";

import { useRef, useCallback, useState } from "react";
import { useStore } from "@/store/useStore";
import type { WindowId } from "@/store/types";

interface WindowProps {
  windowId: WindowId;
  title: string;
  icon: string;
  children: React.ReactNode;
  defaultRect: { x: number; y: number; width: number; height: number };
}

export default function Window({
  windowId,
  title,
  icon,
  children,
  defaultRect,
}: WindowProps) {
  const {
    windows,
    moveWindow,
    toggleWindow,
    activeWindow,
    setActiveWindow,
  } = useStore();

  const rect = windows[windowId];
  const isActive = activeWindow === windowId;
  const ref = useRef<HTMLDivElement>(null);

  // --- Dragging ---
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, origX: 0, origY: 0 });

  const handleTitleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      setActiveWindow(windowId);
      setDragging(true);
      dragStart.current = {
        x: e.clientX,
        y: e.clientY,
        origX: rect.x,
        origY: rect.y,
      };

      const onMouseMove = (ev: MouseEvent) => {
        const dx = ev.clientX - dragStart.current.x;
        const dy = ev.clientY - dragStart.current.y;
        const w = rect.width;
        moveWindow(windowId, {
          x: Math.max(0, Math.min(dragStart.current.origX + dx, window.innerWidth - Math.min(w, 100))),
          y: Math.max(0, dragStart.current.origY + dy),
        });
      };

      const onMouseUp = () => {
        setDragging(false);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [windowId, rect.x, rect.y, moveWindow, setActiveWindow]
  );

  // --- Resizing ---
  const [resizing, setResizing] = useState(false);
  const resizeStart = useRef({ x: 0, y: 0, origW: 0, origH: 0 });

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setResizing(true);
      resizeStart.current = {
        x: e.clientX,
        y: e.clientY,
        origW: rect.width,
        origH: rect.height,
      };

      const onMouseMove = (ev: MouseEvent) => {
        const dx = ev.clientX - resizeStart.current.x;
        const dy = ev.clientY - resizeStart.current.y;
        moveWindow(windowId, {
          width: Math.max(200, Math.min(resizeStart.current.origW + dx, window.innerWidth - 20)),
          height: Math.max(150, Math.min(resizeStart.current.origH + dy, window.innerHeight - 40)),
        });
      };

      const onMouseUp = () => {
        setResizing(false);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [windowId, rect.width, rect.height, moveWindow]
  );

  if (rect.minimized) return null;

  return (
    <div
      ref={ref}
      onClick={() => setActiveWindow(windowId)}
      className="absolute window"
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
        zIndex: isActive ? 10 : 1,
      }}
    >
      {/* Title bar (98.css structure) */}
      <div
        className={`title-bar ${isActive ? "" : "inactive"}`}
        onMouseDown={handleTitleMouseDown}
      >
        <div className="title-bar-text flex items-center gap-1">
          <span className="text-sm">{icon}</span>
          <span className="truncate">{title}</span>
        </div>
        <div className="title-bar-controls">
          <button
            aria-label="Minimize"
            onClick={(e) => {
              e.stopPropagation();
              toggleWindow(windowId);
            }}
          />
          <button aria-label="Maximize" />
          <button
            aria-label="Close"
            onClick={(e) => {
              e.stopPropagation();
              toggleWindow(windowId);
            }}
          />
        </div>
      </div>

      {/* Window body */}
      <div className="window-body" style={{ height: "calc(100% - 28px)", overflow: "auto" }}>
        {children}
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={handleResizeMouseDown}
        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
        style={{
          background:
            "linear-gradient(135deg, transparent 50%, #808080 50%)",
        }}
      />
    </div>
  );
}