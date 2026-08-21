import {
  Color3, Engine, FreeCamera, Mesh, MeshBuilder, ParticleSystem, Scene,
  StandardMaterial, Vector3,
} from "@babylonjs/core";
import { gestureUnlock, radio, sharedSfx } from "./audio";
import { buildCity, tickCityArt, type CityData } from "./city";
import {
  ARREST_R, BAIL, CALL_T, CAR_FRICTION, CAR_HP, CAR_REV, CAR_SPEC, CHAR, COP_DMG,
  COP_FOOT, COP_SHOT_CD, CRANE_GOAL, FENCE, FIRE_CD, GRAVITY, GUN_DMG, GUN_RANGE, INT, JAIL_WAIT,
  JUMP_VEL, LOC, MAG, MELEE_CD, MELEE_DMG, MELEE_RANGE, PD, PD_OUT, PLAYER_R,
  REGEN_DELAY, REGEN_RATE, RELOAD_T, REPAIR_COST, RESERVE, SAVE_KEY, SEARCH_R0,
  SEARCH_T0, SPAWN_PAD, SPRINT, STAR_MAX, TRACER_LIFE, WALK, WITNESS_R, angWrap,
  clamp, dist2,
} from "./constants";
import type { Input } from "./input";
import { flareTex, lookDir, makeCar, makeCop, makeHero, makePed, makeSilk, mat, placeSilk, tickCrawlPose, tickSwingPose, tickWalk } from "./meshes";
import {
  nearestWall, pickAnchor, standY, stepAir, stepSwing, stepZip, unstickPlayer, type Anchor, type SwingRope,
} from "./swing";
import type { AABB, CharacterId, CopState, HudState, InteriorId, MissionId, MoveMode, PedState } from "./types";
import { emptyHud, pointInAABB } from "./types";

type CarKind = "hatch" | "sedan" | "muscle" | "cop";
type Car = {
  mesh: Mesh; kind: CarKind; color: string; x: number; z: number; y: number;
  yaw: number; speed: number; hp: number; body: number; engineHp: number; tires: number;
  wrecked: boolean; exploding: boolean; boomT: number; occupied: boolean; special: string;
  smoke: ParticleSystem | null; stolen: boolean;
};
type PedRole = "wander" | "group" | "sit" | "cross" | "clerk" | "fence";
type Ped = {
  mesh: Mesh; x: number; z: number; yaw: number; hp: number; state: PedState;
  tx: number; tz: number; downT: number; color: string; role: PedRole; callT: number; waitT: number;
};
type Cop = {
  mesh: Mesh; x: number; z: number; yaw: number; hp: number; state: CopState;
  fireT: number; downT: number;
};
type Tracer = { mesh: Mesh; life: number };

export class ViceGame {
  engine: Engine;
  scene: Scene;
  camera: FreeCamera;
  input: Input;
  city!: CityData;
  playerMesh!: Mesh;
  player = {
    x: LOC.spawn.x, y: 0, z: LOC.spawn.z, vx: 0, vy: 0, vz: 0, yaw: 0,
    health: 100, maxHealth: 100, ammo: MAG, reserve: RESERVE,
    fireT: 0, meleeT: 0, reloadT: 0, grounded: true, flash: 0,
    character: "ansem" as CharacterId,
  };
  mode: MoveMode = "ground";
  private rope: SwingRope | null = null;
  private zipTo: Anchor | null = null;
  private crawlN: { nx: number; nz: number; maxY: number } | null = null;
  private silk!: Mesh;
  private aimOrb!: Mesh;
  private aim: Anchor | null = null;
  private stuns = 0;
  private launched = false;
  camYaw = 0.95;
  camPitch = 0.22;
  camDist = 8.6;
  private camFov = 0.8;
  private camRoll = 0;
  cars: Car[] = [];
  peds: Ped[] = [];
  cops: Cop[] = [];
  tracers: Tracer[] = [];
  drive: Car | null = null;
  cash = 500;
  stars = 0;
  lastSeen = -999;
  lastCombat = -999;
  time = 0;
  mission: MissionId = "launch";
  prompt = "";
  subtitle = "";
  fade = 0;
  busted = false;
  fps = 60;
  private fpsAcc = 0;
  private fpsN = 0;
  frozen = false;
  enterLock = 0;
  storeHold = 0;
  storeRobbed = false;
  jacked = false;
  delivered = false;
  escaped = false;
  heatSit = 0;
  marker!: Mesh;
  private flare!: ReturnType<typeof flareTex>;
  private canvas: HTMLCanvasElement;
  interior: InteriorId = "street";
  private hotwire: { car: Car; t: number } | null = null;
  searching = false;
  searchX = 0;
  searchZ = 0;
  searchR = SEARCH_R0;
  searchT = 0;
  lastKnownX = 0;
  lastKnownZ = 0;
  lastSeenKind = "foot";
  stolenGoods = false;
  ricoPaidJob = false;
  ricoCars = 0;
  ricoTalkBonus = false;
  jailT = 0;
  jailTalked = false;
  stillT = 0;
  camPunch = 0;
  camDip = 0;
  private wasGrounded = true;
  private stepT = 0;
  private ghostArmed = false;
  hasSave = false;
  private saveAcc = 0;
  private parkedRepair: Car | null = null;
  private copTarget: { x: number; z: number } = { x: 0, z: 0 };

