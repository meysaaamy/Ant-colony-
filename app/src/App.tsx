import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SimulationEngine } from './sim/engine';
import { SimulationRenderer } from './sim/renderer';
import { interpolateStroke } from './sim/math';
import type { PresetType, SimulationConfig, StrokePoint, ToolType } from './sim/types';
import { BioSoundscape } from './audio/soundscape';

import { TopHud } from './components/TopHud';
import { Cockpit } from './components/Cockpit';
import { ParameterSheet, PRESET_TITLES } from './components/ParameterSheet';
import { Landing, ChallengeBanner, type PlayMode } from './components/Landing';
import { FieldGuideModal } from './components/FieldGuideModal';
import { toolById } from './components/icons';

type Snap = 'peek' | 'half' | 'full';

const DEFAULT_CONFIG = new SimulationEngine().config;
const BRUSH_RADIUS_DEFAULT = 26;

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<SimulationEngine | null>(null);
  const rendererRef = useRef<SimulationRenderer | null>(null);
  const soundRef = useRef<BioSoundscape | null>(null);

  /* frame loop bookkeeping */
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);
  const accumulatorRef = useRef(0);
  const frameTimesRef = useRef<number[]>([]);
  const lastHudRef = useRef(0);

  /* pointer / stroke */
  const pointerIdRef = useRef<number | null>(null);
  const isDownRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const strokePointsRef = useRef<StrokePoint[]>([]);
  const strokeStartRef = useRef(0);
  const chromeTimerRef = useRef<number | null>(null);

  /* live values mirrored for the rAF closure */
  const toolRef = useRef<ToolType>('food_trail');
  const pausedRef = useRef(false);
  const speedRef = useRef<1 | 2 | 4>(1);

  const [activeTool, setActiveTool] = useState<ToolType>('food_trail');
  const [config, setConfig] = useState<SimulationConfig>({ ...DEFAULT_CONFIG });
  const [snap, setSnap] = useState<Snap>('peek');
  const [guideOpen, setGuideOpen] = useState(false);
  const [chromeFaded, setChromeFaded] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [soundOn, setSoundOn] = useState(false);
  const [onboarded, setOnboarded] = useState<boolean>(() => {
    try {
      return localStorage.getItem('myrmecodia.onboarded') === '1';
    } catch {
      return false;
    }
  });
  const [screen, setScreen] = useState<'landing' | 'play'>('landing');
  const [mode, setMode] = useState<PlayMode>('sandbox');
  const [challengeLeft, setChallengeLeft] = useState(180);
  const [challengeBase, setChallengeBase] = useState(0);
  const [bestSandbox, setBestSandbox] = useState(0);
  const [bestChallenge, setBestChallenge] = useState(0);
  const [telemetry, setTelemetry] = useState({
    antCount: 160,
    foodCount: 0,
    fps: 60,
    isPaused: false,
    simSpeed: 1 as 1 | 2 | 4,
    preset: 'double_bridge' as PresetType,
  });

  const tool = toolById(activeTool);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((prev) => (prev === message ? null : prev)), 2200);
  }, []);

  /* ── engine + renderer bootstrap ─────────────────────────────────────── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    /* Size the simulation world to the device aspect so the cover-fit camera
       never crops the nest or the nutrient groves on tall phones.

       The world is deliberately larger than before: the camera therefore sits
       further back, the colony reads as one living plate of colour from a
       distance, and the blue/green lattice stays legible as a fine RGB mesh
       rather than a few fat smears. Ant sprites, brush and trail widths are
       world-space, so they scale with the frame and keep their proportions. */
    const viewportAspect = window.innerWidth / Math.max(1, window.innerHeight);
    const worldHeight = 1720;
    const worldWidth = Math.round(
      Math.max(560, Math.min(1080, worldHeight * viewportAspect))
    );

    const engine = new SimulationEngine({
      worldWidth,
      worldHeight,
      brushRadius: Math.round(BRUSH_RADIUS_DEFAULT * 1.19),
      maxPopulation: 600,
    });
    engine.loadPreset('double_bridge');
    engineRef.current = engine;
    setConfig({ ...engine.config });

    const renderer = new SimulationRenderer(canvas, engine);
    rendererRef.current = renderer;

    const sound = new BioSoundscape();
    sound.setMuted(true);
    soundRef.current = sound;

    engine.onFoodHarvested = () => sound.playHarvestChime();
    engine.onFoodDelivered = () => sound.playDeliveryChime();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const scale = Math.max(
        (w * dpr) / engine.config.worldWidth,
        (h * dpr) / engine.config.worldHeight
      );
      const offsetX = (w * dpr - engine.config.worldWidth * scale) / 2;
      const offsetY = (h * dpr - engine.config.worldHeight * scale) / 2;
      ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    };

    resize();
    let resizeTimer: number | null = null;
    const onResize = () => {
      if (resizeTimer) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(resize, 120);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);

    const onVisibility = () => {
      lastTimeRef.current = 0;
      accumulatorRef.current = 0;
    };
    document.addEventListener('visibilitychange', onVisibility);

    const fixedDt = 1 / 60;
    const loop = (now: number) => {
      rafRef.current = requestAnimationFrame(loop);
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = now;
        return;
      }
      const frameMs = Math.min(100, now - lastTimeRef.current);
      lastTimeRef.current = now;

      frameTimesRef.current.push(frameMs);
      if (frameTimesRef.current.length > 30) frameTimesRef.current.shift();

      const avg =
        frameTimesRef.current.reduce((a, b) => a + b, 0) /
        (frameTimesRef.current.length || 1);
      engine.qualityThrottleDiffusion = avg > 20;
      if (rendererRef.current) rendererRef.current.throttlePheromonePaint = avg > 20;

      if (!pausedRef.current) {
        accumulatorRef.current += (frameMs / 1000) * speedRef.current;
        accumulatorRef.current = Math.min(
          accumulatorRef.current,
          fixedDt * 4 * speedRef.current
        );
        while (accumulatorRef.current >= fixedDt) {
          engine.step(fixedDt);
          accumulatorRef.current -= fixedDt;
        }
      }

      const last = lastPointRef.current;
      rendererRef.current?.render(engine, toolRef.current, {
        isDown: isDownRef.current,
        x: last ? last.x : -200,
        y: last ? last.y : -200,
        strokePoints: strokePointsRef.current,
        strokeStartTime: strokeStartRef.current,
        now,
      });

      if (now - lastHudRef.current > 110) {
        lastHudRef.current = now;
        const fps = Math.max(1, Math.min(120, Math.round(1000 / Math.max(8.3, avg))));
        setTelemetry((prev) => ({
          ...prev,
          fps,
          antCount: engine.activeCount,
          foodCount: Math.floor(engine.nest.storedFood),
          preset: engine.activePreset,
        }));
      }
    };

    lastTimeRef.current = performance.now();
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (resizeTimer) window.clearTimeout(resizeTimer);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  /* ── pointer ↔ world mapping ─────────────────────────────────────────── */
  const clientToWorld = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const engine = engineRef.current;
    if (!canvas || !engine) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const px = (clientX - rect.left) * dpr;
    const py = (clientY - rect.top) * dpr;
    const scale = Math.max(
      (rect.width * dpr) / engine.config.worldWidth,
      (rect.height * dpr) / engine.config.worldHeight
    );
    const offsetX = (rect.width * dpr - engine.config.worldWidth * scale) / 2;
    const offsetY = (rect.height * dpr - engine.config.worldHeight * scale) / 2;
    return {
      x: Math.max(0, Math.min(engine.config.worldWidth, (px - offsetX) / scale)),
      y: Math.max(0, Math.min(engine.config.worldHeight, (py - offsetY) / scale)),
    };
  }, []);

  const applyBrush = useCallback((wx: number, wy: number) => {
    const engine = engineRef.current;
    if (!engine) return;
    const r = engine.config.brushRadius;
    const intensity = engine.config.brushIntensity;
    switch (toolRef.current) {
      case 'food_trail':
        engine.depositPheromone(engine.foodTrail, wx, wy, r, intensity);
        break;
      case 'home_trail':
        engine.depositPheromone(engine.homeGuide, wx, wy, r, intensity);
        break;
      case 'alarm':
        engine.depositPheromone(engine.alarm, wx, wy, r, intensity * 1.6);
        break;
      case 'food_cluster':
        engine.addFoodCluster(wx, wy);
        break;
      case 'wall':
        engine.paintWallAt(wx, wy, r);
        break;
      case 'eraser':
        engine.eraseAt(wx, wy, r);
        break;
      default:
        break;
    }
    soundRef.current?.playStrokeHum(toolRef.current);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (pointerIdRef.current !== null && pointerIdRef.current !== e.pointerId) return;
    pointerIdRef.current = e.pointerId;
    isDownRef.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);

    /* auto-dimming painting focus */
    if (chromeTimerRef.current) window.clearTimeout(chromeTimerRef.current);
    setChromeFaded(true);

    soundRef.current?.resume();

    if (!onboarded) {
      setOnboarded(true);
      try {
        localStorage.setItem('myrmecodia.onboarded', '1');
      } catch {
        /* private mode */
      }
    }

    const { x, y } = clientToWorld(e.clientX, e.clientY);
    lastPointRef.current = { x, y };
    strokeStartRef.current = performance.now();
    strokePointsRef.current = [{ x, y, time: performance.now() }];
    applyBrush(x, y);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, y } = clientToWorld(e.clientX, e.clientY);
    if (!isDownRef.current || pointerIdRef.current !== e.pointerId) {
      lastPointRef.current = { x, y };
      return;
    }
    const last = lastPointRef.current;
    if (last) {
      const step = Math.max(4, (engineRef.current?.config.brushRadius ?? 32) * 0.22);
      for (const pt of interpolateStroke(last.x, last.y, x, y, step)) {
        applyBrush(pt.x, pt.y);
      }
    }
    lastPointRef.current = { x, y };
    strokePointsRef.current.push({ x, y, time: performance.now() });
    if (strokePointsRef.current.length > 28) strokePointsRef.current.shift();
  };

  const endStroke = () => {
    isDownRef.current = false;
    pointerIdRef.current = null;
    strokePointsRef.current = [];
    if (chromeTimerRef.current) window.clearTimeout(chromeTimerRef.current);
    chromeTimerRef.current = window.setTimeout(() => setChromeFaded(false), 200);
  };

  /* ── controls ────────────────────────────────────────────────────────── */
  const handleUpdateConfig = useCallback((patch: Partial<SimulationConfig>) => {
    if (engineRef.current) Object.assign(engineRef.current.config, patch);
    if (patch.timeScale) speedRef.current = patch.timeScale;
    setConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  const cycleSpeed = useCallback(() => {
    const next: 1 | 2 | 4 = speedRef.current === 1 ? 2 : speedRef.current === 2 ? 4 : 1;
    handleUpdateConfig({ timeScale: next });
    setTelemetry((prev) => ({ ...prev, simSpeed: next }));
  }, [handleUpdateConfig]);

  const togglePause = useCallback(() => {
    pausedRef.current = !pausedRef.current;
    setTelemetry((prev) => ({ ...prev, isPaused: pausedRef.current }));
    showToast(pausedRef.current ? 'Simulation paused' : 'Simulation resumed');
  }, [showToast]);

  const loadPreset = useCallback(
    (preset: PresetType) => {
      engineRef.current?.loadPreset(preset);
      setTelemetry((prev) => ({ ...prev, preset }));
      showToast(PRESET_TITLES[preset]);
    },
    [showToast]
  );

  // ── bests ───────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      setBestSandbox(Number(localStorage.getItem('myrmecodia.best.sandbox') || 0) || 0);
      setBestChallenge(Number(localStorage.getItem('myrmecodia.best.challenge') || 0) || 0);
    } catch {
      /* storage blocked in embedded contexts */
    }
  }, []);

  const saveBest = useCallback((m: PlayMode, value: number) => {
    if (value <= 0) return;
    try {
      const key = `myrmecodia.best.${m}`;
      const prev = Number(localStorage.getItem(key) || 0) || 0;
      if (value > prev) localStorage.setItem(key, String(value));
    } catch {
      /* ignore */
    }
    if (m === 'sandbox') setBestSandbox((v) => Math.max(v, value));
    else setBestChallenge((v) => Math.max(v, value));
  }, []);

  // ── launch a session ────────────────────────────────────────────────
  const startSession = useCallback(
    (next: PlayMode) => {
      const engine = engineRef.current;
      setMode(next);
      setScreen('play');
      engine?.loadPreset(telemetry.preset);
      if (next === 'challenge') {
        setChallengeLeft(180);
        setChallengeBase(Math.floor(engine?.nest.storedFood ?? 0));
      }
      showToast(next === 'challenge' ? '180 seconds — gather what you can' : 'Sandbox — paint as it suits you');
    },
    [showToast, telemetry.preset]
  );

  const endSession = useCallback(() => {
    const engine = engineRef.current;
    const gathered = Math.floor((engine?.nest.storedFood ?? 0) - challengeBase);
    if (mode === 'challenge') saveBest('challenge', gathered);
    setScreen('landing');
    setChallengeLeft(180);
  }, [challengeBase, mode, saveBest]);

  // ── challenge countdown ─────────────────────────────────────────────
  useEffect(() => {
    if (screen !== 'play' || mode !== 'challenge') return;
    const id = window.setInterval(() => {
      setChallengeLeft((t) => {
        if (t <= 1) {
          window.clearInterval(id);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [screen, mode]);

  useEffect(() => {
    if (screen === 'play' && mode === 'challenge' && challengeLeft === 0) {
      const engine = engineRef.current;
      const gathered = Math.floor((engine?.nest.storedFood ?? 0) - challengeBase);
      saveBest('challenge', gathered);
      showToast(`Time — ${gathered} food delivered`);
      setScreen('landing');
      setChallengeLeft(180);
    }
  }, [challengeLeft, screen, mode, challengeBase, saveBest, showToast]);

  const clearTrails = useCallback(() => {
    engineRef.current?.clearPheromones();
    showToast('Scent field cleared');
  }, [showToast]);

  const resetWorld = useCallback(() => {
    engineRef.current?.resetWorld();
    showToast('World reseeded');
  }, [showToast]);

  const resetTab = useCallback(
    (tab: 'colony' | 'pheromones' | 'world') => {
      if (tab === 'colony') {
        handleUpdateConfig({
          maxPopulation: DEFAULT_CONFIG.maxPopulation,
          antBaseSpeed: DEFAULT_CONFIG.antBaseSpeed,
          antennaAngle: DEFAULT_CONFIG.antennaAngle,
          trailSensitivity: DEFAULT_CONFIG.trailSensitivity,
          wanderStrength: DEFAULT_CONFIG.wanderStrength,
        });
      } else if (tab === 'pheromones') {
        handleUpdateConfig({
          evaporationRate: DEFAULT_CONFIG.evaporationRate,
          diffusionRate: DEFAULT_CONFIG.diffusionRate,
          alarmEvapMultiplier: DEFAULT_CONFIG.alarmEvapMultiplier,
          pheromoneRenderMode: 'glow',
        });
      } else {
        handleUpdateConfig({
          brushRadius: BRUSH_RADIUS_DEFAULT,
          brushIntensity: DEFAULT_CONFIG.brushIntensity,
          timeScale: 1,
        });
      }
      showToast('Restored defaults');
    },
    [handleUpdateConfig, showToast]
  );

  const toggleSound = useCallback(() => {
    setSoundOn((on) => {
      const next = !on;
      soundRef.current?.setMuted(!next);
      if (next) soundRef.current?.resume();
      return next;
    });
  }, []);

  const selectTool = useCallback((t: ToolType) => {
    toolRef.current = t;
    setActiveTool(t);
  }, []);

  /* sheet snap choreography */
  const tapSheet = useCallback(() => setSnap((s) => (s === 'peek' ? 'half' : 'peek')), []);
  const swipeSheet = useCallback((dir: 'up' | 'down') => {
    setSnap((s) => {
      if (dir === 'up') return s === 'peek' ? 'half' : s === 'half' ? 'full' : 'full';
      return s === 'full' ? 'half' : s === 'half' ? 'peek' : 'peek';
    });
  }, []);

  /* desktop preview affordances */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const idx = ['1', '2', '3', '4', '5', '6'].indexOf(e.key);
      if (idx >= 0) selectTool(['food_trail', 'home_trail', 'alarm', 'food_cluster', 'wall', 'eraser'][idx] as ToolType);
      if (e.key === ' ') {
        e.preventDefault();
        togglePause();
      }
      if (e.key === '[') handleUpdateConfig({ brushRadius: Math.max(10, config.brushRadius - 4) });
      if (e.key === ']') handleUpdateConfig({ brushRadius: Math.min(80, config.brushRadius + 4) });
      if (e.key === 'Escape') {
        setGuideOpen(false);
        setSnap('peek');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectTool, togglePause, handleUpdateConfig, config.brushRadius]);

  /* per-tool accent triad cascades to every luminous surface */
  const accentVars = useMemo(
    () =>
      ({
        '--accent': tool.accent,
        '--core': tool.core,
        '--halo': tool.halo,
        '--accent-soft': tool.soft,
        '--accent-line': tool.line,
      }) as React.CSSProperties,
    [tool]
  );

  return (
    <div
      className={`app${screen === 'landing' ? ' is-landing' : ''}${mode === 'challenge' && screen === 'play' ? ' is-challenge' : ''}`}
      style={accentVars}
      data-screen={screen}
    >
      <canvas
        ref={canvasRef}
        className="world"
        role="img"
        aria-label="Interactive bioluminescent ant colony scent-painting canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endStroke}
        onPointerCancel={endStroke}
        onPointerLeave={() => {
          if (!isDownRef.current) lastPointRef.current = null;
        }}
      />

      {screen === 'play' && mode === 'challenge' && (
        <ChallengeBanner
          secondsLeft={challengeLeft}
          score={Math.max(0, telemetry.foodCount - challengeBase)}
          onExit={endSession}
        />
      )}

      {screen === 'play' && (
      <div className={`chrome${chromeFaded ? ' is-dimmed' : ''}`}>
        <TopHud
          antCount={telemetry.antCount}
          foodCount={telemetry.foodCount}
          fps={telemetry.fps}
          simSpeed={telemetry.simSpeed}
          isPaused={telemetry.isPaused}
          guideOpen={guideOpen}
          paramsOpen={snap !== 'peek'}
          onTogglePause={togglePause}
          onCycleSpeed={cycleSpeed}
          onOpenGuide={() => {
            setGuideOpen(true);
            setSnap('peek');
          }}
          onOpenParams={() => setSnap((s) => (s === 'peek' ? 'half' : 'peek'))}
        />

        <div className="stack">
          <ParameterSheet
            snap={snap}
            config={config}
            activePreset={telemetry.preset}
            soundOn={soundOn}
            onClose={() => setSnap('peek')}
            onLoadPreset={loadPreset}
            onUpdateConfig={handleUpdateConfig}
            onResetTab={resetTab}
            onClearTrails={clearTrails}
            onResetWorld={resetWorld}
            onToggleSound={toggleSound}
          />
          <Cockpit
            activeTool={activeTool}
            onSelectTool={selectTool}
            presetTitle={PRESET_TITLES[telemetry.preset]}
            sheetOpen={snap !== 'peek'}
            onTapSheet={tapSheet}
            onSwipeSheet={swipeSheet}
            onClearTrails={clearTrails}
            onResetWorld={resetWorld}
            brushRadius={config.brushRadius}
            brushIntensity={config.brushIntensity}
            onChangeBrushRadius={(v) => handleUpdateConfig({ brushRadius: v })}
            onChangeBrushIntensity={(v) => handleUpdateConfig({ brushIntensity: v })}
          />
        </div>
      </div>
      )}

      {screen === 'landing' && (
        <Landing
          preset={telemetry.preset}
          onSelectPreset={(p) => {
            engineRef.current?.loadPreset(p);
            setTelemetry((prev) => ({ ...prev, preset: p }));
          }}
          onPlay={startSession}
          onOpenGuide={() => setGuideOpen(true)}
          onOpenBests={() => setGuideOpen(true)}
          antCount={telemetry.antCount}
          foodCount={telemetry.foodCount}
          bestSandbox={bestSandbox}
          bestChallenge={bestChallenge}
        />
      )}

      {screen === 'play' && !onboarded && (
        <div className="hint glass" role="status">
          <span className="dot" aria-hidden />
          <span>Paint a green trail from the nest to a crystal</span>
        </div>
      )}

      {toast && <div className="toast glass-deep" role="status">{toast}</div>}

      <FieldGuideModal
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        antCount={telemetry.antCount}
        foodCount={telemetry.foodCount}
        fps={telemetry.fps}
        presetTitle={PRESET_TITLES[telemetry.preset]}
        evaporation={config.evaporationRate}
        diffusion={config.diffusionRate}
      />
    </div>
  );
}
