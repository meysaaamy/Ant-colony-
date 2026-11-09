/**
 * Pure mathematical, physical, and neuroethological functions
 * Decoupled from DOM/Canvas for deterministic behavior and unit testing.
 */

/**
 * Weber-Fechner Law: Translates raw chemical concentration C into perceived neural stimulus S.
 * S = ln(1.0 + C)
 */
export function weberFechner(concentration: number): number {
  if (concentration <= 0) return 0;
  return Math.log(1.0 + concentration);
}

/**
 * Exact frame-rate-independent exponential evaporation:
 * C_next = C * exp(-dt * lambda)
 */
export function exponentialEvaporation(
  concentration: number,
  dt: number,
  lambda: number
): number {
  if (concentration <= 0.0001) return 0;
  return concentration * Math.exp(-dt * lambda);
}

/**
 * Saturating, age-attenuated deposition model:
 * deposit = (baseStrength * exp(-decayRate * timeSinceLastVisit)) / (1.0 + 0.08 * localConcentration)
 * Prevents runaway positive feedback and dead-trail locking.
 */
export function saturatingDeposition(
  baseStrength: number,
  timeSinceLastVisit: number,
  decayRate: number,
  localConcentration: number
): number {
  const ageFactor = Math.exp(-decayRate * Math.max(0, timeSinceLastVisit));
  const saturationFactor = 1.0 / (1.0 + 0.08 * Math.max(0, localConcentration));
  return Math.max(0, baseStrength * ageFactor * saturationFactor);
}

/**
 * Bilateral Antenna Positions:
 * Computes left, center, and right antenna sensor tips ahead of the agent.
 */
export function computeAntennaPositions(
  x: number,
  y: number,
  heading: number,
  distance: number,
  angle: number
): {
  lx: number;
  ly: number;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
} {
  const cosH = Math.cos(heading);
  const sinH = Math.sin(heading);

  // Center sensor directly forward
  const cx = x + cosH * distance;
  const cy = y + sinH * distance;

  // Left sensor (-angle)
  const leftAngle = heading - angle;
  const lx = x + Math.cos(leftAngle) * distance;
  const ly = y + Math.sin(leftAngle) * distance;

  // Right sensor (+angle)
  const rightAngle = heading + angle;
  const rx = x + Math.cos(rightAngle) * distance;
  const ry = y + Math.sin(rightAngle) * distance;

  return { lx, ly, cx, cy, rx, ry };
}

/**
 * Tropotaxis & Stochastic Steering with Autocatalytic Shortest-Path Amplification:
 * S_left, S_center, S_right are Weber-Fechner stimulus values.
 * Computes angular steering delta based on bilateral contrast and center commitment.
 * Uses super-linear power scaling (S^1.35) so high-traffic optimal paths dominate.
 */
export function computeTropotaxisSteering(
  sLeft: number,
  sCenter: number,
  sRight: number,
  wanderNoise: number,
  sensitivity: number
): number {
  const sum = sLeft + sCenter + sRight;
  if (sum < 0.015) {
    // Pure exploratory wander when no trail is present
    return wanderNoise;
  }

  // Non-linear power scaling enhances contrast between competing branches (Deneubourg effect)
  const pLeft = Math.pow(Math.max(0, sLeft), 1.35);
  const pCenter = Math.pow(Math.max(0, sCenter), 1.35);
  const pRight = Math.pow(Math.max(0, sRight), 1.35);
  const pSum = pLeft + pCenter + pRight + 0.001;

  // Bilateral differential steering
  const bilateralDiff = (pRight - pLeft) / pSum;

  // When center stimulus is high, the ant accelerates and commits forward
  const forwardCommitment = Math.min(1.8, 0.7 + pCenter * 0.5);

  const chemicalTorque = bilateralDiff * sensitivity * forwardCommitment;

  // Stronger signal suppresses wander (klinokinesis reduction: ants lock onto strong trails)
  const wanderDamping = 1.0 / (1.0 + sum * 0.85);

  return chemicalTorque + wanderNoise * wanderDamping;
}

/**
 * Bresenham-like Line of sight check on wall grid.
 * Returns false if a solid obstacle wall intersects the line from (x0, y0) to (x1, y1).
 */
export function lineOfSight(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  isWall: (gx: number, gy: number) => boolean,
  cellSize: number
): boolean {
  let gx0 = Math.floor(x0 / cellSize);
  let gy0 = Math.floor(y0 / cellSize);
  const gx1 = Math.floor(x1 / cellSize);
  const gy1 = Math.floor(y1 / cellSize);

  const dx = Math.abs(gx1 - gx0);
  const dy = Math.abs(gy1 - gy0);
  const sx = gx0 < gx1 ? 1 : -1;
  const sy = gy0 < gy1 ? 1 : -1;
  let err = dx - dy;

  // Quick check if end point is inside wall
  if (isWall(gx1, gy1)) return false;

  while (gx0 !== gx1 || gy0 !== gy1) {
    if (isWall(gx0, gy0)) {
      return false;
    }
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      gx0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      gy0 += sy;
    }
  }

  return !isWall(gx1, gy1);
}

/**
 * Dense linear stroke interpolation:
 * Spaced at 0.25 * brushRadius so finger swipes produce continuous unbroken highways.
 */
