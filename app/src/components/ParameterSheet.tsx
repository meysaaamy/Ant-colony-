import React, { useState } from 'react';
import type { PresetType, SimulationConfig } from '../sim/types';
import {
  AntGlyph,
  CloseIcon,
  CompassIcon,
  EraserIcon,
  FoodClusterIcon,
  LayersIcon,
  SoundIcon,
  WaveIcon,
  ResetArrowIcon,
  SparkleSweepIcon,
} from './icons';
import { GlassSlider } from './GlassSlider';

type TabId = 'presets' | 'colony' | 'pheromones' | 'world';

export interface ParameterSheetProps {
  snap: 'peek' | 'half' | 'full';
  config: SimulationConfig;
  activePreset: PresetType;
  soundOn: boolean;
  onClose: () => void;
  onLoadPreset: (p: PresetType) => void;
  onUpdateConfig: (patch: Partial<SimulationConfig>) => void;
  onResetTab: (tab: Exclude<TabId, 'presets'>) => void;
  onClearTrails: () => void;
  onResetWorld: () => void;
  onToggleSound: () => void;
}

const TABS: { id: TabId; label: string; Icon: React.FC<{ size?: number }> }[] = [
  { id: 'presets', label: 'Presets', Icon: LayersIcon },
  { id: 'colony', label: 'Colony', Icon: AntGlyph },
  { id: 'pheromones', label: 'Scent', Icon: WaveIcon },
  { id: 'world', label: 'World', Icon: CompassIcon },
];

const PRESETS: {
  id: PresetType;
  name: string;
  desc: string;
  Icon: React.FC<{ size?: number }>;
}[] = [
  {
    id: 'sanctuary',
    name: 'Open Sanctuary',
    desc: 'Three emerald groves, unobstructed meadow.',
    Icon: FoodClusterIcon,
  },
  {
    id: 'double_bridge',
    name: 'Double Bridge',
    desc: "Deneubourg's bifurcated bridge — short vs long path.",
    Icon: CompassIcon,
  },
  {
    id: 'labyrinth',
    name: 'Subterranean Labyrinth',
    desc: 'Choked basalt caves guarding two deep vaults.',
    Icon: EraserIcon,
  },
];

export const PRESET_TITLES: Record<PresetType, string> = {
  sanctuary: 'Open Sanctuary',
  double_bridge: 'Double Bridge',
  labyrinth: 'Subterranean Labyrinth',
};

