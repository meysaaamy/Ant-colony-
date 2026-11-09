import React from 'react';
import {
  AntGlyph,
  CrystalGlyph,
  InfoIcon,
  PauseIcon,
  PlayIcon,
  TuningSlidersIcon,
} from './icons';

export interface TopHudProps {
  antCount: number;
  foodCount: number;
  fps: number;
  simSpeed: 1 | 2 | 4;
  isPaused: boolean;
  guideOpen: boolean;
  paramsOpen: boolean;
  onTogglePause: () => void;
  onCycleSpeed: () => void;
  onOpenGuide: () => void;
  onOpenParams: () => void;
}

export const TopHud: React.FC<TopHudProps> = ({
  antCount,
  foodCount,
  fps,
  simSpeed,
  isPaused,
  guideOpen,
  paramsOpen,
  onTogglePause,
  onCycleSpeed,
  onOpenGuide,
  onOpenParams,
}) => {
  return (
    <div className="hud-top">
      <div className="telemetry glass">
        <span className="glyph ant" aria-hidden>
          <AntGlyph size={18} />
        </span>
        <span className="value num">{antCount.toLocaleString('en-US')}</span>
        <span className="unit">ants</span>

        <span className="hairline" aria-hidden />

        <span className="glyph food" aria-hidden>
          <CrystalGlyph size={18} />
        </span>
        <span className="value num">{foodCount.toLocaleString('en-US')}</span>
        <span className="unit">food</span>

        <span className="spacer" aria-hidden />

        <button
          type="button"
          className="speed-chip num"
          onClick={onCycleSpeed}
          aria-label={`Simulation speed ${simSpeed}x, tap to change`}
        >
          {simSpeed}
          <span className="x">x</span>
        </button>

        <button
          type="button"
          className="play"
          data-playing={!isPaused}
          onClick={onTogglePause}
          aria-label={isPaused ? 'Resume simulation' : 'Pause simulation'}
          aria-pressed={!isPaused}
        >
          <span className="visual" aria-hidden>
            {isPaused ? <PlayIcon size={17} /> : <PauseIcon size={16} />}
          </span>
        </button>
      </div>

      <div className="utility">
        <button
          type="button"
          className="squircle glass"
          data-active={guideOpen}
          onClick={onOpenGuide}
          aria-label="Open the scientific field guide"
        >
          <InfoIcon size={19} />
        </button>
        <button
          type="button"
          className="squircle glass"
          data-active={paramsOpen}
          onClick={onOpenParams}
          aria-label="Open simulation parameters"
        >
          <TuningSlidersIcon size={19} />
        </button>
      </div>

      <span className="sr-only" aria-live="off">
        {`${antCount} ants, ${foodCount} food, ${fps} frames per second`}
      </span>
    </div>
  );
};
