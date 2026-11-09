/**
 * The ant's plastic brain.
 *
 * Five policy genes, all multiplicative around 1.0, so a newborn colony behaves
 * exactly like the hand-tuned baseline and every deviation from 1.0 has to be
 * *earned* by reward or beaten out of the gene pool by penalty.
 *
 *   0 TRAIL      — how hard it locks onto a high-traffic scent corridor
 *   1 CURIOSITY  — how strongly it leans into unvisited ground
 *   2 FORESIGHT  — wall-clearance margin: how early it starts the tangent turn
 *   3 VECTOR     — trust in its own dead-reckoning compass over home scent
 *   4 PENALTY    — how fast it damps a trail proven to be false
 *
 * Pure and allocation-light: the engine stores every ant's genome in one flat
 * Float32Array (`i * GENE_COUNT + gene`).
 */

export const GENE_TRAIL = 0;
export const GENE_CURIOSITY = 1;
export const GENE_FORESIGHT = 2;
export const GENE_VECTOR = 3;
export const GENE_PENALTY = 4;
export const GENE_COUNT = 5;

/** Hard bounds: never let evolution switch a sense off entirely or blow it up. */
export const GENE_MIN = 0.35;
export const GENE_MAX = 1.95;

/**
 * Generation-1 variance. Selection can only improve what varies, so newborn
 * ants start genuinely spread out (0.65 … 1.35 per gene) and the colony's own
 * rewards decide which end of that spread survives.
 */
const BIRTH_JITTER = 0.35;

export const GENE_LABELS = [
  'trail commitment',
  'curiosity',
  'obstacle foresight',
  'vector memory',
  'penalty sense',
] as const;

const clampGene = (v: number) => (v < GENE_MIN ? GENE_MIN : v > GENE_MAX ? GENE_MAX : v);

/** Write a fresh, generation-1 genome at `offset`. */
export function seedGenome(
  genome: Float32Array,
  offset: number,
  random: () => number = Math.random
): void {
  for (let g = 0; g < GENE_COUNT; g++) {
    genome[offset + g] = clampGene(1 + (random() - 0.5) * 2 * BIRTH_JITTER);
  }
}

/**
 * Uniform crossover of two parents plus a small mutation. `mutation` is the
 * per-gene standard deviation; the hall of fame keeps it low (0.07) so the
 * colony refines rather than re-randomises.
 */
export function breedGenome(
  genome: Float32Array,
  offset: number,
  parentA: Float32Array,
  offsetA: number,
  parentB: Float32Array,
  offsetB: number,
  mutation: number,
  random: () => number = Math.random
): void {
  for (let g = 0; g < GENE_COUNT; g++) {
    const pick = random() < 0.5 ? parentA[offsetA + g] : parentB[offsetB + g];
    const drift = (random() + random() + random() - 1.5) * mutation; // ~N(0, m/√2), cheap
    genome[offset + g] = clampGene(pick + drift);
  }
}

/** Add `delta` to one gene, clamped, in place. */
export function nudgeGene(
  genome: Float32Array,
  offset: number,
  gene: number,
  delta: number
): void {
  genome[offset + gene] = clampGene(genome[offset + gene] + delta);
}

/** Blend `target` a fraction `alpha` toward `source` (social learning). */
export function blendGenome(
  target: Float32Array,
  targetOffset: number,
  source: Float32Array,
  sourceOffset: number,
  alpha: number
): void {
  for (let g = 0; g < GENE_COUNT; g++) {
    const t = target[targetOffset + g];
    target[targetOffset + g] = clampGene(t + (source[sourceOffset + g] - t) * alpha);
  }
}

/** Mean absolute distance from the neutral 1.0 brain — "how evolved is this ant". */
export function genomeDistance(genome: Float32Array, offset: number): number {
  let sum = 0;
  for (let g = 0; g < GENE_COUNT; g++) sum += Math.abs(genome[offset + g] - 1);
  return sum / GENE_COUNT;
}
