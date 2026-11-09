/**
 * Bio-acoustic Web Audio Synthesizer and Generative Music Player
 * 100% offline procedural audio synthesizer with Lyria AI music streaming integration.
 */

export class BioSoundscape {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private ambientGain: GainNode | null = null;
  private droneOsc1: OscillatorNode | null = null;
  private droneOsc2: OscillatorNode | null = null;

  // AI Generated Music Audio element
  private aiAudioElement: HTMLAudioElement | null = null;
  private currentAiTrackUrl: string | null = null;

  constructor() {
    // AudioContext will be initialized on first user gesture
  }

  private initContext() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.startSubterraneanDrone();
    } catch {
      // Audio not supported or blocked
    }
  }

  public resume() {
    this.initContext();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.ambientGain && this.ctx) {
      this.ambientGain.gain.setValueAtTime(muted ? 0 : 0.08, this.ctx.currentTime);
    }
    if (this.aiAudioElement) {
      this.aiAudioElement.muted = muted;
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  private startSubterraneanDrone() {
    if (!this.ctx) return;
    try {
      // Warm subterranean drone (55Hz and 110Hz with slow low-pass filter LFO)
      const now = this.ctx.currentTime;
      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.setValueAtTime(this.isMuted ? 0 : 0.06, now);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(160, now);

      this.droneOsc1 = this.ctx.createOscillator();
      this.droneOsc1.type = 'sine';
      this.droneOsc1.frequency.setValueAtTime(55, now); // A1 note

      this.droneOsc2 = this.ctx.createOscillator();
      this.droneOsc2.type = 'triangle';
      this.droneOsc2.frequency.setValueAtTime(110.2, now); // A2 slight detune

      this.droneOsc1.connect(filter);
      this.droneOsc2.connect(filter);
      filter.connect(this.ambientGain);
      this.ambientGain.connect(this.ctx.destination);

      this.droneOsc1.start();
      this.droneOsc2.start();
    } catch {
      // Safe fallback
    }
  }

  /**
   * Tactile scent painting shimmer
   */
  public playStrokeHum(tool: string) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      // Pitch based on tool
      let baseFreq = 220;
      if (tool === 'food_trail') baseFreq = 330; // Amber E4
      if (tool === 'home_trail') baseFreq = 440; // Cyan A4
      if (tool === 'alarm') baseFreq = 180; // Crimson low
      if (tool === 'food_cluster') baseFreq = 523.25; // Emerald C5
      if (tool === 'eraser') baseFreq = 260;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.08, now + 0.08);

      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.1);
    } catch {
      // ignore
    }
  }

  /**
   * Emerald Food Crystal Harvest Chime
   */
  public playHarvestChime() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const notes = [659.25, 880.0, 1046.5]; // E5, A5, C6 crystalline triad
      const freq = notes[Math.floor(Math.random() * notes.length)];

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.25);
    } catch {
      // ignore
    }
  }

  /**
   * Nest Food Delivery Chime & Heartbeat Pulse
   */
  public playDeliveryChime() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;

      // Bell chime
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(1046.5, now + 0.18); // Arpeggiate to C6

      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.38);

      // Low heartbeat thump
      const subOsc = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(80, now);
      subOsc.frequency.exponentialRampToValueAtTime(40, now + 0.2);

      subGain.gain.setValueAtTime(0.12, now);
      subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

      subOsc.connect(subGain);
      subGain.connect(this.ctx.destination);
      subOsc.start(now);
      subOsc.stop(now + 0.25);
    } catch {
      // ignore
    }
  }

  /**
   * Play generated Lyria music track
   */
  public playAiMusic(audioDataUrl: string) {
    try {
      if (this.aiAudioElement) {
        this.aiAudioElement.pause();
      }
      this.currentAiTrackUrl = audioDataUrl;
      const audio = new Audio(audioDataUrl);
      audio.loop = true;
      audio.volume = this.isMuted ? 0 : 0.6;
      audio.play().catch(() => {});
      this.aiAudioElement = audio;
    } catch (e) {
      console.warn('Could not play AI audio track', e);
    }
  }

  public stopAiMusic() {
    if (this.aiAudioElement) {
      this.aiAudioElement.pause();
      this.aiAudioElement = null;
    }
  }
}
