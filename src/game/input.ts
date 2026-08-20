import { STICK_DEAD, STICK_RADIUS } from "./constants";

export class Input {
  moveX = 0;
  moveY = 0;
  lookDX = 0;
  lookDY = 0;
  sprint = false;
  fireHeld = false;
  shootPressed = false;
  enterPressed = false;
  enterHeld = false;
  jumpPressed = false;
  jumpHeld = false;
  reloadPressed = false;
  meleePressed = false;
  pausePressed = false;
  brakeHeld = false;
  surrenderPressed = false;
  talkPressed = false;

  stickActive = false;
  stickBaseX = 0;
  stickBaseY = 0;
  stickKnobX = 0;
  stickKnobY = 0;
  stickId: number | null = null;
  showTouch = false;

  private stickX = 0;
  private stickY = 0;
  private shootHeld = false;
  private enterTouch = false;
  private sprintHeld = false;
  private jumpTouch = false;
  private stickMiss = 0;
  private livePointers = new Set<number>();
  private shootId: number | null = null;
  private enterId: number | null = null;
  private sprintId: number | null = null;
  private jumpId: number | null = null;
  private brakeId: number | null = null;
  private lookId: number | null = null;
  private lookLastX = 0;
  private lookLastY = 0;
  private keys = new Set<string>();
  private prev = new Set<string>();
  private bound = false;
  private mouseHeld = false;
  private rightHeld = false;
  private mouseWas = false;
  private shootWas = false;
  private enterWas = false;
  private jumpWas = false;
  private lockGrace = 0;
  private capturedEl: Element | null = null;

  attach() {
    if (this.bound) return;
    this.bound = true;
    window.addEventListener("keydown", this.onKeyDown, { passive: false });
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    window.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    window.addEventListener("pointerup", this.onWindowPointerUp);
    window.addEventListener("pointercancel", this.onWindowPointerUp);
    window.addEventListener("visibilitychange", this.onVis);
    document.addEventListener("pointerlockchange", this.onLock);
    document.addEventListener("contextmenu", this.onMenu, { capture: true });
  }

  detach() {
    if (!this.bound) return;
    this.bound = false;
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    window.removeEventListener("mousemove", this.onMouseMove);
    window.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
    window.removeEventListener("pointerup", this.onWindowPointerUp);
    window.removeEventListener("pointercancel", this.onWindowPointerUp);
    window.removeEventListener("visibilitychange", this.onVis);
    document.removeEventListener("pointerlockchange", this.onLock);
    document.removeEventListener("contextmenu", this.onMenu, { capture: true } as AddEventListenerOptions);
  }

  private onMenu = (e: Event) => {
    if (this.showTouch) return;
    e.preventDefault();
  };

  private onLock = () => {
    if (document.pointerLockElement) this.lockGrace = 10;
  };

  private onKeyDown = (e: KeyboardEvent) => {
    const k = e.key;
    if (k === " " || k.startsWith("Arrow") || k === "Tab") e.preventDefault();
    this.keys.add(k.toLowerCase());
    if (k === " ") this.keys.add("space");
    if (k === "Shift") this.keys.add("shift");
    if (k === "Escape") this.keys.add("escape");
    if (k === "Control") this.keys.add("control");
  };

  private onKeyUp = (e: KeyboardEvent) => {
    const k = e.key;
    this.keys.delete(k.toLowerCase());
    if (k === " ") this.keys.delete("space");
    if (k === "Shift") this.keys.delete("shift");
    if (k === "Escape") this.keys.delete("escape");
    if (k === "Control") this.keys.delete("control");
  };

  private onMouseMove = (e: MouseEvent) => {
    if (this.showTouch && this.lookId === null) return;
    const locked = !!document.pointerLockElement;
    if (locked || this.mouseHeld || this.rightHeld || !this.showTouch) {
      this.lookDX += e.movementX;
      this.lookDY += e.movementY;
    }
  };

