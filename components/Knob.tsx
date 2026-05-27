"use client";
import { useRef, useEffect, useState } from "react";

interface KnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  onDoubleClick?: () => void;
}

export default function SVGKnob({
  label, value, min, max, step = 0.01, onChange, onDoubleClick,
}: KnobProps) {
  const [dragging, setDragging] = useState(false);
  const startYRef = useRef(0);
  const startValueRef = useRef(value);

  useEffect(() => {
    if (!dragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = startYRef.current - e.clientY;
      const range = max - min;
      const sensitivity = 200;
      const deltaValue = (deltaY / sensitivity) * range;
      const newValue = startValueRef.current + deltaValue;
      const quantized = Math.round(newValue / step) * step;
      const clamped = Math.min(max, Math.max(min, quantized));
      onChange(clamped);
    };
    const handleMouseUp = () => setDragging(false);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging, min, max, step, onChange]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startYRef.current = e.clientY;
    startValueRef.current = value;
    setDragging(true);
  };

  const angle = ((value - min) / (max - min)) * 270 - 135;

  return (
    <div className="flex flex-col items-center gap-0.5 select-none">
      <span className="text-[8px] font-semibold">{label}</span>
      <svg
        width="36"
        height="36"
        viewBox="0 0 140 140"
        onMouseDown={handleMouseDown}
        onDoubleClick={onDoubleClick}
        style={{ cursor: "pointer" }}
      >
        <g transform="translate(70 70)">
          <g stroke="#444" strokeWidth="2">
            {Array.from({ length: 19 }, (_, i) => {
              const a = -135 + i * 15;
              return (
                <line
                  key={i}
                  x1="0"
                  y1="-58"
                  x2="0"
                  y2="-64"
                  transform={`rotate(${a})`}
                />
              );
            })}
          </g>
          <circle cx="3" cy="4" r="44" fill="#6f6f6f" />
          <circle cx="0" cy="0" r="44" fill="#c0c0c0" stroke="#000" strokeWidth="2" />
          <path d="M -30 -30 A 42 42 0 0 1 30 -30" stroke="#ffffff" strokeWidth="4" fill="none" />
          <path d="M 30 30 A 42 42 0 0 1 -30 30" stroke="#555" strokeWidth="4" fill="none" />
          <circle cx="0" cy="0" r="35" fill="#d6d6d6" stroke="#9a9a9a" strokeWidth="1" />
          <g transform={`rotate(${angle})`}>
            <rect x="-3" y="-34" width="6" height="18" rx="1" fill="#111" />
          </g>
          <circle cx="0" cy="0" r="5" fill="#8a8a8a" />
        </g>
      </svg>
      <span className="text-[10px]">{value.toFixed(step < 1 ? 2 : 0)}</span>
    </div>
  );
}
