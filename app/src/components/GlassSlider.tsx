import React, { useCallback, useRef, useState } from 'react';

export interface GlassSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  defaultValue?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  hint?: string;
}

/**
 * Illuminated glass slider: recessed 6px dark-glass track, glowing gradient
 * fill bar, a tick at the engineered default, and a specular thumb that blooms
 * while dragged.
 */
export const GlassSlider: React.FC<GlassSliderProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  defaultValue,
  onChange,
  format,
  hint,
}) => {
  const [dragging, setDragging] = useState(false);
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  const defPct =
    defaultValue === undefined
      ? undefined
      : Math.max(0, Math.min(100, ((defaultValue - min) / (max - min)) * 100));
  const ref = useRef<HTMLInputElement | null>(null);

  const handle = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onChange(parseFloat(e.target.value)),
    [onChange]
  );

  return (
    <div className="param">
      <div className="param-head">
        <label className="param-label" htmlFor={`slider-${label}`}>
          {label}
        </label>
        <span className="param-value">{format ? format(value) : value}</span>
      </div>
      <div
        className={`slider${dragging ? ' is-dragging' : ''}`}
        style={{ ['--fill' as string]: `${pct}%` }}
      >
        <div className="slider-track">
          <div className="slider-fill" />
        </div>
        {defPct !== undefined && (
          <span
            className="slider-tick"
            style={{ left: `${defPct}%` }}
            title="Engineered default"
          />
        )}
        <input
          id={`slider-${label}`}
          ref={ref}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handle}
          onPointerDown={() => setDragging(true)}
          onPointerUp={() => setDragging(false)}
          onPointerCancel={() => setDragging(false)}
          onBlur={() => setDragging(false)}
          aria-label={label}
          aria-valuetext={format ? format(value) : String(value)}
        />
        <span className="slider-thumb" style={{ left: `${pct}%` }} />
      </div>
      {hint && <div className="param-hint">{hint}</div>}
    </div>
  );
};
