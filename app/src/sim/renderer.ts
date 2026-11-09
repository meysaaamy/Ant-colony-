import { blendScent } from './palette';
import { SimulationEngine } from './engine';
import { AntState, ToolType, StrokePoint } from './types';
import { computePheromoneAlpha } from './math';

export class SimulationRenderer {
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;

  // Offscreen cached layers
  private terrainCanvas: HTMLCanvasElement;
  private terrainCtx: CanvasRenderingContext2D;

  private pheromoneCanvas: HTMLCanvasElement;
  private pheromoneCtx: CanvasRenderingContext2D;
  private pheromoneImageData: ImageData;

  private bloomCanvas: HTMLCanvasElement;
  private bloomCtx: CanvasRenderingContext2D;

  private antSpriteCanvas: HTMLCanvasElement;
  private antSpriteCtx: CanvasRenderingContext2D;

  // Food cluster pre-rendered variants (8 variants)
  private crystalSprites: HTMLCanvasElement[] = [];

  // Look-Up Tables (LUTs) 256 entries x 3 (R, G, B)
  private foodTrailLUT: Uint8ClampedArray;
  private homeGuideLUT: Uint8ClampedArray;
  private alarmLUT: Uint8ClampedArray;

  // Sprite dimensions
  private readonly SPRITE_FRAME_SIZE = 36;
  private readonly SPRITE_FRAMES = 8;

  // Custom background image support (optional macro backdrop)
  public customBackground: HTMLImageElement | null = null;

  // Touch choreography state
  private wasDown = false;
  private rippleStart = 0;
  private rippleX = 0;
  private rippleY = 0;

  constructor(canvas: HTMLCanvasElement, engine: SimulationEngine) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Could not get 2D context');
    this.ctx = ctx;

    // 1. Terrain Cache Canvas (matches world resolution)
    this.terrainCanvas = document.createElement('canvas');
    this.terrainCanvas.width = engine.config.worldWidth;
    this.terrainCanvas.height = engine.config.worldHeight;
    this.terrainCtx = this.terrainCanvas.getContext('2d')!;

    // 2. Pheromone Offscreen Canvas (matches grid resolution)
    this.pheromoneCanvas = document.createElement('canvas');
    this.pheromoneCanvas.width = engine.gridWidth;
    this.pheromoneCanvas.height = engine.gridHeight;
    this.pheromoneCtx = this.pheromoneCanvas.getContext('2d', { willReadFrequently: true })!;
    this.pheromoneImageData = this.pheromoneCtx.createImageData(engine.gridWidth, engine.gridHeight);

    // 3. Bloom Canvas (1/4 resolution for lightweight bilinear glow)
    this.bloomCanvas = document.createElement('canvas');
    this.bloomCanvas.width = Math.floor(engine.gridWidth / 2);
    this.bloomCanvas.height = Math.floor(engine.gridHeight / 2);
    this.bloomCtx = this.bloomCanvas.getContext('2d')!;

    // 4. Precompute 256-entry RGB Color Look-Up Tables
    this.foodTrailLUT = this.buildFoodTrailLUT();
    this.homeGuideLUT = this.buildHomeGuideLUT();
    this.alarmLUT = this.buildAlarmLUT();

    // 5. Pre-render Ant Sprite Sheet (8 frames x 3 states)
    this.antSpriteCanvas = document.createElement('canvas');
    this.antSpriteCanvas.width = this.SPRITE_FRAME_SIZE * this.SPRITE_FRAMES;
    this.antSpriteCanvas.height = this.SPRITE_FRAME_SIZE * 3; // 3 states: Normal, Carrying, Alarmed
    this.antSpriteCtx = this.antSpriteCanvas.getContext('2d')!;
    this.bakeAntSpriteSheet();

    // 6. Pre-render faceted glowing crystal cluster variants
    this.bakeCrystalSprites();

