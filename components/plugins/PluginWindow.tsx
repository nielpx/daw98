"use client";
import { useRef, useState, useCallback } from "react";

export default function PluginWindow({
  title,
  icon,
  children,
  onClose,
  defaultRect = { x: 200, y: 100, width: 340, height: 380 },
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
  onClose: () => void;
  defaultRect?: { x: number; y: number; width: number; height: number };
}) {
  const [rect, setRect] = useState(defaultRect);

  const clampToViewport = useCallback((r: { x: number; y: number; width: number; height: number }) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    return {
      x: Math.max(0, Math.min(r.x, vw - 100)),
      y: Math.max(0, Math.min(r.y, vh - 40)),
      width: Math.max(200, Math.min(r.width, vw - 20)),
      height: Math.max(150, Math.min(r.height, vh - 40)),
    };
  }, []);

  const dragStart = useRef({ x: 0, y: 0, origX: 0, origY: 0 });
  const [dragging, setDragging] = useState(false);

  const handleTitleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, origX: rect.x, origY: rect.y };
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - dragStart.current.x;
      const dy = ev.clientY - dragStart.current.y;
      setRect((prev) =>
        clampToViewport({
          ...prev,
          x: dragStart.current.origX + dx,
          y: Math.max(0, dragStart.current.origY + dy),
        }),
      );
    };
    const onUp = () => {
      setDragging(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const resizeStart = useRef({ x: 0, y: 0, origW: 0, origH: 0 });
  const [resizing, setResizing] = useState(false);

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setResizing(true);
    resizeStart.current = { x: e.clientX, y: e.clientY, origW: rect.width, origH: rect.height };
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - resizeStart.current.x;
      const dy = ev.clientY - resizeStart.current.y;
      setRect((prev) =>
        clampToViewport({
          ...prev,
          width: resizeStart.current.origW + dx,
          height: resizeStart.current.origH + dy,
        }),
      );
    };
    const onUp = () => {
      setResizing(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div
      className="absolute window z-50"
      style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
    >
      <div className={`title-bar ${dragging ? "" : ""}`} onMouseDown={handleTitleMouseDown}>
        <div className="title-bar-text flex items-center gap-1">
          <span>{icon}</span> {title}
        </div>
        <div className="title-bar-controls">
          <button aria-label="Close" onClick={onClose} />
        </div>
      </div>
      <div className="window-body" style={{ height: "calc(100% - 28px)", overflow: "auto" }}>
        {children}
      </div>
      <div
        onMouseDown={handleResizeMouseDown}
        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
        style={{
          background: "linear-gradient(135deg, transparent 50%, #808080 50%)",
        }}
      />
    </div>
  );
}
