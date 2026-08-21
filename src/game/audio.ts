let sharedCtx: AudioContext | null = null;

export function gestureUnlock() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!sharedCtx) sharedCtx = new Ctx();
    if (sharedCtx.state === "suspended") void sharedCtx.resume();
  } catch {
    /* ignore */
  }
}

function playFile(el: HTMLAudioElement | null, muted: boolean) {
  if (!el || muted) return;
  el.currentTime = 0;
  const p = el.play();
  if (p) void p.catch(() => undefined);
}

export class Radio {
  el: HTMLAudioElement | null = null;
  started = false;

  ensure() {
    if (this.el) return this.el;
    const a = new Audio("/audio/nova-city.mp3");
    a.loop = true;
    a.preload = "auto";
    a.volume = 0.4;
    this.el = a;
    return a;
  }

  play() {
    const a = this.ensure();
    const p = a.play();
    if (p) void p.then(() => { this.started = true; }).catch(() => { this.started = false; });
    else this.started = true;
  }

  setMuted(m: boolean) {
    if (this.el) this.el.muted = m;
  }

  isLive() {
    return !!this.el && !this.el.paused && !this.el.muted && this.started;
  }
}

export const radio = new Radio();

export class ClubBass {
  private osc: OscillatorNode | null = null;
  private gain: GainNode | null = null;
  private lfo: OscillatorNode | null = null;
  private lfoGain: GainNode | null = null;
  muted = false;

  ensure() {
    gestureUnlock();
    if (!sharedCtx || this.osc) return;
    const g = sharedCtx.createGain();
    g.gain.value = 0;
    const o = sharedCtx.createOscillator();
    o.type = "sine";
    o.frequency.value = 58;
    const filter = sharedCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 140;
    const lfo = sharedCtx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 1.7;
    const lg = sharedCtx.createGain();
    lg.gain.value = 0;
    lfo.connect(lg);
    lg.connect(g.gain);
    o.connect(filter);
    filter.connect(g);
    g.connect(sharedCtx.destination);
    o.start();
    lfo.start();
    this.osc = o;
    this.gain = g;
    this.lfo = lfo;
    this.lfoGain = lg;
  }

  setLevel(v: number) {
    this.ensure();
    if (!this.gain || !this.lfoGain || this.muted) {
      if (this.gain) this.gain.gain.value = 0;
      return;
    }
    const n = Math.max(0, Math.min(1, v));
    this.gain.gain.value = n * 0.09;
    this.lfoGain.gain.value = n * 0.05;
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (m && this.gain) this.gain.gain.value = 0;
  }
}

export const clubBass = new ClubBass();

export class ClubBed {
  private osc: OscillatorNode | null = null;
  private gain: GainNode | null = null;
  private pulse: OscillatorNode | null = null;
  private pulseGain: GainNode | null = null;
  private moan: OscillatorNode | null = null;
  private moanGain: GainNode | null = null;
  muted = false;

  ensure() {
    gestureUnlock();
    if (!sharedCtx || this.osc) return;
    const dest = sharedCtx.destination;
    const g = sharedCtx.createGain();
    g.gain.value = 0;
    const bed = sharedCtx.createOscillator();
    bed.type = "triangle";
    bed.frequency.value = 48;
    const lp = sharedCtx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 180;
    bed.connect(lp);
    lp.connect(g);
    g.connect(dest);
    const pulse = sharedCtx.createOscillator();
    pulse.type = "sine";
    pulse.frequency.value = 2.35;
    const pg = sharedCtx.createGain();
    pg.gain.value = 0;
    pulse.connect(pg);
    pg.connect(g.gain);
    const moan = sharedCtx.createOscillator();
    moan.type = "sine";
    moan.frequency.value = 220;
    const mg = sharedCtx.createGain();
    mg.gain.value = 0;
    const bp = sharedCtx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 340;
    bp.Q.value = 2.2;
    moan.connect(bp);
    bp.connect(mg);
    mg.connect(dest);
    bed.start();
    pulse.start();
    moan.start();
    this.osc = bed;
    this.gain = g;
    this.pulse = pulse;
    this.pulseGain = pg;
    this.moan = moan;
    this.moanGain = mg;
  }

