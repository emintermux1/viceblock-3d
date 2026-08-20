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

export class Sfx {
  muted = false;
  private gun: HTMLAudioElement | null = null;
  private engine: HTMLAudioElement | null = null;
  private siren: HTMLAudioElement | null = null;
  private boom: HTMLAudioElement | null = null;
  private reloadEl: HTMLAudioElement | null = null;
  private meleeEl: HTMLAudioElement | null = null;
  private emptyEl: HTMLAudioElement | null = null;

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
  }

  setMuted(m: boolean) {
    this.muted = m;
    radio.setMuted(m);
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
