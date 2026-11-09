/**
 * Simulation-level tests: scent colour blending and ant navigation.
 *
 * These run the real engine (not a mock) for a few simulated minutes and assert
 * the behaviours the brief asks for:
 *   • food scent reads green, home scent reads blue, an overlap reads as a new
 *     colour, and brightness rises with traffic
 *   • ants never end up inside a wall, never stay pinned, and do deliver food
 *     (i.e. the pheromone loop actually closes)
 */
import { build } from 'esbuild';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const watchdog = setTimeout(() => {
  console.error('✗ sim test watchdog fired after 90s — exiting');
  process.exit(2);
}, 90_000);
watchdog.unref?.();

/* ── bundle the TypeScript simulation for Node ─────────────────────────── */
const dir = await mkdtemp(join(tmpdir(), 'simtest-'));
const entry = join(dir, 'entry.ts');
await writeFile(
  entry,
  `export { SimulationEngine } from ${JSON.stringify(new URL('../src/sim/engine.ts', import.meta.url).pathname)};
   export { blendScent, scentAura, FOOD_RGB } from ${JSON.stringify(new URL('../src/sim/palette.ts', import.meta.url).pathname)};
   export { AntState } from ${JSON.stringify(new URL('../src/sim/types.ts', import.meta.url).pathname)};`
);
const outfile = join(dir, 'bundle.mjs');
await build({
  entryPoints: [entry],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  outfile,
  logLevel: 'silent',
});
const { SimulationEngine, blendScent, scentAura, AntState } = await import(outfile);

const checks = [];
const check = (name, fn) => {
  try {
    fn();
    checks.push(`✓ ${name}`);
  } catch (e) {
    checks.push(`✗ ${name} — ${e.message}`);
    errors.push(name);
  }
};
const errors = [];

/* ── 1. colour blending ────────────────────────────────────────────────── */
const foodOnly = blendScent(60, 0, 0);
const homeOnly = blendScent(0, 60, 0);
const mixed = blendScent(30, 30, 0);
const quiet = blendScent(6, 0, 0);
const busy = blendScent(60, 0, 0);

check('food scent reads green (G dominant)', () => {
  assert.ok(foodOnly.g > foodOnly.r * 2 && foodOnly.g > foodOnly.b * 1.4, JSON.stringify(foodOnly));
});
check('home scent reads blue (B dominant)', () => {
  assert.ok(homeOnly.b > homeOnly.r * 2 && homeOnly.b > homeOnly.g, JSON.stringify(homeOnly));
});
check('an overlap produces a new aqua colour, not either input', () => {
  // aqua: green and blue both strong, red pulled down below both
  assert.ok(mixed.g > 150 && mixed.b > 150, JSON.stringify(mixed));
  assert.ok(mixed.r < mixed.g && mixed.r < mixed.b, JSON.stringify(mixed));
  assert.ok(mixed.g !== mixed.b, 'mixture must be its own hue');
});
check('brightness scales with traffic', () => {
  const lum = (c) => c.r + c.g + c.b;
  assert.ok(lum(busy) > lum(quiet) * 1.6, `${lum(busy)} vs ${lum(quiet)}`);
  assert.ok(busy.a >= quiet.a);
});
check('home scent runs cobalt → electric cyan with concentration', () => {
  const faint = blendScent(0, 12, 0);
  const strong = blendScent(0, 90, 0);
  const cyanicity = (c) => c.g / Math.max(1, c.b);
  assert.ok(cyanicity(strong) > cyanicity(faint) * 1.25, `${cyanicity(strong)} vs ${cyanicity(faint)}`);
  assert.ok(strong.b > 150 && strong.g > 150, JSON.stringify(strong));
});
check('food carries a warm golden aura, home a cool one', () => {
  const foodAura = scentAura(60, 0);
  const homeAura = scentAura(0, 60);
  assert.ok(foodAura.r > foodAura.g && foodAura.g > foodAura.b, JSON.stringify(foodAura));
  assert.ok(homeAura.b > homeAura.r, JSON.stringify(homeAura));
  assert.ok(foodAura.a > 100 && homeAura.a > 100);
  assert.equal(scentAura(0, 0).a, 0);
});
check('peak overlap turns prismatic (near-white gold)', () => {
  const peak = blendScent(60, 60, 0);
  const lum = (c) => (c.r + c.g + c.b) / 3;
  assert.ok(lum(peak) > 200, `peak average ${lum(peak)}`);
  assert.ok(peak.r > 150 && peak.g > 200, JSON.stringify(peak));
});
check('empty terrain is fully transparent', () => {
  const empty = blendScent(0, 0, 0);
  assert.equal(empty.a, 0);
  assert.deepEqual([empty.r, empty.g, empty.b], [0, 0, 0]);
});

