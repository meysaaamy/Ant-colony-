import React from 'react';
import type { PresetType } from '../sim/types';
import { AntGlyph, ChevronIcon, CrystalGlyph, PlayIcon, ResetArrowIcon } from './icons';

export type PlayMode = 'sandbox' | 'challenge';

interface WorldCardSpec {
  id: PresetType;
  index: string;
  name: string;
  blurb: string;
}

const WORLDS: WorldCardSpec[] = [
  { id: 'sanctuary', index: '01', name: 'Sanctuary', blurb: 'Open ground, gentle currents' },
  { id: 'double_bridge', index: '02', name: 'Double Bridge', blurb: 'Two roads, one short' },
  { id: 'labyrinth', index: '03', name: 'Labyrinth', blurb: 'Walls that ask questions' },
];

/** Bespoke map thumbnail — pure SVG, no bitmaps, no icon-set imports. */
const WorldThumb: React.FC<{ variant: PresetType }> = ({ variant }) => (
  <svg viewBox="0 0 120 76" className="world-thumb" aria-hidden="true">
    <defs>
      <radialGradient id={`wt-glow-${variant}`} cx="30%" cy="70%" r="70%">
        <stop offset="0%" stopColor="rgba(255,196,110,0.55)" />
        <stop offset="100%" stopColor="rgba(255,196,110,0)" />
      </radialGradient>
    </defs>
    <rect width="120" height="76" fill="#0b0d10" />
    <ellipse cx="34" cy="54" rx="46" ry="26" fill={`url(#wt-glow-${variant})`} />
    {variant === 'sanctuary' && (
      <>
        <path d="M22 56c14-14 26-18 40-12 12 5 20 2 34-8" className="wt-trail" />
        <path d="M20 62c16-10 30-10 44-2 10 6 22 4 34-4" className="wt-trail dim" />
      </>
    )}
    {variant === 'double_bridge' && (
      <>
        <path d="M22 56c10-4 16-18 26-22 9-4 16 2 24 8 9 6 18 4 26-2" className="wt-trail" />
        <path d="M22 56c12-16 20-30 32-30 10 0 18 10 24 18" className="wt-trail dim" />
      </>
    )}
    {variant === 'labyrinth' && (
      <>
        <path d="M28 44h20V28h22v18h24" className="wt-wall" />
        <path d="M24 60h30V50h26" className="wt-wall" />
        <path d="M22 56c8-6 16-8 24-6 12 3 20 0 30-8" className="wt-trail" />
      </>
    )}
    <circle cx="22" cy="56" r="3.2" fill="#ffc46e" />
    <circle cx="22" cy="56" r="6.5" fill="none" stroke="rgba(0,216,255,0.55)" strokeWidth="0.8" />
    {[
      [92, 40],
      [62, 30],
      [44, 66],
    ].map(([cx, cy], i) => (
      <g key={i}>
        <circle cx={cx} cy={cy} r="1.6" fill="#4dffa1" />
        <circle cx={cx} cy={cy} r="3.6" fill="rgba(77,255,161,0.18)" />
      </g>
    ))}
  </svg>
);

export interface LandingProps {
  preset: PresetType;
  onSelectPreset: (p: PresetType) => void;
  onPlay: (mode: PlayMode) => void;
  onOpenGuide: () => void;
  onOpenBests: () => void;
  antCount: number;
  foodCount: number;
  bestSandbox: number;
  bestChallenge: number;
}

