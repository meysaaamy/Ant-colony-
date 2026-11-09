/* ============================================================================
   BESPOKE ARTISANAL SVG SYSTEM — zero emojis, zero stock icons.
   Every glyph is a hand-tuned 24x24 optical composition: 1.75px rounded
   strokes, dual-tone opacity layering, and vector gradient highlights.
   ========================================================================== */

import React, { useId } from 'react';
import type { ToolType } from '../sim/types';

export interface IconProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

const useGrad = () => `g${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none' as const,
  xmlns: 'http://www.w3.org/2000/svg',
  'aria-hidden': true as const,
  focusable: 'false' as const,
});

const stroke = {
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  strokeWidth: 1.75,
};

/* ---------------------------------------------------------------------------
   TOOL GLYPHS
   ------------------------------------------------------------------------- */

/** Dual-wave flowing organic current, directional micro-arrow, tapered filament. */
export const FoodTrailIcon: React.FC<IconProps> = ({ size = 24, ...rest }) => {
  const g = useGrad();
  return (
    <svg {...base(size)} {...rest}>
      <defs>
        <linearGradient id={g} x1="2" y1="18" x2="22" y2="6" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffae00" stopOpacity="0.55" />
          <stop offset="0.55" stopColor="#ffc233" />
          <stop offset="1" stopColor="#fff3b0" />
        </linearGradient>
      </defs>
      {/* primary scent current */}
      <path
        d="M2.9 16.1c3.1 0 4.1-5.3 7.3-5.3 2.9 0 3.5 4.3 6.3 4.3 1.1 0 2-.3 2.8-1"
        stroke={`url(#${g})`}
        {...stroke}
      />
      {/* tapered secondary filament */}
      <path
        d="M4.7 19.6c2.2 0 3.3-2.1 4.9-3.1"
        stroke="#ffae00"
        strokeOpacity="0.45"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      {/* directional arrow tip */}
      <path d="M17.3 11.5l3.1 2.6-3.2 2.3" stroke="#fff3b0" {...stroke} />
      <circle cx="3.4" cy="19.6" r="1.15" fill="#ffae00" fillOpacity="0.55" />
    </svg>
  );
};

