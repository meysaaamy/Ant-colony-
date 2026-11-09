import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { ToolType } from '../sim/types';
import {
  ChevronIcon,
  DottedRingIcon,
  ResetArrowIcon,
  SparkleSweepIcon,
  TOOLS,
  TuningSlidersIcon,
  toolById,
} from './icons';
import { GlassSlider } from './GlassSlider';

export interface CockpitProps {
  activeTool: ToolType;
  onSelectTool: (t: ToolType) => void;
  presetTitle: string;
  sheetOpen: boolean;
  onTapSheet: () => void;
  onSwipeSheet: (dir: 'up' | 'down') => void;
  onClearTrails: () => void;
  onResetWorld: () => void;
  brushRadius: number;
  brushIntensity: number;
  onChangeBrushRadius: (v: number) => void;
  onChangeBrushIntensity: (v: number) => void;
}

export const Cockpit: React.FC<CockpitProps> = ({
  activeTool,
  onSelectTool,
  presetTitle,
  sheetOpen,
  onTapSheet,
  onSwipeSheet,
  onClearTrails,
  onResetWorld,
  brushRadius,
  brushIntensity,
  onChangeBrushRadius,
  onChangeBrushIntensity,
}) => {
  const [armed, setArmed] = useState(false);
  const armTimer = useRef<number | null>(null);
  const [brushOpen, setBrushOpen] = useState(false);
  const brushWrapRef = useRef<HTMLDivElement | null>(null);
  const tool = toolById(activeTool);

  /* reset requires a deliberate 2-tap armed state */
  const handleReset = useCallback(() => {
    if (armed) {
      setArmed(false);
      if (armTimer.current) window.clearTimeout(armTimer.current);
      onResetWorld();
      return;
    }
    setArmed(true);
    armTimer.current = window.setTimeout(() => setArmed(false), 3000);
  }, [armed, onResetWorld]);

  useEffect(
    () => () => {
      if (armTimer.current) window.clearTimeout(armTimer.current);
    },
    []
  );

  /* dismiss the brush popover on any outside contact */
  useEffect(() => {
    if (!brushOpen) return;
    const onDown = (e: PointerEvent) => {
      if (brushWrapRef.current && !brushWrapRef.current.contains(e.target as Node)) {
        setBrushOpen(false);
      }
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [brushOpen]);

  /* tap vs drag choreography on the world-controls card */
  const gesture = useRef({ y: 0, t: 0, dragged: false });
  const lastTapAt = useRef(0);

  /* A real finger produces pointerdown→pointerup→click. Assistive tech and
     keyboards only produce click. De-duplicate so the sheet never double-toggles. */
  const fireTap = () => {
    lastTapAt.current = performance.now();
    onTapSheet();
  };
  const handlePointerDown = (e: React.PointerEvent) => {
    gesture.current = { y: e.clientY, t: performance.now(), dragged: false };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!gesture.current.t) return;
    const dy = e.clientY - gesture.current.y;
    if (Math.abs(dy) > 26 && !gesture.current.dragged) {
      gesture.current.dragged = true;
      onSwipeSheet(dy < 0 ? 'up' : 'down');
    }
  };
  const handlePointerUp = () => {
    const wasTap =
      !gesture.current.dragged &&
      gesture.current.t !== 0 &&
      performance.now() - gesture.current.t < 600;
    gesture.current.t = 0;
    if (wasTap && performance.now() - lastTapAt.current > 350) fireTap();
  };

  return (
    <>
      {/* ── Tier 1 — world controls + preset peek card ─────────────────── */}
      <div
        className="tier1 glass"
        role="button"
        tabIndex={0}
        aria-expanded={sheetOpen}
        aria-label={`World controls. Preset ${presetTitle}. Tap to ${sheetOpen ? 'collapse' : 'expand'} parameters`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => (gesture.current.t = 0)}
        onClick={() => {
          if (performance.now() - lastTapAt.current > 350) fireTap();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fireTap();
          }
        }}
      >
        <span className="drag-handle" aria-hidden />
        <div className="tier1-row">
          <div className="preset-block">
            <span className="badge" aria-hidden>
              <TuningSlidersIcon size={17} />
            </span>
            <div className="preset-meta">
              <div className="caption">World controls</div>
              <div className="preset-title">{presetTitle}</div>
            </div>
          </div>

          <div className="tier1-actions">
            <button
              type="button"
              className="pill-btn"
              aria-label="Clear all pheromone trails"
              title="Clear trails"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onClearTrails();
              }}
            >
              <SparkleSweepIcon size={14} />
              <span className="label">Clear trails</span>
            </button>
            <button
              type="button"
              className="pill-btn"
              data-armed={armed}
              aria-label={armed ? 'Tap again to reset the world' : 'Reset world — requires two taps'}
              title="Reset world"
              aria-live="polite"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                handleReset();
              }}
            >
              <ResetArrowIcon size={14} />
              <span className="label">{armed ? 'Tap again' : 'Reset'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Tier 2 — active tool badge + live brush trigger ────────────── */}
      <div className="tier2" style={{ display: sheetOpen ? 'none' : undefined }}>
        <div className="tool-badge glass">
          <span className="orb" aria-hidden />
          <span className="tool-name">{tool.name}</span>
          <span className="tool-index num">· {tool.index}</span>
        </div>

        <span className="spacer" aria-hidden />

        <div className="brush-wrap" ref={brushWrapRef}>
          {brushOpen && (
            <div className="popover glass-deep" role="dialog" aria-label="Brush settings">
              <div className="popover-head">
                <span className="caption">Brush engine</span>
                <span className="popover-pill">{tool.name}</span>
              </div>
              <GlassSlider
                label="Brush radius"
                value={brushRadius}
                min={10}
                max={80}
                step={1}
                defaultValue={26}
                onChange={onChangeBrushRadius}
                format={(v) => `${v}`}
              />
              <GlassSlider
                label="Deposition intensity"
                value={brushIntensity}
                min={10}
                max={100}
                step={5}
                defaultValue={45}
                onChange={onChangeBrushIntensity}
                format={(v) => `${v}%`}
                hint={tool.hint}
              />
            </div>
          )}
          <button
            type="button"
            className="brush-pill glass"
            data-open={brushOpen}
            onClick={() => setBrushOpen((v) => !v)}
            aria-expanded={brushOpen}
            aria-label={`Brush radius ${brushRadius}. Open brush settings`}
          >
            <DottedRingIcon size={16} />
            <span className="num">{brushRadius}</span>
            <span className="chev" aria-hidden>
              <ChevronIcon size={11} />
            </span>
          </button>
        </div>
      </div>

      {/* ── Tier 3 — primary 6-tool thumb dock ─────────────────────────── */}
      <div className="dock glass" role="toolbar" aria-label="Scent painting tools">
        {TOOLS.map(({ id, name, index, core, accent, halo, soft, line, Icon }) => {
          const active = id === activeTool;
          return (
            <button
              key={id}
              type="button"
              className="slot"
              data-active={active}
              aria-pressed={active}
              aria-label={`${name} — tool ${index}`}
              style={
                {
                  '--core': core,
                  '--accent': accent,
                  '--halo': halo,
                  '--accent-soft': soft,
                  '--accent-line': line,
                } as React.CSSProperties
              }
              onClick={() => {
                if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                  try {
                    navigator.vibrate(8);
                  } catch {
                    /* haptics unavailable */
                  }
                }
                onSelectTool(id);
              }}
            >
              <Icon size={24} />
              <span className="idx num">{index}</span>
            </button>
          );
        })}
      </div>
    </>
  );
};