export function interpolateStroke(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  stepSpacing: number
): Array<{ x: number; y: number }> {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const effectiveStep = Math.max(2, stepSpacing);

  if (dist < effectiveStep) {
    return [{ x: x1, y: y1 }];
  }

  const steps = Math.ceil(dist / effectiveStep);
  const points: Array<{ x: number; y: number }> = [];

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    points.push({
      x: x0 + dx * t,
      y: y0 + dy * t,
    });
  }

  return points;
}

/**
 * Circle-to-wall obstacle collision resolution with smooth tangent sliding.
 */
export function resolveWallCollision(
  x: number,
  y: number,
  radius: number,
  isWall: (gx: number, gy: number) => boolean,
  cellSize: number
): { x: number; y: number; collided: boolean; normalX: number; normalY: number } {
  const minGx = Math.floor((x - radius) / cellSize);
  const maxGx = Math.floor((x + radius) / cellSize);
  const minGy = Math.floor((y - radius) / cellSize);
  const maxGy = Math.floor((y + radius) / cellSize);

  let collided = false;
  let normalX = 0;
  let normalY = 0;
  let resolvedX = x;
  let resolvedY = y;

  for (let gy = minGy; gy <= maxGy; gy++) {
    for (let gx = minGx; gx <= maxGx; gx++) {
      if (!isWall(gx, gy)) continue;

      // Nearest point on grid cell AABB
      const cellLeft = gx * cellSize;
      const cellRight = cellLeft + cellSize;
      const cellTop = gy * cellSize;
      const cellBottom = cellTop + cellSize;

      const nearestX = Math.max(cellLeft, Math.min(resolvedX, cellRight));
      const nearestY = Math.max(cellTop, Math.min(resolvedY, cellBottom));

      const dx = resolvedX - nearestX;
      const dy = resolvedY - nearestY;
      const distSq = dx * dx + dy * dy;

      if (distSq < radius * radius && distSq > 0.0001) {
        collided = true;
        const dist = Math.sqrt(distSq);
        const nx = dx / dist;
        const ny = dy / dist;
        const penetration = radius - dist;

        resolvedX += nx * penetration;
        resolvedY += ny * penetration;
        normalX += nx;
        normalY += ny;
      } else if (distSq <= 0.0001) {
        // Center is deeply inside wall; push towards center of world or outward
        collided = true;
        normalX += 1;
        resolvedX += radius;
      }
    }
  }

  if (collided) {
    const normLen = Math.hypot(normalX, normalY);
    if (normLen > 0.001) {
      normalX /= normLen;
      normalY /= normLen;
    }
  }

  return { x: resolvedX, y: resolvedY, collided, normalX, normalY };
}

/**
 * 1D Spatial Hash Grid mapping:
 * Maps world coordinates (x, y) to a cell index.
 */
export function hashCoord(x: number, y: number, cellSize: number, gridWidth: number, gridHeight: number): number {
  const gx = Math.max(0, Math.min(gridWidth - 1, Math.floor(x / cellSize)));
  const gy = Math.max(0, Math.min(gridHeight - 1, Math.floor(y / cellSize)));
  return gy * gridWidth + gx;
}

/**
 * Pheromone alpha computation:
 * - 'glow': translucent linear bioluminescence
 * - 'fog': non-linear steep saturation making high-intensity trails fully opaque
 */
export function computePheromoneAlpha(
  maxVal: number,
  mode: 'glow' | 'fog'
): number {
  if (maxVal <= 0) return 0;
  if (mode === 'fog') {
    const norm = Math.min(1.0, maxVal / 255);
    return Math.min(255, Math.floor(255 * Math.pow(norm, 0.45) * 1.4));
  }
  return Math.min(255, Math.floor(maxVal * 1.8));
}

/**
 * Proactive Whisker Obstacle Avoidance:
 * Samples 3 forward whiskers (left, center, right) ahead of the agent.
 * Returns an angular avoidance torque to steer smoothly around walls and corners before impact.
 */
export function computeWhiskerAvoidance(
  x: number,
  y: number,
  heading: number,
  feelerDist: number,
  feelerAngle: number,
  isWall: (gx: number, gy: number) => boolean,
  cellSize: number
): number {
  // Center feeler
  const cx = x + Math.cos(heading) * feelerDist;
  const cy = y + Math.sin(heading) * feelerDist;
  const cHit = isWall(Math.floor(cx / cellSize), Math.floor(cy / cellSize));

  // Left feeler (-feelerAngle)
  const lAngle = heading - feelerAngle;
  const lx = x + Math.cos(lAngle) * feelerDist;
  const ly = y + Math.sin(lAngle) * feelerDist;
  const lHit = isWall(Math.floor(lx / cellSize), Math.floor(ly / cellSize));

  // Right feeler (+feelerAngle)
  const rAngle = heading + feelerAngle;
  const rx = x + Math.cos(rAngle) * feelerDist;
  const ry = y + Math.sin(rAngle) * feelerDist;
  const rHit = isWall(Math.floor(rx / cellSize), Math.floor(ry / cellSize));

  if (cHit && lHit && rHit) {
    // Trapped in corner or head-on dead end: strong turn
    return Math.PI * 0.75;
  }
  if (cHit) {
    // Obstacle straight ahead: turn towards the open side
    return lHit ? 0.75 : rHit ? -0.75 : 0.65;
  }
  if (lHit) {
    // Wall on the left: steer right
    return 0.45;
  }
  if (rHit) {
    // Wall on the right: steer left
    return -0.45;
  }

  return 0;
}
