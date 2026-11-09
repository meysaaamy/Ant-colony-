import React, { useEffect } from 'react';
import {
  BilateralAntennaDiagram,
  CloseIcon,
  DoubleBridgeDiagram,
  PheromoneLegendDiagram,
} from './icons';

export interface FieldGuideModalProps {
  open: boolean;
  onClose: () => void;
  antCount: number;
  foodCount: number;
  fps: number;
  presetTitle: string;
  evaporation: number;
  diffusion: number;
}

export const FieldGuideModal: React.FC<FieldGuideModalProps> = ({
  open,
  onClose,
  antCount,
  foodCount,
  fps,
  presetTitle,
  evaporation,
  diffusion,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="scrim" onClick={onClose} aria-hidden />
      <div className="modal glass-deep" role="dialog" aria-modal="true" aria-label="Field guide">
        <div className="modal-head">
          <div>
            <div className="modal-eyebrow">Field guide · no. 01</div>
            <h1 className="modal-title">Neuroethology of the scent field</h1>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close field guide">
            <CloseIcon size={15} />
          </button>
        </div>

        <div className="modal-body">
          <section className="guide-section">
            <div className="guide-h">Bilateral antenna sensing</div>
            <div className="diagram">
              <BilateralAntennaDiagram />
            </div>
            <p className="guide-p">
              Each forager sweeps two antennae across a <strong>±35°</strong> cone. The
              difference in perceived concentration between the left and right sample drives
              a <strong>tropotactic</strong> steering torque — the ant simply turns toward the
              stronger scent. Perception is compressed logarithmically (Weber–Fechner), so a
              faint trail still reads clearly against a saturated highway.
            </p>
          </section>

          <section className="guide-section">
            <div className="guide-h">Pheromone vocabulary</div>
            <div className="diagram">
              <PheromoneLegendDiagram />
            </div>
            <div className="legend">
              <div className="legend-row">
                <span className="legend-swatch" style={{ background: 'linear-gradient(90deg,#7a4f00,#ffae00,#fff3b0)', color: '#ffae00' }} />
                <span className="legend-name">Food recruitment</span>
                <span className="legend-note">amber · λ slow</span>
              </div>
              <div className="legend-row">
                <span className="legend-swatch" style={{ background: 'linear-gradient(90deg,#003b47,#00f0ff,#e0ffff)', color: '#00f0ff' }} />
                <span className="legend-name">Homeward guide</span>
                <span className="legend-note">cyan · λ slow</span>
              </div>
              <div className="legend-row">
                <span className="legend-swatch" style={{ background: 'linear-gradient(90deg,#3a0210,#ff0a43,#ffd1dc)', color: '#ff0a43' }} />
                <span className="legend-name">Alarm</span>
                <span className="legend-note">crimson · λ 3.5×</span>
              </div>
            </div>
            <p className="guide-p" style={{ marginTop: 10 }}>
              Three fields share one substrate. Overlapping amber and cyan produce aquamarine
              filaments where outbound and inbound traffic truly merge; alarm blooms shatter
              the flow and scatter foragers until the crimson decays.
            </p>
          </section>

          <section className="guide-section">
            <div className="guide-h">Deneubourg double bridge</div>
            <div className="diagram">
              <DoubleBridgeDiagram />
            </div>
            <p className="guide-p">
              Two routes of unequal length join nest and food. A purely random first cohort
              reaches the food faster on the <strong>short branch</strong>, so it deposits the
              first complete trail. That trail recruits more traffic, which deposits more
              pheromone — <strong>autocatalysis</strong> locks the colony onto the shorter path
              within a few minutes. Try painting a deliberate long-branch highway and watch the
              symmetry break in reverse.
            </p>
          </section>

          <section className="guide-section">
            <div className="guide-h">Live substrate telemetry</div>
            <div className="kv"><span>Scenario</span><span>{presetTitle}</span></div>
            <div className="kv"><span>Live agents</span><span>{antCount.toLocaleString('en-US')}</span></div>
            <div className="kv"><span>Stored nutrients</span><span>{foodCount.toLocaleString('en-US')}</span></div>
            <div className="kv"><span>Render</span><span>{fps} fps · adaptive</span></div>
            <div className="kv"><span>Evaporation λ</span><span>{evaporation.toFixed(3)}</span></div>
            <div className="kv"><span>Diffusion</span><span>{diffusion.toFixed(3)}</span></div>
            <p className="guide-p" style={{ marginTop: 12, color: 'rgba(233,240,250,0.42)', fontSize: 11 }}>
              Modelled on <em>Lasius niger</em> and <em>Linepithema humile</em> foraging
              dynamics. Everything here — trails, crystals, crater — is drawn procedurally at
              runtime; no bitmaps are shipped in the app.
            </p>
          </section>
        </div>
      </div>
    </>
  );
};