  constructor(canvas: HTMLCanvasElement, input: Input, character: CharacterId) {
    this.canvas = canvas;
    this.input = input;
    this.player.character = character;
    const kit = CHAR[character];
    this.player.health = kit.hp;
    this.player.maxHealth = kit.hp;
    this.engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: false, adaptToDeviceRatio: true });
    this.scene = new Scene(this.engine);
    this.scene.collisionsEnabled = false;
    this.camera = new FreeCamera("cam", new Vector3(0, 8, -12), this.scene);
    this.camera.minZ = 0.15;
    this.camera.maxZ = 420;
    this.camera.inputs.clear();
    this.flare = flareTex(this.scene);
    this.city = buildCity(this.scene);
    this.playerMesh = makeHero(this.scene, character);
    this.playerMesh.position.set(this.player.x, 0, this.player.z);
    this.silk = makeSilk(this.scene, CHAR[character].color);
    this.aimOrb = MeshBuilder.CreateSphere("aim", { diameter: 0.55, segments: 6 }, this.scene);
    this.aimOrb.material = mat(this.scene, CHAR[character].color, 0.9);
    this.aimOrb.setEnabled(false);
    this.marker = MeshBuilder.CreateTorus("mk", { diameter: 3.2, thickness: 0.18, tessellation: 20 }, this.scene);
    this.marker.material = mat(this.scene, "#ffc83d", 0.8);
    this.spawnCars();
    this.spawnPeds();
    this.restore();
    this.placeMarker();
    this.engine.runRenderLoop(() => this.tick());
    window.addEventListener("resize", this.onResize);
    canvas.addEventListener("click", this.onClick);
  }

  private onResize = () => this.engine.resize();
  private onClick = () => {
    this.canvas.focus();
  };

  setPaused(v: boolean) { this.frozen = v; }
  setMuted(v: boolean) { sharedSfx.setMuted(v); }

  dispose() {
    this.persist();
    window.removeEventListener("resize", this.onResize);
    this.canvas.removeEventListener("click", this.onClick);
    sharedSfx.stopEngine();
    sharedSfx.stopSiren();
    this.engine.stopRenderLoop();
    this.scene.dispose();
    this.engine.dispose();
  }

  private persist() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        v: 2, cash: this.cash, mission: this.mission, character: this.player.character, stars: this.stars, stuns: this.stuns,
      }));
      this.hasSave = true;
    } catch { /* ignore */ }
  }

  private restore() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw) as { v?: number; cash?: number; mission?: MissionId; stars?: number; stuns?: number };
      if (s.v !== 2) return;
      if (typeof s.cash === "number") this.cash = s.cash;
      if (s.mission === "launch" || s.mission === "crane" || s.mission === "sweep" || s.mission === "ghost" || s.mission === "free") {
        this.mission = s.mission;
      }
      if (this.mission === "ghost" || this.mission === "free") this.ghostArmed = true;
      if (typeof s.stars === "number") this.stars = clamp(s.stars, 0, STAR_MAX);
      if (typeof s.stuns === "number") this.stuns = s.stuns;
      this.hasSave = true;
      if (this.mission !== "launch") this.launched = true;
    } catch { /* ignore */ }
  }

  private spawnCars() {
    const specs: { x: number; z: number; yaw: number; kind: CarKind; color: string; special: string }[] = [
      { ...LOC.carA, kind: "hatch", color: "#ffc83d", special: "jack" },
      { ...LOC.carB, kind: "sedan", color: "#2a8a7a", special: "" },
      { ...LOC.carC, kind: "muscle", color: "#ff6a3d", special: "" },
      { x: -58, z: 8, yaw: 0.05, kind: "sedan", color: "#4a6088", special: "" },
      { x: 22, z: 48, yaw: Math.PI, kind: "hatch", color: "#c03050", special: "" },
      { x: -46, z: 28, yaw: 1.55, kind: "muscle", color: "#2a2a38", special: "" },
      { x: 48, z: -6, yaw: 0.1, kind: "cop", color: "#f0f2f4", special: "" },
    ];
    for (const s of specs) {
      const mesh = makeCar(this.scene, s.color, s.kind);
      mesh.position.set(s.x, 0, s.z);
      mesh.rotation.y = s.yaw;
      this.cars.push({
        mesh, kind: s.kind, color: s.color, x: s.x, z: s.z, y: 0, yaw: s.yaw,
        speed: 0, hp: CAR_HP, body: 100, engineHp: 100, tires: 100,
        wrecked: false, exploding: false, boomT: 0,
        occupied: false, special: s.special, smoke: null, stolen: false,
      });
    }
  }

  private spawnPeds() {
    const spots: { x: number; z: number; role: PedRole }[] = [
      { x: -12, z: 5, role: "group" }, { x: -10.4, z: 5.6, role: "group" }, { x: -11.2, z: 4.2, role: "group" },
      { x: -24, z: 4, role: "sit" },
      { x: -18, z: 8, role: "cross" }, { x: 16, z: 8, role: "cross" },
      { x: 18, z: 36, role: "wander" }, { x: -40, z: 28, role: "wander" },
      { x: 40, z: 8, role: "wander" }, { x: 30, z: 50, role: "wander" },
      { x: 8, z: -8, role: "wander" }, { x: 50, z: 30, role: "wander" },
    ];
    for (let i = 0; i < spots.length; i++) {
      const s = spots[i];
      if (this.blocked(s.x, s.z, 0.5)) continue;
      const mesh = makePed(this.scene, i + 1);
      mesh.position.set(s.x, 0, s.z);
      this.peds.push({
        mesh, x: s.x, z: s.z, yaw: Math.random() * Math.PI * 2, hp: 40,
        state: s.role === "sit" ? "sit" : "wander", tx: s.x, tz: s.z, downT: 0,
        color: "#888", role: s.role, callT: 0, waitT: 0,
      });
    }
    const clerk = makePed(this.scene, 21);
    clerk.position.set(INT.mart.ox + 0.2, 0, INT.mart.oz + 3.7);
    this.peds.push({
      mesh: clerk, x: INT.mart.ox + 0.2, z: INT.mart.oz + 3.7, yaw: Math.PI, hp: 40,
      state: "wander", tx: INT.mart.ox, tz: INT.mart.oz + 3.7, downT: 0,
      color: "#888", role: "clerk", callT: 0, waitT: 0,
    });
    const rico = makePed(this.scene, 5);
    rico.position.set(FENCE.x, 0, FENCE.z);
    this.peds.push({
      mesh: rico, x: FENCE.x, z: FENCE.z, yaw: -0.6, hp: 50,
      state: "wander", tx: FENCE.x, tz: FENCE.z, downT: 0,
      color: "#d4a040", role: "fence", callT: 0, waitT: 0,
    });
    const guard = makeCop(this.scene);
    guard.position.set(INT.jail.ox + 2.2, 0, INT.jail.oz - 1.4);
    guard.rotation.y = -0.4;
  }

  private tick() {
    const dt = Math.min(0.05, this.engine.getDeltaTime() / 1000);
    this.fpsAcc += dt;
    this.fpsN += 1;
    if (this.fpsAcc >= 0.4) {
      this.fps = Math.round(this.fpsN / this.fpsAcc);
      this.fpsAcc = 0;
      this.fpsN = 0;
    }
    if (!this.frozen) {
      this.input.beginFrame();
      this.time += dt;
      this.step(dt);
      this.input.endFrame();
    }
    this.scene.render();
  }

  private step(dt: number) {
    const look = this.input.consumeLook();
    const touch = this.input.showTouch;
    const inv = this.input.lookInvert ? -1 : 1;
    const sx = touch ? 0.0072 : 0.0044;
    const sy = (touch ? 0.0056 : 0.0038) * inv;
    this.camYaw = angWrap(this.camYaw + look.x * sx);
    this.camPitch = clamp(this.camPitch + look.y * sy, -0.62, 0.98);
    this.enterLock = Math.max(0, this.enterLock - dt);
    this.player.fireT = Math.max(0, this.player.fireT - dt);
    this.player.meleeT = Math.max(0, this.player.meleeT - dt);
    this.player.flash = Math.max(0, this.player.flash - dt);
    this.camPunch = Math.max(0, this.camPunch - dt * 4);
    this.camDip = Math.max(0, this.camDip - dt * 3.2);
    if (this.player.reloadT > 0) {
      this.player.reloadT -= dt;
      if (this.player.reloadT <= 0) {
        const need = MAG - this.player.ammo;
        const take = Math.min(need, this.player.reserve);
        this.player.ammo += take;
        this.player.reserve -= take;
      }
    }

    this.tickHotwire(dt);
    if (this.interior === "jail") {
      if (this.input.enterPressed && this.enterLock <= 0) this.tryEnterExit();
      this.tickJail(dt);
      this.walkFree(dt, 0.7);
      this.mode = "ground";
    } else {
      this.locomote(dt);
    }

    this.updatePeds(dt);
    this.updateCops(dt);
    this.updateTracers(dt);
    this.updateCarsFx(dt);
    if (this.interior !== "jail") this.combat(dt);
    this.missions(dt);
    this.tickArrest(dt);
    this.regen(dt);
    this.cameraFollow();
    this.syncMeshes();
    tickCityArt(this.scene, this.time);
    this.wantedDecay(dt);
    this.saveAcc += dt;
    if (this.saveAcc > 4) { this.saveAcc = 0; this.persist(); }
    sharedSfx.engineDrive(!!this.drive && !this.drive.wrecked, this.drive?.speed ?? 0);
    sharedSfx.sirenOn(this.stars > 0 && this.cops.some((c) => c.state === "chase"));
  }

  private locomote(dt: number) {
    const p = this.player;
    const ins = this.input;

    if (this.drive) {
      if (ins.enterPressed && this.enterLock <= 0) this.tryEnterExit();
      if (this.drive) this.driveCar(dt);
      this.silk.setEnabled(false);
      this.aim = null;
      return;
    }

    if (this.interior !== "street") {
      this.walkFree(dt, 1);
      this.mode = "ground";
      this.rope = null;
      this.zipTo = null;
      this.silk.setEnabled(false);
      return;
    }

    const nearCar = this.nearestCar(3.2);
    const streetBin = !!nearCar && this.mode === "ground" && p.y < 1.35;
    if (streetBin && this.enterLock <= 0 && (ins.enterPressed || ins.enterHeld)) {
      this.tryEnterExit();
      if (this.drive) return;
    }

    this.aim = pickAnchor(
      p.x, p.y + 1.05, p.z, p.vx, p.vy, p.vz,
      this.camYaw, this.camPitch, this.city.anchors,
    );

    if (this.mode === "zip") {
      if (!this.zipTo) {
        this.mode = "air";
      } else {
        const done = stepZip(p, this.zipTo, dt);
        this.drawSilk(this.zipTo.x, this.zipTo.y, this.zipTo.z);
        this.clampWorld();
        this.collideBuildings();
        const stuck = unstickPlayer(p, this.city.colliders);
        if (stuck === "roof") this.landOn(standY(p.x, p.z, this.city.colliders));
        if (done) {
          this.zipTo = null;
          this.rope = null;
          this.mode = "air";
        }
        this.maybeLand();
        this.faceVelocity();
        return;
      }
    }

    if (this.mode === "crawl") {
      this.stepCrawl(dt);
      return;
    }

    const wantSwing = !streetBin && (ins.swingHeld || (ins.jumpHeld && this.mode !== "ground"));
    if (ins.zipPressed && this.aim && !streetBin) {
      this.zipTo = { ...this.aim };
      this.mode = "zip";
      this.rope = {
        ax: this.aim.x, ay: this.aim.y, az: this.aim.z,
        length: Math.max(4, Math.hypot(p.x - this.aim.x, p.y - this.aim.y, p.z - this.aim.z)),
      };
      this.launched = true;
      sharedSfx.web();
      return;
    }

    if (this.mode === "swing") {
      if (!wantSwing || !this.rope) {
        if (this.rope && p.vy > 1) p.vy += 3.2;
        this.rope = null;
        this.mode = "air";
        this.silk.setEnabled(false);
        sharedSfx.whoosh();
      } else {
        stepSwing(p, this.rope, ins.moveX, ins.moveY, this.camYaw, dt);
        this.drawSilk(this.rope.ax, this.rope.ay, this.rope.az);
        this.clampWorld();
        this.collideBuildings();
        unstickPlayer(p, this.city.colliders);
        this.maybeLand();
        this.maybeCrawl();
        this.faceVelocity();
        return;
      }
    }

    if (this.mode === "ground") {
      this.walkRooftops(dt);
      if (this.tryStartClimb()) return;
      if (ins.jumpPressed) {
        p.vy = JUMP_VEL;
        p.grounded = false;
        this.mode = "air";
        sharedSfx.whoosh();
      } else if (wantSwing && this.aim) {
        p.vy = JUMP_VEL * 0.7;
        p.grounded = false;
        this.attachSwing();
      }
      return;
    }

    stepAir(p, ins.moveX, ins.moveY, this.camYaw, dt);
    this.clampWorld();
    if (wantSwing && this.aim) this.attachSwing();
    this.collideBuildings();
    const stuck = unstickPlayer(p, this.city.colliders);
    if (stuck === "roof") this.landOn(standY(p.x, p.z, this.city.colliders));
    this.maybeLand();
    this.maybeCrawl();
    this.faceVelocity();
  }

  private attachSwing() {
    const p = this.player;
    const a = this.aim;
    if (!a) return;
    const dist = Math.hypot(p.x - a.x, p.y - a.y, p.z - a.z);
    this.rope = { ax: a.x, ay: a.y, az: a.z, length: Math.max(5.2, dist * 0.92) };
    this.mode = "swing";
    this.launched = true;
    const pull = 2.6;
    const dx = a.x - p.x;
    const dy = a.y - p.y;
    const dz = a.z - p.z;
    const d = Math.hypot(dx, dy, dz) || 1;
    p.vx += (dx / d) * pull;
    p.vy += (dy / d) * pull * 0.38;
    p.vz += (dz / d) * pull;
    sharedSfx.web();
    this.drawSilk(a.x, a.y, a.z);
  }

  private drawSilk(x: number, y: number, z: number) {
    placeSilk(this.silk, this.player.x + 0.16, this.player.y + 1.18, this.player.z, x, y, z);
  }

  private faceVelocity() {
    const p = this.player;
    if (Math.hypot(p.vx, p.vz) > 0.85) p.yaw = Math.atan2(p.vx, p.vz);
    else p.yaw = this.camYaw;
  }

  private clampWorld() {
    const p = this.player;
    p.x = clamp(p.x, -94, 94);
    p.z = clamp(p.z, -80, 96);
    if (p.y < 0) {
      p.y = 0;
      if (p.vy < 0) p.vy = 0;
    }
  }

  private walkRooftops(dt: number) {
    const p = this.player;
    const kit = CHAR[p.character];
    const speed = (this.input.sprint ? SPRINT : WALK) * kit.speed;
    const fwd = lookDir(this.camYaw, 0);
    const right = new Vector3(fwd.z, 0, -fwd.x);
    const vx = (fwd.x * -this.input.moveY + right.x * this.input.moveX) * speed;
    const vz = (fwd.z * -this.input.moveY + right.z * this.input.moveX) * speed;
    if (this.input.moveX !== 0 || this.input.moveY !== 0) p.yaw = Math.atan2(vx, vz);
    p.vx = vx;
    p.vz = vz;
    p.vy = 0;
    const stuck = unstickPlayer(p, this.city.colliders);
    if (stuck === "roof") p.y = standY(p.x, p.z, this.city.colliders);
    const floor = standY(p.x, p.z, this.city.colliders);
    const onRoof = floor > 0.4 && p.y >= floor - 0.9;
    const nx = p.x + vx * dt;
    const nz = p.z + vz * dt;
    if (onRoof) {
      const next = standY(nx, nz, this.city.colliders);
      if (next > 0.35 && floor - next < 2.2) {
        p.x = clamp(nx, -94, 94);
        p.z = clamp(nz, -80, 96);
        p.y = next;
        p.grounded = true;
      } else {
        p.x = nx;
        p.z = nz;
        p.y = floor;
        p.grounded = false;
        this.mode = "air";
      }
    } else {
      if (!this.blocked(nx, p.z, PLAYER_R) && this.walkable(nx, p.z)) p.x = nx;
      if (!this.blocked(p.x, nz, PLAYER_R) && this.walkable(p.x, nz)) p.z = nz;
      p.y = 0;
      p.grounded = true;
      if (p.z > this.city.waterZ && !pointInAABB(p.x, p.z, this.city.pier, 0.2)) {
        p.vx *= 0.55;
        p.vz *= 0.55;
      }
    }
    this.playerMesh.setEnabled(true);
    const moving = Math.hypot(vx, vz) > 0.4;
    this.stepT -= dt;
    if (moving && this.stepT <= 0) {
      this.stepT = 0.36;
      sharedSfx.footstep(onRoof ? 0.7 : this.surfaceRate());
    }
  }

  private collideBuildings() {
    const p = this.player;
    for (const b of this.city.colliders) {
      if (p.y >= b.maxY - 0.18) continue;
      if (p.x < b.minX - 0.48 || p.x > b.maxX + 0.48 || p.z < b.minZ - 0.48 || p.z > b.maxZ + 0.48) continue;
      if (p.y >= b.maxY - 1.35 && p.x > b.minX && p.x < b.maxX && p.z > b.minZ && p.z < b.maxZ) {
        p.y = b.maxY;
        if (p.vy < 0) p.vy = 0;
        continue;
      }
      const left = p.x - b.minX;
      const right = b.maxX - p.x;
      const back = p.z - b.minZ;
      const fwd = b.maxZ - p.z;
      const m = Math.min(left, right, back, fwd);
      if (m === left) { p.x = b.minX - 0.5; p.vx *= -0.28; }
      else if (m === right) { p.x = b.maxX + 0.5; p.vx *= -0.28; }
      else if (m === back) { p.z = b.minZ - 0.5; p.vz *= -0.28; }
      else { p.z = b.maxZ + 0.5; p.vz *= -0.28; }
    }
  }

  private landOn(floor: number) {
    const p = this.player;
    p.y = floor;
    p.vy = 0;
    p.grounded = true;
    this.mode = "ground";
    this.rope = null;
    this.zipTo = null;
    this.crawlN = null;
    this.silk.setEnabled(false);
  }

  private maybeLand() {
    const p = this.player;
    const floor = standY(p.x, p.z, this.city.colliders);
    if (p.y <= floor + 0.38 && p.vy <= 8) {
      if (this.mode === "air" || this.mode === "swing" || this.mode === "zip") {
        const spd = Math.hypot(p.vx, p.vz);
        if (spd > 16) sharedSfx.impact();
      }
      this.landOn(floor);
    }
  }

  private tryStartClimb(): boolean {
    const p = this.player;
    const w = nearestWall(p.x, Math.max(0.35, p.y + 0.4), p.z, this.city.colliders, 1.85);
    if (!w) return false;
    const fwd = lookDir(this.camYaw, 0);
    const right = new Vector3(fwd.z, 0, -fwd.x);
    const mx = fwd.x * -this.input.moveY + right.x * this.input.moveX;
    const mz = fwd.z * -this.input.moveY + right.z * this.input.moveX;
    const into = -mx * w.nx - mz * w.nz;
    const blockedInto = this.blocked(p.x - w.nx * 0.55, p.z - w.nz * 0.55, PLAYER_R);
    if (!this.input.climbHeld && into < 0.18 && !blockedInto) return false;
    if (!this.input.climbHeld && into < 0.18 && Math.hypot(this.input.moveX, this.input.moveY) < 0.2) return false;
    this.stickWall(w);
    return true;
  }

  private maybeCrawl() {
    if (this.mode !== "air") return;
    const p = this.player;
    const w = nearestWall(p.x, p.y, p.z, this.city.colliders, this.input.climbHeld ? 1.9 : 1.2);
    if (!w) return;
    if (!this.input.climbHeld && p.y < 0.55) return;
    this.stickWall(w);
  }

  private stickWall(w: { x: number; y: number; z: number; nx: number; nz: number; maxY: number }) {
    const p = this.player;
    this.mode = "crawl";
    this.crawlN = { nx: w.nx, nz: w.nz, maxY: w.maxY };
    p.vx = 0;
    p.vz = 0;
    p.vy = 0;
    p.x = w.x + w.nx * 0.42;
    p.z = w.z + w.nz * 0.42;
    this.rope = null;
    this.zipTo = null;
    this.silk.setEnabled(false);
  }

  private stepCrawl(dt: number) {
    const p = this.player;
    const ins = this.input;
    const w = nearestWall(p.x, p.y, p.z, this.city.colliders, 1.85);
    if (!w) {
      const floor = standY(p.x, p.z, this.city.colliders);
      if (floor > 1 && p.y >= floor - 0.8) this.landOn(floor);
      else {
        this.mode = "air";
        this.crawlN = null;
      }
      return;
    }
    this.crawlN = { nx: w.nx, nz: w.nz, maxY: w.maxY };
    const fwd = lookDir(this.camYaw, 0);
    const right = new Vector3(fwd.z, 0, -fwd.x);
    const tx = fwd.x * -ins.moveY + right.x * ins.moveX;
    const tz = fwd.z * -ins.moveY + right.z * ins.moveX;
    const alongX = tx + w.nx * (tx * w.nx + tz * w.nz);
    const alongZ = tz + w.nz * (tx * w.nx + tz * w.nz);
    p.x += alongX * 3.6 * dt;
    p.z += alongZ * 3.6 * dt;
    let climb = 0;
    if (ins.climbHeld || ins.moveY < -0.12) climb = ins.sprint ? 5.6 : 4.2;
    else if (ins.moveY > 0.18) climb = -3.4;
    p.y += climb * dt;
    p.y = Math.max(0.35, p.y);
    const pinned = nearestWall(p.x, p.y, p.z, this.city.colliders, 1.85) ?? w;
    p.x = pinned.x + pinned.nx * 0.42;
    p.z = pinned.z + pinned.nz * 0.42;
    this.crawlN = { nx: pinned.nx, nz: pinned.nz, maxY: pinned.maxY };
    p.yaw = Math.atan2(-pinned.nx, -pinned.nz);
    this.playerMesh.setEnabled(true);
    if (p.y >= pinned.maxY - 0.42) {
      p.x = pinned.x - pinned.nx * 1.05;
      p.z = pinned.z - pinned.nz * 1.05;
      this.landOn(pinned.maxY);
      return;
    }
    if (ins.jumpPressed || (ins.swingHeld && !ins.climbHeld)) {
      p.vx = pinned.nx * 8.6;
      p.vz = pinned.nz * 8.6;
      p.vy = 6.4;
      this.mode = "air";
      this.crawlN = null;
      sharedSfx.whoosh();
    }
  }

  private walk(dt: number) {
    if (this.interior === "jail") {
      this.playerMesh.setEnabled(true);
      return this.walkFree(dt, 0.7);
    }
    this.walkFree(dt, 1);
  }

  private walkFree(dt: number, mul: number) {
    const kit = CHAR[this.player.character];
    const speed = (this.input.sprint ? SPRINT : WALK) * kit.speed * mul;
    const fwd = lookDir(this.camYaw, 0);
    const right = new Vector3(fwd.z, 0, -fwd.x);
    let vx = (fwd.x * -this.input.moveY + right.x * this.input.moveX) * speed;
    let vz = (fwd.z * -this.input.moveY + right.z * this.input.moveX) * speed;
    if (this.input.moveX !== 0 || this.input.moveY !== 0) {
      this.player.yaw = Math.atan2(vx, vz);
    }
    if (this.input.jumpPressed && this.player.grounded && this.interior === "street") {
      this.player.vy = JUMP_VEL;
      this.player.grounded = false;
    }
    this.player.vy += GRAVITY * dt;
    this.player.y += this.player.vy * dt;
    if (this.player.y <= 0) {
      if (!this.wasGrounded && this.player.vy < -4) this.camDip = 0.18;
      this.player.y = 0;
      this.player.vy = 0;
      this.player.grounded = true;
    }
    this.wasGrounded = this.player.grounded;
    const nx = this.player.x + vx * dt;
    const nz = this.player.z + vz * dt;
    if (!this.blocked(nx, this.player.z, PLAYER_R) && this.walkable(nx, this.player.z)) this.player.x = nx;
    if (!this.blocked(this.player.x, nz, PLAYER_R) && this.walkable(this.player.x, nz)) this.player.z = nz;
    this.playerMesh.setEnabled(true);
    const moving = Math.hypot(vx, vz) > 0.4 && this.player.grounded;
    this.stepT -= dt;
    if (moving && this.stepT <= 0) {
      this.stepT = 0.36;
      sharedSfx.footstep(this.surfaceRate());
    }
  }

  private surfaceRate(): number {
    if (pointInAABB(this.player.x, this.player.z, this.city.pier, 0.2)) return 1.45;
    const rx = [-60, -20, 20, 60];
    const rz = [-40, 0, 30, 60];
    if (rx.some((x) => Math.abs(this.player.x - x) < 4.2) || rz.some((z) => Math.abs(this.player.z - z) < 4.2)) return 1.05;
    if (Math.hypot(this.player.x + 28, this.player.z + 8) < 8) return 0.72;
    return 0.9;
  }

  private driveCar(dt: number) {
    const car = this.drive;
    if (!car || car.wrecked) {
      this.eject();
      return;
    }
    const spec = CAR_SPEC[car.kind];
    const eng = clamp(car.engineHp / 100, 0.18, 1);
    const tire = clamp(car.tires / 100, 0.22, 1);
    const throttle = -this.input.moveY;
    const steer = this.input.moveX;
    const misfire = car.engineHp < 35 && Math.random() < 0.03;
    const acc = (spec.torque / spec.mass) * eng;
    const top = spec.top * (0.55 + 0.45 * eng);
    const brk = spec.brake;
    if (this.input.brakeHeld) car.speed += (car.speed > 0 ? -1 : 1) * brk * dt;
    else if (throttle > 0.1 && !misfire) car.speed += acc * dt * throttle;
    else if (throttle < -0.1) car.speed -= brk * dt;
    else car.speed -= Math.sign(car.speed) * CAR_FRICTION * spec.traction * dt;
    if (Math.abs(car.speed) < 0.15 && Math.abs(throttle) < 0.1) car.speed = 0;
    car.speed = clamp(car.speed, -CAR_REV, top);
    let steerPow = spec.steer * (0.45 + 0.55 * tire) * (Math.abs(car.speed) / Math.max(8, top)) * 1.7;
    steerPow += Math.sin(this.time * 14) * 0.4 * (1 - tire);
    if (Math.abs(steer) > 0.4 && Math.abs(car.speed) > 10) car.speed *= (1 - spec.drift * 0.012);
    car.yaw = angWrap(car.yaw + steer * steerPow * Math.sign(car.speed || 1) * dt);
    const fx = Math.sin(car.yaw) * car.speed;
    const fz = Math.cos(car.yaw) * car.speed;
    const nx = car.x + fx * dt;
    const nz = car.z + fz * dt;
    const hitX = this.blocked(nx, car.z, 1.2) || !this.walkable(nx, car.z);
    const hitZ = this.blocked(car.x, nz, 1.2) || !this.walkable(car.x, nz);
    if (hitX || hitZ) {
      const impact = Math.abs(car.speed);
      if (impact > 6) this.hurtCar(car, (impact - 5) * 5.5 * spec.mass, impact > 13);
      car.speed *= -0.25;
    } else {
      car.x = nx;
      car.z = nz;
    }
    this.player.x = car.x;
    this.player.z = car.z;
    this.player.y = 0;
    this.player.yaw = car.yaw;
    this.playerMesh.setEnabled(false);
  }

  private hurtCar(car: Car, dmg: number, heavy: boolean) {
    if (car.wrecked) return;
    car.body -= dmg;
    if (heavy) {
      car.engineHp -= dmg * 0.45;
      car.tires -= dmg * 0.25;
    } else {
      car.engineHp -= dmg * 0.12;
    }
    car.body = Math.max(0, car.body);
    car.engineHp = Math.max(0, car.engineHp);
    car.tires = Math.max(0, car.tires);
    car.hp = car.body;
    this.paintCar(car);
    if (car.body < 45) this.ensureSmoke(car);
    const hardBoom = heavy && car.body < 8 && car.engineHp < 10 && Math.abs(car.speed) > 12;
    if (car.body <= 0) {
      car.wrecked = true;
      car.speed = 0;
      if (hardBoom) this.explodeCar(car);
      if (this.drive === car) {
        this.player.health -= 18;
        this.lastCombat = this.time;
        this.eject();
      }
    }
  }

  private paintCar(car: Car) {
    for (const ch of car.mesh.getChildMeshes()) {
      if ((ch.name === "hl" || ch.name === "hr") && ch.material instanceof StandardMaterial) {
        const on = car.body > 30 && car.engineHp > 20;
        ch.material.emissiveColor = on ? Color3.FromHexString("#f2e6c0").scale(0.85) : new Color3(0, 0, 0);
      }
      if (ch.name === "bd" && ch.material instanceof StandardMaterial) {
        const k = car.body / 100;
        const base = Color3.FromHexString(car.kind === "cop" ? "#f0f2f4" : car.color);
        ch.material.diffuseColor = base.scale(0.4 + 0.6 * k);
      }
    }
  }

  private explodeCar(car: Car) {
    car.exploding = true;
    car.boomT = 0.7;
    sharedSfx.explode();
    const ball = MeshBuilder.CreateSphere("boom", { diameter: 0.55, segments: 8 }, this.scene);
    ball.position.set(car.x, 1.15, car.z);
    const m = new StandardMaterial("bm", this.scene);
    m.emissiveColor = new Color3(1, 0.45, 0.1);
    m.diffuseColor = new Color3(1, 0.4, 0.1);
    ball.material = m;
    this.camPunch = 0.45;
    window.setTimeout(() => ball.dispose(), 560);
    const start = this.time;
    const grow = () => {
      const k = (this.time - start) / 0.45;
      if (k < 1 && !ball.isDisposed()) {
        ball.scaling.setAll(1 + k * 8);
        window.requestAnimationFrame(grow);
      }
    };
    window.requestAnimationFrame(grow);
    car.mesh.setEnabled(false);
  }

  private ensureSmoke(car: Car) {
    if (car.smoke) return;
    const ps = new ParticleSystem("sm", 60, this.scene);
    ps.particleTexture = this.flare;
    ps.emitter = car.mesh;
    ps.minEmitBox = new Vector3(-0.2, 0.8, 1.4);
    ps.maxEmitBox = new Vector3(0.2, 1.0, 1.7);
    ps.color1 = new Color3(0.25, 0.25, 0.25).toColor4(0.7);
    ps.color2 = new Color3(0.08, 0.08, 0.08).toColor4(0.2);
    ps.minSize = 0.3;
    ps.maxSize = 0.9;
    ps.minLifeTime = 0.4;
    ps.maxLifeTime = 0.9;
    ps.emitRate = car.body < 25 ? 48 : 28;
    ps.direction1 = new Vector3(-0.3, 1.2, -0.2);
    ps.direction2 = new Vector3(0.3, 2.0, 0.2);
    ps.start();
    car.smoke = ps;
  }

  private tryEnterExit() {
    if (this.interior === "jail") {
      if (this.cash >= BAIL) {
        this.cash -= BAIL;
        this.releaseJail(true);
      }
      return;
    }
    if (this.drive) {
      this.eject();
      return;
    }
    if (this.interior !== "street") {
      const room = this.city.interiors[this.interior];
      if (dist2(this.player.x, this.player.z, room.exitX, room.exitZ) < 2.4) {
        this.leaveInterior();
        return;
      }
    }
    if (this.tryRico()) return;
    let best: Car | null = null;
    let bestD = 3.4;
    for (const c of this.cars) {
      if (c.wrecked) continue;
      const d = dist2(this.player.x, this.player.z, c.x, c.z);
      if (d < bestD) { bestD = d; best = c; }
    }
    if (best && this.interior === "street") {
      if (this.hotwire && this.hotwire.car === best) return;
      const need = CAR_SPEC[best.kind].hotwire;
      if (need <= 0) this.enterCar(best);
      else this.hotwire = { car: best, t: 0 };
      return;
    }
    if (this.interior === "street") {
      const mart = this.city.interiors.mart;
      const gar = this.city.interiors.garage;
      if (dist2(this.player.x, this.player.z, mart.doorX, mart.doorZ) < 2.6) this.enterInterior("mart");
      else if (dist2(this.player.x, this.player.z, gar.doorX, gar.doorZ) < 2.8) this.enterInterior("garage");
    }
  }

  private tickHotwire(dt: number) {
    if (!this.hotwire) return;
    const hw = this.hotwire;
    if (!this.input.enterHeld || dist2(this.player.x, this.player.z, hw.car.x, hw.car.z) > 3.1) {
      this.hotwire = null;
      return;
    }
    hw.t += dt;
    const need = CAR_SPEC[hw.car.kind].hotwire;
    this.prompt = "HOTWIRE  " + Math.max(0, Math.ceil((need - hw.t) * 10) / 10);
    if (hw.t >= need) {
      this.enterCar(hw.car);
      this.hotwire = null;
    }
  }

  private enterCar(best: Car) {
    this.drive = best;
    best.occupied = true;
    best.stolen = true;
    this.enterLock = 0.35;
    this.jacked = true;
    this.camDist = 10;
    this.notifyCrime(best.x, best.z, "jack");
  }

  private enterInterior(id: "mart" | "garage") {
    const room = this.city.interiors[id];
    if (id === "garage") {
      const c = this.nearestCar(6);
      if (c && dist2(c.x, c.z, room.doorX, room.doorZ) < 9) {
        c.x = room.spawnX;
        c.z = room.spawnZ + 2.4;
        c.yaw = 0;
        this.parkedRepair = c;
      }
    }
    this.interior = id;
    this.player.x = room.spawnX;
    this.player.z = room.spawnZ;
    this.player.y = 0;
    this.camDist = room.camDist;
    this.enterLock = 0.3;
  }

  private leaveInterior() {
    if (this.interior === "street" || this.interior === "jail") return;
    const room = this.city.interiors[this.interior];
    if (this.parkedRepair && this.interior === "garage") {
      this.parkedRepair.x = LOC.garage.x;
      this.parkedRepair.z = LOC.garage.z + 8;
      this.parkedRepair = null;
    }
    this.player.x = room.streetX;
    this.player.z = room.streetZ;
    this.player.y = 0;
    this.interior = "street";
    this.camDist = 7.2;
    this.enterLock = 0.3;
  }

  private tryRico(): boolean {
    if (this.interior !== "street") return false;
    if (dist2(this.player.x, this.player.z, FENCE.x, FENCE.z) > 2.8) return false;
    if (this.stolenGoods && !this.ricoPaidJob) {
      this.cash += 280;
      this.ricoPaidJob = true;
      this.stolenGoods = false;
      if (this.ricoTalkBonus) { this.cash += 50; this.ricoTalkBonus = false; }
      this.subtitle = "Rico takes the bag. Don't come back loud.";
      this.persist();
      return true;
    }
    const car = this.nearestCar(5);
    if (car && car.stolen && this.ricoCars < 3) {
      this.cash += 120;
      this.ricoCars += 1;
      car.stolen = false;
      if (this.ricoTalkBonus) { this.cash += 50; this.ricoTalkBonus = false; }
      this.subtitle = "Rico parks it. Cash in the pocket.";
      this.persist();
      return true;
    }
    return false;
  }

  private eject() {
    if (!this.drive) return;
    const c = this.drive;
    c.occupied = false;
    c.speed = 0;
    this.player.x = c.x + Math.cos(c.yaw) * 2.1;
    this.player.z = c.z - Math.sin(c.yaw) * 2.1;
    if (this.blocked(this.player.x, this.player.z, PLAYER_R)) {
      this.player.x = c.x;
      this.player.z = c.z + 2.2;
    }
    this.drive = null;
    this.enterLock = 0.35;
    this.camDist = this.interior === "street" ? 8.6 : 5.2;
    this.playerMesh.setEnabled(true);
  }

  private blocked(x: number, z: number, r: number): boolean {
    const cols = this.interior === "street" ? this.city.colliders : this.city.interiors[this.interior].colliders;
    for (const b of cols) {
      if (x + r > b.minX && x - r < b.maxX && z + r > b.minZ && z - r < b.maxZ) return true;
    }
    return false;
  }

  private walkable(x: number, z: number): boolean {
    if (this.interior !== "street") {
      const id = this.interior;
      const c = id === "mart" ? { x: INT.mart.ox, z: INT.mart.oz, hw: 5.6, hd: 4.6 }
        : id === "garage" ? { x: INT.garage.ox, z: INT.garage.oz, hw: 6.6, hd: 5.6 }
        : { x: INT.jail.ox, z: INT.jail.oz, hw: 4.2, hd: 3.6 };
      return Math.abs(x - c.x) < c.hw && Math.abs(z - c.z) < c.hd;
    }
    if (z > this.city.waterZ && !pointInAABB(x, z, this.city.pier, 0.2)) return false;
    if (Math.abs(x) > 92 || z < -78 || z > 94) return false;
    return true;
  }

  private combat(dt: number) {
    if (this.input.meleePressed && this.player.meleeT <= 0) {
      this.player.meleeT = MELEE_CD;
      sharedSfx.punch();
      this.meleeHit();
    }
    if (this.input.shootPressed || (this.input.fireHeld && this.player.fireT <= 0)) {
      if (this.player.fireT > 0) return;
      this.player.fireT = 0.28;
      this.camPunch = 0.1;
      if (this.input.showTouch) this.nudgeAim();
      this.webShot();
    }
    void dt;
  }


  private nudgeAim() {
    let best = 0.42;
    let yaw = this.camYaw;
    const consider = (x: number, z: number) => {
      const dx = x - this.player.x;
      const dz = z - this.player.z;
      const d = Math.hypot(dx, dz);
      if (d < 2 || d > 26) return;
      const want = Math.atan2(dx, dz);
      const diff = angWrap(want - this.camYaw);
      if (Math.abs(diff) < best) { best = Math.abs(diff); yaw = this.camYaw + diff * 0.55; }
    };
    for (const p of this.peds) if (p.state !== "down") consider(p.x, p.z);
    for (const c of this.cops) if (c.state !== "down") consider(c.x, c.z);
    this.camYaw = yaw;
  }

  private webShot() {
    const origin = new Vector3(this.player.x, this.player.y + 1.35, this.player.z);
    const dir = lookDir(this.camYaw, this.camPitch * 0.45);
    dir.y = Math.max(-0.08, dir.y);
    dir.normalize();
    sharedSfx.web();
    let hitT = GUN_RANGE;
    let hitPed: Ped | null = null;
    let hitCop: Cop | null = null;
    if (this.interior === "street") {
      for (const b of this.city.colliders) {
        const t = this.rayAABB(origin, dir, b);
        if (t > 0.2 && t < hitT) { hitT = t; hitPed = null; hitCop = null; }
      }
    }
    for (const p of this.peds) {
      if (p.state === "down" || p.state === "webbed") continue;
      if (p.role === "clerk" || p.role === "fence") continue;
      if (this.interior !== "street") continue;
      const t = this.raySphere(origin, dir, p.x, 0.9, p.z, 0.55);
      if (t > 0.2 && t < hitT) { hitT = t; hitPed = p; hitCop = null; }
    }
    for (const c of this.cops) {
      if (c.state === "down" || c.state === "webbed" || this.interior !== "street") continue;
      const t = this.raySphere(origin, dir, c.x, 0.9, c.z, 0.55);
      if (t > 0.2 && t < hitT) { hitT = t; hitPed = null; hitCop = c; }
    }
    const end = origin.add(dir.scale(hitT));
    this.spawnTracer(origin, end, true);
    this.spawnSpark(end);
    if (hitPed) this.webTarget(hitPed, false);
    if (hitCop) this.webTarget(hitCop, true);
    if (hitPed || hitCop) this.notifyCrime(this.player.x, this.player.z, "melee");
  }

  private webTarget(t: Ped | Cop, cop: boolean) {
    const d = dist2(this.player.x, this.player.z, t.x, t.z);
    t.state = "webbed";
    t.downT = cop ? 5.2 : 4.2;
    this.stuns += 1;
    this.lastCombat = this.time;
    if (d < 9.5) {
      const k = 0.38;
      t.x += (this.player.x - t.x) * k;
      t.z += (this.player.z - t.z) * k;
      if (this.mode === "air" || this.mode === "swing") {
        const inv = d || 1;
        this.player.vx += ((t.x - this.player.x) / inv) * 6;
        this.player.vz += ((t.z - this.player.z) / inv) * 6;
        this.player.vy += 1.4;
      }
    }
  }

  private meleeHit() {
    const fwd = lookDir(this.player.yaw, 0);
    const px = this.player.x + fwd.x * 1.1;
    const pz = this.player.z + fwd.z * 1.1;
    const air = this.mode === "air" || this.mode === "swing" || this.mode === "zip";
    this.notifyCrime(this.player.x, this.player.z, "melee");
    for (const p of this.peds) {
      if (p.state === "down") continue;
      if (dist2(px, pz, p.x, p.z) < MELEE_RANGE + (air ? 0.5 : 0)) {
        if (air && this.player.y > 2.2) {
          this.hurtPed(p, 80);
          sharedSfx.impact();
        } else this.hurtPed(p, MELEE_DMG);
      }
    }
    for (const c of this.cops) {
      if (c.state === "down") continue;
      if (dist2(px, pz, c.x, c.z) < MELEE_RANGE + (air ? 0.5 : 0)) {
        if (air && this.player.y > 2.2) {
          this.hurtCop(c, 80);
          sharedSfx.impact();
        } else this.hurtCop(c, MELEE_DMG);
      }
    }
  }

  private hurtPed(p: Ped, dmg: number) {
    p.hp -= dmg;
    this.lastCombat = this.time;
    if (p.hp <= 0) {
      p.state = "down";
      p.downT = 8;
      p.mesh.rotation.x = Math.PI / 2;
      p.mesh.position.y = 0.3;
    } else if (p.role !== "clerk" && p.role !== "fence") p.state = "flee";
  }

  private hurtCop(c: Cop, dmg: number) {
    c.hp -= dmg;
    this.lastCombat = this.time;
    this.lastSeen = this.time;
    this.addStar(c.state === "down" ? 0 : 1);
    if (c.hp <= 0) {
      c.state = "down";
      c.downT = 10;
      c.mesh.rotation.x = Math.PI / 2;
      c.mesh.position.y = 0.3;
      this.addStar(1);
    }
  }

  private notifyCrime(x: number, z: number, kind: "jack" | "gun" | "melee") {
    if (this.interior !== "street") return;
    for (const c of this.cops) {
      if (c.state === "down" || c.state === "webbed") continue;
      const d = dist2(c.x, c.z, x, z);
      if (d < WITNESS_R && this.hasLOS(c.x, c.z, x, z) && kind !== "jack") {
        this.addStar(1);
        this.lastSeen = this.time;
        this.markKnown();
        return;
      }
    }
    for (const p of this.peds) {
      if (p.state === "down" || p.role === "clerk" || p.role === "fence") continue;
      const d = dist2(p.x, p.z, x, z);
      if (d > WITNESS_R) continue;
      if (!this.hasLOS(p.x, p.z, x, z)) continue;
      const caller = p.role === "sit" || ((p.x * 13 + p.z * 7) % 10) > 4;
      if (caller && p.state !== "call") {
        p.state = "call";
        p.callT = CALL_T;
      } else p.state = "flee";
    }
  }

  private spawnFlash(p: Vector3) {
    const b = MeshBuilder.CreateBox("mz", { width: 0.1, height: 0.08, depth: 0.2 }, this.scene);
    b.position.copyFrom(p);
    b.material = mat(this.scene, "#ffe6a0", 1);
    window.setTimeout(() => { if (!b.isDisposed()) b.dispose(); }, 55);
  }

  private spawnSpark(p: Vector3) {
    const s = MeshBuilder.CreateSphere("sp", { diameter: 0.14, segments: 4 }, this.scene);
    s.position.copyFrom(p);
    s.material = mat(this.scene, "#ffc83d", 1);
    window.setTimeout(() => { if (!s.isDisposed()) s.dispose(); }, 80);
  }

  private spawnTracer(a: Vector3, b: Vector3, web = false) {
    const line = MeshBuilder.CreateLines("tr", { points: [a, b] }, this.scene);
    line.color = web ? Color3.FromHexString(CHAR[this.player.character].color) : new Color3(1, 0.85, 0.35);
    this.tracers.push({ mesh: line, life: web ? 0.16 : TRACER_LIFE });
  }

  private updateTracers(dt: number) {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      if (t.life <= 0) {
        t.mesh.dispose();
        this.tracers.splice(i, 1);
      }
    }
  }

  private raySphere(o: Vector3, d: Vector3, x: number, y: number, z: number, r: number): number {
    const cx = o.x - x, cy = o.y - y, cz = o.z - z;
    const b = cx * d.x + cy * d.y + cz * d.z;
    const c = cx * cx + cy * cy + cz * cz - r * r;
    const disc = b * b - c;
    if (disc < 0) return -1;
    const t = -b - Math.sqrt(disc);
    return t > 0 ? t : -1;
  }

  private rayAABB(o: Vector3, d: Vector3, b: AABB): number {
    let tmin = 0;
    let tmax = GUN_RANGE;
    const axes: ["x" | "y" | "z", number, number][] = [
      ["x", o.x, d.x],
      ["y", o.y, d.y],
      ["z", o.z, d.z],
    ];
    const min = { x: b.minX, y: b.minY, z: b.minZ };
    const max = { x: b.maxX, y: b.maxY, z: b.maxZ };
    for (const [ax, orig, dir] of axes) {
      if (Math.abs(dir) < 1e-6) {
        if (orig < min[ax] || orig > max[ax]) return -1;
        continue;
      }
      let t1 = (min[ax] - orig) / dir;
      let t2 = (max[ax] - orig) / dir;
      if (t1 > t2) { const k = t1; t1 = t2; t2 = k; }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmax < tmin) return -1;
    }
    return tmin > 0 ? tmin : -1;
  }

  private addStar(n: number) {
    const next = clamp(this.stars + n, 0, STAR_MAX);
    if (next !== this.stars) {
      this.stars = next;
      this.lastSeen = this.time;
      this.markKnown();
      this.ensureCops();
      this.persist();
    }
  }

  private markKnown() {
    this.lastKnownX = this.player.x;
    this.lastKnownZ = this.player.z;
    this.searchX = this.player.x;
    this.searchZ = this.player.z;
    this.searchR = SEARCH_R0;
    this.searchT = SEARCH_T0;
    this.searching = false;
    this.lastSeenKind = this.drive ? this.drive.kind : "foot";
  }

  private ensureCops() {
    const want = this.stars <= 0 ? 0 : this.stars === 1 ? 1 : 2;
    const live = this.cops.filter((c) => c.state === "chase").length;
    for (let i = live; i < want; i++) this.spawnCopFar();
  }

  private spawnCopFar() {
    const pts = this.city.roads.filter((p) => {
      const d = dist2(p.x, p.z, this.player.x, this.player.z);
      return d >= SPAWN_PAD && !this.blocked(p.x, p.z, 0.6);
    });
    if (!pts.length) return;
    pts.sort((a, b) => dist2(a.x, a.z, PD.x, PD.z) - dist2(b.x, b.z, PD.x, PD.z));
    const pick = pts[Math.min(pts.length - 1, Math.floor(Math.random() * Math.min(4, pts.length)))];
    if (dist2(pick.x, pick.z, this.player.x, this.player.z) < SPAWN_PAD) return;
    const mesh = makeCop(this.scene);
    mesh.position.set(pick.x, 0, pick.z);
    this.cops.push({ mesh, x: pick.x, z: pick.z, yaw: 0, hp: 70, state: "chase", fireT: 0.6, downT: 0 });
  }

  private updatePeds(dt: number) {
    for (const p of this.peds) {
      if (p.state === "down") {
        p.downT -= dt;
        continue;
      }
      if (p.state === "webbed") {
        p.downT -= dt;
        p.mesh.position.set(p.x, 0, p.z);
        for (const ch of p.mesh.getChildMeshes(false)) {
          if (ch.name === "larm" || ch.name === "rarm") ch.rotation.x = -1.8;
        }
        if (p.downT <= 0) p.state = "flee";
        continue;
      }
      if (p.role === "clerk") {
        if (this.storeRobbed && this.interior === "mart") {
          p.z = Math.min(INT.mart.oz + 4.4, p.z + dt * 1.4);
          p.yaw = Math.atan2(this.player.x - p.x, this.player.z - p.z) + Math.PI;
        }
        p.mesh.position.set(p.x, 0, p.z);
        p.mesh.rotation.y = p.yaw;
        continue;
      }
      if (p.role === "fence") {
        p.mesh.position.set(p.x, 0, p.z);
        p.mesh.rotation.y = p.yaw;
        continue;
      }
      if (p.state === "call") {
        p.callT -= dt;
        for (const ch of p.mesh.getChildMeshes(false)) {
          if (ch.name === "rarm") ch.rotation.x = -2.1;
        }
        if (p.callT <= 0) {
          this.addStar(1);
          p.state = "flee";
        }
        p.mesh.position.set(p.x, 0, p.z);
        continue;
      }
      if (p.role === "sit" && p.state === "sit") {
        for (const ch of p.mesh.getChildMeshes(false)) {
          if (ch.name === "lleg" || ch.name === "rleg") ch.rotation.x = 1.15;
        }
        p.mesh.position.set(p.x, 0.42, p.z);
        p.mesh.rotation.y = p.yaw;
        continue;
      }
      if (this.stars > 0 || p.state === "flee") {
        const dx = p.x - this.player.x;
        const dz = p.z - this.player.z;
        const d = Math.hypot(dx, dz) || 1;
        p.tx = p.x + (dx / d) * 8;
        p.tz = p.z + (dz / d) * 8;
        p.state = "flee";
      } else if (p.role === "group") {
        p.yaw += Math.sin(this.time + p.x) * dt * 0.4;
      } else if (p.role === "cross") {
        if (p.state === "wait") {
          p.waitT -= dt;
          if (p.waitT <= 0) {
            p.state = "wander";
            const c = this.city.crossings[Math.floor(Math.random() * this.city.crossings.length)];
            p.tx = c.x; p.tz = c.z;
          }
        } else if (dist2(p.x, p.z, p.tx, p.tz) < 0.7) {
          p.state = "wait";
          p.waitT = 1;
        }
      } else if (dist2(p.x, p.z, p.tx, p.tz) < 0.6) {
        p.tx = p.x + (Math.random() - 0.5) * 16;
        p.tz = p.z + (Math.random() - 0.5) * 16;
      }
      if (p.role !== "group" || p.state === "flee") {
        const spd = p.state === "flee" ? 6.2 : 1.6;
        const ax = p.tx - p.x;
        const az = p.tz - p.z;
        const d = Math.hypot(ax, az) || 1;
        const nx = p.x + (ax / d) * spd * dt;
        const nz = p.z + (az / d) * spd * dt;
        if (!this.blocked(nx, p.z, 0.4) && this.walkable(nx, p.z)) p.x = nx;
        if (!this.blocked(p.x, nz, 0.4) && this.walkable(p.x, nz)) p.z = nz;
        p.yaw = Math.atan2(ax, az);
      }
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.yaw;
      tickWalk(p.mesh, this.time, p.state !== "sit" && p.role !== "group");
    }
  }

  private updateCops(dt: number) {
    if (this.stars <= 0) {
      for (const c of this.cops) c.mesh.dispose();
      this.cops = [];
      this.searching = false;
      return;
    }
    this.ensureCops();
    let seen = false;
    for (const c of this.cops) {
      if (c.state === "down") {
        c.downT -= dt;
        continue;
      }
      if (c.state === "webbed") {
        c.downT -= dt;
        c.mesh.position.set(c.x, 0, c.z);
        for (const ch of c.mesh.getChildMeshes(false)) {
          if (ch.name === "larm" || ch.name === "rarm") ch.rotation.x = -1.8;
        }
        if (c.downT <= 0) c.state = "chase";
        continue;
      }
      const d = dist2(c.x, c.z, this.player.x, this.player.z);
      const high = this.player.y > 14 || this.mode === "swing" || this.mode === "zip";
      const hasLos = this.interior === "street" && d < 42 && !high && this.hasLOS(c.x, c.z, this.player.x, this.player.z);
      if (hasLos) { this.lastSeen = this.time; seen = true; this.markKnown(); }
      let tx = this.player.x;
      let tz = this.player.z;
      if (this.searching && !hasLos) {
        tx = this.searchX + Math.sin(this.time * 0.4 + c.x) * this.searchR * 0.35;
        tz = this.searchZ + Math.cos(this.time * 0.35 + c.z) * this.searchR * 0.35;
        const road = this.city.roads.find((p) => dist2(p.x, p.z, this.searchX, this.searchZ) < this.searchR);
        if (road && (Math.floor(this.time + c.x) % 4 === 0)) { tx = road.x; tz = road.z; }
      }
      const ax = tx - c.x;
      const az = tz - c.z;
      const ad = Math.hypot(ax, az) || 1;
      const nx = c.x + (ax / ad) * COP_FOOT * dt;
      const nz = c.z + (az / ad) * COP_FOOT * dt;
      if (!this.blocked(nx, c.z, 0.45)) c.x = nx;
      if (!this.blocked(c.x, nz, 0.45)) c.z = nz;
      c.yaw = Math.atan2(ax, az);
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.yaw;
      tickWalk(c.mesh, this.time, true);
      c.fireT -= dt;
      if (hasLos && d < 22 && d > ARREST_R + 0.15 && c.fireT <= 0) {
        c.fireT = COP_SHOT_CD;
        this.player.health -= COP_DMG;
        this.player.flash = 0.12;
        this.lastCombat = this.time;
        const origin = new Vector3(c.x, 1.3, c.z);
        const dest = new Vector3(this.player.x, 1.3, this.player.z);
        this.spawnTracer(origin, dest);
        sharedSfx.gunshot();
        if (this.player.health <= 0) this.bust();
      }
    }
    this.copTarget = { x: this.searchX, z: this.searchZ };
    void seen;
  }

  private hasLOS(ax: number, az: number, bx: number, bz: number): boolean {
    const o = new Vector3(ax, 1.2, az);
    const d = new Vector3(bx - ax, 0, bz - az);
    const len = d.length();
    if (len < 0.2) return true;
    d.normalize();
    for (const b of this.city.colliders) {
      const t = this.rayAABB(o, d, b);
      if (t > 0.4 && t < len - 0.5) return false;
    }
    return true;
  }

  private wantedDecay(dt: number) {
    if (this.stars <= 0) { this.searching = false; return; }
    const seenRecently = this.time - this.lastSeen < 0.4;
    if (seenRecently) return;
    this.searching = true;
    let rate = 1;
    if (this.interior === "garage") rate = 2.4;
    if (this.player.y > 12) rate *= 2.6;
    if (this.mode === "swing" || this.mode === "zip") rate *= 1.35;
    const nowKind = this.drive ? this.drive.kind : "foot";
    if (nowKind !== this.lastSeenKind) rate *= 1.55;
    this.searchT -= dt * rate;
    this.searchR = 14 + 26 * clamp(this.searchT / SEARCH_T0, 0, 1);
    if (this.searchT <= 0) {
      this.stars = Math.max(0, this.stars - 1);
      if (this.stars > 0) {
        this.searchT = 16;
        this.searchR = 28;
      } else this.searching = false;
      this.persist();
    }
  }

  private tickArrest(dt: number) {
    if (this.interior !== "street" || this.mode !== "ground" || this.drive || this.stars <= 0) { this.stillT = 0; return; }
    let close = false;
    for (const c of this.cops) {
      if (c.state === "down") continue;
      if (dist2(c.x, c.z, this.player.x, this.player.z) < ARREST_R) close = true;
    }
    if (!close) { this.stillT = 0; return; }
    const still = Math.hypot(this.input.moveX, this.input.moveY) < 0.12;
    this.prompt = this.prompt || "G  SURRENDER";
    if (still) this.stillT += dt; else this.stillT = 0;
    if (this.input.surrenderPressed || this.stillT > 0.85) this.startJail();
  }

  private startJail() {
    this.eject();
    this.interior = "jail";
    this.mode = "ground";
    this.rope = null;
    this.zipTo = null;
    this.silk.setEnabled(false);
    this.player.x = this.city.interiors.jail.spawnX;
    this.player.z = this.city.interiors.jail.spawnZ;
    this.player.y = 0;
    this.player.health = this.player.maxHealth;
    this.camDist = this.city.interiors.jail.camDist;
    this.jailT = 0;
    this.jailTalked = false;
    this.busted = true;
    this.fade = 0.55;
    this.searching = false;
    window.setTimeout(() => { this.busted = false; this.fade = 0; }, 700);
  }

  private tickJail(dt: number) {
    this.prompt = "F  PAY BAIL $" + BAIL + "    T  TALK    WAIT " + Math.max(0, Math.ceil(JAIL_WAIT - this.jailT));
    this.subtitle = "NCPD holding cell. Short stay.";
    if (this.input.talkPressed && !this.jailTalked) {
      this.jailTalked = true;
      this.ricoTalkBonus = true;
      this.subtitle = "Guard: Rico on the pier still floats bail notes.";
    }
    this.jailT += dt;
    if (this.jailT >= JAIL_WAIT) this.releaseJail(false);
  }

  private releaseJail(paid: boolean) {
    this.interior = "street";
    this.player.x = PD_OUT.x;
    this.player.z = PD_OUT.z;
    this.player.y = 0;
    this.stars = 0;
    this.searching = false;
    this.camDist = 7.2;
    if (!paid) this.cash = Math.max(0, this.cash - 80);
    this.subtitle = paid ? "Bail posted. Sidewalk. Stars gone." : "Time served. South Docks sidewalk.";
    this.persist();
  }

  private bust() {
    this.startJail();
  }

  private regen(dt: number) {
    if (this.time - this.lastCombat < REGEN_DELAY) return;
    if (this.player.health < this.player.maxHealth) {
      this.player.health = Math.min(this.player.maxHealth, this.player.health + REGEN_RATE * dt);
    }
  }

  private updateCarsFx(_dt: number) {
    for (const c of this.cars) {
      const bob = Math.abs(c.speed) > 1 ? Math.sin(this.time * 11) * 0.035 * Math.min(1, Math.abs(c.speed) / 14) : 0;
      c.mesh.position.set(c.x, bob, c.z);
      c.mesh.rotation.y = c.yaw;
      if (this.drive === c) {
        c.mesh.rotation.z = -this.input.moveX * 0.09 * Math.min(1, Math.abs(c.speed) / 9);
      } else {
        c.mesh.rotation.z = 0;
      }
    }
  }

  private cameraFollow() {
    const spd = Math.hypot(this.player.vx, this.player.vy, this.player.vz);
    const flying = this.mode === "swing" || this.mode === "zip" || this.mode === "air" || this.mode === "crawl";
    const wantDist = this.drive ? 11.2
      : this.interior !== "street" ? this.camDist
      : flying ? 9.2 + Math.min(4.2, spd * 0.055)
      : 8.2;
    this.camDist += (wantDist - this.camDist) * 0.12;
    const wantFov = flying ? 0.86 + Math.min(0.24, spd * 0.0055) : 0.78;
    this.camFov += (wantFov - this.camFov) * 0.1;
    this.camera.fov = this.camFov;
    const wantRoll = flying
      ? -this.input.moveX * 0.06 - clamp(this.player.vx * 0.003, -0.08, 0.08)
      : -this.input.moveX * 0.03;
    this.camRoll += (wantRoll - this.camRoll) * 0.1;

    const dir = lookDir(this.camYaw, this.camPitch);
    const target = new Vector3(
      this.player.x + this.player.vx * 0.1,
      this.player.y + 1.45 - this.camDip * 0.5,
      this.player.z + this.player.vz * 0.1,
    );
    const want = this.camDist + this.camPunch * 1.4;
    let pos = target.subtract(dir.scale(want));
    if (this.interior === "street") {
      for (let d = want; d > 2.0; d -= 0.35) {
        const p = target.subtract(dir.scale(d));
        if (!this.blocked(p.x, p.z, 0.22) || p.y > 6) { pos = p; break; }
      }
    }
    this.camera.position.copyFrom(pos);
    this.camera.setTarget(target);
    this.camera.rotation.z += this.camRoll;
  }

  private syncMeshes() {
    this.playerMesh.position.set(this.player.x, this.player.y, this.player.z);
    this.playerMesh.rotation.y = this.player.yaw;
    const flying = this.mode === "swing" || this.mode === "zip" || this.mode === "air";
    this.playerMesh.setEnabled(!this.drive);
    if (this.drive) {
      this.silk.setEnabled(false);
      this.aimOrb.setEnabled(false);
    } else if (this.mode === "crawl") tickCrawlPose(this.playerMesh, this.time);
    else if (flying) tickSwingPose(this.playerMesh, this.time, this.mode === "swing" || this.mode === "zip");
    else {
      const moving = Math.hypot(this.player.vx, this.player.vz) > 0.45;
      if (this.interior !== "jail") tickWalk(this.playerMesh, this.time, moving);
    }
    if (this.aim && this.interior === "street") {
      this.aimOrb.setEnabled(true);
      this.aimOrb.position.set(this.aim.x, this.aim.y, this.aim.z);
      const pulse = 0.85 + Math.sin(this.time * 9) * 0.18;
      this.aimOrb.scaling.setAll(pulse);
    } else {
      this.aimOrb.setEnabled(false);
    }
    if (this.mode !== "swing" && this.mode !== "zip") this.silk.setEnabled(false);
    this.placeMarker();
  }

  private placeMarker() {
    let x = CRANE_GOAL.x;
    let z = CRANE_GOAL.z;
    let y = 1.2;
    switch (this.mission) {
      case "launch":
        x = this.player.x + Math.sin(this.camYaw) * 10;
        z = this.player.z + Math.cos(this.camYaw) * 10;
        y = 8;
        break;
      case "crane":
        x = CRANE_GOAL.x; z = CRANE_GOAL.z; y = CRANE_GOAL.y;
        break;
      case "sweep":
        x = LOC.mart.x; z = LOC.mart.z + 8; y = 1.1;
        break;
      case "ghost":
        x = 0; z = -58; y = 28;
        break;
      case "free":
        this.marker.setEnabled(false);
        return;
      default: {
        const _never: never = this.mission;
        void _never;
        this.marker.setEnabled(false);
        return;
      }
    }
    this.marker.setEnabled(this.interior === "street");
    this.marker.position.set(x, y + Math.sin(this.time * 3) * 0.18, z);
    this.marker.rotation.y = this.time * 0.6;
  }

  private missions(_dt: number) {
    if (this.interior === "jail") return;
    this.prompt = "";
    const nearCar = this.nearestCar(3.2);
    const canClimb = !!nearestWall(this.player.x, Math.max(0.35, this.player.y + 0.4), this.player.z, this.city.colliders, 1.85);

    switch (this.mission) {
      case "launch":
        this.subtitle = "Hold SALIN. Stick a line. Swing.";
        this.prompt = this.aim ? "HOLD F  SALIN" : "LOOK UP  HOLD F / SALIN";
        if (this.launched || this.mode === "swing" || this.mode === "zip") {
          this.mission = "crane";
          this.subtitle = "Ride the line to the dock crane.";
          this.persist();
        }
        break;
      case "crane":
        this.subtitle = "Ride the line to the dock crane.";
        if (this.aim) this.prompt = this.mode === "swing" ? "STEER  RELEASE TO FLY" : "HOLD F  SALIN    E  ZIP";
        if (dist2(this.player.x, this.player.z, CRANE_GOAL.x, CRANE_GOAL.z) < 8.5 && this.player.y > 8) {
          this.mission = "sweep";
          this.subtitle = "Web-stun three on the strip. ATEŞ.";
          this.persist();
        }
        break;
      case "sweep":
        this.subtitle = "Web-stun three on the strip. ATEŞ.  " + this.stuns + "/3";
        this.prompt = "CLICK / ATEŞ  STUN    V  MELEE";
        if (this.stuns >= 3) {
          this.mission = "ghost";
          this.subtitle = "Climb the skyline. Lose the heat.";
          this.persist();
        }
        break;
      case "ghost":
        if (!this.ghostArmed) {
          this.ghostArmed = true;
          if (this.stars < 1) this.addStar(1);
        }
        this.subtitle = "Swing high. Let the search die.";
        this.prompt = this.player.y > 12 ? "HIGH  HEAT FADING" : "GET ABOVE THE ROOFS";
        if (this.stars <= 0 && this.player.y > 8) {
          this.escaped = true;
          this.mission = "free";
          this.subtitle = "South Docks is yours. Keep swinging.";
          this.persist();
        }
        break;
      case "free":
        this.subtitle = "South Docks. Keep swinging.";
        if (this.aim && this.mode === "ground") this.prompt = "HOLD F  SALIN";
        else if (this.mode === "swing") this.prompt = "RELEASE  FLY    E  ZIP";
        else if (this.mode === "crawl") this.prompt = "HOLD C  TIRMAN    VAULT AT LEDGE";
        break;
      default: {
        const _never: never = this.mission;
        void _never;
      }
    }
    if (this.drive) this.prompt = "F / BİN  İN";
    else if (nearCar && this.mode === "ground" && this.player.y < 1.35) {
      const need = CAR_SPEC[nearCar.kind].hotwire;
      this.prompt = need > 0 ? "HOLD F  BİN" : "F  BİN";
    } else if (this.mode === "crawl") this.prompt = "HOLD C  TIRMAN    VAULT THE LEDGE";
    else if (canClimb && this.mode === "ground") this.prompt = this.prompt || "HOLD C  TIRMAN";
  }

  private nearestCar(r: number): Car | null {
    let best: Car | null = null;
    let d0 = r;
    for (const c of this.cars) {
      if (c.wrecked) continue;
      const d = dist2(this.player.x, this.player.z, c.x, c.z);
      if (d < d0) { d0 = d; best = c; }
    }
    return best;
  }

  hud(): HudState {
    const h = emptyHud();
    h.cash = this.cash;
    h.stars = this.stars;
    h.health = Math.max(0, this.player.health);
    h.maxHealth = this.player.maxHealth;
    h.ammo = 0;
    h.reserve = 0;
    h.reloading = false;
    h.prompt = this.prompt;
    h.subtitle = this.subtitle;
    h.inCar = !!this.drive;
    h.vehicleHp = this.drive ? Math.round((this.drive.body + this.drive.engineHp + this.drive.tires) / 3) : 0;
    h.mode = this.mode;
    h.speed = Math.hypot(this.player.vx, this.player.vy, this.player.vz);
    h.canAttach = !!this.aim && !this.drive;
    h.nearCar = !!this.nearestCar(3.2) && this.mode === "ground" && this.player.y < 1.35 && !this.drive;
    h.canClimb = !this.drive && !!nearestWall(this.player.x, Math.max(0.35, this.player.y + 0.4), this.player.z, this.city.colliders, 1.85);
    h.fade = this.fade;
    h.busted = this.busted;
    h.fps = this.fps;
    h.character = this.player.character;
    h.radioLive = radio.isLive();
    h.district = this.interior === "mart" ? "Nova Mart" : this.interior === "garage" ? "Maya Garage" : this.interior === "jail" ? "NCPD Hold" : "South Docks";
    h.mapX = this.interior === "street" ? this.player.x : (this.interior === "mart" ? LOC.mart.x : this.interior === "garage" ? LOC.garage.x : PD.x);
    h.mapZ = this.interior === "street" ? this.player.z : (this.interior === "mart" ? LOC.mart.z : this.interior === "garage" ? LOC.garage.z : PD.z);
    h.mapYaw = this.player.yaw;
    h.mapGoalX = this.marker.isEnabled() ? this.marker.position.x : 999;
    h.mapGoalZ = this.marker.isEnabled() ? this.marker.position.z : 999;
    h.mapCars = this.cars.filter((c) => !c.wrecked).slice(0, 3).map((c) => ({ x: c.x, z: c.z }));
    h.searching = this.searching && this.stars > 0;
    h.localSave = this.hasSave;
    h.interior = this.interior;
    switch (this.mission) {
      case "launch": h.missionTitle = "LINE"; h.missionHint = "Stick a line"; break;
      case "crane": h.missionTitle = "CRANE"; h.missionHint = "Swing to the docks crane"; break;
      case "sweep": h.missionTitle = "SWEEP"; h.missionHint = "Stun three  " + this.stuns + "/3"; break;
      case "ghost": h.missionTitle = "GHOST"; h.missionHint = "Lose heat above the roofs"; break;
      case "free": h.missionTitle = "FREE"; h.missionHint = "South Docks"; break;
      default: {
        const _never: never = this.mission;
        void _never;
      }
    }
    return h;
  }
}

export function bootAudio() {
  gestureUnlock();
  sharedSfx.ensure();
  radio.play();
}