  setLevel(v: number) {
    this.ensure();
    if (!this.gain || !this.pulseGain || !this.moanGain || this.muted) {
      if (this.gain) this.gain.gain.value = 0;
      if (this.moanGain) this.moanGain.gain.value = 0;
      return;
    }
    const n = Math.max(0, Math.min(1, v));
    this.gain.gain.value = n * 0.05;
    this.pulseGain.gain.value = n * 0.035;
    this.moanGain.gain.value = n * 0.028;
    if (this.moan && sharedCtx) {
      this.moan.frequency.setTargetAtTime(200 + Math.sin(sharedCtx.currentTime * 1.8) * 28, sharedCtx.currentTime, 0.08);
    }
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (m) {
      if (this.gain) this.gain.gain.value = 0;
      if (this.moanGain) this.moanGain.gain.value = 0;
    }
  }
}

export const clubBed = new ClubBed();

export class Sfx {
  muted = false;
  private gun: HTMLAudioElement | null = null;
  private engine: HTMLAudioElement | null = null;
  private siren: HTMLAudioElement | null = null;
  private boom: HTMLAudioElement | null = null;
  private reloadEl: HTMLAudioElement | null = null;
  private meleeEl: HTMLAudioElement | null = null;
  private emptyEl: HTMLAudioElement | null = null;
  private webEl: HTMLAudioElement | null = null;
  private whooshEl: HTMLAudioElement | null = null;
  private impactEl: HTMLAudioElement | null = null;

  private load(src: string, loop = false, vol = 0.5) {
    const a = new Audio(src);
    a.preload = "auto";
    a.loop = loop;
    a.volume = vol;
    return a;
  }

  ensure() {
    if (this.gun) return;
    this.gun = this.load("/audio/gun.mp3", false, 0.45);
    this.engine = this.load("/audio/engine.mp3", true, 0.22);
    this.siren = this.load("/audio/siren.mp3", true, 0.28);
    this.boom = this.load("/audio/boom.mp3", false, 0.55);
    this.reloadEl = this.load("/audio/reload.mp3", false, 0.4);
    this.meleeEl = this.load("/audio/melee.mp3", false, 0.45);
    this.emptyEl = this.load("/audio/empty.mp3", false, 0.3);
    this.webEl = this.load("/audio/web.mp3", false, 0.42);
    this.whooshEl = this.load("/audio/whoosh.mp3", false, 0.38);
    this.impactEl = this.load("/audio/impact.mp3", false, 0.5);
  }

  setMuted(m: boolean) {
    this.muted = m;
    radio.setMuted(m);
    clubBass.setMuted(m);
    clubBed.setMuted(m);
    if (m) {
      this.stopEngine();
      this.stopSiren();
    }
  }

  gunshot() { this.ensure(); playFile(this.gun, this.muted); }
  explode() { this.ensure(); playFile(this.boom, this.muted); }
  punch() { this.ensure(); playFile(this.meleeEl, this.muted); }
  reload() { this.ensure(); playFile(this.reloadEl, this.muted); }
  empty() { this.ensure(); playFile(this.emptyEl, this.muted); }
  web() { this.ensure(); playFile(this.webEl, this.muted); }
  whoosh() { this.ensure(); playFile(this.whooshEl, this.muted); }
  impact() { this.ensure(); playFile(this.impactEl, this.muted); }

  footstep(rate: number) {
    if (this.muted) return;
    gestureUnlock();
    if (!sharedCtx) return;
    const o = sharedCtx.createOscillator();
    const g = sharedCtx.createGain();
    o.type = "square";
    o.frequency.value = 72 * rate;
    g.gain.value = 0.035;
    g.gain.exponentialRampToValueAtTime(0.001, sharedCtx.currentTime + 0.045);
    o.connect(g);
    g.connect(sharedCtx.destination);
    o.start();
    o.stop(sharedCtx.currentTime + 0.05);
  }

  engineDrive(on: boolean, speed: number) {
    this.ensure();
    const a = this.engine;
    if (!a) return;
    if (!on || this.muted) {
      if (!a.paused) a.pause();
      return;
    }
    a.playbackRate = 0.85 + Math.min(0.7, Math.abs(speed) / 28);
    a.volume = 0.12 + Math.min(0.22, Math.abs(speed) / 80);
    if (a.paused) void a.play().catch(() => undefined);
  }

  stopEngine() {
    if (this.engine && !this.engine.paused) this.engine.pause();
  }

  sirenOn(on: boolean) {
    this.ensure();
    const a = this.siren;
    if (!a) return;
    if (!on || this.muted) {
      if (!a.paused) a.pause();
      return;
    }
    if (a.paused) void a.play().catch(() => undefined);
  }

  stopSiren() {
    if (this.siren && !this.siren.paused) this.siren.pause();
  }
}

export const sharedSfx = new Sfx();