    // 7. Initial Terrain Bake
    this.bakeTerrain(engine);
  }

  /**
   * Precomputed Look-Up Tables (LUTs) with non-linear gamma curves
   */
  private buildFoodTrailLUT(): Uint8ClampedArray {
    // Highly saturated radiant amber-gold to white-hot molten core:
    // Low: Neon Warm Amber (#ff7700) -> Mid: Radiant Gold (#ffbe1a) -> High: White-Hot Sunlight (#fff7d6)
    const lut = new Uint8ClampedArray(256 * 3);
    for (let i = 0; i < 256; i++) {
      const t = i / 255;
      const idx = i * 3;
      if (t < 0.3) {
        // Warm incandescent amber
        const u = t / 0.3;
        lut[idx] = Math.round(180 + 75 * u);
        lut[idx + 1] = Math.round(60 + 80 * u);
        lut[idx + 2] = Math.round(5 * u);
      } else if (t < 0.72) {
        // Vibrant solar gold
        const u = (t - 0.3) / 0.42;
        lut[idx] = 255;
        lut[idx + 1] = Math.round(140 + 75 * u);
        lut[idx + 2] = Math.round(5 + 50 * u);
      } else {
        // Luminous white-hot core
        const u = (t - 0.72) / 0.28;
        lut[idx] = 255;
        lut[idx + 1] = Math.round(215 + 40 * u);
        lut[idx + 2] = Math.round(55 + 200 * u);
      }
    }
    return lut;
  }

  private buildHomeGuideLUT(): Uint8ClampedArray {
    // Saturated Celestial Sapphire -> Electric Cyan (#00f5ff) -> Hyper-White Cyan (#e0ffff)
    const lut = new Uint8ClampedArray(256 * 3);
    for (let i = 0; i < 256; i++) {
      const t = i / 255;
      const idx = i * 3;
      if (t < 0.35) {
        const u = t / 0.35;
        lut[idx] = Math.round(10 * u);
        lut[idx + 1] = Math.round(75 + 75 * u);
        lut[idx + 2] = Math.round(160 + 95 * u);
      } else if (t < 0.75) {
        const u = (t - 0.35) / 0.4;
        lut[idx] = Math.round(10 + 60 * u);
        lut[idx + 1] = Math.round(150 + 95 * u);
        lut[idx + 2] = 255;
      } else {
        const u = (t - 0.75) / 0.25;
        lut[idx] = Math.round(70 + 185 * u);
        lut[idx + 1] = 245 + Math.round(10 * u);
        lut[idx + 2] = 255;
      }
    }
    return lut;
  }

  private buildAlarmLUT(): Uint8ClampedArray {
    // Crimson Pulse (#ff0a43) -> Bright Coral Red
    const lut = new Uint8ClampedArray(256 * 3);
    for (let i = 0; i < 256; i++) {
      const t = i / 255;
      const idx = i * 3;
      lut[idx] = Math.round(255 * Math.pow(t, 0.7));
      lut[idx + 1] = Math.round(10 + 60 * t);
      lut[idx + 2] = Math.round(67 + 50 * t);
    }
    return lut;
  }

  /**
   * Pre-render offscreen sprite sheet: 8 articulated leg frames x 3 states
   */
  private bakeAntSpriteSheet() {
    const size = this.SPRITE_FRAME_SIZE;
    const half = size / 2;
    const ctx = this.antSpriteCtx;

    ctx.clearRect(0, 0, this.antSpriteCanvas.width, this.antSpriteCanvas.height);

    for (let state = 0; state < 3; state++) {
      for (let frame = 0; frame < this.SPRITE_FRAMES; frame++) {
        const ox = frame * size + half;
        const oy = state * size + half;
        const phase = (frame / this.SPRITE_FRAMES) * Math.PI * 2;

        ctx.save();
        ctx.translate(ox, oy);

        // Body colors
        const cuticleDark = '#0e141e';
        const cuticleHighlight = state === 2 ? '#ff2a5a' : '#2d3f58';
        const rimColor = state === 2 ? 'rgba(255, 10, 67, 0.7)' : 'rgba(255, 255, 255, 0.35)';

        // 1. Articulated Legs (3 pairs)
        ctx.strokeStyle = state === 2 ? '#942238' : '#334155';
        ctx.lineWidth = 1.3;
        ctx.lineCap = 'round';

        for (let pair = 0; pair < 3; pair++) {
          const legOffset = (pair - 1) * 3.5;
          const legPhaseOffset = phase + pair * (Math.PI * 0.6);

          // Left leg (jointed 2-segment)
          const leftSwing = Math.sin(legPhaseOffset) * 4.5;
          ctx.beginPath();
          ctx.moveTo(legOffset, -1.5);
          ctx.lineTo(legOffset - 3.5, -6 - leftSwing * 0.4);
          ctx.lineTo(legOffset - 6 + leftSwing, -10.5);
          ctx.stroke();

          // Right leg (jointed 2-segment, alternating phase)
          const rightSwing = Math.sin(legPhaseOffset + Math.PI) * 4.5;
          ctx.beginPath();
          ctx.moveTo(legOffset, 1.5);
          ctx.lineTo(legOffset - 3.5, 6 + rightSwing * 0.4);
          ctx.lineTo(legOffset - 6 + rightSwing, 10.5);
          ctx.stroke();
        }

        // 2. Gaster (Abdomen with subtle banding)
        ctx.fillStyle = cuticleDark;
        ctx.beginPath();
        ctx.ellipse(-6.5, 0, 5.5, 3.8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Gaster rim/specular sheen
        ctx.strokeStyle = rimColor;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.ellipse(-6.5, 0, 5.5, 3.8, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Gaster bands
        ctx.strokeStyle = cuticleHighlight;
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.arc(-7, 0, 3, -Math.PI * 0.4, Math.PI * 0.4);
        ctx.stroke();

        // 3. Thorax (Mesosoma)
        ctx.fillStyle = '#151f2e';
        ctx.beginPath();
        ctx.ellipse(-0.5, 0, 3.6, 2.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = rimColor;
        ctx.lineWidth = 0.7;
        ctx.stroke();

        // 4. Head with Mandibles
        ctx.fillStyle = cuticleDark;
        ctx.beginPath();
        ctx.ellipse(4.8, 0, 3.2, 2.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = rimColor;
        ctx.lineWidth = 0.7;
        ctx.stroke();

        // 5. Elbowed Antennae
        ctx.strokeStyle = state === 2 ? '#ff2a5a' : '#64748b';
        ctx.lineWidth = 1.0;
        // Left antenna
        ctx.beginPath();
        ctx.moveTo(6.5, -1.2);
        ctx.lineTo(9.5, -4.5);
        ctx.lineTo(13.5, -3.2);
        ctx.stroke();
        // Right antenna
        ctx.beginPath();
        ctx.moveTo(6.5, 1.2);
        ctx.lineTo(9.5, 4.5);
        ctx.lineTo(13.5, 3.2);
        ctx.stroke();

        // 6. Food Crystal in Mandibles (State 1: Carrying)
        if (state === 1) {
          ctx.fillStyle = '#00e676';
          ctx.shadowColor = '#00e676';
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.moveTo(7.5, -2.5);
          ctx.lineTo(11.5, 0);
          ctx.lineTo(7.5, 2.5);
          ctx.lineTo(5.5, 0);
          ctx.closePath();
          ctx.fill();
          ctx.shadowBlur = 0;
        }

        ctx.restore();
      }
    }
  }

  /**
   * Pre-render faceted emerald crystal clusters
   */
  private bakeCrystalSprites() {
    this.crystalSprites = [];
    const size = 96;
    const half = size / 2;

    for (let v = 0; v < 8; v++) {
      const c = document.createElement('canvas');
      c.width = size;
      c.height = size;
      const ctx = c.getContext('2d')!;

      // Outer radial glow
      const glowGrad = ctx.createRadialGradient(half, half, 4, half, half, half);
      glowGrad.addColorStop(0, 'rgba(0, 230, 118, 0.45)');
      glowGrad.addColorStop(0.5, 'rgba(0, 230, 118, 0.15)');
      glowGrad.addColorStop(1, 'rgba(0, 230, 118, 0)');
      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, 0, size, size);

      // Faceted crystals
      const crystalCount = 5 + (v % 4);
      for (let i = 0; i < crystalCount; i++) {
        const ang = (i / crystalCount) * Math.PI * 2 + (v * 0.4);
        const len = 12 + (i % 3) * 8;
        const width = 6 + (i % 2) * 3;

        ctx.save();
        ctx.translate(half, half);
        ctx.rotate(ang);

        // Core facet
        ctx.fillStyle = i % 2 === 0 ? '#00e676' : '#69f0ae';
        ctx.beginPath();
        ctx.moveTo(0, -width * 0.5);
        ctx.lineTo(len, 0);
        ctx.lineTo(0, width * 0.5);
        ctx.lineTo(-3, 0);
        ctx.closePath();
        ctx.fill();

        // Inner refraction streak
        ctx.strokeStyle = '#e8f5e9';
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(len * 0.85, 0);
        ctx.stroke();

        ctx.restore();
      }

      this.crystalSprites.push(c);
    }
  }

  /**
   * Static Terrain Cache Canvas:
   * Substrate texture, coordinate reticles, beveled basalt walls with #26354d rim
   */
  public bakeTerrain(engine: SimulationEngine) {
    const W = engine.config.worldWidth;
    const H = engine.config.worldHeight;
    const ctx = this.terrainCtx;

    // 1. Deep Abyssal Substrate background (#03050a)
    ctx.fillStyle = '#03050a';
    ctx.fillRect(0, 0, W, H);

    // If custom background plate provided (e.g. from Gemini generation), render graded into substrate
    if (this.customBackground && this.customBackground.complete) {
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.drawImage(this.customBackground, 0, 0, W, H);
      ctx.restore();
    }

    // Micro-texture procedural organic noise grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
    ctx.lineWidth = 1;
    const step = 48;
    for (let x = 0; x < W; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y < H; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // Faint scientific coordinate reticles and edge ticks
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.06)';
    ctx.lineWidth = 1.2;
    for (let x = 96; x < W; x += 192) {
      for (let y = 96; y < H; y += 192) {
        ctx.beginPath();
        ctx.moveTo(x - 6, y);
        ctx.lineTo(x + 6, y);
        ctx.moveTo(x, y - 6);
        ctx.lineTo(x, y + 6);
        ctx.stroke();
      }
    }

    // 2. Basalt-Obsidian Rock Walls (#101622) with rim lighting (#26354d)
    const cs = engine.config.cellSize;
    const gW = engine.gridWidth;
    const gH = engine.gridHeight;
    const walls = engine.wallGrid;

    // Ambient occlusion halo under walls
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    for (let gy = 0; gy < gH; gy++) {
      for (let gx = 0; gx < gW; gx++) {
        if (walls[gy * gW + gx] === 1) {
          ctx.fillRect(gx * cs - 4, gy * cs - 4, cs + 8, cs + 8);
        }
      }
    }

    // Core Basalt Wall
    ctx.fillStyle = '#101622';
    for (let gy = 0; gy < gH; gy++) {
      for (let gx = 0; gx < gW; gx++) {
        if (walls[gy * gW + gx] === 1) {
          ctx.fillRect(gx * cs, gy * cs, cs, cs);
        }
      }
    }

    // Crisp Rim Lighting (#26354d) on wall contours
    ctx.strokeStyle = '#26354d';
    ctx.lineWidth = 1.5;
    for (let gy = 0; gy < gH; gy++) {
      for (let gx = 0; gx < gW; gx++) {
        const idx = gy * gW + gx;
        if (walls[idx] === 1) {
          // Check neighbors
          const upEmpty = gy > 0 && walls[(gy - 1) * gW + gx] === 0;
          const leftEmpty = gx > 0 && walls[gy * gW + (gx - 1)] === 0;
          const rightEmpty = gx < gW - 1 && walls[gy * gW + (gx + 1)] === 0;
          const downEmpty = gy < gH - 1 && walls[(gy + 1) * gW + gx] === 0;

          if (upEmpty) {
            ctx.beginPath();
            ctx.moveTo(gx * cs, gy * cs);
            ctx.lineTo((gx + 1) * cs, gy * cs);
            ctx.stroke();
          }
          if (leftEmpty) {
            ctx.beginPath();
            ctx.moveTo(gx * cs, gy * cs);
            ctx.lineTo(gx * cs, (gy + 1) * cs);
            ctx.stroke();
          }
          if (rightEmpty) {
            ctx.beginPath();
            ctx.moveTo((gx + 1) * cs, gy * cs);
            ctx.lineTo((gx + 1) * cs, (gy + 1) * cs);
            ctx.stroke();
          }
          if (downEmpty) {
            ctx.beginPath();
            ctx.moveTo(gx * cs, (gy + 1) * cs);
            ctx.lineTo((gx + 1) * cs, (gy + 1) * cs);
            ctx.stroke();
          }
        }
      }
    }

    engine.wallDirty = false;
  }

  /**
   * Main multi-layer composite render
   */
  public render(
    engine: SimulationEngine,
    activeTool: ToolType,
    pointerState: {
      isDown: boolean;
      x: number;
      y: number;
      strokePoints: StrokePoint[];
      strokeStartTime?: number;
      now?: number;
    }
  ) {
    const W = engine.config.worldWidth;
    const H = engine.config.worldHeight;
    const ctx = this.ctx;

    // Refresh static terrain cache if walls modified
    if (engine.wallDirty) {
      this.bakeTerrain(engine);
    }

    // Set high-quality canvas transform
    ctx.save();

    // 1. Draw Static Terrain Cache
    ctx.drawImage(this.terrainCanvas, 0, 0);

    // 2. Render Pheromone Offscreen Canvas using Point-by-Point Green + Blue Proportional Blending
    this.renderPheromoneLayer(engine);

    const isFog = engine.config.pheromoneRenderMode === 'fog';

    if (isFog) {
      // Fog mode: source-over blending gives dense opaque vapor coverage at high concentrations
      ctx.globalCompositeOperation = 'source-over';
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(this.pheromoneCanvas, 0, 0, W, H);

      // Subtle atmospheric boundary halo
      this.bloomCtx.drawImage(this.pheromoneCanvas, 0, 0, this.bloomCanvas.width, this.bloomCanvas.height);
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.35;
      ctx.drawImage(this.bloomCanvas, 0, 0, W, H);
      ctx.globalAlpha = 1.0;
      ctx.globalCompositeOperation = 'source-over';
    } else {
      // Glow mode: screen blending + lighter bloom for bioluminescent luminescence
      ctx.globalCompositeOperation = 'screen';
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(this.pheromoneCanvas, 0, 0, W, H);

      // Composite secondary 1/4 bloom layer with 'lighter' blending for deep glow
      this.bloomCtx.drawImage(this.pheromoneCanvas, 0, 0, this.bloomCanvas.width, this.bloomCanvas.height);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.5;
      ctx.drawImage(this.bloomCanvas, 0, 0, W, H);
      ctx.globalAlpha = 1.0;
      ctx.globalCompositeOperation = 'source-over';
    }

    // 3. Render Food Crystal Clusters
    this.renderFoodClusters(engine);

    // 4. Render The Nest
    this.renderNest(engine);

    // 5. Render Ants using fast rotated drawImage from Sprite Sheet
    this.renderAnts(engine);

    // 6. Render Ambient Spore Motes
    this.renderMotes(engine);

    // 7. Render Sparks
    this.renderSparks(engine);

    // 8. Render Active Stroke & Brush Ribbon
    this.renderActiveStroke(engine, activeTool, pointerState);

    // 9. Soft Vignette Overlay
    this.renderVignette(W, H);

    ctx.restore();
  }

  /**
   * Point-by-point Chromatic Blending of Green (Food Trail) and Blue (Home Guide)
   * with Alarm (Red) and Traffic-governed Luminance Scaling:
   * 
   * - Food Trail: Vivid Emerald/Spring Green (#00e676)
   * - Home Guide: Radiant Electric/Sapphire Blue (#0088ff)
   * - Alarm: Vivid Crimson (#ff0a43)
   * - Overlap: Proportional mixture w_ft vs w_hg creates dynamic Cyan/Turquoise/Aquamarine
   * - Traffic Luminance: Intensity and core overexposure directly scale with ant traffic
   */
  private renderPheromoneLayer(engine: SimulationEngine) {
    const data = this.pheromoneImageData.data;
    const count = engine.totalCells;

    const ft = engine.foodTrail;
    const hg = engine.homeGuide;
    const al = engine.alarm;
    const isFog = engine.config.pheromoneRenderMode === 'fog';

    for (let i = 0; i < count; i++) {
      const idx4 = i * 4;

      const v_ft = ft[i];
      const v_hg = hg[i];
      const v_al = al[i];

      const sum = v_ft + v_hg + v_al;
      if (sum < 0.25) {
        data[idx4] = 0;
        data[idx4 + 1] = 0;
        data[idx4 + 2] = 0;
        data[idx4 + 3] = 0;
        continue;
      }

      // Point-by-point chromatic blend (shared with the unit tests).
      const c = blendScent(v_ft, v_hg, v_al, isFog);
      const r = c.r;
      const g = c.g;
      const b = c.b;
      const a = computePheromoneAlpha(Math.min(255, c.a), isFog ? 'fog' : 'glow');

      data[idx4] = r;
      data[idx4 + 1] = g;
      data[idx4 + 2] = b;
      data[idx4 + 3] = a;
    }

    this.pheromoneCtx.putImageData(this.pheromoneImageData, 0, 0);
  }

  private renderFoodClusters(engine: SimulationEngine) {
    const ctx = this.ctx;
    for (let i = 0; i < engine.foodClusters.length; i++) {
      const c = engine.foodClusters[i];
      if (c.currentAmount <= 0) continue;

      const frac = c.currentAmount / c.initialAmount;
      const r = c.radius * (0.6 + frac * 0.4);
      const sprite = this.crystalSprites[c.variant % this.crystalSprites.length];

      ctx.save();
      ctx.translate(c.x, c.y);

      // Breathing glow
      const breathe = Math.sin(c.pulsePhase) * 0.15 + 0.85;
      const size = r * 2.6 * breathe;

      ctx.drawImage(sprite, -size / 2, -size / 2, size, size);

      // Specular glint
      if (Math.sin(c.pulsePhase * 3.0) > 0.92) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(r * 0.25, -r * 0.25, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  private renderNest(engine: SimulationEngine) {
    const ctx = this.ctx;
    const nest = engine.nest;
    const nx = nest.x;
    const ny = nest.y;
    const nr = nest.radius;

    ctx.save();
    ctx.translate(nx, ny);

    // Outer crater gradient
    const craterGrad = ctx.createRadialGradient(0, 0, nr * 0.2, 0, 0, nr * 1.5);
    craterGrad.addColorStop(0, '#04070e');
    craterGrad.addColorStop(0.6, '#0b111e');
    craterGrad.addColorStop(1, 'rgba(11, 17, 30, 0)');
    ctx.fillStyle = craterGrad;
    ctx.beginPath();
    ctx.arc(0, 0, nr * 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Concentric amber and cyan rings with slow heartbeat pulse
    const heartbeat = 1.0 + nest.pulseAnim * 0.08 + nest.deliveryPulse * 0.25;

    // Cyan outer orientation ring
    ctx.strokeStyle = `rgba(0, 240, 255, ${0.45 + nest.deliveryPulse * 0.5})`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, 0, nr * 0.95 * heartbeat, 0, Math.PI * 2);
    ctx.stroke();

    // Amber inner trail ring
    ctx.strokeStyle = `rgba(255, 174, 0, ${0.65 + nest.deliveryPulse * 0.35})`;
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.arc(0, 0, nr * 0.7 * heartbeat, 0, Math.PI * 2);
    ctx.stroke();

    // Center Abyssal Pit
    ctx.fillStyle = '#020306';
    ctx.beginPath();
    ctx.arc(0, 0, nr * 0.42, 0, Math.PI * 2);
    ctx.fill();

    // Spawning progress arc (0/3 to 3/3 stored food units)
    const spawnFrac = (nest.spawnAccumulator % 3) / 3.0;
    if (spawnFrac > 0) {
      ctx.strokeStyle = '#00e676';
      ctx.lineWidth = 3.0;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, nr * 1.08, -Math.PI * 0.5, -Math.PI * 0.5 + spawnFrac * Math.PI * 2);
      ctx.stroke();
    }

    // Delivery pulse flash ring
    if (nest.deliveryPulse > 0) {
      ctx.strokeStyle = `rgba(0, 230, 118, ${nest.deliveryPulse})`;
      ctx.lineWidth = 3.0 * nest.deliveryPulse;
      ctx.beginPath();
      ctx.arc(0, 0, nr * (1.1 + (1.0 - nest.deliveryPulse) * 0.6), 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  private renderAnts(engine: SimulationEngine) {
    const ctx = this.ctx;
    const count = engine.activeCount;
    const size = this.SPRITE_FRAME_SIZE;
    const half = size / 2;
    const spriteSheet = this.antSpriteCanvas;

    const xs = engine.x;
    const ys = engine.y;
    const angles = engine.angle;
    const states = engine.state;
    const legPhases = engine.legPhase;

    for (let i = 0; i < count; i++) {
      const state = states[i];
      const frame = Math.floor(legPhases[i]) % this.SPRITE_FRAMES;
      const srcX = frame * size;
      const srcY = state * size;

      ctx.save();
      ctx.translate(xs[i], ys[i]);

      // Radiant underglow halo for returning and alarmed ants
      if (state === 1) {
        // Returning food carrier: glowing emerald-cyan aura
        ctx.fillStyle = 'rgba(0, 230, 118, 0.28)';
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();
      } else if (state === 2) {
        // Alarmed: crimson warning pulse
        ctx.fillStyle = 'rgba(255, 10, 67, 0.28)';
        ctx.beginPath();
        ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.rotate(angles[i]);
      ctx.drawImage(spriteSheet, srcX, srcY, size, size, -half, -half, size, size);

      ctx.restore();
    }
  }

  private renderMotes(engine: SimulationEngine) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    for (let i = 0; i < engine.motes.length; i++) {
      const m = engine.motes[i];
      const alpha = m.alpha * (Math.sin(m.phase) * 0.35 + 0.65);
      ctx.fillStyle = `rgba(0, 240, 255, ${alpha})`;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private renderSparks(engine: SimulationEngine) {
    const ctx = this.ctx;
    ctx.save();
    for (let i = 0; i < engine.sparks.length; i++) {
      const p = engine.sparks[i];
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private renderActiveStroke(
    engine: SimulationEngine,
    tool: ToolType,
    pointerState: {
      isDown: boolean;
      x: number;
      y: number;
      strokePoints: StrokePoint[];
      strokeStartTime?: number;
      now?: number;
    }
  ) {
    const ctx = this.ctx;
    const r = engine.config.brushRadius;
    const now = pointerState.now ?? performance.now();
    const TAU = Math.PI * 2;

    // Tool light profile — accent + white-hot core (matches the UI triad)
    const LIGHT: Record<ToolType, { accent: string; rgb: string; core: string }> = {
      food_trail: { accent: '#ffae00', rgb: '255, 174, 0', core: '#fff3b0' },
      home_trail: { accent: '#00f0ff', rgb: '0, 240, 255', core: '#e0ffff' },
      alarm: { accent: '#ff0a43', rgb: '255, 10, 67', core: '#ffd1dc' },
      food_cluster: { accent: '#00e676', rgb: '0, 230, 118', core: '#b9f6ca' },
      wall: { accent: '#94a3b8', rgb: '148, 163, 184', core: '#e2e8f0' },
      eraser: { accent: '#cbd5e1', rgb: '203, 213, 225', core: '#ffffff' },
    };
    const light = LIGHT[tool] ?? LIGHT.food_trail;

    // ── 1. Initial-contact ripple ──────────────────────────────────────
    if (pointerState.isDown && !this.wasDown) {
      this.rippleStart = now;
      this.rippleX = pointerState.x;
      this.rippleY = pointerState.y;
    }
    this.wasDown = pointerState.isDown;

    if (this.rippleStart > 0) {
      const age = (now - this.rippleStart) / 1000;
      if (age < 0.6) {
        const t = Math.min(1, age / 0.6);
        const eased = 1 - Math.pow(1 - t, 3);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(${light.rgb}, ${0.5 * (1 - t)})`;
        ctx.lineWidth = 2.6 * (1 - t) + 0.5;
        ctx.beginPath();
        ctx.arc(this.rippleX, this.rippleY, r * (0.5 + 1.25 * eased), 0, TAU);
        ctx.stroke();
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.28 * (1 - t)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(this.rippleX, this.rippleY, r * (0.5 + 1.05 * eased), 0, TAU);
        ctx.stroke();
        ctx.restore();
      } else {
        this.rippleStart = 0;
      }
    }

    // ── 2. Tapered dual-core luminous ribbon ───────────────────────────
    const pts = pointerState.strokePoints;
    if (pointerState.isDown && pts.length > 1) {
      const n = pts.length;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalCompositeOperation = 'lighter';

      const passes = [
        { w: r * 1.05, color: light.rgb, alpha: 0.1 },
        { w: r * 0.62, color: light.rgb, alpha: 0.2 },
        { w: r * 0.28, color: light.rgb, alpha: 0.34 },
        { w: Math.max(2, r * 0.13), color: '255, 255, 255', alpha: 0.5 },
      ];

      for (const pass of passes) {
        for (let i = 1; i < n; i++) {
          const t = i / (n - 1); // 0 → tail, 1 → finger
          const w = pass.w * (0.35 + 0.65 * t);
          ctx.strokeStyle = `rgba(${pass.color}, ${pass.alpha * (0.35 + 0.65 * t)})`;
          ctx.lineWidth = w;
          ctx.beginPath();
          ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
          ctx.lineTo(pts[i].x, pts[i].y);
          ctx.stroke();
        }
      }

      // specular core filament in the tool's incandescent colour
      ctx.strokeStyle = light.core;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = Math.max(1, r * 0.05);
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < n; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
      ctx.restore();
    }

    // ── 3. Live brush boundary ─────────────────────────────────────────
    if (pointerState.x >= 0 && pointerState.y >= 0) {
      ctx.save();
      ctx.translate(pointerState.x, pointerState.y);

      if (tool === 'eraser') {
        // rotating dashed ring + dissolve shimmer
        const spin = (now / 42) % 26;
        ctx.setLineDash([6, 6]);
        ctx.lineDashOffset = -spin;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, TAU);
        ctx.stroke();

        ctx.setLineDash([2, 9]);
        ctx.lineDashOffset = spin * 1.7;
        ctx.strokeStyle = 'rgba(203, 213, 225, 0.45)';
        ctx.lineWidth = 3.4;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.82, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);

        // shimmering dissolve sweep
        const sweep = (now / 620) % 1;
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.55, sweep * TAU, sweep * TAU + 1.1);
        ctx.stroke();
      } else {
        // luminous solid ring with atmospheric halo
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(${light.rgb}, 0.14)`;
        ctx.lineWidth = pointerState.isDown ? 7 : 5;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, TAU);
        ctx.stroke();

        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = light.accent;
        ctx.globalAlpha = pointerState.isDown ? 0.95 : 0.7;
        ctx.lineWidth = pointerState.isDown ? 2 : 1.4;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, TAU);
        ctx.stroke();

        // precision crosshair ticks
        ctx.globalAlpha = 0.55;
        ctx.strokeStyle = light.core;
        ctx.lineWidth = 1;
        for (let k = 0; k < 4; k++) {
          const a = k * (Math.PI / 2);
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * (r - 5), Math.sin(a) * (r - 5));
          ctx.lineTo(Math.cos(a) * (r + 3), Math.sin(a) * (r + 3));
          ctx.stroke();
        }

        ctx.fillStyle = light.core;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(0, 0, 2.2, 0, TAU);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  private renderVignette(w: number, h: number) {
    const ctx = this.ctx;
    const vigGrad = ctx.createRadialGradient(w * 0.5, h * 0.5, Math.min(w, h) * 0.45, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
    vigGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vigGrad.addColorStop(1, 'rgba(1, 2, 5, 0.75)');
    ctx.fillStyle = vigGrad;
    ctx.fillRect(0, 0, w, h);
  }
}