/* ── 2. ant navigation over a walled world ─────────────────────────────── */
/* Deterministic run: the engine draws from Math.random, so seed it. */
const mulberry32 = (a) => () => {
  a |= 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
Math.random = mulberry32(20261109);
const engine = new SimulationEngine({
  worldWidth: 600,
  worldHeight: 900,
  maxPopulation: 220,
  brushRadius: 26,
});
engine.loadPreset('labyrinth');

const cs = engine.config.cellSize;
const insideWall = (x, y) => {
  const gx = Math.floor(x / cs);
  const gy = Math.floor(y / cs);
  if (gx < 0 || gx >= engine.gridWidth || gy < 0 || gy >= engine.gridHeight) return true;
  return engine.wallGrid[gy * engine.gridWidth + gx] === 1;
};

const startPositions = Array.from({ length: engine.activeCount }, (_, i) => [engine.x[i], engine.y[i]]);
const startFood = engine.nest.storedFood;

/* Two simulated minutes at 60 Hz. */
for (let step = 0; step < 7200; step++) engine.step(1 / 60);

let inWall = 0;
let moved = 0;
for (let i = 0; i < engine.activeCount; i++) {
  if (insideWall(engine.x[i], engine.y[i])) inWall++;
  if (i < startPositions.length) {
    const d = Math.hypot(engine.x[i] - startPositions[i][0], engine.y[i] - startPositions[i][1]);
    if (d > 20) moved++;
  }
}

check('no ant is ever inside a wall', () => assert.equal(inWall, 0, `${inWall} ants inside walls`));
check('ants keep moving (no permanent sticking)', () => {
  const ratio = moved / Math.max(1, Math.min(startPositions.length, engine.activeCount));
  assert.ok(ratio > 0.8, `only ${(ratio * 100).toFixed(0)}% moved`);
});
check('the colony actually delivers food', () => {
  assert.ok(engine.nest.storedFood > startFood, `storedFood stayed at ${startFood}`);
});
check('ants stay inside the world bounds', () => {
  for (let i = 0; i < engine.activeCount; i++) {
    assert.ok(engine.x[i] >= 0 && engine.x[i] <= engine.config.worldWidth, 'x out of bounds');
    assert.ok(engine.y[i] >= 0 && engine.y[i] <= engine.config.worldHeight, 'y out of bounds');
  }
});
check('food scent forms a legible trail (not a flat field)', () => {
  let peak = 0;
  let cells = 0;
  for (let i = 0; i < engine.totalCells; i++) {
    const v = engine.foodTrail[i];
    if (v > peak) peak = v;
    if (v > 5) cells++;
  }
  assert.ok(peak > 15, `peak scent only ${peak.toFixed(1)}`);
  assert.ok(cells > 40, `only ${cells} cells carry scent (peak ${peak.toFixed(1)})`);
  assert.ok(cells < engine.totalCells * 0.9, 'scent covers almost the whole field (no structure)');
});
check('home scent and food scent coexist and differ', () => {
  let homeCells = 0;
  let foodCells = 0;
  for (let i = 0; i < engine.totalCells; i++) {
    if (engine.homeGuide[i] > 4) homeCells++;
    if (engine.foodTrail[i] > 4) foodCells++;
  }
  assert.ok(homeCells > 30, `home scent vanished (${homeCells})`);
  assert.ok(foodCells > 30, `food scent vanished (${foodCells})`);
});
check('most ants are foraging or returning (no permanent alarm lock)', () => {
  let valid = 0;
  for (let i = 0; i < engine.activeCount; i++) {
    const s = engine.state[i];
    if (s === AntState.FORAGING || s === AntState.RETURNING) valid++;
  }
  assert.ok(valid / engine.activeCount > 0.9, `${valid}/${engine.activeCount} in a working state`);
});

/* ── 2b. scent fades where nothing walks ───────────────────────────────── */
{
  const fadeEng = new SimulationEngine({ worldWidth: 600, worldHeight: 900, maxPopulation: 1 });
  // Paint a patch far from every ant, then never reinforce it.
  const px0 = fadeEng.config.worldWidth - 40;
  const py0 = fadeEng.config.worldHeight - 40;
  fadeEng.depositPheromone(fadeEng.foodTrail, px0, py0, 26, 95);
  const cs2 = fadeEng.config.cellSize;
  const cell = (x, y) => Math.floor(y / cs2) * fadeEng.gridWidth + Math.floor(x / cs2);
  const cIdx = cell(px0, py0);
  const painted = fadeEng.foodTrail[cIdx];

  for (let step = 0; step < 600; step++) fadeEng.step(1 / 60); // 10 s
  const afterPaint = fadeEng.foodTrail[cIdx];

  check('unwalked scent fades away on its own', () => {
    assert.ok(painted > 20, `paint did not land (${painted.toFixed(1)})`);
    assert.ok(afterPaint < painted * 0.35, `still ${afterPaint.toFixed(1)} of ${painted.toFixed(1)}`);
  });

  // A corridor the ants actually use must survive longer than the untouched patch.
  let walked = 0;
  let walkedCount = 0;
  let idle = 0;
  let idleCount = 0;
  for (let i = 0; i < fadeEng.totalCells; i++) {
    if (fadeEng.wallGrid[i] === 1) continue;
    if (fadeEng.traffic[i] > 1.2) {
      walked += fadeEng.foodTrail[i] + fadeEng.homeGuide[i];
      walkedCount++;
    } else if (fadeEng.traffic[i] === 0) {
      idle += fadeEng.foodTrail[i] + fadeEng.homeGuide[i];
      idleCount++;
    }
  }
  check('traffic keeps a corridor alive; idle ground stays clean', () => {
    const walkedAvg = walkedCount ? walked / walkedCount : 0;
    const idleAvg = idleCount ? idle / idleCount : 0;
    assert.ok(walkedAvg > idleAvg * 2, `walked=${walkedAvg.toFixed(2)} idle=${idleAvg.toFixed(2)}`);
  });
}

/* ── 2b. famine: an empty larder erases the old memory ─────────────────── */

// Two identical colonies, one still fed and one whose vaults have just been
// emptied. Both are painted with the same stale trail, then left to run.
const faminePair = () => {
  const fed = new SimulationEngine({ worldWidth: 700, worldHeight: 900, maxPopulation: 240 });
  fed.loadPreset('double_bridge');
  const starving = new SimulationEngine({ worldWidth: 700, worldHeight: 900, maxPopulation: 240 });
  starving.loadPreset('double_bridge');
  for (const cluster of starving.foodClusters) cluster.currentAmount = 0;
  for (const E of [fed, starving]) {
    for (let x = 200; x < 600; x += 6) E.depositPheromone(E.foodTrail, x, 450, 8, 70);
  }
  return { fed, starving };
};
const trailMass = (E) => {
  let total = 0;
  for (let i = 0; i < E.totalCells; i++) total += E.foodTrail[i];
  return total;
};
const spreadOf = (E) => {
  const n = E.activeCount;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < n; i++) {
    cx += E.x[i];
    cy += E.y[i];
  }
  cx /= n;
  cy /= n;
  let variance = 0;
  for (let i = 0; i < n; i++) variance += (E.x[i] - cx) ** 2 + (E.y[i] - cy) ** 2;
  return Math.sqrt(variance / n);
};

