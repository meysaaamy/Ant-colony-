/**
 * Scent → colour, point by point.
 *
 * Food scent is emerald, home scent is electric blue. Where both pass through
 * the same cell the two weights mix into a genuinely new hue (turquoise when
 * balanced), and the overall brightness is driven by traffic — quiet cells stay
 * dim, busy corridors bloom into an incandescent core.
 *
 * Pure and allocation-free so the renderer can call it 40 000×/frame.
 */

export const FOOD_RGB = [18, 232, 128] as const;
export const HOME_RGB = [32, 118, 255] as const;
export const ALARM_RGB = [255, 26, 74] as const;

/** Traffic at which a cell reaches full incandescence. */
const SATURATION = 68;

export interface ScentRGBA {
  r: number;
  g: number;
  b: number;
  /** 0-255 premultiplied-ish opacity for the scent sprite. */
  a: number;
}

/**
 * Blend one cell.
 * @param food  food-scent concentration (0…100)
 * @param home  home-scent concentration (0…100)
 * @param alarm alarm concentration (0…100)
 * @param fog   fog mode trades glow for denser coverage
 */
export function blendScent(food: number, home: number, alarm: number, fog = false): ScentRGBA {
  const sum = food + home + alarm;
  if (sum < 0.25) return { r: 0, g: 0, b: 0, a: 0 };

  const inv = 1 / sum;
  const wFood = food * inv;
  const wHome = home * inv;
  const wAlarm = alarm * inv;

  let r = wFood * FOOD_RGB[0] + wHome * HOME_RGB[0] + wAlarm * ALARM_RGB[0];
  let g = wFood * FOOD_RGB[1] + wHome * HOME_RGB[1] + wAlarm * ALARM_RGB[1];
  let b = wFood * FOOD_RGB[2] + wHome * HOME_RGB[2] + wAlarm * ALARM_RGB[2];

  // A balanced corridor becomes a deliberate third colour (aqua) rather than
  // mud, and shifts toward turquoise as the ratio drifts.
  const mix = Math.min(wFood, wHome) * 2; // 0 → 1 as the ratio approaches 50/50
  if (mix > 0.05) {
    const pull = 0.55 * mix;
    r = r * (1 - pull) + 40 * mix;
    g = g * (1 - pull) + 220 * mix;
    b = b * (1 - pull) + 240 * mix;
  }

  // Brightness is traffic. Normalise the hue first so scaling never clips two
  // channels to 255 (which would flatten every strong colour to white); then
  // let only the very busiest corridors pick up an incandescent white core.
  const peak = Math.max(r, g, b) || 1;
  const nR = r / peak;
  const nG = g / peak;
  const nB = b / peak;

  const t = Math.min(1, sum / SATURATION);
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
