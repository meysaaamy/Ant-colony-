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

/* ── 3. shortest-route convergence on the double bridge ────────────────── */
const bridgeWorld = new SimulationEngine({ worldWidth: 700, worldHeight: 900, maxPopulation: 260 });
bridgeWorld.loadPreset('double_bridge');
for (let step = 0; step < 10_800; step++) bridgeWorld.step(1 / 60); // 3 simulated minutes

const bandScent = (yFromFrac, yToFrac) => {
  const W = bridgeWorld.gridWidth;
  const H = bridgeWorld.gridHeight;
  let sum = 0;
  for (let gy = Math.floor(H * yFromFrac); gy < Math.floor(H * yToFrac); gy++) {
    for (let gx = Math.floor(W * 0.3); gx < Math.floor(W * 0.7); gx++) {
      sum += bridgeWorld.foodTrail[gy * W + gx];
    }
  }
  return sum;
};
const shortBridge = bandScent(0.28, 0.42);
const longBridge = bandScent(0.6, 0.82);

check('colony converges on the short bridge (traffic-weighted shortest path)', () => {
  assert.ok(shortBridge > longBridge, `short=${shortBridge.toFixed(0)} long=${longBridge.toFixed(0)}`);
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
