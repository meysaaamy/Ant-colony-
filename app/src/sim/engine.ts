import {
  AntState,
  SimulationConfig,
  FoodCluster,
  Nest,
  PresetType,
  SparkParticle,
  SporeMote,
} from './types';
import {
  weberFechner,
  exponentialEvaporation,
  saturatingDeposition,
  computeAntennaPositions,
  computeTropotaxisSteering,
  lineOfSight,
  resolveWallCollision,
  hashCoord,
  computeWhiskerAvoidance,
} from './math';

/** Total standing nutrients below which the colony starts to feel the pinch. */
const FEAST_LEVEL = 140;

export class SimulationEngine {
  public config: SimulationConfig;

  // Grid dimensions
  public gridWidth: number;
  public gridHeight: number;
  public totalCells: number;

  // Pheromone grids (Float32Array) - double buffered for ping-pong diffusion
  public foodTrail: Float32Array;
  public foodTrailNext: Float32Array;

  public homeGuide: Float32Array;
  public homeGuideNext: Float32Array;

  public alarm: Float32Array;
  public alarmNext: Float32Array;

  // Obstacle grid: 1 = wall, 0 = open
  public wallGrid: Uint8Array;
  public wallDirty: boolean = true;

  // Last visit timestamp per cell for age-attenuation (Float32Array)
  public lastVisitGrid: Float32Array;

  /**
   * Recent ant traffic per cell. Pheromone survives only while ants keep
   * walking over it: busy cells evaporate slowly, abandoned ones fade fast.
   */
  public traffic: Float32Array;

  /** Per-frame evaporation factors bucketed by local traffic. */
  private evapFoodLut = new Float32Array(16);
  private evapHomeLut = new Float32Array(16);
  public simTime: number = 0;

  // Structure of Arrays (SoA) for up to 3,000 ants
  public readonly MAX_AGENTS = 3000;
  public activeCount: number = 0;

  public x: Float32Array;
  public y: Float32Array;
  public vx: Float32Array;
  public vy: Float32Array;
  public angle: Float32Array;
  public state: Uint8Array;
  public homeDx: Float32Array;
  public homeDy: Float32Array;
  public legPhase: Float32Array;
  public pheromoneTimer: Float32Array;
  public alarmTimer: Float32Array;
  public antennationTimer: Float32Array;
  public wanderVelocity: Float32Array;
  public stuckTimer: Float32Array;
  public lastSampleX: Float32Array;
  public lastSampleY: Float32Array;
  /** 0 = free, +1 = contouring with wall on the left, -1 = on the right. */
  public wallMode: Int8Array;
  public wallCooldown: Float32Array;
  /** Distance travelled on the current leg (nest→food or food→nest). */
  public pathLen: Float32Array;
  /** Previous position, used to stamp a continuous trail between ticks. */
  public prevX: Float32Array;
  public prevY: Float32Array;

  // Spatial Hash Grid for O(1) neighbor lookups and zero allocation
  public hashCellSize: number;
  public hashCols: number;
  public hashRows: number;
  public hashHead: Int32Array;
  public hashNext: Int32Array;

  // World objects
  public nest: Nest;
  public foodClusters: FoodCluster[] = [];
  /**
   * 0 → the colony is fed, 1 → every vault is empty. Rises smoothly as the last
   * nutrients are harvested, and while it is high the ants stop trusting their
   * old chemical memory: pheromone guidance is damped, the trails themselves
   * evaporate several times faster, and scouts fan out to search.
   */
  public famine = 0;
  public sparks: SparkParticle[] = [];
  public motes: SporeMote[] = [];

  // Active preset
  public activePreset: PresetType = 'sanctuary';

  // Performance scaling
  public qualityThrottleDiffusion: boolean = false;
  private stepCounter: number = 0;

  // Event callbacks for audio/haptics/UI
  public onFoodDelivered?: () => void;
  public onAntSpawned?: () => void;
  public onFoodHarvested?: (x: number, y: number) => void;
  public onColonyCapacity?: () => void;

  constructor(customConfig?: Partial<SimulationConfig>) {
    const worldW = customConfig?.worldWidth ?? 1080;
    const worldH = customConfig?.worldHeight ?? 1440;
    const cellSize = customConfig?.cellSize ?? 6;

    this.gridWidth = Math.floor(worldW / cellSize);
    this.gridHeight = Math.floor(worldH / cellSize);
    this.totalCells = this.gridWidth * this.gridHeight;

    this.config = {
      worldWidth: worldW,
      worldHeight: worldH,
      cellSize,
      gridWidth: this.gridWidth,
      gridHeight: this.gridHeight,
      maxPopulation: customConfig?.maxPopulation ?? 600,
      evaporationRate: customConfig?.evaporationRate ?? 0.05,
      diffusionRate: customConfig?.diffusionRate ?? 0.085,
      alarmEvapMultiplier: customConfig?.alarmEvapMultiplier ?? 3.5,
      antBaseSpeed: customConfig?.antBaseSpeed ?? 2.4,
      antennaAngle: customConfig?.antennaAngle ?? 0.61, // ~35 deg
      antennaDistance: customConfig?.antennaDistance ?? 18,
      trailSensitivity: customConfig?.trailSensitivity ?? 1.25,
      wanderStrength: customConfig?.wanderStrength ?? 0.28,
      brushRadius: customConfig?.brushRadius ?? 32,
      brushIntensity: customConfig?.brushIntensity ?? 45,
      timeScale: customConfig?.timeScale ?? 1,
      pheromoneRenderMode: customConfig?.pheromoneRenderMode ?? 'glow',
    };

    // Preallocate pheromone arrays
    this.foodTrail = new Float32Array(this.totalCells);
    this.foodTrailNext = new Float32Array(this.totalCells);

    this.homeGuide = new Float32Array(this.totalCells);
    this.homeGuideNext = new Float32Array(this.totalCells);

    this.alarm = new Float32Array(this.totalCells);
    this.alarmNext = new Float32Array(this.totalCells);

    this.wallGrid = new Uint8Array(this.totalCells);
    this.lastVisitGrid = new Float32Array(this.totalCells);
    this.traffic = new Float32Array(this.totalCells);

    // Preallocate SoA agent arrays
    this.x = new Float32Array(this.MAX_AGENTS);
    this.y = new Float32Array(this.MAX_AGENTS);
    this.vx = new Float32Array(this.MAX_AGENTS);
    this.vy = new Float32Array(this.MAX_AGENTS);
    this.angle = new Float32Array(this.MAX_AGENTS);
    this.state = new Uint8Array(this.MAX_AGENTS);
    this.homeDx = new Float32Array(this.MAX_AGENTS);
    this.homeDy = new Float32Array(this.MAX_AGENTS);
    this.legPhase = new Float32Array(this.MAX_AGENTS);
    this.pheromoneTimer = new Float32Array(this.MAX_AGENTS);
    this.alarmTimer = new Float32Array(this.MAX_AGENTS);
    this.antennationTimer = new Float32Array(this.MAX_AGENTS);
    this.wanderVelocity = new Float32Array(this.MAX_AGENTS);
    this.stuckTimer = new Float32Array(this.MAX_AGENTS);
    this.lastSampleX = new Float32Array(this.MAX_AGENTS);
    this.lastSampleY = new Float32Array(this.MAX_AGENTS);
    this.wallMode = new Int8Array(this.MAX_AGENTS);
    this.wallCooldown = new Float32Array(this.MAX_AGENTS);
    this.pathLen = new Float32Array(this.MAX_AGENTS);
    this.prevX = new Float32Array(this.MAX_AGENTS);
    this.prevY = new Float32Array(this.MAX_AGENTS);

    // Spatial hash grid (cell size 24 logical units)
    this.hashCellSize = 24;
    this.hashCols = Math.ceil(worldW / this.hashCellSize);
    this.hashRows = Math.ceil(worldH / this.hashCellSize);
    const hashTotal = this.hashCols * this.hashRows;
    this.hashHead = new Int32Array(hashTotal);
    this.hashNext = new Int32Array(this.MAX_AGENTS);

    // Initialize Nest
    this.nest = {
      x: worldW * 0.25,
      y: worldH * 0.5,
      radius: 46,
      storedFood: 0,
      spawnAccumulator: 0,
      pulseAnim: 0,
      deliveryPulse: 0,
      ringPhase: 0,
    };

    // Initialize ambient spore motes
    this.initMotes(36);

    // Load initial scenario preset
    this.loadPreset('sanctuary');
  }