  private onMouseDown = (e: MouseEvent) => {
    if (e.button === 0) this.mouseHeld = true;
    if (e.button === 2) this.rightHeld = true;
  };

  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.mouseHeld = false;
    if (e.button === 2) this.rightHeld = false;
  };

  private onVis = () => { if (document.hidden) this.onBlur(); };

  private onBlur = () => {
    this.keys.clear();
    this.clearStick();
    this.shootHeld = this.enterTouch = this.sprintHeld = this.jumpTouch = this.brakeHeld = false;
    this.mouseHeld = false;
    this.rightHeld = false;
    this.livePointers.clear();
    this.shootId = this.enterId = this.sprintId = this.jumpId = this.brakeId = this.lookId = null;
  };

  private onWindowPointerUp = (e: PointerEvent) => {
    this.livePointers.delete(e.pointerId);
    this.onPointerUp(e);
  };

  beginFrame() {
    if (this.stickId !== null) {
      if (!this.livePointers.has(this.stickId)) {
        this.stickMiss += 1;
        if (this.stickMiss >= 1) this.clearStick();
      } else this.stickMiss = 0;
    }
    if (this.lockGrace > 0) this.lockGrace -= 1;

    const kx = (this.down("a") || this.down("arrowleft") ? -1 : 0) + (this.down("d") || this.down("arrowright") ? 1 : 0);
    const ky = (this.down("w") || this.down("arrowup") ? -1 : 0) + (this.down("s") || this.down("arrowdown") ? 1 : 0);
    let mx = kx + this.stickX;
    let my = ky + this.stickY;
    const mag = Math.hypot(mx, my);
    if (mag > 1) { mx /= mag; my /= mag; }
    this.moveX = mx;
    this.moveY = my;

    this.sprint = this.down("shift") || this.sprintHeld;
    this.jumpHeld = this.down("space") || this.jumpTouch;
    this.enterHeld = this.enterTouch || this.down("f");
    if (this.down("q")) this.lookDX -= 22;
    if (this.down("e")) this.lookDX += 22;
    const locked = !!document.pointerLockElement && this.lockGrace === 0;
    this.fireHeld = this.shootHeld || this.down("control") || (this.mouseHeld && !this.rightHeld && (locked || !this.showTouch));
    this.shootPressed = (!this.shootWas && this.shootHeld) || this.edge("control") || (!this.mouseWas && this.mouseHeld && !this.rightHeld && (locked || !this.showTouch));
    this.jumpPressed = (!this.jumpWas && this.jumpTouch) || this.edge("space");
    this.enterPressed = (!this.enterWas && this.enterTouch) || this.edge("f");
    this.reloadPressed = this.edge("r");
    this.meleePressed = this.edge("v");
    this.pausePressed = this.edge("escape");
    this.surrenderPressed = this.edge("g");
    this.talkPressed = this.edge("t");

    this.shootWas = this.shootHeld;
    this.enterWas = this.enterTouch;
    this.mouseWas = this.mouseHeld;
    this.jumpWas = this.jumpTouch;
    this.prev = new Set(this.keys);
  }

  endFrame() {
    this.shootPressed = this.enterPressed = this.jumpPressed = false;
    this.reloadPressed = this.meleePressed = this.pausePressed = false;
    this.surrenderPressed = this.talkPressed = false;
    this.lookDX = 0;
    this.lookDY = 0;
  }

  consumeLook() {
    const x = this.lookDX;
    const y = this.lookDY;
    this.lookDX = 0;
    this.lookDY = 0;
    return { x, y };
  }

  private down(k: string) { return this.keys.has(k); }
  private edge(k: string) { return this.keys.has(k) && !this.prev.has(k); }

  onPointerDown(e: PointerEvent, hit: "stick" | "shoot" | "enter" | "jump" | "sprint" | "brake" | "look" | "reload" | "melee" | "none") {
    this.showTouch = true;
    this.livePointers.add(e.pointerId);
    if (e.pointerType === "touch") this.showTouch = true;
    if (hit === "shoot") { this.shootHeld = true; this.shootId = e.pointerId; this.cap(e); return; }
    if (hit === "enter") { this.enterTouch = true; this.enterId = e.pointerId; this.cap(e); return; }
    if (hit === "jump") { this.jumpTouch = true; this.jumpId = e.pointerId; this.cap(e); return; }
    if (hit === "sprint") { this.sprintHeld = true; this.sprintId = e.pointerId; this.cap(e); return; }
    if (hit === "brake") { this.brakeHeld = true; this.brakeId = e.pointerId; this.cap(e); return; }
    if (hit === "reload") { this.keys.add("r"); this.cap(e); return; }
    if (hit === "melee") { this.keys.add("v"); this.cap(e); return; }
    if (hit === "look") {
      this.lookId = e.pointerId;
      this.lookLastX = e.clientX;
      this.lookLastY = e.clientY;
      this.cap(e);
      return;
    }
    if (hit === "stick" && this.stickId === null) {
      this.stickId = e.pointerId;
      this.stickActive = true;
      this.stickBaseX = e.clientX;
      this.stickBaseY = e.clientY;
      this.stickKnobX = e.clientX;
      this.stickKnobY = e.clientY;
      this.stickX = 0;
      this.stickY = 0;
      this.stickMiss = 0;
      this.cap(e);
    }
  }

  onPointerMove(e: PointerEvent) {
    if (e.pointerId === this.lookId) {
      this.lookDX += (e.clientX - this.lookLastX) * 1.85;
      this.lookDY += (e.clientY - this.lookLastY) * 1.85;
      this.lookLastX = e.clientX;
      this.lookLastY = e.clientY;
      e.preventDefault();
      return;
    }
    if (e.pointerId !== this.stickId) return;
    this.livePointers.add(e.pointerId);
    this.stickMiss = 0;
    e.preventDefault();
    const dx = e.clientX - this.stickBaseX;
    const dy = e.clientY - this.stickBaseY;
    const len = Math.hypot(dx, dy);
    const cl = Math.min(len, STICK_RADIUS);
    const nx = len > 0.0001 ? dx / len : 0;
    const ny = len > 0.0001 ? dy / len : 0;
    this.stickKnobX = this.stickBaseX + nx * cl;
    this.stickKnobY = this.stickBaseY + ny * cl;
    if (len < STICK_DEAD) { this.stickX = 0; this.stickY = 0; }
    else { this.stickX = (nx * cl) / STICK_RADIUS; this.stickY = (ny * cl) / STICK_RADIUS; }
  }

  onPointerUp(e: PointerEvent) {
    this.livePointers.delete(e.pointerId);
    if (e.pointerId === this.stickId) this.clearStick();
    if (e.pointerId === this.shootId) { this.shootHeld = false; this.shootId = null; }
    if (e.pointerId === this.enterId) { this.enterTouch = false; this.enterId = null; }
    if (e.pointerId === this.sprintId) { this.sprintHeld = false; this.sprintId = null; }
    if (e.pointerId === this.jumpId) { this.jumpTouch = false; this.jumpId = null; }
    if (e.pointerId === this.brakeId) { this.brakeHeld = false; this.brakeId = null; }
    if (e.pointerId === this.lookId) this.lookId = null;
    this.keys.delete("r");
    this.keys.delete("v");
  }

  clearStick() {
    this.stickId = null;
    this.stickActive = false;
    this.stickX = 0;
    this.stickY = 0;
    this.moveX = 0;
    this.moveY = 0;
    this.stickMiss = 0;
    this.capturedEl = null;
    this.stickKnobX = this.stickBaseX;
    this.stickKnobY = this.stickBaseY;
  }

  private cap(e: PointerEvent) {
    try {
      (e.target as Element | null)?.setPointerCapture?.(e.pointerId);
      this.capturedEl = e.target as Element;
    } catch { /* ignore */ }
  }
}
