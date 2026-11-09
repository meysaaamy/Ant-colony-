export enum AntState {
  FORAGING = 0,
  RETURNING = 1,
  ALARMED = 2,
}

export type ToolType =
  | 'food_trail'
  | 'home_trail'
  | 'alarm'
  | 'food_cluster'
  | 'wall'
  | 'eraser';

export type PresetType = 'sanctuary' | 'double_bridge' | 'labyrinth';

export interface SimulationConfig {
  worldWidth: number;
  worldHeight: number;
  cellSize: number; // 6 logical units
  gridWidth: number;
  gridHeight: number;
  maxPopulation: number; // 100 to 3000, default ~800
  evaporationRate: number; // lambda: 0.005 - 0.05
  diffusionRate: number; // 0.05 - 0.25 (CFL stable)
  alarmEvapMultiplier: number; // 3.5x
  antBaseSpeed: number; // 2.2 - 3.2
  antennaAngle: number; // radians (~0.61 = 35 deg)
  antennaDistance: number; // 18 logical units = 3 cells
  trailSensitivity: number; // alpha: 0.8 - 2.5
  wanderStrength: number; // 0.15 - 0.4
  brushRadius: number; // 15 - 80
  brushIntensity: number; // 10 - 100
  timeScale: 1 | 2 | 4;
  pheromoneRenderMode: 'glow' | 'fog';
}

export interface FoodCluster {
  id: number;
  x: number;
  y: number;
  radius: number;
  initialAmount: number;
  currentAmount: number;
  variant: number; // 0-7
  pulsePhase: number;
}

export interface Nest {
  x: number;
  y: number;
  radius: number;
  storedFood: number;
  spawnAccumulator: number; // 0..3
  pulseAnim: number; // heartbeat animation
  deliveryPulse: number; // bright flash on food drop
  ringPhase: number;
}

export interface SparkParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
  maxLife: number;
  size: number;
}

export interface SporeMote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  pulseSpeed: number;
  phase: number;
}

export interface StrokePoint {
  x: number;
  y: number;
  time: number;
}

export interface TelemetryData {
  fps: number;
  antCount: number;
  storedFood: number;
  simSpeed: 1 | 2 | 4;
  isPaused: boolean;
  activePreset: PresetType;
  atCapacity: boolean;
  fpsStatus: 'emerald' | 'amber' | 'crimson';
}