/** Sinuous return-vector wave anchored by a glowing homeward beacon. */
export const HomeTrailIcon: React.FC<IconProps> = ({ size = 24, ...rest }) => {
  const g = useGrad();
  return (
    <svg {...base(size)} {...rest}>
      <defs>
        <linearGradient id={g} x1="3" y1="7" x2="20" y2="17" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00f0ff" stopOpacity="0.5" />
          <stop offset="0.6" stopColor="#45f6ff" />
          <stop offset="1" stopColor="#e0ffff" />
        </linearGradient>
        <radialGradient id={`${g}b`} cx="0.5" cy="0.5" r="0.5">
          <stop stopColor="#e0ffff" />
          <stop offset="0.55" stopColor="#00f0ff" stopOpacity="0.75" />
          <stop offset="1" stopColor="#00f0ff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path
        d="M3.2 7.9c2.5-3.1 5.4-3.1 7.2 0 1.7 3 4.4 3.9 6.6 1.9"
        stroke={`url(#${g})`}
        {...stroke}
      />
      <path
        d="M4.6 11.3c1.8-1.9 3.6-1.9 5.1 0"
        stroke="#00f0ff"
        strokeOpacity="0.4"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="18.4" cy="16.4" r="4.4" fill={`url(#${g}b)`} />
      <circle cx="18.4" cy="16.4" r="2" stroke="#e0ffff" strokeWidth="1.5" />
      <circle cx="18.4" cy="16.4" r="0.85" fill="#e0ffff" />
      <path
        d="M18.4 13.1v-1.6M15.6 16.4h-1.5M21.2 16.4h1"
        stroke="#00f0ff"
        strokeOpacity="0.45"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
};

/** Broken concentric sonar ripples pierced by a central mandibular spike. */
export const AlarmIcon: React.FC<IconProps> = ({ size = 24, ...rest }) => {
  const g = useGrad();
  return (
    <svg {...base(size)} {...rest}>
      <defs>
        <linearGradient id={g} x1="12" y1="17" x2="12" y2="3" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ff0a43" />
          <stop offset="1" stopColor="#ffd1dc" />
        </linearGradient>
      </defs>
      {/* broken sonar rings */}
      <path
        d="M4.2 14.9a8 8 0 0 1 4.1-6.1"
        stroke="#ff0a43"
        strokeOpacity="0.9"
        {...stroke}
      />
      <path
        d="M19.8 14.9a8 8 0 0 0-4.1-6.1"
        stroke="#ff0a43"
        strokeOpacity="0.9"
        {...stroke}
      />
      <path
        d="M6.6 17.7a5.6 5.6 0 0 1 1.7-3.5M17.4 17.7a5.6 5.6 0 0 0-1.7-3.5"
        stroke="#ff5c82"
        strokeOpacity="0.6"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      {/* mandibular warning spike */}
      <path d="M12 4.4l2.3 8.2h-4.6L12 4.4z" fill={`url(#${g})`} fillOpacity="0.9" />
      <path d="M12 5l1.5 7.1h-3L12 5z" fill="#fff" fillOpacity="0.55" />
      <path d="M9.4 14.9h5.2" stroke="#ffd1dc" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="18.4" r="1.15" fill="#ff0a43" fillOpacity="0.9" />
    </svg>
  );
};

/** Three-spired faceted isometric emerald cluster with refraction lines. */
export const FoodClusterIcon: React.FC<IconProps> = ({ size = 24, ...rest }) => {
  const g = useGrad();
  return (
    <svg {...base(size)} {...rest}>
      <defs>
        <linearGradient id={g} x1="12" y1="20" x2="12" y2="3" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00b25a" />
          <stop offset="0.55" stopColor="#00e676" />
          <stop offset="1" stopColor="#b9f6ca" />
        </linearGradient>
        <radialGradient id={`${g}h`} cx="0.5" cy="0.5" r="0.5">
          <stop stopColor="#00e676" stopOpacity="0.5" />
          <stop offset="1" stopColor="#00e676" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="12" cy="19.1" rx="8" ry="2.6" fill={`url(#${g}h)`} />
      {/* side spires */}
      <path
        d="M6.1 18.2l1.2-6.4 1.9 2 1 4.4z"
        fill="#00e676"
        fillOpacity="0.26"
        stroke="#00e676"
        strokeOpacity="0.7"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path
        d="M18.3 18.2l-1.3-5.4-1.7 1.7-1 3.7z"
        fill="#00e676"
        fillOpacity="0.22"
        stroke="#00e676"
        strokeOpacity="0.6"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      {/* central faceted crystal */}
      <path d="M12 3.9l3.6 4.6-1.1 9.5h-5l-1.1-9.5L12 3.9z" fill={`url(#${g})`} fillOpacity="0.34" />
      <path d="M12 3.9l3.6 4.6-1.1 9.5h-5l-1.1-9.5L12 3.9z" stroke={`url(#${g})`} {...stroke} />
      {/* internal refraction */}
      <path d="M12 4.4v13.4M8.4 8.5l3.6 2.9 3.6-2.9" stroke="#b9f6ca" strokeOpacity="0.9" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M12 7.4l2.3 1.1" stroke="#fff" strokeOpacity="0.8" strokeWidth="1.1" strokeLinecap="round" />
      <circle cx="9.5" cy="6.9" r="0.7" fill="#fff" fillOpacity="0.9" />
    </svg>
  );
};

/** Contoured dual-peak basalt silhouette with a topographic bevel. */
export const WallIcon: React.FC<IconProps> = ({ size = 24, ...rest }) => {
  const g = useGrad();
  return (
    <svg {...base(size)} {...rest}>
      <defs>
        <linearGradient id={g} x1="12" y1="6" x2="12" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#e2e8f0" stopOpacity="0.85" />
          <stop offset="1" stopColor="#64748b" stopOpacity="0.85" />
        </linearGradient>
      </defs>
      <path
        d="M2.7 19.2l4.6-8.1 3.1 4.3 3.2-6.1 3.5 6 2-2.6 2.2 6.5z"
        fill="#64748b"
        fillOpacity="0.22"
        stroke={`url(#${g})`}
        {...stroke}
      />
      {/* topographic bevel lines */}
      <path
        d="M7.3 12.6l2.1 3.3M13.6 10.4l2 4.4"
        stroke="#cbd5e1"
        strokeOpacity="0.5"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M5.2 19.2c1.7-1.1 3.4-1.1 5.1 0 1.7 1.1 3.4 1.1 5.1 0 1.5-1 3-1 4.3 0"
        stroke="#94a3b8"
        strokeOpacity="0.35"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
};

/** Angled geometric prism eraser with a clean baseline sweep. */
export const EraserIcon: React.FC<IconProps> = ({ size = 24, ...rest }) => {
  const g = useGrad();
  return (
    <svg {...base(size)} {...rest}>
      <defs>
        <linearGradient id={g} x1="8" y1="8" x2="18" y2="18" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" />
          <stop offset="1" stopColor="#94a3b8" />
        </linearGradient>
      </defs>
      <path
        d="M9.4 15.9l5.5-5.5a2 2 0 0 1 2.8 0l.9.9a2 2 0 0 1 0 2.8l-4.9 4.9a2.6 2.6 0 0 1-1.8.8H8.3z"
        fill="#ffffff"
        fillOpacity="0.09"
        stroke={`url(#${g})`}
        {...stroke}
      />
      <path d="M12.6 12.7l3.4 3.4" stroke="#e2e8f0" strokeOpacity="0.6" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M3.6 19.6h16.8" stroke="#94a3b8" strokeOpacity="0.75" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="17.2" cy="16.4" r="0.75" fill="#fff" fillOpacity="0.8" />
    </svg>
  );
};

/* ---------------------------------------------------------------------------
   HUD + UTILITY GLYPHS
   ------------------------------------------------------------------------- */

/** Top-down articulated 3-segment ant. */
export const AntGlyph: React.FC<IconProps> = ({ size = 24, ...rest }) => {
  const g = useGrad();
  return (
    <svg {...base(size)} {...rest}>
      <defs>
        <linearGradient id={g} x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff6d8" />
          <stop offset="1" stopColor="#ffb84d" />
        </linearGradient>
      </defs>
      {/* antennae */}
      <path d="M11.2 4.2L9.5 2.2M12.8 4.2l1.7-2" stroke={`url(#${g})`} strokeWidth="1.3" strokeLinecap="round" strokeOpacity="0.85" />
      {/* legs */}
      <path
        d="M10 9.6L6.7 7.8M9.7 11.6H5.9M10.1 13.3L6.9 15.8M14 9.6l3.3-1.8M14.3 11.6h3.8M13.9 13.3l3.2 2.5"
        stroke={`url(#${g})`}
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeOpacity="0.9"
      />
      {/* head */}
      <circle cx="12" cy="5.1" r="1.9" fill="#fff3b0" fillOpacity="0.28" stroke={`url(#${g})`} strokeWidth="1.4" />
      {/* thorax */}
      <ellipse cx="12" cy="10.5" rx="2.1" ry="2.9" fill="#ffae00" fillOpacity="0.2" stroke={`url(#${g})`} strokeWidth="1.45" />
      {/* gaster */}
      <path
        d="M12 13.1c2.1 0 3.1 2 3.1 4.1S13.9 21 12 21s-3.1-1.7-3.1-3.8.9-4.1 3.1-4.1z"
        fill="#ffae00"
        fillOpacity="0.18"
        stroke={`url(#${g})`}
        strokeWidth="1.45"
      />
      <path d="M10.8 15.2h2.4M10.8 17.1h2.4" stroke="#fff3b0" strokeOpacity="0.7" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
};

/** Faceted emerald crystal telemetry glyph. */
export const CrystalGlyph: React.FC<IconProps> = ({ size = 24, ...rest }) => {
  const g = useGrad();
  return (
    <svg {...base(size)} {...rest}>
      <defs>
        <linearGradient id={g} x1="12" y1="3" x2="12" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#eafff2" />
          <stop offset="0.55" stopColor="#00e676" />
          <stop offset="1" stopColor="#00975a" />
        </linearGradient>
      </defs>
      <path d="M12 2.9l4.5 6-1.4 11.2h-6.2L7.5 8.9 12 2.9z" fill="#00e676" fillOpacity="0.22" stroke={`url(#${g})`} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M12 3.4v16.2M7.7 9l4.3 3.2L16.3 9" stroke="#b9f6ca" strokeOpacity="0.9" strokeWidth="1.15" strokeLinejoin="round" />
      <path d="M12 5.6l2.2 1.5" stroke="#fff" strokeOpacity="0.85" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
};

/** Sparkle sweep — clear pheromone trails. */
export const SparkleSweepIcon: React.FC<IconProps> = ({ size = 24, ...rest }) => {
  const g = useGrad();
  return (
    <svg {...base(size)} {...rest}>
      <defs>
        <linearGradient id={g} x1="3" y1="20" x2="21" y2="5" gradientUnits="userSpaceOnUse">
          <stop stopColor="#64748b" />
          <stop offset="1" stopColor="#e0ffff" />
        </linearGradient>
      </defs>
      <path d="M3.4 19.4c4.6-.4 7.6-2.4 9.4-6.4 1.2-2.7 3.4-4.5 7.8-5.1" stroke={`url(#${g})`} strokeWidth="1.75" strokeLinecap="round" />
      <path d="M17.4 4.6l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z" fill="#e0ffff" fillOpacity="0.9" />
      <path d="M8.1 5.6l.5 1.4 1.4.5-1.4.5-.5 1.4-.5-1.4-1.4-.5 1.4-.5.5-1.4z" fill="#9fe8ff" fillOpacity="0.6" />
      <circle cx="4.5" cy="13.4" r="1" fill="#00f0ff" fillOpacity="0.55" />
    </svg>
  );
};

/** Circular reset arrow. */
export const ResetArrowIcon: React.FC<IconProps> = ({ size = 24, ...rest }) => {
  const g = useGrad();
  return (
    <svg {...base(size)} {...rest}>
      <defs>
        <linearGradient id={g} x1="4" y1="19" x2="20" y2="5" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffae00" stopOpacity="0.6" />
          <stop offset="1" stopColor="#fff3b0" />
        </linearGradient>
      </defs>
      <path d="M20 12a8 8 0 1 1-2.7-6" stroke={`url(#${g})`} strokeWidth="1.75" strokeLinecap="round" />
      <path d="M20.4 3.6l-.5 4.6-4.5-.9" stroke="#fff3b0" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="1.3" fill="#ffae00" fillOpacity="0.75" />
    </svg>
  );
};

/** Tuning sliders. */
export const TuningSlidersIcon: React.FC<IconProps> = ({ size = 24, ...rest }) => {
  const g = useGrad();
  return (
    <svg {...base(size)} {...rest}>
      <defs>
        <linearGradient id={g} x1="3" y1="12" x2="21" y2="12" gradientUnits="userSpaceOnUse">
          <stop stopColor="#94a3b8" />
          <stop offset="1" stopColor="#e0ffff" />
        </linearGradient>
      </defs>
      <path d="M3.4 7.2h17.2M3.4 12h17.2M3.4 16.8h17.2" stroke={`url(#${g})`} strokeWidth="1.6" strokeLinecap="round" strokeOpacity="0.8" />
      <circle cx="8.6" cy="7.2" r="2.5" fill="#0b1119" stroke="#e0ffff" strokeWidth="1.5" />
      <circle cx="15.4" cy="12" r="2.5" fill="#0b1119" stroke="#ffcf72" strokeWidth="1.5" />
      <circle cx="10.4" cy="16.8" r="2.5" fill="#0b1119" stroke="#e0ffff" strokeWidth="1.5" />
    </svg>
  );
};

/** Info emblem. */
export const InfoIcon: React.FC<IconProps> = ({ size = 24, ...rest }) => {
  const g = useGrad();
  return (
    <svg {...base(size)} {...rest}>
      <defs>
        <linearGradient id={g} x1="5" y1="20" x2="19" y2="4" gradientUnits="userSpaceOnUse">
          <stop stopColor="#64748b" />
          <stop offset="1" stopColor="#00f0ff" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="8.6" stroke={`url(#${g})`} strokeWidth="1.6" />
      <path d="M12 10.6v6" stroke="#e0ffff" strokeWidth="1.9" strokeLinecap="round" />
      <circle cx="12" cy="7.5" r="1.15" fill="#e0ffff" />
    </svg>
  );
};

export const PlayIcon: React.FC<IconProps> = ({ size = 18, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <path d="M8.4 5.6l9 6.4-9 6.4z" fill="currentColor" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
);

export const PauseIcon: React.FC<IconProps> = ({ size = 18, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <path d="M8.6 5.8v12.4M15.4 5.8v12.4" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
  </svg>
);

/** Concentric dotted brush-radius ring. */
export const DottedRingIcon: React.FC<IconProps> = ({ size = 24, ...rest }) => {
  const g = useGrad();
  return (
    <svg {...base(size)} {...rest}>
      <defs>
        <linearGradient id={g} x1="4" y1="20" x2="20" y2="4" gradientUnits="userSpaceOnUse">
          <stop stopColor="#64748b" />
          <stop offset="1" stopColor="#e0ffff" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="8.4" stroke={`url(#${g})`} strokeWidth="1.6" strokeDasharray="2.2 3.1" strokeLinecap="round" />
      <circle cx="12" cy="12" r="4.5" stroke="#00f0ff" strokeOpacity="0.5" strokeWidth="1.3" strokeDasharray="1.4 2.6" strokeLinecap="round" />
      <circle cx="12" cy="12" r="1.5" fill="#e0ffff" fillOpacity="0.9" />
    </svg>
  );
};

export const ChevronIcon: React.FC<IconProps> = ({ size = 12, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <path d="M5.5 9.2l6.5 6 6.5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const CloseIcon: React.FC<IconProps> = ({ size = 16, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
  </svg>
);

export const BugSmallIcon: React.FC<IconProps> = AntGlyph;

export const LayersIcon: React.FC<IconProps> = ({ size = 14, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <path d="M12 3.6l8.4 4.6-8.4 4.6L3.6 8.2 12 3.6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M4.6 12.5l7.4 4 7.4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeOpacity="0.55" />
  </svg>
);

export const WaveIcon: React.FC<IconProps> = ({ size = 14, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <path d="M3 9.4c2.4 0 3-3.2 5-3.2s2.6 2.6 4.4 2.6 2.8-2.4 5.6-2.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M3 17.4c2.4 0 3-3.2 5-3.2s2.6 2.6 4.4 2.6 2.8-2.4 5.6-2.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.45" />
  </svg>
);

export const CompassIcon: React.FC<IconProps> = ({ size = 14, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <circle cx="12" cy="12" r="8.6" stroke="currentColor" strokeWidth="1.5" />
    <path d="M15.4 8.6l-2 4.8-4.8 2 2-4.8 4.8-2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
);

export const SoundIcon: React.FC<IconProps & { muted?: boolean }> = ({ size = 16, muted, ...rest }) => (
  <svg {...base(size)} {...rest}>
    <path d="M4.4 9.4h3l4-3.2v11.6l-4-3.2h-3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    {muted ? (
      <path d="M15.4 9.4l4 5.2M19.4 9.4l-4 5.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    ) : (
      <path d="M15.2 8.8a4.6 4.6 0 0 1 0 6.4M17.8 6.6a8 8 0 0 1 0 10.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeOpacity="0.75" />
    )}
  </svg>
);

/* ---------------------------------------------------------------------------
   TOOL REGISTRY — index, label, optical accent triad + glyph
   ------------------------------------------------------------------------- */

export interface ToolSpec {
  id: ToolType;
  name: string;
  index: number;
  core: string;
  accent: string;
  halo: string;
  soft: string;
  line: string;
  Icon: React.FC<IconProps>;
  hint: string;
}

export const TOOLS: ToolSpec[] = [
  {
    id: 'food_trail',
    name: 'Food trail',
    index: 1,
    core: '#c9ffe4',
    accent: '#00e676',
    halo: 'rgba(0, 230, 118, 0.22)',
    soft: 'rgba(0, 230, 118, 0.16)',
    line: 'rgba(0, 230, 118, 0.45)',
    Icon: FoodTrailIcon,
    hint: 'Lay an emerald food-scent highway toward nutrients.',
  },
  {
    id: 'home_trail',
    name: 'Home trail',
    index: 2,
    core: '#dbe8ff',
    accent: '#2f7bff',
    halo: 'rgba(47, 123, 255, 0.22)',
    soft: 'rgba(47, 123, 255, 0.16)',
    line: 'rgba(47, 123, 255, 0.45)',
    Icon: HomeTrailIcon,
    hint: 'Paint a sapphire home-scent vector back to the nest.',
  },
  {
    id: 'alarm',
    name: 'Alarm pulse',
    index: 3,
    core: '#ffd1dc',
    accent: '#ff0a43',
    halo: 'rgba(255, 10, 67, 0.20)',
    soft: 'rgba(255, 10, 67, 0.16)',
    line: 'rgba(255, 10, 67, 0.45)',
    Icon: AlarmIcon,
    hint: 'Trigger a crimson alarm wave — foragers scatter.',
  },
  {
    id: 'food_cluster',
    name: 'Food cluster',
    index: 4,
    core: '#b9f6ca',
    accent: '#00e676',
    halo: 'rgba(0, 230, 118, 0.20)',
    soft: 'rgba(0, 230, 118, 0.16)',
    line: 'rgba(0, 230, 118, 0.45)',
    Icon: FoodClusterIcon,
    hint: 'Seed a faceted emerald nutrient crystal.',
  },
  {
    id: 'wall',
    name: 'Wall',
    index: 5,
    core: '#cbd5e1',
    accent: '#64748b',
    halo: 'rgba(100, 116, 139, 0.20)',
    soft: 'rgba(100, 116, 139, 0.18)',
    line: 'rgba(148, 163, 184, 0.45)',
    Icon: WallIcon,
    hint: 'Sculpt basalt barriers and bridge narrows.',
  },
  {
    id: 'eraser',
    name: 'Eraser',
    index: 6,
    core: '#ffffff',
    accent: '#94a3b8',
    halo: 'rgba(148, 163, 184, 0.16)',
    soft: 'rgba(148, 163, 184, 0.14)',
    line: 'rgba(203, 213, 225, 0.4)',
    Icon: EraserIcon,
    hint: 'Dissolve scent, crystal and basalt matter.',
  },
];

export const toolById = (id: ToolType): ToolSpec =>
  TOOLS.find((t) => t.id === id) ?? TOOLS[0];

/* ---------------------------------------------------------------------------
   SCIENTIFIC FIELD-GUIDE DIAGRAMS
   ------------------------------------------------------------------------- */

/** Bilateral antenna sensing + tropotaxis steering. */
export const BilateralAntennaDiagram: React.FC<{ className?: string }> = ({ className }) => {
  const g = useGrad();
  return (
    <svg viewBox="0 0 320 132" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id={`${g}a`} x1="0" y1="0" x2="1" y2="0">
          <stop stopColor="#ffae00" stopOpacity="0.15" />
          <stop offset="1" stopColor="#fff3b0" stopOpacity="0.55" />
        </linearGradient>
        <radialGradient id={`${g}b`} cx="0.5" cy="0.5" r="0.5">
          <stop stopColor="#ffae00" stopOpacity="0.5" />
          <stop offset="1" stopColor="#ffae00" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* pheromone gradient wedge ahead of the ant */}
      <path d="M160 66 L286 16 L286 116 Z" fill={`url(#${g}a)`} />
      {/* antennae */}
      <path d="M160 66 L206 34" stroke="#fff3b0" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="4 3" />
      <path d="M160 66 L206 98" stroke="#fff3b0" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="4 3" />
      {/* sample nodes */}
      <circle cx="206" cy="34" r="9" fill={`url(#${g}b)`} />
      <circle cx="206" cy="98" r="9" fill={`url(#${g}b)`} />
      <circle cx="206" cy="34" r="3.4" stroke="#ffd98a" strokeWidth="1.4" />
      <circle cx="206" cy="98" r="3.4" stroke="#ffd98a" strokeWidth="1.4" />
      {/* ant body schematic */}
      <ellipse cx="160" cy="66" rx="9" ry="12" stroke="#e2e8f0" strokeWidth="1.6" />
      <circle cx="160" cy="46" r="6" stroke="#e2e8f0" strokeWidth="1.6" />
      <ellipse cx="160" cy="86" rx="7.5" ry="10" stroke="#e2e8f0" strokeWidth="1.6" />
      <path d="M151 62 L136 54 M151 68 L134 70 M151 74 L136 82 M169 62 L184 54 M169 68 L186 70 M169 74 L184 82" stroke="#94a3b8" strokeWidth="1.2" strokeLinecap="round" />
      {/* heading vector */}
      <path d="M160 66 L262 66" stroke="#00f0ff" strokeWidth="1.4" strokeDasharray="5 4" strokeLinecap="round" strokeOpacity="0.85" />
      <path d="M262 66l-7-4v8l7-4z" fill="#00f0ff" fillOpacity="0.85" />
      {/* angle annotation */}
      <path d="M198 66a38 38 0 0 0-11-22" stroke="#64748b" strokeWidth="1.2" strokeDasharray="3 3" />
      <text x="176" y="46" fill="#9fb0c6" fontSize="9" fontFamily="system-ui, sans-serif">±35°</text>
      <text x="214" y="26" fill="#ffd98a" fontSize="9" fontFamily="system-ui, sans-serif">L sample</text>
      <text x="214" y="112" fill="#ffd98a" fontSize="9" fontFamily="system-ui, sans-serif">R sample</text>
      <text x="238" y="60" fill="#8ff4ff" fontSize="9" fontFamily="system-ui, sans-serif">Δ steer</text>
      <text x="24" y="120" fill="#7c8ba1" fontSize="9" fontFamily="system-ui, sans-serif">tropotaxis · Weber–Fechner</text>
    </svg>
  );
};

/** Pheromone colour-gradient legend with intensity ramp. */
export const PheromoneLegendDiagram: React.FC<{ className?: string }> = ({ className }) => {
  const g = useGrad();
  return (
    <svg viewBox="0 0 320 96" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id={`${g}1`} x1="0" y1="0" x2="1" y2="0">
          <stop stopColor="#3a2500" />
          <stop offset="0.5" stopColor="#ffae00" />
          <stop offset="1" stopColor="#fff3b0" />
        </linearGradient>
        <linearGradient id={`${g}2`} x1="0" y1="0" x2="1" y2="0">
          <stop stopColor="#00323a" />
          <stop offset="0.5" stopColor="#00f0ff" />
          <stop offset="1" stopColor="#e0ffff" />
        </linearGradient>
        <linearGradient id={`${g}3`} x1="0" y1="0" x2="1" y2="0">
          <stop stopColor="#3a0210" />
          <stop offset="0.5" stopColor="#ff0a43" />
          <stop offset="1" stopColor="#ffd1dc" />
        </linearGradient>
      </defs>
      <text x="10" y="18" fill="#9fb0c6" fontSize="9" fontFamily="system-ui, sans-serif">LOW CONCENTRATION</text>
      <text x="238" y="18" fill="#cdd8e6" fontSize="9" fontFamily="system-ui, sans-serif">SATURATED</text>
      {[
        { y: 30, grad: `${g}1`, label: 'Food' },
        { y: 52, grad: `${g}2`, label: 'Home' },
        { y: 74, grad: `${g}3`, label: 'Alarm' },
      ].map((row) => (
        <g key={row.label}>
          <rect x="52" y={row.y - 6} width="216" height="9" rx="4.5" fill={`url(#${row.grad})`} />
          <text x="10" y={row.y + 2} fill="#8b9ab0" fontSize="9" fontFamily="system-ui, sans-serif">{row.label}</text>
        </g>
      ))}
      <path d="M52 86h216" stroke="#334155" strokeWidth="1" strokeDasharray="2 4" />
      <path d="M52 82v8M124 82v8M196 82v8M268 82v8" stroke="#334155" strokeWidth="1" />
    </svg>
  );
};

/** Deneubourg double-bridge geometry. */
export const DoubleBridgeDiagram: React.FC<{ className?: string }> = ({ className }) => {
  const g = useGrad();
  return (
    <svg viewBox="0 0 320 132" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id={`${g}s`} x1="0" y1="0" x2="1" y2="0">
          <stop stopColor="#fff3b0" stopOpacity="0.5" />
          <stop offset="1" stopColor="#ffae00" />
        </linearGradient>
        <radialGradient id={`${g}f`} cx="0.5" cy="0.5" r="0.5">
          <stop stopColor="#b9f6ca" />
          <stop offset="1" stopColor="#00e676" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* nest + food nodes */}
      <circle cx="40" cy="66" r="26" fill="#00f0ff" fillOpacity="0.05" />
      <circle cx="40" cy="66" r="13" stroke="#00e5ff" strokeWidth="1.6" />
      <circle cx="40" cy="66" r="5" stroke="#e0ffff" strokeWidth="1.4" />
      <text x="22" y="108" fill="#8ff4ff" fontSize="9" fontFamily="system-ui, sans-serif">NEST</text>
      <circle cx="282" cy="66" r="16" fill={`url(#${g}f)`} />
      <path d="M282 50l7 10-3 14h-8l-3-14 7-10z" stroke="#00e676" strokeWidth="1.5" strokeLinejoin="round" />
      <text x="262" y="108" fill="#9ef7c3" fontSize="9" fontFamily="system-ui, sans-serif">FOOD</text>
      {/* short branch */}
      <path d="M53 60 L110 40 L160 44 L216 40 L266 60" stroke={`url(#${g}s)`} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      {/* long branch */}
      <path d="M53 74 L100 96 L160 106 L222 96 L269 74" stroke="#ffae00" strokeOpacity="0.4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="6 5" />
      {/* barrier blocks */}
      <rect x="112" y="46" width="42" height="18" rx="4" fill="#334155" fillOpacity="0.55" stroke="#64748b" strokeWidth="1" />
      <rect x="164" y="46" width="46" height="18" rx="4" fill="#334155" fillOpacity="0.4" stroke="#64748b" strokeWidth="1" />
      <text x="116" y="38" fill="#94a3b8" fontSize="9" fontFamily="system-ui, sans-serif">basalt</text>
      {/* branch labels */}
      <text x="120" y="30" fill="#ffd98a" fontSize="9.5" fontFamily="system-ui, sans-serif">short branch · 1× length</text>
      <text x="120" y="122" fill="#b08a4a" fontSize="9.5" fontFamily="system-ui, sans-serif">long branch · 2× length</text>
      {/* emergent traffic arrows */}
      <path d="M196 40l14-7M196 40l14 1" stroke="#fff3b0" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M96 96l-12-4" stroke="#ffae00" strokeOpacity="0.5" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
};