export const Landing: React.FC<LandingProps> = ({
  preset,
  onSelectPreset,
  onPlay,
  onOpenGuide,
  onOpenBests,
  antCount,
  foodCount,
  bestSandbox,
  bestChallenge,
}) => (
  <div className="landing" data-screen="landing">
    <header className="landing-nav">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          <AntGlyph size={22} />
        </span>
        <span className="brand-word">ant colony</span>
      </div>
      <nav className="landing-links">
        <button type="button" className="landing-link" onClick={onOpenGuide}>
          Guide
        </button>
        <button type="button" className="landing-link" onClick={onOpenBests}>
          Bests
        </button>
        <button type="button" className="profile-squircle" aria-label="Colony profile" onClick={onOpenBests}>
          <AntGlyph size={16} />
        </button>
      </nav>
    </header>

    <div className="landing-hero">
      <p className="eyebrow">
        <span className="eyebrow-rule" aria-hidden="true" />
        A little world, alive
      </p>
      <h1 className="display">
        Small world.
        <br />
        <em>Big wonder.</em>
      </h1>
      <p className="lede">Draw a little light. Watch an entire colony find its way.</p>

      <div className="cta-row">
        <button type="button" className="cta cta-primary" onClick={() => onPlay('sandbox')} data-play="sandbox">
          <span className="cta-icon" aria-hidden="true">
            <PlayIcon size={17} />
          </span>
          <span className="cta-copy">
            <strong>Play sandbox</strong>
            <small>Make yourself at home</small>
          </span>
        </button>
        <button
          type="button"
          className="cta cta-ghost"
          onClick={() => onPlay('challenge')}
          data-play="challenge"
        >
          <span className="cta-icon" aria-hidden="true">
            <span className="clock-dial">
              <i />
            </span>
          </span>
          <span className="cta-copy">
            <strong>180-second challenge</strong>
            <small>How much can they gather?</small>
          </span>
        </button>
      </div>
    </div>

    <section className="landing-worlds" aria-label="Choose your starting world">
      <div className="section-head">
        <h2>Choose your starting world</h2>
        <button type="button" className="section-link" onClick={onOpenBests}>
          <span className="trophy" aria-hidden="true">
            <CrystalGlyph size={13} />
          </span>
          Your bests
          <ChevronIcon size={12} />
        </button>
      </div>

      <div className="world-rail" role="radiogroup" aria-label="Starting world">
        {WORLDS.map((w) => {
          const selected = w.id === preset;
          return (
            <button
              key={w.id}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`world-card${selected ? ' is-selected' : ''}`}
              onClick={() => onSelectPreset(w.id)}
              data-world={w.id}
            >
              <WorldThumb variant={w.id} />
              {selected && (
                <span className="world-check" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="14" height="14">
                    <path
                      d="M5.5 12.8l4 4L18.5 7.6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              )}
              <span className="world-meta">
                <span className="world-index num">{w.index}</span>
                <span className="world-state">{selected ? 'Selected' : 'Explore'}</span>
              </span>
              <span className="world-name">{w.name}</span>
              <span className="world-blurb">{w.blurb}</span>
            </button>
          );
        })}
      </div>
    </section>

    <footer className="landing-foot">
      <div className="foot-stats">
        <span className="foot-stat">
          <span className="dot emerald" aria-hidden="true" />
          <strong className="num">{antCount}</strong> ants exploring
        </span>
        <span className="foot-div" aria-hidden="true" />
        <span className="foot-stat">
          <strong className="num">{foodCount}</strong> food delivered
        </span>
        {bestChallenge > 0 && (
          <>
            <span className="foot-div" aria-hidden="true" />
            <span className="foot-stat">
              best challenge <strong className="num">{bestChallenge}</strong>
            </span>
          </>
        )}
        {bestSandbox > 0 && (
          <>
            <span className="foot-div" aria-hidden="true" />
            <span className="foot-stat">
              best sandbox <strong className="num">{bestSandbox}</strong>
            </span>
          </>
        )}
      </div>
      <span className="foot-mark">
        Made for the curious
        <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" className="foot-star">
          <path
            d="M12 2.6v18.8M2.6 12h18.8M5.4 5.4l13.2 13.2M18.6 5.4L5.4 18.6"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
      </span>
    </footer>
  </div>
);

export interface ChallengeBannerProps {
  secondsLeft: number;
  score: number;
  onExit: () => void;
}

/** Slim top banner shown only in challenge mode. */
export const ChallengeBanner: React.FC<ChallengeBannerProps> = ({ secondsLeft, score, onExit }) => (
  <div className="challenge-banner glass" role="status">
    <span className="challenge-clock" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="15" height="15">
        <circle cx="12" cy="12" r="8.4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M12 7.4V12l3.2 2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </span>
    <span className="challenge-time num">
      {String(Math.floor(secondsLeft / 60)).padStart(1, '0')}:
      {String(secondsLeft % 60).padStart(2, '0')}
    </span>
    <span className="challenge-div" aria-hidden="true" />
    <span className="challenge-score">
      <strong className="num">{score}</strong> gathered
    </span>
    <button type="button" className="challenge-exit" onClick={onExit} aria-label="End challenge">
      <ResetArrowIcon size={14} />
    </button>
  </div>
);