{
  const { fed, starving } = faminePair();
  const fedBase = trailMass(fed);
  const starvingBase = trailMass(starving);
  const fedSpread = spreadOf(fed);
  const starvingSpread = spreadOf(starving);

  for (let step = 0; step < 240; step++) {
    fed.step(1 / 60);
    starving.step(1 / 60);
  }

  check('an empty larder puts the colony into famine', () => {
    assert.ok(starving.famine > 0.9, `famine=${starving.famine.toFixed(2)}`);
    assert.equal(fed.famine, 0, `fed colony should not starve (${fed.famine})`);
  });

  check('starving ants abandon the old trail instead of parading down it', () => {
    const starvingLeft = trailMass(starving) / starvingBase;
    const fedLeft = trailMass(fed) / fedBase;
    assert.ok(starvingLeft < 0.25, `famine kept ${(starvingLeft * 100).toFixed(1)}% of the trail`);
    assert.ok(starvingLeft < fedLeft * 0.35, `starving=${starvingLeft.toFixed(2)} fed=${fedLeft.toFixed(2)}`);
  });

  check('starving scouts fan out to search', () => {
    const starvingGrowth = spreadOf(starving) / starvingSpread;
    const fedGrowth = spreadOf(fed) / fedSpread;
    assert.ok(starvingGrowth > 8, `spread only grew ${starvingGrowth.toFixed(1)}x`);
    assert.ok(starvingGrowth > fedGrowth * 1.2, `starving=${starvingGrowth.toFixed(1)} fed=${fedGrowth.toFixed(1)}`);
  });
}