  public initMotes(count: number) {
    this.motes = [];
    for (let i = 0; i < count; i++) {
      this.motes.push({
        x: Math.random() * this.config.worldWidth,
        y: Math.random() * this.config.worldHeight,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25 - 0.1,
        size: 1.0 + Math.random() * 2.0,
        alpha: 0.15 + Math.random() * 0.35,
        pulseSpeed: 1.5 + Math.random() * 2.0,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  public spawnAnt(x: number, y: number, initialAngle?: number): boolean {
    if (this.activeCount >= this.MAX_AGENTS || this.activeCount >= this.config.maxPopulation) {
      return false;
    }

    const idx = this.activeCount;
    const ang = initialAngle !== undefined ? initialAngle : Math.random() * Math.PI * 2;
    this.x[idx] = x;
    this.y[idx] = y;
    this.vx[idx] = Math.cos(ang) * this.config.antBaseSpeed;
    this.vy[idx] = Math.sin(ang) * this.config.antBaseSpeed;
    this.angle[idx] = ang;
    this.state[idx] = AntState.FORAGING;
    this.homeDx[idx] = 0;
    this.homeDy[idx] = 0;
    this.legPhase[idx] = Math.random() * 8;
    this.pheromoneTimer[idx] = Math.random() * 0.2;
    this.alarmTimer[idx] = 0;
    this.antennationTimer[idx] = 0;
    this.wanderVelocity[idx] = 0;
    this.stuckTimer[idx] = 0;
    this.lastSampleX[idx] = x;
    this.lastSampleY[idx] = y;

    this.activeCount++;
    return true;
  }

  public clearPheromones() {
    this.traffic.fill(0);
    this.foodTrail.fill(0);
    this.foodTrailNext.fill(0);
    this.homeGuide.fill(0);
    this.homeGuideNext.fill(0);
    this.alarm.fill(0);
    this.alarmNext.fill(0);
    this.lastVisitGrid.fill(0);
  }

  public resetWorld() {
    this.loadPreset(this.activePreset);
  }

  public loadPreset(preset: PresetType) {
    this.activePreset = preset;
    this.activeCount = 0;
    this.clearPheromones();
    this.wallGrid.fill(0);
    this.wallDirty = true;
    this.foodClusters = [];
    this.sparks = [];

    const W = this.config.worldWidth;
    const H = this.config.worldHeight;

    if (preset === 'sanctuary') {
      // Open Sanctuary: Nest on the left-center, 3 nutrient groves, zero obstacles
      this.nest.x = W * 0.22;
      this.nest.y = H * 0.5;
      this.nest.storedFood = 0;
      this.nest.spawnAccumulator = 0;

      // 3 Emerald food groves
      this.foodClusters.push({
        id: 1,
        x: W * 0.76,
        y: H * 0.28,
        radius: 38,
        initialAmount: 320,
        currentAmount: 320,
        variant: 0,
        pulsePhase: 0,
      });

      this.foodClusters.push({
        id: 2,
        x: W * 0.82,
        y: H * 0.52,
        radius: 44,
        initialAmount: 480,
        currentAmount: 480,
        variant: 2,
        pulsePhase: 1.2,
      });

      this.foodClusters.push({
        id: 3,
        x: W * 0.68,
        y: H * 0.78,
        radius: 36,
        initialAmount: 300,
        currentAmount: 300,
        variant: 4,
        pulsePhase: 2.5,
      });

      // Spawn starter colony of 140 ants
      const initialPop = Math.min(this.config.maxPopulation, 160);
      for (let i = 0; i < initialPop; i++) {
        const offsetR = Math.random() * (this.nest.radius - 8);
        const offsetA = Math.random() * Math.PI * 2;
        this.spawnAnt(this.nest.x + Math.cos(offsetA) * offsetR, this.nest.y + Math.sin(offsetA) * offsetR);
      }
    } else if (preset === 'double_bridge') {
      // Deneubourg's Double Bridge experiment:
      // Nest on left (x=180), Food on right (x=900)
      // Solid basalt wall barrier with two bridge paths:
      // 1. Short branch (straight/shallow diamond, length 1x)
      // 2. Long branch (wide loop diamond, length 2x)
      this.nest.x = W * 0.16;
      this.nest.y = H * 0.5;
      this.nest.storedFood = 0;
      this.nest.spawnAccumulator = 0;

      // Food cluster on right side
      this.foodClusters.push({
        id: 1,
        x: W * 0.84,
        y: H * 0.5,
        radius: 48,
        initialAmount: 900,
        currentAmount: 900,
        variant: 1,
        pulsePhase: 0.5,
      });

      // Sculpt basalt barrier with the two asymmetric bridges
      // Fill central barrier leaving only the two bridge channels
      const midX = W * 0.5;
      const barrierWidth = W * 0.52;
      const startX = midX - barrierWidth * 0.5;
      const endX = midX + barrierWidth * 0.5;

      // Build obstacle block in the middle
      // Full-height barrier: the two bridges are the only ways through.
      this.paintWallBox(startX, H * 0.02, endX, H * 0.98);

      // Short branch: a straight bore through the barrier on the direct
      // nest→food line (length L). Wide enough that ants can run it without
      // fighting the wall sensors the whole way.
      this.carveTunnel(this.nest.x + 30, H * 0.5, this.foodClusters[0].x - 30, H * 0.5, 44);

      // Long branch: the same two endpoints reached by a deep lower loop (~2 L)
      this.carveTunnel(this.nest.x + 30, H * 0.5, startX + 20, H * 0.8, 34);
      this.carveTunnel(startX + 20, H * 0.8, endX - 20, H * 0.8, 34);
      this.carveTunnel(endX - 20, H * 0.8, this.foodClusters[0].x - 30, H * 0.5, 34);

      // Spawn starter colony
      const initialPop = Math.min(this.config.maxPopulation, 220);
      for (let i = 0; i < initialPop; i++) {
        const offsetR = Math.random() * (this.nest.radius - 8);
        const offsetA = Math.random() * Math.PI * 2;
        this.spawnAnt(this.nest.x + Math.cos(offsetA) * offsetR, this.nest.y + Math.sin(offsetA) * offsetR);
      }
    } else if (preset === 'labyrinth') {
      // Subterranean Labyrinth: Organic cave network with choke points and 2 deep vaults
      this.nest.x = W * 0.18;
      this.nest.y = H * 0.22;
      this.nest.storedFood = 0;
      this.nest.spawnAccumulator = 0;

      // 2 Deep nutrient vaults
      this.foodClusters.push({
        id: 1,
        x: W * 0.82,
        y: H * 0.82,
        radius: 46,
        initialAmount: 600,
        currentAmount: 600,
        variant: 3,
        pulsePhase: 0,
      });

      this.foodClusters.push({
        id: 2,
        x: W * 0.24,
        y: H * 0.85,
        radius: 42,
        initialAmount: 500,
        currentAmount: 500,
        variant: 5,
        pulsePhase: 1.8,
      });

      // Procedural cave network
      this.paintWallBox(W * 0.05, H * 0.38, W * 0.72, H * 0.44);
      this.paintWallBox(W * 0.32, H * 0.56, W * 0.95, H * 0.62);
      this.paintWallBox(W * 0.48, H * 0.15, W * 0.54, H * 0.38);
      this.paintWallBox(W * 0.38, H * 0.62, W * 0.44, H * 0.88);

      // Irregular rock pillars
      this.paintWallCircle(W * 0.74, H * 0.26, 38);
      this.paintWallCircle(W * 0.62, H * 0.74, 44);
      this.paintWallCircle(W * 0.22, H * 0.62, 34);

      // Spawn starter colony
      const initialPop = Math.min(this.config.maxPopulation, 180);
      for (let i = 0; i < initialPop; i++) {
        const offsetR = Math.random() * (this.nest.radius - 8);
        const offsetA = Math.random() * Math.PI * 2;
        this.spawnAnt(this.nest.x + Math.cos(offsetA) * offsetR, this.nest.y + Math.sin(offsetA) * offsetR);
      }
    }
  }

  private paintWallBox(x0: number, y0: number, x1: number, y1: number) {
    const minGx = Math.max(0, Math.floor(Math.min(x0, x1) / this.config.cellSize));
    const maxGx = Math.min(this.gridWidth - 1, Math.floor(Math.max(x0, x1) / this.config.cellSize));
    const minGy = Math.max(0, Math.floor(Math.min(y0, y1) / this.config.cellSize));
    const maxGy = Math.min(this.gridHeight - 1, Math.floor(Math.max(y0, y1) / this.config.cellSize));

    for (let gy = minGy; gy <= maxGy; gy++) {
      for (let gx = minGx; gx <= maxGx; gx++) {
        this.wallGrid[gy * this.gridWidth + gx] = 1;
      }
    }
    this.wallDirty = true;
  }

  private paintWallCircle(cx: number, cy: number, radius: number) {
    const cs = this.config.cellSize;
    const minGx = Math.max(0, Math.floor((cx - radius) / cs));
    const maxGx = Math.min(this.gridWidth - 1, Math.floor((cx + radius) / cs));
    const minGy = Math.max(0, Math.floor((cy - radius) / cs));
    const maxGy = Math.min(this.gridHeight - 1, Math.floor((cy + radius) / cs));
    const rSq = radius * radius;

    for (let gy = minGy; gy <= maxGy; gy++) {
      const dy = gy * cs + cs * 0.5 - cy;
      for (let gx = minGx; gx <= maxGx; gx++) {
        const dx = gx * cs + cs * 0.5 - cx;
        if (dx * dx + dy * dy <= rSq) {
          this.wallGrid[gy * this.gridWidth + gx] = 1;
        }
      }
    }
    this.wallDirty = true;
  }

  private carveTunnel(x0: number, y0: number, x1: number, y1: number, width: number) {
    const cs = this.config.cellSize;
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.ceil(dist / (cs * 0.8));
    const r = width * 0.5;
    const rSq = r * r;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = x0 + (x1 - x0) * t;
      const py = y0 + (y1 - y0) * t;

      const minGx = Math.max(0, Math.floor((px - r) / cs));
      const maxGx = Math.min(this.gridWidth - 1, Math.floor((px + r) / cs));
      const minGy = Math.max(0, Math.floor((py - r) / cs));
      const maxGy = Math.min(this.gridHeight - 1, Math.floor((py + r) / cs));

      for (let gy = minGy; gy <= maxGy; gy++) {
        const dy = gy * cs + cs * 0.5 - py;
        for (let gx = minGx; gx <= maxGx; gx++) {
          const dx = gx * cs + cs * 0.5 - px;
          if (dx * dx + dy * dy <= rSq) {
            this.wallGrid[gy * this.gridWidth + gx] = 0;
          }
        }
      }
    }
    this.wallDirty = true;
  }

  /**
   * Main simulation tick.
   * Fixed dt = 1/60s. Zero allocations inside this loop.
   */
  public step(dt: number) {
    this.simTime += dt;
    this.stepCounter++;

    // 1. Update pheromone diffusion & evaporation
    // Throttle diffusion to every 2nd frame if qualityThrottle engaged under heavy load
    const doDiffusion = !this.qualityThrottleDiffusion || this.stepCounter % 2 === 0;

    if (doDiffusion) {
      this.diffuseAndEvaporate(dt * (this.qualityThrottleDiffusion ? 2.0 : 1.0));
    }

    // 2. Build Spatial Hash Grid for O(1) neighbor lookups
    this.buildSpatialHash();

    // 3. Update Nest animations
    this.nest.ringPhase += dt * 1.5;
    this.nest.pulseAnim = Math.sin(this.simTime * 2.8) * 0.5 + 0.5;
    if (this.nest.deliveryPulse > 0) {
      this.nest.deliveryPulse = Math.max(0, this.nest.deliveryPulse - dt * 2.5);
    }

    // 4. Famine state — derived from what is actually left in the vaults.
    let foodLeft = 0;
    for (let f = 0; f < this.foodClusters.length; f++) {
      const amount = this.foodClusters[f].currentAmount;
      if (amount > 0) foodLeft += amount;
    }
    // Fully fed above FEAST_LEVEL, starving at zero, with a readable ramp in
    // between so the colony widens its search before the last crystal.
    const famineTarget = 1 - Math.min(1, foodLeft / FEAST_LEVEL);
    this.famine += (famineTarget - this.famine) * Math.min(1, dt * 1.8);
    if (this.famine < 0.002) this.famine = 0;

    // 5. Update Agents
    this.updateAgents(dt);

    // 5. Trail memory decays: a corridor nobody walks stops being reinforced
    const trafficDecay = Math.exp(-dt * 0.55);
    const trafficArr = this.traffic;
    for (let i = 0; i < this.totalCells; i++) {
      if (trafficArr[i] > 0.001) {
        trafficArr[i] *= trafficDecay;
      } else if (trafficArr[i] !== 0) {
        trafficArr[i] = 0;
      }
    }

    // 6. Update Food Clusters
    for (let i = 0; i < this.foodClusters.length; i++) {
      this.foodClusters[i].pulsePhase += dt * 1.2;
    }

    // 7. Update Sparks & Motes
    this.updateParticles(dt);
  }

  private buildSpatialHash() {
    this.hashHead.fill(-1);
    const hs = this.hashCellSize;
    const cols = this.hashCols;
    const rows = this.hashRows;

    for (let i = 0; i < this.activeCount; i++) {
      const gx = Math.max(0, Math.min(cols - 1, Math.floor(this.x[i] / hs)));
      const gy = Math.max(0, Math.min(rows - 1, Math.floor(this.y[i] / hs)));
      const cellIdx = gy * cols + gx;

      this.hashNext[i] = this.hashHead[cellIdx];
      this.hashHead[cellIdx] = i;
    }
  }

  /**
   * 3x3 weighted Laplacian stencil with CFL stability
   * and strict zero-flux Neumann boundary conditions at walls and borders.
   */
  private diffuseAndEvaporate(dt: number) {
    const W = this.gridWidth;
    const H = this.gridHeight;
    const D = Math.min(0.24, this.config.diffusionRate); // CFL clamp
    // A starving colony's trails are not worth preserving: when the vaults are
    // empty the chemical memory is wiped several times faster so nobody keeps
    // marching down a route that no longer leads anywhere.
    const lambda = this.config.evaporationRate * (1 + 2.8 * this.famine);
    // Evaporation is traffic-dependent: a cell nobody walks across loses its
    // scent quickly ("trail fades when there is no movement"), while a corridor
    // with ants on it is refreshed and lingers. Precomputed per bucket so the
    // inner loop stays allocation- and exp-free.
    const EVAP_BUCKETS = 16;
    const evapFood = this.evapFoodLut;
    const evapHome = this.evapHomeLut;
    for (let b = 0; b < EVAP_BUCKETS; b++) {
      const trafficLevel = b / (EVAP_BUCKETS - 1); // 0 → 1 (busy)
      const staleness = 1 - trafficLevel;
      evapFood[b] = Math.exp(-dt * lambda * (0.5 + 2.2 * staleness));
      evapHome[b] = Math.exp(-dt * lambda * (0.8 + 2.6 * staleness));
    }
    const trafficField = this.traffic;
    const alarmEvapFactor = Math.exp(-dt * lambda * this.config.alarmEvapMultiplier);

    const D_center = 1.0 - 4.0 * D * 0.5;
    const D_cardinal = D * 0.125;

    const ft = this.foodTrail;
    const ftNext = this.foodTrailNext;
    const hg = this.homeGuide;
    const hgNext = this.homeGuideNext;
    const al = this.alarm;
    const alNext = this.alarmNext;
    const walls = this.wallGrid;

    for (let y = 0; y < H; y++) {
      const yOffset = y * W;
      const yUp = y > 0 ? (y - 1) * W : yOffset;
      const yDown = y < H - 1 ? (y + 1) * W : yOffset;

      for (let x = 0; x < W; x++) {
        const idx = yOffset + x;

        // Chemicals cannot exist inside solid walls
        if (walls[idx] === 1) {
          ftNext[idx] = 0;
          hgNext[idx] = 0;
          alNext[idx] = 0;
          continue;
        }

        const xLeft = x > 0 ? idx - 1 : idx;
        const xRight = x < W - 1 ? idx + 1 : idx;
        const idxUp = yUp + x;
        const idxDown = yDown + x;

        // Zero-flux boundary condition: if adjacent cell is wall, reflect current cell concentration
        const c_ft = ft[idx];
        const left_ft = walls[xLeft] === 1 ? c_ft : ft[xLeft];
        const right_ft = walls[xRight] === 1 ? c_ft : ft[xRight];
        const up_ft = walls[idxUp] === 1 ? c_ft : ft[idxUp];
        const down_ft = walls[idxDown] === 1 ? c_ft : ft[idxDown];

        const bucket = Math.min(
          EVAP_BUCKETS - 1,
          Math.max(0, Math.round((trafficField[idx] / 6) * (EVAP_BUCKETS - 1)))
        );
        const lap_ft = left_ft + right_ft + up_ft + down_ft - 4.0 * c_ft;
        const val_ft = (c_ft + lap_ft * D) * evapFood[bucket];
        ftNext[idx] = val_ft > 0.35 ? Math.min(100.0, val_ft) : 0;

        // Home Guide
        const c_hg = hg[idx];
        const left_hg = walls[xLeft] === 1 ? c_hg : hg[xLeft];
        const right_hg = walls[xRight] === 1 ? c_hg : hg[xRight];
        const up_hg = walls[idxUp] === 1 ? c_hg : hg[idxUp];
        const down_hg = walls[idxDown] === 1 ? c_hg : hg[idxDown];

        const lap_hg = left_hg + right_hg + up_hg + down_hg - 4.0 * c_hg;
        const val_hg = (c_hg + lap_hg * D) * evapHome[bucket];
        hgNext[idx] = val_hg > 0.35 ? Math.min(100.0, val_hg) : 0;

        // Alarm (3.5x faster evaporation)
        const c_al = al[idx];
        const left_al = walls[xLeft] === 1 ? c_al : al[xLeft];
        const right_al = walls[xRight] === 1 ? c_al : al[xRight];
        const up_al = walls[idxUp] === 1 ? c_al : al[idxUp];
        const down_al = walls[idxDown] === 1 ? c_al : al[idxDown];

        const lap_al = left_al + right_al + up_al + down_al - 4.0 * c_al;
        const val_al = (c_al + lap_al * D) * alarmEvapFactor;
        alNext[idx] = val_al > 0.0005 ? Math.min(100.0, val_al) : 0;
      }
    }

    // Ping-pong buffer swap
    this.foodTrail = ftNext;
    this.foodTrailNext = ft;

    this.homeGuide = hgNext;
    this.homeGuideNext = hg;

    this.alarm = alNext;
    this.alarmNext = al;
  }

  /** Stamp one sample of a trail, including a narrow cross-trail footprint. */
  private depositScent(
    field: Float32Array,
    x: number,
    y: number,
    baseStr: number,
    wide: boolean,
    // Route vigour: short, efficient legs count as real traffic; long detours
    // barely keep their cells alive, so unused branches fade first.
    vigour = 1
  ) {
    const cs = this.config.cellSize;
    const gx = Math.floor(x / cs);
    const gy = Math.floor(y / cs);
    if (gx < 0 || gx >= this.gridWidth || gy < 0 || gy >= this.gridHeight) return;

    const cIdx = gy * this.gridWidth + gx;
    if (this.wallGrid[cIdx] === 1) return;

    const timeSince = this.simTime - this.lastVisitGrid[cIdx];
    const amount = saturatingDeposition(baseStr, timeSince, 0.06, field[cIdx]);
    field[cIdx] = Math.min(100.0, field[cIdx] + amount);
    this.lastVisitGrid[cIdx] = this.simTime;
    // Walking a corridor is what keeps it alive — in proportion to how
    // directly this leg served the errand.
    this.traffic[cIdx] = Math.min(8.0, this.traffic[cIdx] + 1.4 * vigour);

    if (!wide) return;

    // A tight cross-trail gives returning highways body without smearing.
    const spill = baseStr * 0.42;
    for (let k = 0; k < 4; k++) {
      const ngx = gx + (k === 0 ? 1 : k === 1 ? -1 : 0);
      const ngy = gy + (k === 2 ? 1 : k === 3 ? -1 : 0);
      if (ngx < 0 || ngx >= this.gridWidth || ngy < 0 || ngy >= this.gridHeight) continue;
      const nIdx = ngy * this.gridWidth + ngx;
      if (this.wallGrid[nIdx] === 1) continue;
      field[nIdx] = Math.min(100.0, field[nIdx] + spill * 0.28);
      this.traffic[nIdx] = Math.min(8.0, this.traffic[nIdx] + 0.55 * vigour);
    }
  }

  /** Radial scent stamp — marks discoveries (food found) with a soft beacon. */
  private stampScent(field: Float32Array, x: number, y: number, cells: number, amount: number) {
    const cs = this.config.cellSize;
    const gx = Math.floor(x / cs);
    const gy = Math.floor(y / cs);
    const r2 = cells * cells;
    for (let oy = -cells; oy <= cells; oy++) {
      const ny = gy + oy;
      if (ny < 0 || ny >= this.gridHeight) continue;
      for (let ox = -cells; ox <= cells; ox++) {
        const d2 = ox * ox + oy * oy;
        if (d2 > r2) continue;
        const nx = gx + ox;
        if (nx < 0 || nx >= this.gridWidth) continue;
        const idx = ny * this.gridWidth + nx;
        if (this.wallGrid[idx] === 1) continue;
        const falloff = 1 - Math.sqrt(d2) / (cells + 1);
        field[idx] = Math.min(100.0, field[idx] + amount * falloff);
      }
    }
  }

  private sampleField(field: Float32Array, x: number, y: number): number {
    const cs = this.config.cellSize;
    const gx = Math.floor(x / cs);
    const gy = Math.floor(y / cs);

    if (gx < 0 || gx >= this.gridWidth || gy < 0 || gy >= this.gridHeight) {
      return 0;
    }

    const idx = gy * this.gridWidth + gx;
    if (this.wallGrid[idx] === 1) {
      return 0;
    }

    return field[idx];
  }

  public depositPheromone(
    field: Float32Array,
    x: number,
    y: number,
    radius: number,
    baseStrength: number
  ) {
    const cs = this.config.cellSize;
    const minGx = Math.max(0, Math.floor((x - radius) / cs));
    const maxGx = Math.min(this.gridWidth - 1, Math.floor((x + radius) / cs));
    const minGy = Math.max(0, Math.floor((y - radius) / cs));
    const maxGy = Math.min(this.gridHeight - 1, Math.floor((y + radius) / cs));
    const rSq = radius * radius;

    for (let gy = minGy; gy <= maxGy; gy++) {
      const cy = gy * cs + cs * 0.5;
      const dy = cy - y;
      const yOffset = gy * this.gridWidth;

      for (let gx = minGx; gx <= maxGx; gx++) {
        const cx = gx * cs + cs * 0.5;
        const dx = cx - x;
        const dSq = dx * dx + dy * dy;

        if (dSq <= rSq) {
          const idx = yOffset + gx;
          if (this.wallGrid[idx] === 1) continue;

          const falloff = 1.0 - Math.sqrt(dSq) / radius;
          const current = field[idx];
          const timeSinceVisit = this.simTime - this.lastVisitGrid[idx];
          const added = saturatingDeposition(baseStrength * falloff, timeSinceVisit, 0.05, current);

          field[idx] = Math.min(100.0, current + added);
          this.lastVisitGrid[idx] = this.simTime;
        }
      }
    }
  }

  private updateAgents(dt: number) {
    const isWallFn = (gx: number, gy: number) => {
      if (gx < 0 || gx >= this.gridWidth || gy < 0 || gy >= this.gridHeight) return true;
      return this.wallGrid[gy * this.gridWidth + gx] === 1;
    };

    const cs = this.config.cellSize;
    const antRadius = 4.0;
    const baseSpeed = this.config.antBaseSpeed;
    const sensitivity = this.config.trailSensitivity;
    const antDistance = this.config.antennaDistance;
    const antAngle = this.config.antennaAngle;
    // Pheromone trust collapses as the colony starves: old trails stop being
    // evidence, and the search broadens instead.
    const famine = this.famine;
    const trailTrust = 1 - 0.92 * famine;
    const noveltyEvery = famine > 0.25 ? 10 : 24;
    const wanderCoeff = this.config.wanderStrength * (1 + 1.9 * famine);

    const nestX = this.nest.x;
    const nestY = this.nest.y;
    const nestR = this.nest.radius;

    for (let i = 0; i < this.activeCount; i++) {
      let px = this.x[i];
      let py = this.y[i];
      let ang = this.angle[i];
      const currentState = this.state[i];

      // Sample alarm at current ant position
      const localAlarm = this.sampleField(this.alarm, px, py);
      if (localAlarm > 15.0) {
        this.state[i] = AntState.ALARMED;
        this.alarmTimer[i] = 1.5;
      } else if (this.alarmTimer[i] > 0) {
        this.alarmTimer[i] -= dt;
        if (this.alarmTimer[i] <= 0 && currentState === AntState.ALARMED) {
          this.state[i] = AntState.FORAGING;
        }
      }

      // Orthokinesis & Klinokinesis: Speed boost during alarm or excitement
      let currentSpeed = baseSpeed;
      if (this.state[i] === AntState.ALARMED) {
        currentSpeed = baseSpeed * 1.85; // Evasive speed boost
      } else if (this.antennationTimer[i] > 0) {
        this.antennationTimer[i] -= dt;
        currentSpeed = baseSpeed * 1.4; // Excitement boost from antennation
      }

      // Bilateral Antenna Sensing tips
      const sensors = computeAntennaPositions(px, py, ang, antDistance, antAngle);

      // Check line of sight so chemical cannot be sensed through walls
      const losL = lineOfSight(px, py, sensors.lx, sensors.ly, isWallFn, cs);
      const losC = lineOfSight(px, py, sensors.cx, sensors.cy, isWallFn, cs);
      const losR = lineOfSight(px, py, sensors.rx, sensors.ry, isWallFn, cs);

      // Select target chemical field based on ant state
      let activeField = this.foodTrail;
      if (currentState === AntState.RETURNING) {
        activeField = this.homeGuide;
      }

      const rawL = losL ? this.sampleField(activeField, sensors.lx, sensors.ly) : 0;
      const rawC = losC ? this.sampleField(activeField, sensors.cx, sensors.cy) : 0;
      const rawR = losR ? this.sampleField(activeField, sensors.rx, sensors.ry) : 0;

      // Weber-Fechner sensory response S = ln(1 + C)
      const sLeft = weberFechner(rawL) * trailTrust;
      const sCenter = weberFechner(rawC) * trailTrust;
      const sRight = weberFechner(rawR) * trailTrust;
      const sumStimulus = sLeft + sCenter + sRight;

      let steeringDelta = 0;

      // Natural Organic Exploration Wander:
      // With no trail to follow, scouting ants sweep on smooth correlated arcs
      // and bias away from ground the colony has already combed through, which
      // is what pushes discovery out toward the far clusters.
      if (sumStimulus < 0.02) {
        this.wanderVelocity[i] =
          this.wanderVelocity[i] * 0.88 + (Math.random() - 0.5) * wanderCoeff * 0.38;

        if (currentState === AntState.FORAGING && this.stepCounter % noveltyEvery === i % noveltyEvery) {
          let bestNovelty = -1;
          let bestAng = ang;
          const probe = 72 + 54 * famine; // starving scouts look further out
          for (let k = -1; k <= 1; k++) {
            const a = ang + k * 0.72;
            const rx = px + Math.cos(a) * probe;
            const ry = py + Math.sin(a) * probe;
            const gx2 = Math.floor(rx / cs);
            const gy2 = Math.floor(ry / cs);
            if (gx2 < 0 || gx2 >= this.gridWidth || gy2 < 0 || gy2 >= this.gridHeight) continue;
            const nIdx = gy2 * this.gridWidth + gx2;
            if (this.wallGrid[nIdx] === 1) continue;
            const novelty = 1 / (1 + (this.simTime - this.lastVisitGrid[nIdx]) * 0.55);
            if (novelty > bestNovelty) {
              bestNovelty = novelty;
              bestAng = a;
            }
          }
          let d = bestAng - ang;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          steeringDelta += d * (0.12 + 0.2 * famine);
        }
      } else {
        this.wanderVelocity[i] *= 0.6;
      }
      const wander = this.wanderVelocity[i] * (this.state[i] === AntState.ALARMED ? 2.5 : 1.0);

      // ── Route choice: five-ray fan ──────────────────────────────────
      // Ants commit to the corridor that carries the most pheromone *and* lies
      // closest to their heading, which is how a colony settles on the shortest
      // well-travelled route instead of oscillating between equal branches.
      let fanWeight = 0;
      if (sumStimulus > 0.015) {
        let bestScore = 0;
        let bestOffset = 0;
        for (let k = -2; k <= 2; k++) {
          const rayAng = ang + k * antAngle * 0.9;
          const reach = antDistance * 1.7;
          const rx = px + Math.cos(rayAng) * reach;
          const ry = py + Math.sin(rayAng) * reach;
          if (!lineOfSight(px, py, rx, ry, isWallFn, cs)) continue;
          const conc = weberFechner(this.sampleField(activeField, rx, ry)) * trailTrust;
          // Alignment penalty: a branch two sectors off must be clearly stronger.
          const score = conc / (1.0 + 0.5 * Math.abs(k));
          if (score > bestScore) {
            bestScore = score;
            bestOffset = k;
          }
        }
        if (bestScore > 0.02) {
          steeringDelta += bestOffset * 0.19 * Math.min(1.6, sensitivity);
          fanWeight = Math.min(1, bestScore * 2.2);
        }
      }

      // Local tropotaxis for fine trail following
      steeringDelta +=
        computeTropotaxisSteering(sLeft, sCenter, sRight, wander, sensitivity) * (1 - 0.7 * fanWeight);

      // Foragers on a trail: slight outward alignment away from nest to keep them rushing towards food
      if (currentState === AntState.FORAGING && sumStimulus > 0.04) {
        const toNestDx = px - nestX;
        const toNestDy = py - nestY;
        const awayAng = Math.atan2(toNestDy, toNestDx);
        let angDiff = awayAng - ang;
        while (angDiff > Math.PI) angDiff -= Math.PI * 2;
        while (angDiff < -Math.PI) angDiff += Math.PI * 2;
        steeringDelta += angDiff * 0.06;
      }

      // Starving colony: keep scouts radiating outward instead of orbiting the
      // nest on a guide that now leads to an empty vault.
      if (currentState === AntState.FORAGING && famine > 0.2) {
        const awayAng = Math.atan2(py - nestY, px - nestX);
        let angDiff = awayAng - ang;
        while (angDiff > Math.PI) angDiff -= Math.PI * 2;
        while (angDiff < -Math.PI) angDiff += Math.PI * 2;
        steeringDelta += angDiff * (0.05 + 0.1 * famine);
      }

      // Proactive Whisker Obstacle Avoidance:
      // Steers ants around walls and corners before impact
      // ── Direct lock-on ──────────────────────────────────────────────
      // With a clear line of sight to the goal, an ant stops dithering and
      // homes in: foragers onto the nearest visible cluster, carriers onto
      // the nest. Wall-following overrides this (see below).
      if (currentState === AntState.RETURNING) {
        const losNest = lineOfSight(px, py, nestX, nestY, isWallFn, cs);
        if (losNest) {
          const a = Math.atan2(nestY - py, nestX - px);
          let d = a - ang;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          steeringDelta += d * 0.22;
        }
      } else {
        let best: { d: number; a: number } | null = null;
        for (let f = 0; f < this.foodClusters.length; f++) {
          const c = this.foodClusters[f];
          if (c.currentAmount <= 0) continue;
          const d = Math.hypot(c.x - px, c.y - py);
          if (d > 300) continue;
          if (best && d >= best.d) continue;
          if (!lineOfSight(px, py, c.x, c.y, isWallFn, cs)) continue;
          best = { d, a: Math.atan2(c.y - py, c.x - px) };
        }
        if (best) {
          let d = best.a - ang;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          steeringDelta += d * 0.16;
        }
      }

      // Layered whiskers: near/mid/far so ants start turning early and never
      // press into a corner ("پشت دیوارها گیر نکنند").
      for (const [reach, spread, gain] of [
        [antRadius + 9, 0.46, 0.55],
        [antRadius + 17, 0.62, 0.35],
        [antRadius + 26, 0.78, 0.2],
      ] as [number, number, number][]) {
        const torque = computeWhiskerAvoidance(px, py, ang, reach, spread, isWallFn, cs);
        if (torque !== 0) steeringDelta += torque * gain;
      }

      // Path Integration & Dead Reckoning for RETURNING ants
      if (currentState === AntState.RETURNING) {
        // Compute homeward heading vector
        const toNestDx = nestX - px;
        const toNestDy = nestY - py;
        const nestDist = Math.hypot(toNestDx, toNestDy);
        const homeAngle = Math.atan2(toNestDy, toNestDx);

        let angleDiff = homeAngle - ang;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        // Blend Path Integration with sensed Home Guide pheromones
        const chemicalConfidence = Math.min(1.0, sumStimulus * 0.45);
        const piWeight = Math.max(0.3, 1.0 - chemicalConfidence);
        const steerHome = angleDiff * 0.14 * piWeight;

        steeringDelta += steerHome;

        // Food Delivery Check at Nest
        if (nestDist < nestR) {
          // Deliver nutrient
          this.state[i] = AntState.FORAGING;
          this.pathLen[i] = 0;
          this.homeDx[i] = 0;
          this.homeDy[i] = 0;
          ang += Math.PI; // Turn back towards foraging grounds

          this.nest.storedFood++;
          this.nest.spawnAccumulator++;
          this.nest.deliveryPulse = 1.0;

          if (this.onFoodDelivered) this.onFoodDelivered();

          // Every 3 stored food spawns 1 new ant at the nest
          if (this.nest.spawnAccumulator >= 3) {
            this.nest.spawnAccumulator = 0;
            if (this.activeCount < this.config.maxPopulation) {
              const spawnAngle = Math.random() * Math.PI * 2;
              this.spawnAnt(nestX + Math.cos(spawnAngle) * 12, nestY + Math.sin(spawnAngle) * 12, spawnAngle);
              if (this.onAntSpawned) this.onAntSpawned();
            } else if (this.onColonyCapacity) {
              this.onColonyCapacity();
            }
          }
        }
      } else if (currentState === AntState.FORAGING) {
        // Check contact with food clusters
        for (let f = 0; f < this.foodClusters.length; f++) {
          const cluster = this.foodClusters[f];
          if (cluster.currentAmount <= 0) continue;

          const fdx = cluster.x - px;
          const fdy = cluster.y - py;
          const fDist = Math.hypot(fdx, fdy);

          if (fDist < cluster.radius + antRadius) {
            // Harvest food crystal unit!
            cluster.currentAmount--;
            this.state[i] = AntState.RETURNING;
            this.pathLen[i] = 0; // fresh leg: potency starts at maximum
            ang += Math.PI; // Turn back towards nest

            // Stamp a bright food-scent beacon at the source so the return
            // trail is unambiguous for the rest of the colony.
            this.stampScent(this.foodTrail, px, py, 5, 62);

            // Burst of emerald sparks
            this.emitHarvestSparks(px, py);
            if (this.onFoodHarvested) this.onFoodHarvested(px, py);
            break;
          }
        }
      }

      // If alarmed, add repulsive klinokinesis turning away from alarm
      if (this.state[i] === AntState.ALARMED) {
        const alL = this.sampleField(this.alarm, sensors.lx, sensors.ly);
        const alR = this.sampleField(this.alarm, sensors.rx, sensors.ry);
        if (alL > alR) {
          steeringDelta += 0.35; // Turn right away from danger
        } else if (alR > alL) {
          steeringDelta -= 0.35; // Turn left
        } else {
          steeringDelta += (Math.random() - 0.5) * 0.8;
        }
      }

      // Apply steering
      ang += steeringDelta;

      // Integrate velocity
      const nvx = Math.cos(ang) * currentSpeed;
      const nvy = Math.sin(ang) * currentSpeed;

      px += nvx;
      py += nvy;

      // Update leg animation phase based on distance traveled
      this.legPhase[i] = (this.legPhase[i] + currentSpeed * 0.45) % 8;

      // World boundary clamping
      const worldMargin = 12;
      if (px < worldMargin) {
        px = worldMargin;
        ang = Math.PI - ang;
      } else if (px > this.config.worldWidth - worldMargin) {
        px = this.config.worldWidth - worldMargin;
        ang = Math.PI - ang;
      }
      if (py < worldMargin) {
        py = worldMargin;
        ang = -ang;
      } else if (py > this.config.worldHeight - worldMargin) {
        py = this.config.worldHeight - worldMargin;
        ang = -ang;
      }

      // ── Wall contouring ─────────────────────────────────────────────
      // When a wall interrupts the heading, the ant does not press into it:
      // it picks a side, aligns with the contour and glides along it until the
      // way ahead is clear, then resumes its errand. A stalled contour flips
      // sides, which is the clean corner escape.
      const col = resolveWallCollision(px, py, antRadius, isWallFn, cs);
      if (col.collided) {
        px = col.x;
        py = col.y;
        if (this.wallMode[i] === 0 && this.wallCooldown[i] <= 0) {
          // Choose the side that continues closest to the current errand.
          const tanL = Math.atan2(col.normalX, -col.normalY);
          const tanR = Math.atan2(-col.normalX, col.normalY);
          let dL = tanL - ang;
          let dR = tanR - ang;
          while (dL > Math.PI) dL -= Math.PI * 2;
          while (dL < -Math.PI) dL += Math.PI * 2;
          while (dR > Math.PI) dR -= Math.PI * 2;
          while (dR < -Math.PI) dR += Math.PI * 2;
          this.wallMode[i] = Math.abs(dL) <= Math.abs(dR) ? 1 : -1;
        }
      }

      if (this.wallMode[i] !== 0) {
        // Probe the contour tangent and hug it, keeping a small inward bias so
        // the ant follows the silhouette instead of drifting away.
        const probeDist = antRadius + 12;
        const leftAng = ang - this.wallMode[i] * 0.42;
        const freeLeft = !isWallFn(
          Math.floor((px + Math.cos(leftAng) * probeDist) / cs),
          Math.floor((py + Math.sin(leftAng) * probeDist) / cs)
        );
        if (freeLeft) {
          // Way ahead is open again — resume the errand smoothly.
          this.wallMode[i] = 0;
          this.wallCooldown[i] = 0.25;
        } else {
          ang += this.wallMode[i] * 0.16;
          // Keep the ant in contact with the wall while contouring.
          const hug = resolveWallCollision(px, py, antRadius + 2.5, isWallFn, cs);
          if (hug.collided) {
            px = hug.x;
            py = hug.y;
          }
        }
      }

      if (this.wallCooldown[i] > 0) this.wallCooldown[i] -= dt;

      // Active Stuck Detector & Recovery:
      // Guarantees ants never remain trapped in corners or dead-ends
      if (this.stepCounter % 12 === 0) {
        const movedDist = Math.hypot(px - this.lastSampleX[i], py - this.lastSampleY[i]);
        if (movedDist < 3.0) {
          this.stuckTimer[i] += dt * 12;
          if (this.stuckTimer[i] > 0.18) {
            // Trapped in a corner or against a long wall: choose the most open
            // of 16 headings (clearance-weighted) and step into it, so an ant
            // can never remain pinned.
            let bestAng = ang + Math.PI;
            let bestClear = -1;
            for (let c = 0; c < 16; c++) {
              const a = (c / 16) * Math.PI * 2;
              let clear = 0;
              for (let d = 6; d <= 38; d += 8) {
                const tx = px + Math.cos(a) * d;
                const ty = py + Math.sin(a) * d;
                const gx2 = Math.floor(tx / cs);
                const gy2 = Math.floor(ty / cs);
                if (gx2 < 0 || gx2 >= this.gridWidth || gy2 < 0 || gy2 >= this.gridHeight) break;
                if (this.wallGrid[gy2 * this.gridWidth + gx2] === 1) break;
                clear += d;
              }
              // prefer openings that loosely continue the ant's errand
              const align = Math.cos(a - ang) * 4;
              if (clear + align > bestClear) {
                bestClear = clear + align;
                bestAng = a;
              }
            }
            // If we were contouring, reverse the contour first: that alone
            // clears most concave pockets without any teleport.
            if (this.wallMode[i] !== 0) {
              this.wallMode[i] = this.wallMode[i] === 1 ? -1 : 1;
              this.wallCooldown[i] = 0.45;
              ang += Math.PI * 0.5 * this.wallMode[i];
            } else {
              ang = bestAng;
            }
            px += Math.cos(ang) * 4.5;
            py += Math.sin(ang) * 4.5;
            this.stuckTimer[i] = 0;
            this.lastSampleX[i] = px;
            this.lastSampleY[i] = py;
          }
        } else {
          this.stuckTimer[i] = 0;
        }
        this.lastSampleX[i] = px;
        this.lastSampleY[i] = py;
      }

      // ── Continuous, route-weighted deposition ───────────────────────
      // Trails are stamped along the segment travelled since the last tick, so
      // they read as an unbroken filament rather than a dotted line. Potency
      // falls with the distance already walked on this leg, which is what makes
      // the colony prefer — and visibly brighten — the shortest route.
      this.pheromoneTimer[i] -= dt;
      const isReturning = this.state[i] === AntState.RETURNING;

      if (this.pheromoneTimer[i] <= 0) {
        this.pheromoneTimer[i] = isReturning ? 0.032 : 0.075;

        const depField = isReturning ? this.foodTrail : this.homeGuide;
        const efficiency = 1 / (1 + this.pathLen[i] / 900); // 1 → strong, decays with distance
        const vigour = 0.18 + 0.82 * efficiency;
        const baseStr = (isReturning ? 62.0 : 20.0) * (0.55 + 0.45 * efficiency);

        const steps = Math.max(
          1,
          Math.ceil(
            Math.hypot(px - this.prevX[i], py - this.prevY[i]) / (cs * 0.9)
          )
        );
        for (let sIdx = 1; sIdx <= steps; sIdx++) {
          const t = sIdx / steps;
          const sx = this.prevX[i] + (px - this.prevX[i]) * t;
          const sy = this.prevY[i] + (py - this.prevY[i]) * t;
          this.depositScent(depField, sx, sy, baseStr, isReturning, vigour);
        }

        // Bright micro-sparkles riding the returning highways
        if (isReturning && Math.random() < 0.16 && this.sparks.length < 90) {
          this.sparks.push({
            x: px + (Math.random() - 0.5) * 6,
            y: py + (Math.random() - 0.5) * 6,
            vx: (Math.random() - 0.5) * 0.8,
            vy: (Math.random() - 0.5) * 0.8,
            color: '#00e676',
            life: 1.0,
            maxLife: 0.32,
            size: 1.5,
          });
        }
      }

      // Remember where we were, for next tick's trail interpolation.
      this.prevX[i] = px;
      this.prevY[i] = py;
      this.pathLen[i] += currentSpeed * dt;

      // Social Information Transfer (Antennation) via Spatial Hash Grid
      if (currentState === AntState.FORAGING && this.stepCounter % 3 === 0) {
        const hs = this.hashCellSize;
        const hgx = Math.max(0, Math.min(this.hashCols - 1, Math.floor(px / hs)));
        const hgy = Math.max(0, Math.min(this.hashRows - 1, Math.floor(py / hs)));

        // Check current cell and neighboring cells
        for (let ny = Math.max(0, hgy - 1); ny <= Math.min(this.hashRows - 1, hgy + 1); ny++) {
          for (let nx = Math.max(0, hgx - 1); nx <= Math.min(this.hashCols - 1, hgx + 1); nx++) {
            let neighborIdx = this.hashHead[ny * this.hashCols + nx];
            while (neighborIdx !== -1) {
              if (neighborIdx !== i && this.state[neighborIdx] === AntState.RETURNING) {
                const ndx = this.x[neighborIdx] - px;
                const ndy = this.y[neighborIdx] - py;
                const distSq = ndx * ndx + ndy * ndy;

                if (distSq < 16 * 16) {
                  // Direct antennation contact!
                  this.antennationTimer[i] = 0.8; // Excitement boost
                  // Steer towards returning ant's origin direction
                  ang = (ang + (this.angle[neighborIdx] + Math.PI)) * 0.5;
                  break;
                }
              }
              neighborIdx = this.hashNext[neighborIdx];
            }
          }
        }
      }

      // Commit state back to arrays
      this.x[i] = px;
      this.y[i] = py;
      this.angle[i] = ang;
      this.vx[i] = Math.cos(ang) * currentSpeed;
      this.vy[i] = Math.sin(ang) * currentSpeed;
    }
  }

  public emitHarvestSparks(x: number, y: number) {
    if (this.sparks.length > 80) return; // Particle cap for mobile budget
    const count = 6;
    for (let k = 0; k < count; k++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 1.0 + Math.random() * 3.5;
      this.sparks.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        color: '#00e676',
        life: 1.0,
        maxLife: 0.4 + Math.random() * 0.3,
        size: 2.0 + Math.random() * 2.0,
      });
    }
  }

  private updateParticles(dt: number) {
    // Update sparks
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const p = this.sparks[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.life -= dt / p.maxLife;

      if (p.life <= 0) {
        this.sparks.splice(i, 1);
      }
    }

    // Update ambient spore motes
    const W = this.config.worldWidth;
    const H = this.config.worldHeight;
    for (let i = 0; i < this.motes.length; i++) {
      const m = this.motes[i];
      m.x += m.vx;
      m.y += m.vy;
      m.phase += dt * m.pulseSpeed;

      if (m.x < 0) m.x = W;
      if (m.x > W) m.x = 0;
      if (m.y < 0) m.y = H;
      if (m.y > H) m.y = 0;
    }
  }

  public paintWallAt(x: number, y: number, radius: number) {
    this.paintWallCircle(x, y, radius);

    // Safely eject any ants trapped inside the new wall to nearest open cell
    const cs = this.config.cellSize;
    const isWallFn = (gx: number, gy: number) => {
      if (gx < 0 || gx >= this.gridWidth || gy < 0 || gy >= this.gridHeight) return true;
      return this.wallGrid[gy * this.gridWidth + gx] === 1;
    };

    for (let i = 0; i < this.activeCount; i++) {
      const col = resolveWallCollision(this.x[i], this.y[i], 6, isWallFn, cs);
      if (col.collided) {
        this.x[i] = col.x;
        this.y[i] = col.y;
      }
    }
  }

  public eraseAt(x: number, y: number, radius: number) {
    // Never erase the Nest
    const nestDist = Math.hypot(x - this.nest.x, y - this.nest.y);
    if (nestDist < this.nest.radius + radius) {
      this.nest.deliveryPulse = 0.5; // Pulse to indicate protected
    }

    const cs = this.config.cellSize;
    const minGx = Math.max(0, Math.floor((x - radius) / cs));
    const maxGx = Math.min(this.gridWidth - 1, Math.floor((x + radius) / cs));
    const minGy = Math.max(0, Math.floor((y - radius) / cs));
    const maxGy = Math.min(this.gridHeight - 1, Math.floor((y + radius) / cs));
    const rSq = radius * radius;

    let clearedWall = false;

    for (let gy = minGy; gy <= maxGy; gy++) {
      const cy = gy * cs + cs * 0.5;
      const dy = cy - y;
      const yOffset = gy * this.gridWidth;

      for (let gx = minGx; gx <= maxGx; gx++) {
        const cx = gx * cs + cs * 0.5;
        const dx = cx - x;
        if (dx * dx + dy * dy <= rSq) {
          const idx = yOffset + gx;
          this.foodTrail[idx] = 0;
          this.homeGuide[idx] = 0;
          this.alarm[idx] = 0;
          if (this.wallGrid[idx] === 1) {
            this.wallGrid[idx] = 0;
            clearedWall = true;
          }
        }
      }
    }

    if (clearedWall) {
      this.wallDirty = true;
    }

    // Also remove any food cluster centers within radius
    for (let f = this.foodClusters.length - 1; f >= 0; f--) {
      const cl = this.foodClusters[f];
      const d = Math.hypot(x - cl.x, y - cl.y);
      if (d < radius + cl.radius * 0.5) {
        this.foodClusters.splice(f, 1);
      }
    }
  }

  public addFoodCluster(x: number, y: number) {
    // Don't spawn on top of nest
    if (Math.hypot(x - this.nest.x, y - this.nest.y) < this.nest.radius + 30) return;

    this.foodClusters.push({
      id: Date.now() + Math.random(),
      x,
      y,
      radius: 36 + Math.random() * 12,
      initialAmount: 400,
      currentAmount: 400,
      variant: Math.floor(Math.random() * 6),
      pulsePhase: Math.random() * Math.PI * 2,
    });
  }
}
