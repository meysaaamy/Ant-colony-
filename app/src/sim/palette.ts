/**
 * Scent → colour, point by point.
 *
 * Home scent runs **deep cobalt → electric cyan** as its concentration rises.
 * Food scent stays an **emerald filament** whose warmth blooms into a golden
 * aura as the trail thickens (see `scentAura`). Where both pass over the same
 * cell the local ratio mixes them into a third colour — aquamarine → turquoise,
 * and a prismatic white-gold at peak overlap — while brightness is driven
 * purely by traffic.
 *
 * Pure and allocation-free so the renderer can call it tens of thousands of
 * times per frame.
 */

export const FOOD_RGB = [0, 230, 118] as const; // #00e676
export const HOME_LOW_RGB = [28, 58, 208] as const; // deep cobalt
export const HOME_HIGH_RGB = [34, 226, 255] as const; // electric cyan
export const ALARM_RGB = [255, 26, 74] as const;
export const AURA_FOOD_RGB = [255, 176, 74] as const; // warm golden-amber
export const AURA_HOME_RGB = [56, 132, 255] as const;

/** Traffic at which a cell reaches full incandescence. */
const SATURATION = 62;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export interface ScentRGBA {
  r: number;
  g: number;
  b: number;
  /** 0–255 opacity of the scent itself. */
  a: number;
}

/** The luminous core: emerald filaments and cobalt→cyan home traces that mix. */
export function blendScent(food: number, home: number, alarm: number, fog = false): ScentRGBA {
  const sum = food + home + alarm;
  if (sum < 0.25) return { r: 0, g: 0, b: 0, a: 0 };

  const inv = 1 / sum;
  const wFood = food * inv;
  const wHome = home * inv;
  const wAlarm = alarm * inv;

  // Home runs cobalt → electric cyan with concentration.
  const hN = clamp01(home / 55);
  const homeR = lerp(HOME_LOW_RGB[0], HOME_HIGH_RGB[0], hN);
  const homeG = lerp(HOME_LOW_RGB[1], HOME_HIGH_RGB[1], hN);
  const homeB = lerp(HOME_LOW_RGB[2], HOME_HIGH_RGB[2], hN);

  let r = wFood * FOOD_RGB[0] + wHome * homeR + wAlarm * ALARM_RGB[0];
  let g = wFood * FOOD_RGB[1] + wHome * homeG + wAlarm * ALARM_RGB[1];
  let b = wFood * FOOD_RGB[2] + wHome * homeB + wAlarm * ALARM_RGB[2];

  // Balanced overlap becomes a deliberate third colour rather than mud.
  const balance = Math.min(wFood, wHome) * 2; // 0 → 1 at 50/50
  const overlap = balance * clamp01(sum / 55);

  if (overlap > 0.02) {
    // aquamarine / turquoise family
    r = lerp(r, 92, overlap * 0.55);
    g = lerp(g, 242, overlap * 0.5);
    b = lerp(b, 236, overlap * 0.5);

    // …and a prismatic white-gold core where the overlap is also heavy.
    const prism = clamp01((overlap - 0.72) * 2.4);
    if (prism > 0) {
      r = lerp(r, 255, prism * 0.85);
      g = lerp(g, 248, prism * 0.7);
      b = lerp(b, 206, prism * 0.5);
    }
  }

  // Hue-preserving brightness: scale toward the peak channel so no two
  // channels clip to 255 and flatten the hue, then let the busiest corridors
  // pick up an incandescent white core.
  const peak = Math.max(r, g, b) || 1;
  const nR = r / peak;
  const nG = g / peak;
  const nB = b / peak;

  const t = clamp01(sum / SATURATION);
  const level = 0.26 + 0.74 * Math.sqrt(t);
  const core = Math.max(0, t - 0.86) * 1.35;
  const mixWhite = (c: number) => (c * (1 - core) + core) * level * 255;

  return {
    r: mixWhite(nR),
    g: mixWhite(nG),
    b: mixWhite(nB),
    a: Math.min(255, Math.floor(sum * (fog ? 4.2 : 3.1))),
  };
}

/**
 * The atmospheric halo drawn *under* the core: food glow reads warm amber-gold,
 * home glow reads electric blue. Kept as a separate pass so the emerald
 * filament keeps its hue while the air around it warms up.
 */
export function scentAura(food: number, home: number): ScentRGBA {
  const sum = food + home;
  if (sum < 1) return { r: 0, g: 0, b: 0, a: 0 };

  const inv = 1 / sum;
  const wFood = food * inv;
  const wHome = home * inv;

  const r = wFood * AURA_FOOD_RGB[0] + wHome * AURA_HOME_RGB[0];
  const g = wFood * AURA_FOOD_RGB[1] + wHome * AURA_HOME_RGB[1];
  const b = wFood * AURA_FOOD_RGB[2] + wHome * AURA_HOME_RGB[2];

  // Aura strength is traffic too, but softer and wider than the core.
  const t = clamp01(sum / 90);
  return {
    r,
    g,
    b,
    a: Math.min(160, Math.floor(28 + 132 * Math.sqrt(t))),
  };
}