export const ParameterSheet: React.FC<ParameterSheetProps> = ({
  snap,
  config,
  activePreset,
  soundOn,
  onClose,
  onLoadPreset,
  onUpdateConfig,
  onResetTab,
  onClearTrails,
  onResetWorld,
  onToggleSound,
}) => {
  const [tab, setTab] = useState<TabId>('presets');

  return (
    <div className="sheet-panel glass-deep" data-snap={snap} aria-hidden={snap === 'peek'}>
      <div className="sheet-scroll">
        <div className="sheet-head">
          <span className="sheet-title">Simulation parameters</span>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Collapse parameters">
            <CloseIcon size={14} />
          </button>
        </div>

        <div className="tabs" role="tablist">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              className="tab"
              data-active={tab === id}
              aria-selected={tab === id}
              onClick={() => setTab(id)}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>

        {tab === 'presets' && (
          <div>
            <div className="preset-list">
              {PRESETS.map(({ id, name, desc, Icon }) => (
                <button
                  key={id}
                  type="button"
                  className="preset-card"
                  data-active={activePreset === id}
                  onClick={() => onLoadPreset(id)}
                >
                  <span className="pc-icon" aria-hidden>
                    <Icon size={18} />
                  </span>
                  <span>
                    <span className="pc-name">{name}</span>
                    <span className="pc-desc">{desc}</span>
                  </span>
                </button>
              ))}
            </div>
            <div className="sheet-actions">
              <button type="button" className="pill-btn" onClick={onClearTrails}>
                <SparkleSweepIcon size={15} /> Clear trails
              </button>
              <button type="button" className="pill-btn" onClick={onResetWorld}>
                <ResetArrowIcon size={15} /> Reset world
              </button>
            </div>
          </div>
        )}

        {tab === 'colony' && (
          <div className="param-group">
            <GlassSlider
              label="Colony capacity"
              value={config.maxPopulation}
              min={60}
              max={1600}
              step={20}
              defaultValue={600}
              onChange={(v) => onUpdateConfig({ maxPopulation: v })}
              format={(v) => `${v} ants`}
              hint="Hard ceiling on live agents; spawns stop at the cap."
            />
            <GlassSlider
              label="Walking speed"
              value={config.antBaseSpeed}
              min={1.2}
              max={4}
              step={0.1}
              defaultValue={2.4}
              onChange={(v) => onUpdateConfig({ antBaseSpeed: v })}
              format={(v) => `${v.toFixed(1)} u/f`}
            />
            <GlassSlider
              label="Antenna angle"
              value={config.antennaAngle}
              min={0.25}
              max={1.1}
              step={0.01}
              defaultValue={0.61}
              onChange={(v) => onUpdateConfig({ antennaAngle: v })}
              format={(v) => `${Math.round((v * 180) / Math.PI)}°`}
              hint="Bilateral sampling cone for tropotaxis steering."
            />
            <GlassSlider
              label="Trail sensitivity"
              value={config.trailSensitivity}
              min={0.4}
              max={3}
              step={0.05}
              defaultValue={1.25}
              onChange={(v) => onUpdateConfig({ trailSensitivity: v })}
              format={(v) => `${v.toFixed(2)} α`}
            />
            <GlassSlider
              label="Wander strength"
              value={config.wanderStrength}
              min={0.05}
              max={0.8}
              step={0.01}
              defaultValue={0.28}
              onChange={(v) => onUpdateConfig({ wanderStrength: v })}
              format={(v) => v.toFixed(2)}
            />
            <button type="button" className="reset-tab" onClick={() => onResetTab('colony')}>
              <ResetArrowIcon size={12} /> Restore colony defaults
            </button>
          </div>
        )}

        {tab === 'pheromones' && (
          <div className="param-group">
            <GlassSlider
              label="Evaporation λ"
              value={config.evaporationRate}
              min={0.004}
              max={0.06}
              step={0.002}
              defaultValue={0.016}
              onChange={(v) => onUpdateConfig({ evaporationRate: v })}
              format={(v) => v.toFixed(3)}
              hint="Frame-rate independent exponential decay per second."
            />
            <GlassSlider
              label="Diffusion"
              value={config.diffusionRate}
              min={0.02}
              max={0.22}
              step={0.005}
              defaultValue={0.12}
              onChange={(v) => onUpdateConfig({ diffusionRate: v })}
              format={(v) => v.toFixed(3)}
              hint="CFL-stable 3×3 Laplacian spread across the grid."
            />
            <GlassSlider
              label="Alarm dissipation"
              value={config.alarmEvapMultiplier}
              min={1.5}
              max={6}
              step={0.1}
              defaultValue={3.5}
              onChange={(v) => onUpdateConfig({ alarmEvapMultiplier: v })}
              format={(v) => `${v.toFixed(1)}×`}
            />
            <div className="param">
              <div className="param-head">
                <span className="param-label">Render mode</span>
              </div>
              <div className="segmented">
                <button
                  type="button"
                  data-active={config.pheromoneRenderMode === 'glow'}
                  onClick={() => onUpdateConfig({ pheromoneRenderMode: 'glow' })}
                >
                  Bioluminescent glow
                </button>
                <button
                  type="button"
                  data-active={config.pheromoneRenderMode === 'fog'}
                  onClick={() => onUpdateConfig({ pheromoneRenderMode: 'fog' })}
                >
                  Dense vapour
                </button>
              </div>
            </div>
            <button type="button" className="reset-tab" onClick={() => onResetTab('pheromones')}>
              <ResetArrowIcon size={12} /> Restore scent defaults
            </button>
          </div>
        )}

        {tab === 'world' && (
          <div className="param-group">
            <GlassSlider
              label="Brush radius"
              value={config.brushRadius}
              min={10}
              max={80}
              step={1}
              defaultValue={26}
              onChange={(v) => onUpdateConfig({ brushRadius: v })}
              format={(v) => `${v} u`}
            />
            <GlassSlider
              label="Deposition intensity"
              value={config.brushIntensity}
              min={10}
              max={100}
              step={5}
              defaultValue={45}
              onChange={(v) => onUpdateConfig({ brushIntensity: v })}
              format={(v) => `${v}%`}
            />
            <div className="param">
              <div className="param-head">
                <span className="param-label">Time scale</span>
              </div>
              <div className="segmented">
                {([1, 2, 4] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    data-active={config.timeScale === s}
                    onClick={() => onUpdateConfig({ timeScale: s })}
                  >
                    {s}×
                  </button>
                ))}
              </div>
            </div>
            <div className="param">
              <div className="param-head">
                <span className="param-label">Colony soundscape</span>
                <button
                  type="button"
                  className="pill-btn"
                  data-armed={soundOn}
                  onClick={onToggleSound}
                  aria-pressed={soundOn}
                >
                  <SoundIcon size={14} muted={!soundOn} />
                  {soundOn ? 'On' : 'Off'}
                </button>
              </div>
              <div className="param-hint">
                Generative chimes on harvest and delivery — no external audio files.
              </div>
            </div>
            <button type="button" className="reset-tab" onClick={() => onResetTab('world')}>
              <ResetArrowIcon size={12} /> Restore world defaults
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