/* ── 3. shortest-route convergence on the double bridge ────────────────── */
const bridgeWorld = new SimulationEngine({ worldWidth: 700, worldHeight: 900, maxPopulation: 260 });
bridgeWorld.loadPreset('double_bridge');

// Scent actually inside the fault line's own x-span, per bridge band: this is
// the chemical evidence of *which* tunnel the colony is running, not the return
// traffic from vaults that happen to sit at that height.
const bandSum = (y0, y1, field) => {
  const W = bridgeWorld.gridWidth;
  const H = bridgeWorld.gridHeight;
  // Mean over the *open* cells of the opening, so a wider tunnel cannot win
  // simply by having more cells to hold scent.
  let sum = 0;
  let open = 0;
  for (let gy = Math.floor(H * y0); gy < Math.floor(H * y1); gy++) {
    for (let gx = Math.floor(W * 0.46); gx < Math.floor(W * 0.54); gx++) {
      const idx = gy * W + gx;
      if (bridgeWorld.wallGrid[idx] === 1) continue;
      sum += field[idx];
      open++;
    }
  }
  return { mean: open ? sum / open : 0, open };
};
// Count real crossings of the barrier's midline, classified by branch. This is
// area-independent: a wide or narrow tunnel can't inflate its own share.
let shortUse = 0;
let longUse = 0;
const W0 = bridgeWorld.config.worldWidth;
const H0 = bridgeWorld.config.worldHeight;
const lastSide = new Int8Array(4096);
for (let step = 0; step < 3600; step++) {
  bridgeWorld.step(1 / 60);
  for (let i = 0; i < bridgeWorld.activeCount; i++) {
    const ax = bridgeWorld.x[i];
    const ay = bridgeWorld.y[i];
    const side = ax > W0 * 0.5 ? 1 : -1;
    if (lastSide[i] === -1 && side === 1) {
      if (Math.abs(ay - H0 * 0.5) < H0 * 0.1) shortUse++;
      else if (ay > H0 * 0.62) longUse++;
    }
    lastSide[i] = side;
  }
}

const shortBridge = bandSum(0.44, 0.56, bridgeWorld.foodTrail);
const longBridge = bandSum(0.62, 0.86, bridgeWorld.foodTrail);
console.log(
  `   [bridge scent] short mean=${shortBridge.mean.toFixed(2)} (${shortBridge.open} open cells)` +
    ` | long mean=${longBridge.mean.toFixed(2)} (${longBridge.open} open cells)`
);

check('colony converges on the short bridge (traffic-weighted shortest path)', () => {
  assert.ok(
    shortUse > longUse * 1.2,
    `ants used short=${shortUse.toFixed(0)} vs long=${longUse.toFixed(0)}`
  );
  assert.ok(shortUse > 300, `too few crossings to judge: ${shortUse}`);
  assert.ok(
    shortBridge.mean > longBridge.mean * 1.15,
    `scent mean short=${shortBridge.mean.toFixed(2)} long=${longBridge.mean.toFixed(2)}`
  );
});

/* ── 4. no stalling anywhere, including concave pockets ────────────────── */
const before = Array.from({ length: engine.activeCount }, (_, i) => [engine.x[i], engine.y[i]]);
for (let step = 0; step < 180; step++) engine.step(1 / 60); // 3 seconds
let stalled = 0;
for (let i = 0; i < engine.activeCount; i++) {
  const d = Math.hypot(engine.x[i] - before[i][0], engine.y[i] - before[i][1]);
  if (d < 1.5) stalled++;
}
check('no ant is stalled in a choke point or pocket', () => {
  assert.ok(stalled / engine.activeCount < 0.02, `${stalled}/${engine.activeCount} stalled`);
});
check('carriers exist (returning ants hold their shard on the way home)', () => {
  let carriers = 0;
  for (let i = 0; i < engine.activeCount; i++) if (engine.state[i] === 1) carriers++;
  assert.ok(carriers > 0, 'no ant is carrying food');
});

console.log(checks.join('\n'));
clearTimeout(watchdog);
if (errors.length) {
  console.error(`\n${errors.length}/${checks.length} simulation checks FAILED`);
  process.exit(1);
}
console.log(`\n${checks.length}/${checks.length} simulation checks passed — no runtime errors.`);
process.exit(0);
