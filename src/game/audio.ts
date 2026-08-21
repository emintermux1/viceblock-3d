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
  private moan2: OscillatorNode | null = null;
  private moan2Gain: GainNode | null = null;
  private wetGain: GainNode | null = null;
  private talkGain: GainNode | null = null;
  private clipMoan: HTMLAudioElement | null = null;
  private clipCreak: HTMLAudioElement | null = null;
  private clipWet: HTMLAudioElement | null = null;
  private clipTalk: HTMLAudioElement | null = null;
  muted = false;

  ensure() {
    gestureUnlock();
    if (!this.clipMoan) {
      this.clipMoan = this.loadClip("/audio/vip-moan.wav", true, 0.42);
      this.clipCreak = this.loadClip("/audio/vip-creak.wav", true, 0.28);
      this.clipWet = this.loadClip("/audio/vip-wet.wav", true, 0.22);
      this.clipTalk = this.loadClip("/audio/vip-talk.wav", false, 0.55);
    }
    if (!sharedCtx || this.osc) return;
    const dest = sharedCtx.destination;
    const g = sharedCtx.createGain();
    g.gain.value = 0;
    const bed = sharedCtx.createOscillator();
    bed.type = "triangle";
    bed.frequency.value = 46;
    const lp = sharedCtx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 200;
    bed.connect(lp);
    lp.connect(g);
    g.connect(dest);
    const pulse = sharedCtx.createOscillator();
    pulse.type = "sine";
    pulse.frequency.value = 2.15;
    const pg = sharedCtx.createGain();
    pg.gain.value = 0;
    pulse.connect(pg);
    pg.connect(g.gain);
    const moan = sharedCtx.createOscillator();
    moan.type = "sine";
    moan.frequency.value = 240;
    const mg = sharedCtx.createGain();
    mg.gain.value = 0;
    const bp = sharedCtx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 360;
    bp.Q.value = 2.4;
    moan.connect(bp);
    bp.connect(mg);
    mg.connect(dest);
    const moan2 = sharedCtx.createOscillator();
    moan2.type = "triangle";
    moan2.frequency.value = 180;
    const m2g = sharedCtx.createGain();
    m2g.gain.value = 0;
    const bp2 = sharedCtx.createBiquadFilter();
    bp2.type = "bandpass";
    bp2.frequency.value = 280;
    bp2.Q.value = 1.6;
    moan2.connect(bp2);
    bp2.connect(m2g);
    m2g.connect(dest);
    const wet = sharedCtx.createGain();
    wet.gain.value = 0;
    const noise = sharedCtx.createBufferSource();
    const buf = sharedCtx.createBuffer(1, sharedCtx.sampleRate * 2, sharedCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.35;
    noise.buffer = buf;
    noise.loop = true;
    const nbp = sharedCtx.createBiquadFilter();
    nbp.type = "bandpass";
    nbp.frequency.value = 900;
    nbp.Q.value = 0.7;
    noise.connect(nbp);
    nbp.connect(wet);
    wet.connect(dest);
    const tg = sharedCtx.createGain();
    tg.gain.value = 0;
    tg.connect(dest);
    bed.start();
    pulse.start();
    moan.start();
    moan2.start();
    noise.start();
    this.osc = bed;
    this.gain = g;
    this.pulse = pulse;
    this.pulseGain = pg;
    this.moan = moan;
    this.moanGain = mg;
    this.moan2 = moan2;
    this.moan2Gain = m2g;
    this.wetGain = wet;
    this.talkGain = tg;
  }

  private loadClip(src: string, loop: boolean, vol: number) {
    const a = new Audio(src);
    a.preload = "auto";
    a.loop = loop;
    a.volume = vol;
    a.addEventListener("error", () => { /* optional clip */ });
    return a;
  }

  private playLoop(el: HTMLAudioElement | null, on: boolean, vol: number) {
    if (!el || this.muted) {
      if (el) { el.pause(); el.volume = 0; }
      return;
    }
    el.volume = vol;
    if (on) {
      if (el.paused) void el.play().catch(() => undefined);
    } else {
      el.pause();
    }
  }

  setLevel(v: number) {
    this.ensure();
    const n = Math.max(0, Math.min(1.5, v));
    const hot = n > 0.05;
    this.playLoop(this.clipMoan, hot && n > 0.4, Math.min(0.7, n * 0.38));
    this.playLoop(this.clipCreak, hot && n > 0.25, Math.min(0.5, n * 0.24));
    this.playLoop(this.clipWet, hot && n > 0.55, Math.min(0.4, n * 0.18));
    if (!this.gain || !this.pulseGain || !this.moanGain || this.muted) {
      if (this.gain) this.gain.gain.value = 0;
      if (this.moanGain) this.moanGain.gain.value = 0;
      if (this.moan2Gain) this.moan2Gain.gain.value = 0;
      if (this.wetGain) this.wetGain.gain.value = 0;
      return;
    }
    this.gain.gain.value = n * 0.11;
    this.pulseGain.gain.value = n * 0.07;
    this.moanGain.gain.value = n * 0.06;
    if (this.moan2Gain) this.moan2Gain.gain.value = n * 0.04;
    if (this.wetGain) this.wetGain.gain.value = n * 0.045;
    if (this.moan && sharedCtx) {
      this.moan.frequency.setTargetAtTime(210 + Math.sin(sharedCtx.currentTime * 1.9) * 36, sharedCtx.currentTime, 0.08);
    }
    if (this.moan2 && sharedCtx) {
      this.moan2.frequency.setTargetAtTime(170 + Math.sin(sharedCtx.currentTime * 1.15) * 22, sharedCtx.currentTime, 0.1);
    }
  }

  talk() {
    this.ensure();
    if (this.muted) return;
    if (this.clipTalk) {
      this.clipTalk.currentTime = 0;
      void this.clipTalk.play().catch(() => undefined);
    }
    if (!sharedCtx || !this.talkGain) return;
    const o = sharedCtx.createOscillator();
    o.type = "sine";
    o.frequency.value = 320;
    o.connect(this.talkGain);
    const t = sharedCtx.currentTime;
    this.talkGain.gain.cancelScheduledValues(t);
    this.talkGain.gain.setValueAtTime(0.0001, t);
    this.talkGain.gain.exponentialRampToValueAtTime(0.07, t + 0.04);
    this.talkGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    o.frequency.exponentialRampToValueAtTime(210, t + 0.22);
    o.start(t);
    o.stop(t + 0.3);
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (m) {
      if (this.gain) this.gain.gain.value = 0;
      if (this.moanGain) this.moanGain.gain.value = 0;
      if (this.moan2Gain) this.moan2Gain.gain.value = 0;
      if (this.wetGain) this.wetGain.gain.value = 0;
      this.clipMoan?.pause();
      this.clipCreak?.pause();
      this.clipWet?.pause();
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
