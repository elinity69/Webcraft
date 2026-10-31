// ============================================================================
// MINECRAFT 1:1 WEBGL2 EDITION - PROCEDURAL WEB AUDIO ENGINE & C418 SYNTH
// ============================================================================

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.masterVol = 0.7;
    this.musicVol = 0.35;
    this.sfxVol = 0.85;
    this.musicTimer = null;
    this.noiseBuffer = null;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      // Pre-build 1 second white/pink noise buffer for crisp footsteps, digging, explosions
      const sr = this.ctx.sampleRate;
      this.noiseBuffer = this.ctx.createBuffer(1, sr, sr);
      const data = this.noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < sr; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99765 * b0 + w * 0.0990460;
        b1 = 0.96300 * b1 + w * 0.2965164;
        b2 = 0.57000 * b2 + w * 1.0526913;
        data[i] = (b0 + b1 + b2 + w * 0.1848) * 0.22;
      }
      this.startAmbientMusicLoop();
    } catch (e) {}
  }

  playNoiseBurst(duration, filterFreq, filterType = 'bandpass', gainVal = 0.25, pitchSlide = 1.0) {
    if (!this.ctx || !this.noiseBuffer || this.masterVol <= 0 || this.sfxVol <= 0) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.playbackRate.setValueAtTime(0.85 + Math.random() * 0.3, now);
    if (pitchSlide !== 1.0) {
      src.playbackRate.exponentialRampToValueAtTime(Math.max(0.1, pitchSlide), now + duration);
    }

    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterFreq * (0.9 + Math.random() * 0.2), now);
    filter.Q.setValueAtTime(1.8, now);

    const gain = this.ctx.createGain();
    const v = Math.min(1, gainVal * this.masterVol * this.sfxVol);
    gain.gain.setValueAtTime(v, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    src.start(now);
    src.stop(now + duration);
  }

  playTone(freq, duration, type = 'triangle', gainVal = 0.2, endFreq = null) {
    if (!this.ctx || this.masterVol <= 0 || this.sfxVol <= 0) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    }
    const gain = this.ctx.createGain();
    const v = Math.min(1, gainVal * this.masterVol * this.sfxVol);
    gain.gain.setValueAtTime(v, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  playStep(mat = 'grass') {
    this.init();
    const map = {
      grass:  [0.07, 900, 'bandpass', 0.16],
      dirt:   [0.07, 750, 'bandpass', 0.16],
      stone:  [0.05, 1600, 'highpass', 0.18],
      wood:   [0.06, 520, 'bandpass', 0.22],
      sand:   [0.08, 2200, 'bandpass', 0.14],
      gravel: [0.08, 1300, 'bandpass', 0.20],
      glass:  [0.05, 3200, 'highpass', 0.18],
      snow:   [0.07, 2600, 'bandpass', 0.15],
      metal:  [0.06, 2400, 'bandpass', 0.22],
    };
    const cfg = map[mat] || map.stone;
    this.playNoiseBurst(cfg[0], cfg[1], cfg[2], cfg[3]);
  }

  playDig(mat = 'stone') {
    this.init();
    this.playStep(mat);
    this.playTone(180 + Math.random() * 80, 0.045, 'square', 0.08, 90);
  }

  playBreak(mat = 'stone') {
    this.init();
    this.playNoiseBurst(0.18, mat === 'glass' ? 3600 : 1100, 'bandpass', 0.38, 0.55);
    if (mat === 'glass') {
      this.playTone(1800, 0.12, 'sine', 0.18, 920);
      setTimeout(() => this.playTone(2400, 0.09, 'sine', 0.14, 1100), 45);
    } else {
      this.playTone(150 + Math.random() * 50, 0.14, 'triangle', 0.22, 65);
    }
  }

  playPlace(mat = 'stone') {
    this.init();
    this.playNoiseBurst(0.09, 950, 'lowpass', 0.30);
    this.playTone(130 + Math.random() * 40, 0.07, 'triangle', 0.18, 95);
  }

  playPop() {
    this.init();
    this.playTone(380 + Math.random() * 140, 0.065, 'sine', 0.22, 780);
  }

  playXPOrb() {
    this.init();
    const notes = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
    const f = notes[Math.floor(Math.random() * notes.length)];
    this.playTone(f, 0.14, 'sine', 0.20, f * 1.04);
  }

  playLevelUp() {
    this.init();
    [523.25, 659.25, 783.99, 1046.5].forEach((f, idx) => {
      setTimeout(() => this.playTone(f, 0.28, 'triangle', 0.25), idx * 85);
    });
  }

  playSwing() {
    this.init();
    this.playNoiseBurst(0.11, 1400, 'bandpass', 0.18, 0.45);
  }

  playHit(isCrit = false) {
    this.init();
    this.playNoiseBurst(0.12, 800, 'lowpass', 0.35);
    this.playTone(isCrit ? 320 : 190, 0.12, 'sawtooth', 0.25, 75);
  }

  playHurt() {
    this.init();
    this.playNoiseBurst(0.15, 1100, 'bandpass', 0.38);
    this.playTone(260, 0.16, 'sawtooth', 0.28, 110);
  }

  playBowShoot() {
    this.init();
    this.playNoiseBurst(0.10, 1800, 'bandpass', 0.22);
    this.playTone(420, 0.14, 'triangle', 0.22, 160);
  }

  playEat() {
    this.init();
    this.playNoiseBurst(0.08, 1100, 'bandpass', 0.24);
    this.playTone(210 + Math.random() * 60, 0.07, 'square', 0.10, 140);
  }

  playBurp() {
    this.init();
    this.playTone(135, 0.26, 'sawtooth', 0.22, 82);
  }

  playSplash() {
    this.init();
    this.playNoiseBurst(0.32, 1200, 'bandpass', 0.36, 0.4);
  }

  playExplosion() {
    this.init();
    this.playNoiseBurst(0.85, 320, 'lowpass', 0.65, 0.2);
    this.playTone(95, 0.65, 'sawtooth', 0.45, 25);
  }

  playFuse() {
    this.init();
    this.playNoiseBurst(0.45, 3200, 'highpass', 0.28, 1.3);
  }

  playClick(high = true) {
    this.init();
    this.playTone(high ? 900 : 650, 0.035, 'square', 0.16, high ? 500 : 380);
  }

  playNoteBlock(semitone = 0) {
    this.init();
    const freq = 261.63 * Math.pow(2, semitone / 12);
    this.playTone(freq, 0.35, 'triangle', 0.32);
  }

  playPortalTrigger() {
    this.init();
    this.playTone(220, 1.2, 'sine', 0.25, 660);
    setTimeout(() => this.playTone(330, 1.0, 'triangle', 0.2, 880), 150);
  }

  playMobSound(type) {
    this.init();
    if (type === 'zombie') this.playTone(115, 0.38, 'sawtooth', 0.18, 82);
    else if (type === 'skeleton') this.playNoiseBurst(0.09, 2600, 'bandpass', 0.22);
    else if (type === 'creeper') this.playFuse();
    else if (type === 'pig') this.playTone(280, 0.14, 'sawtooth', 0.16, 360);
    else if (type === 'cow') this.playTone(145, 0.45, 'sawtooth', 0.18, 118);
    else if (type === 'sheep') this.playTone(240, 0.32, 'triangle', 0.18, 210);
    else if (type === 'chicken') this.playTone(580, 0.09, 'triangle', 0.15, 420);
    else if (type === 'villager') { this.playTone(240, 0.28, 'sawtooth', 0.12, 300); setTimeout(() => this.playTone(280, 0.24, 'sawtooth', 0.10, 340), 180); }
    else if (type === 'enderman') this.playTone(190, 0.30, 'sine', 0.22, 480);
    else if (type === 'dragon') this.playTone(85, 0.9, 'sawtooth', 0.40, 42);
  }

  playPianoNote(freq, dur = 2.8) {
    if (!this.ctx || this.masterVol <= 0 || this.musicVol <= 0) return;
    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    osc1.type = 'sine';
    osc2.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, now);
    osc2.frequency.setValueAtTime(freq * 2, now);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1100, now);
    filter.frequency.exponentialRampToValueAtTime(280, now + dur);

    const gain = this.ctx.createGain();
    const v = 0.09 * this.masterVol * this.musicVol;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(v, now + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.0005, now + dur);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + dur);
    osc2.stop(now + dur);
  }

  startAmbientMusicLoop() {
    if (this.musicTimer) return;
    // Sweden / Subwoofer Lullaby inspired calm pentatonic/major7 chords
    const chords = [
      [261.63, 329.63, 392.00, 493.88], // Cmaj7
      [220.00, 261.63, 329.63, 392.00], // Am7
      [174.61, 220.00, 261.63, 329.63], // Fmaj7
      [196.00, 246.94, 293.66, 392.00], // G6
    ];
    let step = 0;
    this.musicTimer = setInterval(() => {
      if (!this.ctx || this.ctx.state !== 'running' || this.musicVol <= 0) return;
      if (Math.random() < 0.35) return; // gentle breathing pauses
      const chord = chords[step % chords.length];
      step++;
      chord.forEach((f, idx) => {
        setTimeout(() => {
          this.playPianoNote(f, 3.2);
        }, idx * 240 + Math.random() * 60);
      });
      if (Math.random() < 0.65) {
        const melody = chord[Math.floor(Math.random() * chord.length)] * 2;
        setTimeout(() => this.playPianoNote(melody, 2.5), 1150);
      }
    }, 4500);
  }
}

const SFX = new SoundEngine();
