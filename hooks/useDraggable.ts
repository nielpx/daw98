"use client";

import { useState, useCallback, useRef } from "react";

interface UseDraggableOptions {
  onDrag?: (dx: number, dy: number) => void;
  onDragEnd?: () => void;
}

export function useDraggable(options?: UseDraggableOptions) {
  const [dragging, setDragging] = useState(false);
  const startRef = useRef({ x: 0, y: 0 });

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setDragging(true);
      startRef.current = { x: e.clientX, y: e.clientY };

      const onMouseMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startRef.current.x;
        const dy = ev.clientY - startRef.current.y;
        startRef.current = { x: ev.clientX, y: ev.clientY };
        options?.onDrag?.(dx, dy);
      };

      const onMouseUp = () => {
        setDragging(false);
        options?.onDragEnd?.();
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [options]
  );

  return { dragging, onMouseDown };
}