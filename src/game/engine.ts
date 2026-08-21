import {
  Color3, Engine, FreeCamera, Mesh, MeshBuilder, ParticleSystem, PointLight, Quaternion, Scene,
  StandardMaterial, Vector3,
} from "@babylonjs/core";
import { ASSIST, aimAngles, angError, lookFriction, magnetBlend, scoreAssist, type AssistHit } from "./aim";
import { clubBass, clubBed, gestureUnlock, radio, sharedSfx } from "./audio";
import { buildCity, tickCityArt, type CityData } from "./city";
import { blockedAt, centerInside, circleHitsAABB, landFloor, resolveCapsule, slideMove, unstickCircle } from "./collide";
import {
  ARREST_R, BAIL, CALL_T, CAR_FRICTION, CAR_HP, CAR_REV, CAR_SPEC, CHAR, CLUB_BED, CLUB_BEDS, CLUB_SIZE, CLUB_VIP,
  CLUB_VIP_ROOM, COP_DMG,
  COP_FOOT, COP_SHOT_CD, CRANE_GOAL, FENCE, FIRE_CD, GRAVITY, GUN_DMG, GUN_RANGE, INT, JAIL_WAIT,
  JUMP_VEL, LOC, MAG, MELEE_CD, MELEE_DMG, MELEE_RANGE, PD, PD_OUT, PLAYER_R,
  REGEN_DELAY, REGEN_RATE, RELOAD_T, REPAIR_COST, RESERVE, SAVE_KEY, SEARCH_R0,
  SEARCH_T0, SPAWN_PAD, SPRINT, STAR_MAX, TRACER_LIFE, WALK, WITNESS_R, angWrap,
  clamp, dist2,
} from "./constants";
import type { Input } from "./input";
import {
  findNamed, flareTex, lookDir, makeBouncer, makeCar, makeCop, makeDancer, makeHero, makePed, makeSilk, makeWoman, mat, placeSilk,
  resetBodyPose, setGunHolstered, tickClimbPose, tickDancePose, tickDownPose, tickGunPose, tickLapDancePose,
  tickSexPose, tickSitPose, tickSwingPose, tickWalk,
} from "./meshes";
import {
  nearestWall, pickAnchor, standY, stepAir, stepSwing, stepZip, type Anchor, type SwingRope,
} from "./swing";
import { SEX_LINES } from "./sextalk";
import type { AABB, CharacterId, CopState, HudState, InteriorId, MissionId, MoveMode, PedState, SexKind } from "./types";
import { emptyHud, pointInAABB } from "./types";

type CarKind = "hatch" | "sedan" | "muscle" | "cop";
type Car = {
  mesh: Mesh; kind: CarKind; color: string; x: number; z: number; y: number;
  yaw: number; speed: number; hp: number; body: number; engineHp: number; tires: number;
  wrecked: boolean; exploding: boolean; boomT: number; occupied: boolean; special: string;
  smoke: ParticleSystem | null; stolen: boolean; flow: boolean; flowAxis: "x" | "z"; flowDir: number;
};
type PedRole = "wander" | "group" | "sit" | "cross" | "clerk" | "fence" | "dancer" | "hostess" | "bouncer" | "nightlife" | "vip" | "couple";
type Ped = {
  mesh: Mesh; x: number; z: number; yaw: number; hp: number; state: PedState;
  tx: number; tz: number; downT: number; color: string; role: PedRole; callT: number; waitT: number;
  coupleBed?: number; coupleKind?: SexKind;
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
  private climbLock = 0;
  private clubEntered = false;
  private clubPing!: Mesh;
  private danceWith: Ped | null = null;
  private danceT = 0;
  private sexWith: Ped | null = null;
  private sexKind: SexKind = "seks";
  private sexBed: { x: number; z: number; yaw: number } = { x: CLUB_BED.x, z: CLUB_BED.z, yaw: CLUB_BED.yaw };
  private sexTalkI = 0;
  private sexTalkT = 0;
  private sexTalk = "";
  private sexTalkEn = "";
  private silk!: Mesh;
  private aimOrb!: Mesh;
  private assistMark!: Mesh;
  private assistHit: AssistHit | null = null;
  private assistStick = 0;
  private aim: Anchor | null = null;
  private stuns = 0;
  private launched = false;
  camYaw = 0.9;
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
  private landCrouch = 0;
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
    resolveCapsule(this.player, this.city.colliders);
    this.playerMesh = makeHero(this.scene, character);
    this.playerMesh.position.set(this.player.x, 0, this.player.z);
    this.silk = makeSilk(this.scene, CHAR[character].color);
    this.aimOrb = MeshBuilder.CreateSphere("aim", { diameter: 0.55, segments: 6 }, this.scene);
    this.aimOrb.material = mat(this.scene, CHAR[character].color, 0.9);
    this.aimOrb.setEnabled(false);
    this.assistMark = MeshBuilder.CreateTorus("assist", { diameter: 0.7, thickness: 0.04, tessellation: 18 }, this.scene);
    this.assistMark.material = mat(this.scene, CHAR[character].color, 0.55);
    this.assistMark.rotation.x = Math.PI / 2;
    this.assistMark.setEnabled(false);
    this.marker = MeshBuilder.CreateTorus("mk", { diameter: 3.2, thickness: 0.18, tessellation: 20 }, this.scene);
    this.marker.material = mat(this.scene, "#ffc83d", 0.8);
    this.clubPing = MeshBuilder.CreateTorus("clubping", { diameter: 4.4, thickness: 0.16, tessellation: 22 }, this.scene);
    this.clubPing.material = mat(this.scene, "#ff4da6", 0.95);
    this.clubPing.rotation.x = Math.PI / 2;
    const pingBeam = MeshBuilder.CreateCylinder("clubbeam", { height: 18, diameter: 0.18, tessellation: 8 }, this.scene);
    pingBeam.material = mat(this.scene, "#ff4da6", 0.7);
    pingBeam.parent = this.clubPing;
    pingBeam.position.y = 0;
    pingBeam.rotation.x = -Math.PI / 2;
    this.spawnCars();
    this.spawnFlowCars();
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
    clubBass.setLevel(0);
    clubBed.setLevel(0);
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
        flow: false, flowAxis: "z", flowDir: 1,
      });
      unstickCircle(this.cars[this.cars.length - 1], this.city.colliders, 1.2);
    }
  }

  private spawnFlowCars() {
    const specs: { x: number; z: number; kind: CarKind; color: string; axis: "x" | "z"; dir: number }[] = [
      { x: -60, z: -28, kind: "sedan", color: "#4a6088", axis: "z", dir: 1 },
      { x: 20, z: 46, kind: "hatch", color: "#c45a38", axis: "z", dir: -1 },
      { x: -20, z: -18, kind: "sedan", color: "#2a4a58", axis: "z", dir: 1 },
      { x: 60, z: 38, kind: "muscle", color: "#3a2a40", axis: "z", dir: -1 },
      { x: -42, z: 0, kind: "hatch", color: "#d4a040", axis: "x", dir: 1 },
      { x: 48, z: 30, kind: "sedan", color: "#1a3a44", axis: "x", dir: -1 },
    ];
    for (const s of specs) {
      const yaw = s.axis === "z" ? (s.dir > 0 ? 0 : Math.PI) : (s.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      const mesh = makeCar(this.scene, s.color, s.kind);
      mesh.position.set(s.x, 0, s.z);
      mesh.rotation.y = yaw;
      this.cars.push({
        mesh, kind: s.kind, color: s.color, x: s.x, z: s.z, y: 0, yaw,
        speed: 9.2, hp: CAR_HP, body: 100, engineHp: 100, tires: 100,
        wrecked: false, exploding: false, boomT: 0,
        occupied: false, special: "", smoke: null, stolen: false,
        flow: true, flowAxis: s.axis, flowDir: s.dir,
      });
      unstickCircle(this.cars[this.cars.length - 1], this.city.colliders, 1.2);
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
      { x: -28, z: 8, role: "wander" }, { x: -14, z: 6, role: "cross" },
      { x: -32, z: 40, role: "wander" }, { x: 4, z: 38, role: "group" },
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
    const nightSpots = [
      { x: -20, z: 32 }, { x: -12, z: 34 }, { x: -8, z: 28 }, { x: 6, z: 33 }, { x: -22, z: 8 },
      { x: LOC.club.x - 5.4, z: LOC.club.z - 8.6 }, { x: LOC.club.x + 4.8, z: LOC.club.z - 8.2 },
    ];
    for (let i = 0; i < nightSpots.length; i++) {
      const s = nightSpots[i];
      if (this.blocked(s.x, s.z, 0.5)) continue;
      const mesh = makeWoman(this.scene, 40 + i, true);
      mesh.position.set(s.x, 0, s.z);
      this.peds.push({
        mesh, x: s.x, z: s.z, yaw: Math.random() * Math.PI * 2, hp: 40,
        state: "wander", tx: s.x + 2, tz: s.z + 2, downT: 0,
        color: "#ff4da6", role: "nightlife", callT: 0, waitT: 0,
      });
    }
    const bounce = makeBouncer(this.scene);
    bounce.position.set(LOC.club.x - 2.6, 0, LOC.club.z - 7.4);
    this.peds.push({
      mesh: bounce, x: LOC.club.x - 2.6, z: LOC.club.z - 7.4, yaw: Math.PI, hp: 70,
      state: "wander", tx: LOC.club.x - 2.6, tz: LOC.club.z - 7.4, downT: 0,
      color: "#222", role: "bouncer", callT: 0, waitT: 0,
    });
    const sidewalkDance: [number, number][] = [
      [LOC.club.x + 2.2, LOC.club.z - 7.8],
      [LOC.club.x + 3.5, LOC.club.z - 7.1],
    ];
    for (let i = 0; i < sidewalkDance.length; i++) {
      const [x, z] = sidewalkDance[i];
      const mesh = makeDancer(this.scene, 30 + i);
      mesh.position.set(x, 0.22, z);
      this.peds.push({
        mesh, x, z, yaw: Math.PI, hp: 40,
        state: "wander", tx: x, tz: z, downT: 0,
        color: "#ff4da6", role: "dancer", callT: 0, waitT: 0,
      });
    }
    const dancers: [number, number][] = [
      [INT.club.ox, INT.club.oz + 5.2],
      [INT.club.ox - 1.15, INT.club.oz + 4.7],
    ];
    for (let i = 0; i < dancers.length; i++) {
      const [x, z] = dancers[i];
      const mesh = makeDancer(this.scene, 8 + i);
      mesh.position.set(x, 0.22, z);
      this.peds.push({
        mesh, x, z, yaw: Math.PI, hp: 40,
        state: "wander", tx: x, tz: z, downT: 0,
        color: "#ff4da6", role: "dancer", callT: 0, waitT: 0,
      });
    }
    const hosts: [number, number, PedState][] = [
      [INT.club.ox - 5.4, INT.club.oz - 1.2, "sit"],
      [INT.club.ox + 2.4, INT.club.oz + 0.6, "wander"],
      [INT.club.ox - 1.2, INT.club.oz + 2.2, "wander"],
    ];
    for (let i = 0; i < hosts.length; i++) {
      const [x, z, state] = hosts[i];
      const mesh = makeWoman(this.scene, 20 + i, true);
      mesh.position.set(x, 0, z);
      this.peds.push({
        mesh, x, z, yaw: state === "sit" ? Math.PI / 2 : 0, hp: 40,
        state, tx: x, tz: z, downT: 0,
        color: "#ff4da6", role: "hostess", callT: 0, waitT: 0,
      });
    }
    const vip = makeDancer(this.scene, 44);
    vip.position.set(CLUB_BED.x + 0.85, 0, CLUB_BED.z);
    this.peds.push({
      mesh: vip, x: CLUB_BED.x + 0.85, z: CLUB_BED.z, yaw: CLUB_BED.yaw + Math.PI, hp: 40,
      state: "wander", tx: CLUB_BED.x + 0.85, tz: CLUB_BED.z, downT: 0,
      color: "#ff4da6", role: "vip", callT: 0, waitT: 0,
    });
    const suiteHosts: [number, number][] = [
      [249.6, 3.4],
      [245.4, 6.4],
      [245.4, -2.6],
    ];
    for (let i = 0; i < suiteHosts.length; i++) {
      const [x, z] = suiteHosts[i];
      const mesh = makeWoman(this.scene, 70 + i, true);
      mesh.position.set(x, 0, z);
      this.peds.push({
        mesh, x, z, yaw: Math.PI / 2, hp: 40,
        state: "wander", tx: x, tz: z, downT: 0,
        color: "#ff4da6", role: "vip", callT: 0, waitT: 0,
      });
    }
    const coupleKinds: SexKind[] = ["seks", "yat", "sakso"];
    const coupleBeds = [0, 2, 3];
    for (let i = 0; i < coupleBeds.length; i++) {
      const bi = coupleBeds[i];
      const bed = CLUB_BEDS[bi];
      const kind = coupleKinds[i];
      const she = makeDancer(this.scene, 80 + i);
      const he = makePed(this.scene, 11 + i * 2);
      const sx = bed.x + (kind === "sakso" ? 0.45 : 0.08);
      const sz = bed.z;
      she.position.set(sx, 0, sz);
      he.position.set(bed.x, 0, sz);
      this.peds.push({
        mesh: she, x: sx, z: sz, yaw: bed.yaw + Math.PI, hp: 40,
        state: "sit", tx: sx, tz: sz, downT: 0,
        color: "#ff4da6", role: "couple", callT: 0, waitT: 0,
        coupleBed: bi, coupleKind: kind,
      });
      this.peds.push({
        mesh: he, x: bed.x, z: sz, yaw: bed.yaw, hp: 40,
        state: "sit", tx: bed.x, tz: sz, downT: 0,
        color: "#888", role: "couple", callT: 0, waitT: 0,
        coupleBed: bi, coupleKind: kind,
      });
    }
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
    this.applyLookAssist(dt, look.x, look.y, touch, inv);
    this.enterLock = Math.max(0, this.enterLock - dt);
    this.climbLock = Math.max(0, this.climbLock - dt);
    this.player.fireT = Math.max(0, this.player.fireT - dt);
    this.player.meleeT = Math.max(0, this.player.meleeT - dt);
    this.player.flash = Math.max(0, this.player.flash - dt);
    this.camPunch = Math.max(0, this.camPunch - dt * 4);
    this.camDip = Math.max(0, this.camDip - dt * 2.4);
    this.landCrouch = Math.max(0, this.landCrouch - dt * 2.8);
    if (this.player.reloadT > 0) {
      this.player.reloadT -= dt;
      if (this.player.reloadT <= 0) {
        const need = MAG - this.player.ammo;
        const take = Math.min(need, this.player.reserve);
        this.player.ammo += take;
        this.player.reserve -= take;
      }
    }

    if (this.input.enterPressed && this.enterLock <= 0) this.tryUseF();
    if (this.input.actYatPressed) this.tryStartOrSwitchSex("yat");
    if (this.input.actSaksoPressed) this.tryStartOrSwitchSex("sakso");
    if (this.input.actSeksPressed) this.tryStartOrSwitchSex("seks");
    this.tickSexTalk(dt);

    if (this.interior === "jail") {
      this.tickJail(dt);
      this.walkFree(dt, 0.7);
      this.finishMove();
      this.mode = "ground";
    } else {
      this.locomote(dt);
    }

    this.updatePeds(dt);
    this.updateCops(dt);
    this.updateTracers(dt);
    this.updateFlowCars(dt);
    this.updateCarsFx(dt);
    if (this.interior !== "jail") this.combat(dt);
    this.missions(dt);
    this.tickArrest(dt);
    this.regen(dt);
    this.cameraFollow();
    this.syncMeshes();
    tickCityArt(this.scene, this.time);
    this.tickClubBed();
    this.wantedDecay(dt);
    this.saveAcc += dt;
    if (this.saveAcc > 4) { this.saveAcc = 0; this.persist(); }
    sharedSfx.engineDrive(!!this.drive && !this.drive.wrecked, this.drive?.speed ?? 0);
    sharedSfx.sirenOn(this.stars > 0 && this.cops.some((c) => c.state === "chase"));
  }

  private locomote(dt: number) {
    const p = this.player;
    const ins = this.input;

    if (this.sexWith) {
      this.stepSex(dt);
      return;
    }
    if (this.danceWith) {
      this.stepDance(dt);
      return;
    }

    if (this.drive) {
      if (this.drive) this.driveCar(dt);
      this.silk.setEnabled(false);
      this.aim = null;
      return;
    }

    if (this.interior !== "street") {
      this.walkFree(dt, 1);
      this.finishMove();
      this.mode = "ground";
      this.rope = null;
      this.zipTo = null;
      this.silk.setEnabled(false);
      return;
    }

    const nearCar = this.nearestCar(3.2);
    const streetBin = !!nearCar && this.mode === "ground" && p.y < 1.35 && !this.nearClubEnter();

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
        const stuck = this.finishMove();
        if (stuck === "roof") this.landOn(standY(p.x, p.z, this.city.colliders));
        else if (stuck === "out") {
          this.zipTo = null;
          this.rope = null;
          this.mode = "air";
        } else if (done) {
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

    const fIsVerb = this.nearClubEnter() || this.nearDoor() !== null || !!this.nearDancePed() || this.nearSexSpot();
    const wantSwing = ins.salinHeld
      || (!streetBin && !fIsVerb && ins.swingHeld)
      || (ins.jumpHeld && this.mode !== "ground");
    if (ins.zipPressed && this.aim) {
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
        this.finishMove();
        this.maybeLand();
        this.maybeCrawl();
        this.faceVelocity();
        return;
      }
    }

    if (this.mode === "ground") {
      this.walkRooftops(dt);
      this.finishMove();
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
    const stuck = this.finishMove();
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
    const sag = 0.28 + Math.sin(this.time * 6.4 + this.player.x * 0.08) * 0.16;
    placeSilk(this.silk, this.player.x + 0.16, this.player.y + 1.18, this.player.z, x, y, z, sag);
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
    const floor = standY(p.x, p.z, this.city.colliders);
    const onRoof = floor > 0.4 && p.y >= floor - 0.9;
    const nx = p.x + vx * dt;
    const nz = p.z + vz * dt;
    if (onRoof) {
      const next = standY(nx, nz, this.city.colliders);
      if (next > 0.35 && floor - next < 2.2) {
        if (!this.walkable(nx, nz) && next < 0.4) {
          /* stay */
        } else {
          p.x = clamp(nx, -94, 94);
          p.z = clamp(nz, -80, 96);
          p.y = next;
        }
        p.grounded = true;
      } else {
        p.x = nx;
        p.z = nz;
        p.y = floor;
        p.grounded = false;
        this.mode = "air";
      }
    } else {
      const ox = p.x;
      const oz = p.z;
      slideMove(p, vx * dt, vz * dt, this.worldCols(), PLAYER_R);
      if (!this.walkable(p.x, oz)) p.x = ox;
      if (!this.walkable(p.x, p.z)) p.z = oz;
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

  private worldCols() {
    return this.interior === "street" ? this.city.colliders : this.city.interiors[this.interior].colliders;
  }

  private finishMove() {
    const cols = this.worldCols();
    const hit = resolveCapsule(this.player, cols, PLAYER_R);
    if (this.rope) {
      const d = Math.hypot(
        this.player.x - this.rope.ax,
        this.player.y - this.rope.ay,
        this.player.z - this.rope.az,
      );
      if (hit === "out") this.rope.length = Math.max(4, Math.min(this.rope.length, d));
    }
    return hit;
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
    const floor = landFloor(p.x, p.y, p.z, this.city.colliders, 0.1);
    if (p.y <= floor + 0.38 && p.vy <= 8) {
      if (this.mode === "air" || this.mode === "swing" || this.mode === "zip") {
        const drop = Math.max(0, -p.vy);
        const spd = Math.hypot(p.vx, p.vz);
        this.camDip = clamp(0.16 + drop * 0.038 + spd * 0.006, 0.14, 0.5);
        this.landCrouch = clamp(0.14 + drop * 0.022, 0.1, 0.3);
        if (spd > 13 || drop > 9) sharedSfx.impact();
      }
      this.landOn(floor);
    }
  }

  private tryStartClimb(): boolean {
    if (this.climbLock > 0 || !this.input.climbPressed) return false;
    const p = this.player;
    const w = nearestWall(p.x, Math.max(0.2, p.y + 0.35), p.z, this.city.colliders, 2.2);
    if (!w) return false;
    this.stickWall(w);
    if (this.mode !== "crawl") return false;
    this.finishMove();
    return true;
  }

  private maybeCrawl() {
    if (this.mode !== "air" || this.climbLock > 0 || !this.input.climbPressed) return;
    const p = this.player;
    const w = nearestWall(p.x, p.y, p.z, this.city.colliders, 1.9);
    if (!w) return;
    this.stickWall(w);
    this.finishMove();
  }

  private stickWall(w: { x: number; y: number; z: number; nx: number; nz: number; maxY: number }) {
    const p = this.player;
    this.crawlN = { nx: w.nx, nz: w.nz, maxY: w.maxY };
    p.vx = 0;
    p.vz = 0;
    p.vy = 0;
    p.x = w.x + w.nx * (PLAYER_R + 0.22);
    p.z = w.z + w.nz * (PLAYER_R + 0.22);
    resolveCapsule(p, this.city.colliders, PLAYER_R);
    if (centerInside(p.x, p.y + 0.4, p.z, this.city.colliders)) {
      this.dropClimb();
      return;
    }
    this.mode = "crawl";
    this.rope = null;
    this.zipTo = null;
    this.silk.setEnabled(false);
  }

  private dropClimb() {
    const p = this.player;
    const n = this.crawlN;
    this.mode = "air";
    this.climbLock = 0.28;
    this.crawlN = null;
    this.rope = null;
    this.zipTo = null;
    this.silk.setEnabled(false);
    if (n) {
      p.x += n.nx * 1.15;
      p.z += n.nz * 1.15;
      p.vx = n.nx * 5.4;
      p.vz = n.nz * 5.4;
    }
    p.vy = Math.max(p.vy, 2.2);
    resolveCapsule(p, this.worldCols(), PLAYER_R);
    if (centerInside(p.x, p.y + 0.4, p.z, this.worldCols()) && n) {
      p.x += n.nx * 1.5;
      p.z += n.nz * 1.5;
      resolveCapsule(p, this.worldCols(), PLAYER_R);
    }
    p.grounded = false;
    sharedSfx.whoosh();
  }

  private wantDropClimb(
    w: { nx: number; nz: number },
    tx: number,
    tz: number,
  ): boolean {
    const ins = this.input;
    if (ins.jumpPressed) return true;
    if (ins.climbPressed) return true;
    if (ins.swingHeld && !ins.climbHeld) return true;
    if (this.camPitch > 0.5) return true;
    const into = -(tx * w.nx + tz * w.nz);
    return into < -0.2;
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
    if (this.wantDropClimb(w, tx, tz) || centerInside(p.x, p.y + 0.35, p.z, this.city.colliders)) {
      this.dropClimb();
      return;
    }
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
    this.crawlN = { nx: pinned.nx, nz: pinned.nz, maxY: pinned.maxY };
    p.yaw = Math.atan2(-pinned.nx, -pinned.nz);
    if (centerInside(p.x, p.y + 0.35, p.z, this.city.colliders)) {
      this.dropClimb();
      return;
    }
    const gap = PLAYER_R + 0.22;
    p.x = pinned.x + pinned.nx * gap;
    p.z = pinned.z + pinned.nz * gap;
    const stuck = this.finishMove();
    this.playerMesh.setEnabled(true);
    if (stuck === "out" || centerInside(p.x, p.y + 0.35, p.z, this.city.colliders)) {
      this.dropClimb();
      return;
    }
    if (stuck === "roof" || p.y >= pinned.maxY - 0.85) {
      p.x = pinned.x - pinned.nx * 1.15;
      p.z = pinned.z - pinned.nz * 1.15;
      this.landOn(pinned.maxY);
      resolveCapsule(p, this.city.colliders, PLAYER_R);
      return;
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
    const ox = this.player.x;
    const oz = this.player.z;
    slideMove(this.player, vx * dt, vz * dt, this.worldCols(), PLAYER_R);
    if (!this.walkable(this.player.x, oz)) this.player.x = ox;
    if (!this.walkable(this.player.x, this.player.z)) this.player.z = oz;
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
    if (!hitX) car.x = nx;
    if (!hitZ) car.z = nz;
    if (hitX || hitZ) {
      const impact = Math.abs(car.speed);
      if (impact > 6) this.hurtCar(car, (impact - 5) * 5.5 * spec.mass, impact > 13);
      car.speed *= hitX && hitZ ? -0.25 : 0.7;
    }
    if (this.interior === "street") unstickCircle(car, this.city.colliders, 1.2);
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
    if (car.body <= 0) {
      car.wrecked = true;
      car.speed = 0;
      this.explodeCar(car);
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

  private tryUseF() {
    if (this.enterLock > 0) return;
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
    if (this.sexWith) {
      this.stopSex();
      return;
    }
    if (this.danceWith) {
      this.stopDance();
      return;
    }
    if (this.interior !== "street") {
      const room = this.city.interiors[this.interior];
      if (dist2(this.player.x, this.player.z, room.exitX, room.exitZ) < 3.8) {
        this.leaveInterior();
        return;
      }
      if (this.interior === "club" && this.tryStartSex("seks")) return;
      if (this.interior === "club" && this.tryStartDance()) return;
      return;
    }
    if (this.nearClubEnter()) {
      this.enterInterior("club");
      return;
    }
    if (this.tryStartDance()) return;
    const mart = this.city.interiors.mart;
    const gar = this.city.interiors.garage;
    if (dist2(this.player.x, this.player.z, mart.doorX, mart.doorZ) < 2.6) {
      this.enterInterior("mart");
      return;
    }
    if (dist2(this.player.x, this.player.z, gar.doorX, gar.doorZ) < 2.8) {
      this.enterInterior("garage");
      return;
    }
    if (this.tryRico()) return;
    const best = this.nearestCar(3.4);
    if (best) this.enterCar(best);
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

  private enterInterior(id: "mart" | "garage" | "club") {
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
    if (id === "club") {
      this.clubEntered = true;
      this.ensureClubVolume();
      this.camYaw = 0;
      this.camPitch = 0.12;
    }
    this.player.x = room.spawnX;
    this.player.z = room.spawnZ;
    this.player.y = 0;
    this.player.vx = 0;
    this.player.vz = 0;
    this.player.vy = 0;
    this.mode = "ground";
    this.camDist = room.camDist;
    this.enterLock = 0.28;
    this.rope = null;
    this.zipTo = null;
    this.silk.setEnabled(false);
    resolveCapsule(this.player, room.colliders, PLAYER_R);
  }

  private ensureClubVolume() {
    const room = this.city.interiors.club;
    if (room.colliders.length >= 3) return;
    const cx = INT.club.ox;
    const cz = INT.club.oz;
    room.colliders.push(
      { minX: cx - 9, maxX: cx + 9, minZ: cz + 7.6, maxZ: cz + 8.2, minY: 0, maxY: 5.2 },
      { minX: cx - 9, maxX: cx + 9, minZ: cz - 8.2, maxZ: cz - 7.6, minY: 0, maxY: 5.2 },
      { minX: cx + 8.4, maxX: cx + 9, minZ: cz - 8, maxZ: cz + 8, minY: 0, maxY: 5.2 },
      { minX: cx - 9, maxX: cx - 8.4, minZ: cz - 8, maxZ: CLUB_VIP.z - 1.3, minY: 0, maxY: 5.2 },
      { minX: cx - 9, maxX: cx - 8.4, minZ: CLUB_VIP.z + 1.3, maxZ: cz + 8, minY: 0, maxY: 5.2 },
    );
  }

  private leaveInterior() {
    if (this.interior === "street" || this.interior === "jail") return;
    const room = this.city.interiors[this.interior];
    if (this.parkedRepair && this.interior === "garage") {
      this.parkedRepair.x = LOC.garage.x;
      this.parkedRepair.z = LOC.garage.z + 8;
      this.parkedRepair = null;
    }
    this.stopDance();
    this.stopSex();
    this.player.x = room.streetX;
    this.player.z = room.streetZ;
    this.player.y = 0;
    this.interior = "street";
    this.camDist = 7.2;
    this.enterLock = 0.3;
    resolveCapsule(this.player, this.city.colliders, PLAYER_R);
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
    const offs: [number, number][] = [
      [Math.cos(c.yaw) * 2.1, -Math.sin(c.yaw) * 2.1],
      [-Math.cos(c.yaw) * 2.1, Math.sin(c.yaw) * 2.1],
      [Math.sin(c.yaw) * 2.2, Math.cos(c.yaw) * 2.2],
      [-Math.sin(c.yaw) * 2.2, -Math.cos(c.yaw) * 2.2],
    ];
    this.player.x = c.x;
    this.player.z = c.z;
    for (const [dx, dz] of offs) {
      const x = c.x + dx;
      const z = c.z + dz;
      if (!this.blocked(x, z, PLAYER_R) && this.walkable(x, z)) {
        this.player.x = x;
        this.player.z = z;
        break;
      }
    }
    resolveCapsule(this.player, this.worldCols(), PLAYER_R);
    this.drive = null;
    this.enterLock = 0.35;
    this.camDist = this.interior === "street" ? 8.6 : 5.2;
    this.playerMesh.setEnabled(true);
  }

  private blocked(x: number, z: number, r: number, y = 0): boolean {
    return blockedAt(x, y, z, r, this.worldCols());
  }

  private walkable(x: number, z: number): boolean {
    if (this.interior !== "street") {
      let c: { x: number; z: number; hw: number; hd: number };
      switch (this.interior) {
        case "mart": c = { x: INT.mart.ox, z: INT.mart.oz, hw: 5.6, hd: 4.6 }; break;
        case "garage": c = { x: INT.garage.ox, z: INT.garage.oz, hw: 6.6, hd: 5.6 }; break;
        case "jail": c = { x: INT.jail.ox, z: INT.jail.oz, hw: 4.2, hd: 3.6 }; break;
        case "club": {
          const main = Math.abs(x - INT.club.ox) < 8.2 && Math.abs(z - INT.club.oz) < 7.2;
          const vip = Math.abs(x - CLUB_VIP_ROOM.x) < CLUB_VIP_ROOM.hw && Math.abs(z - CLUB_VIP_ROOM.z) < CLUB_VIP_ROOM.hd;
          return main || vip;
        }
        default: {
          const _never: never = this.interior;
          void _never;
          return false;
        }
      }
      return Math.abs(x - c.x) < c.hw && Math.abs(z - c.z) < c.hd;
    }
    if (z > this.city.waterZ && !pointInAABB(x, z, this.city.pier, 0.2)) return false;
    if (Math.abs(x) > 92 || z < -78 || z > 94) return false;
    return true;
  }

  private combat(dt: number) {
    if (this.danceWith || this.sexWith) { void dt; return; }
    if (this.input.meleePressed && this.player.meleeT <= 0 && !this.drive) {
      this.player.meleeT = MELEE_CD;
      sharedSfx.punch();
      this.meleeHit();
    }
    if (!this.drive && (this.input.shootPressed || (this.input.fireHeld && this.player.fireT <= 0))) {
      if (this.player.fireT > 0) return;
      this.player.fireT = 0.24;
      this.camPunch = 0.18;
      this.webShot();
    }
    void dt;
  }

  private canAimAssist(): boolean {
    if (this.drive || this.danceWith || this.sexWith) return false;
    if (this.interior === "jail") return false;
    if (this.mode === "swing" || this.mode === "zip" || this.mode === "crawl") return false;
    return true;
  }

  private applyLookAssist(dt: number, lookX: number, lookY: number, touch: boolean, inv: number) {
    const aiming = this.input.fireHeld || this.player.fireT > 0;
    if (this.canAimAssist() && aiming) this.assistHit = this.pickAssist(touch, dt);
    else if (!aiming) {
      this.assistStick = Math.max(0, this.assistStick - dt);
      if (this.assistStick <= 0) this.assistHit = null;
    } else {
      this.assistHit = null;
    }

    let fx = lookX;
    let fy = lookY;
    if (this.canAimAssist() && aiming && this.assistHit) {
      const want = aimAngles(this.player.x, this.player.y, this.player.z, this.assistHit.x, this.assistHit.y, this.assistHit.z);
      const err = angError(this.camYaw, this.camPitch, want.yaw, want.pitch);
      const fric = lookFriction(err, touch);
      fx *= fric;
      fy *= fric;
    }
    const sx = touch ? 0.0072 : 0.0044;
    const sy = (touch ? 0.0056 : 0.0038) * inv;
    this.camYaw = angWrap(this.camYaw + fx * sx);
    this.camPitch = clamp(this.camPitch + fy * sy, -0.62, 0.98);

    if (this.canAimAssist() && aiming && this.assistHit) {
      const want = aimAngles(this.player.x, this.player.y, this.player.z, this.assistHit.x, this.assistHit.y, this.assistHit.z);
      const blend = magnetBlend(dt, touch, Math.hypot(lookX, lookY));
      this.camYaw = angWrap(this.camYaw + angWrap(want.yaw - this.camYaw) * blend);
      this.camPitch = clamp(this.camPitch + (want.pitch - this.camPitch) * blend, -0.62, 0.98);
      if (this.mode === "ground") this.player.yaw = this.camYaw;
    }
  }

  private pickAssist(touch: boolean, dt: number): AssistHit | null {
    const stickyId = this.assistStick > 0 && this.assistHit ? this.assistHit.id : null;
    const list: AssistHit[] = [];
    for (const p of this.peds) {
      if (p.state === "down") continue;
      if (p.role === "clerk" || p.role === "fence") continue;
      list.push({ kind: "ped", id: p.mesh.uniqueId, x: p.x, y: 0.95, z: p.z, r: 0.7 });
    }
    for (const c of this.cops) {
      if (c.state === "down") continue;
      list.push({ kind: "cop", id: c.mesh.uniqueId, x: c.x, y: 0.95, z: c.z, r: 0.7 });
    }
    for (const car of this.cars) {
      if (car.wrecked || this.drive === car) continue;
      list.push({ kind: "car", id: car.mesh.uniqueId, x: car.x, y: 0.62, z: car.z, r: 1.35 });
    }
    let best: AssistHit | null = null;
    let bestScore = 99;
    for (const hit of list) {
      if (!this.hasLOS(this.player.x, this.player.z, hit.x, hit.z)) continue;
      const score = scoreAssist(hit, this.player.x, this.player.y, this.player.z, this.camYaw, this.camPitch, stickyId, touch);
      if (score === null || score >= bestScore) continue;
      bestScore = score;
      best = hit;
    }
    if (best) this.assistStick = ASSIST.stickTime;
    else this.assistStick = Math.max(0, this.assistStick - dt);
    return best;
  }

  private webShot() {
    this.applyGunPose();
    const muzzle = findNamed(this.playerMesh, "muzzle");
    const origin = muzzle
      ? muzzle.getAbsolutePosition().clone()
      : new Vector3(this.player.x + Math.sin(this.player.yaw) * 0.45, this.player.y + 1.28, this.player.z + Math.cos(this.player.yaw) * 0.45);
    const dir = this.shotDir(origin);
    sharedSfx.gunshot();
    sharedSfx.web();
    let hitT = GUN_RANGE;
    let hitPed: Ped | null = null;
    let hitCop: Cop | null = null;
    let hitCar: Car | null = null;
    if (this.interior === "street") {
      for (const b of this.city.colliders) {
        const t = this.rayAABB(origin, dir, b);
        if (t > 0.2 && t < hitT) { hitT = t; hitPed = null; hitCop = null; hitCar = null; }
      }
    } else {
      for (const b of this.worldCols()) {
        const t = this.rayAABB(origin, dir, b);
        if (t > 0.2 && t < hitT) { hitT = t; hitPed = null; hitCop = null; hitCar = null; }
      }
    }
    for (const p of this.peds) {
      if (p.state === "down") continue;
      if (p.role === "clerk" || p.role === "fence") continue;
      const t = this.raySphere(origin, dir, p.x, 0.95, p.z, 0.95);
      if (t > 0.15 && t < hitT) { hitT = t; hitPed = p; hitCop = null; hitCar = null; }
    }
    for (const c of this.cops) {
      if (c.state === "down") continue;
      const t = this.raySphere(origin, dir, c.x, 0.95, c.z, 0.95);
      if (t > 0.15 && t < hitT) { hitT = t; hitPed = null; hitCop = c; hitCar = null; }
    }
    if (this.interior === "street") {
      for (const car of this.cars) {
        if (car.wrecked) continue;
        const t = this.raySphere(origin, dir, car.x, 0.62, car.z, 1.45);
        if (t > 0.35 && t < hitT) { hitT = t; hitPed = null; hitCop = null; hitCar = car; }
      }
    }
    const end = origin.add(dir.scale(hitT));
    this.spawnShotVfx(origin, end, dir);
    this.spawnSpark(end);
    if (hitPed) {
      this.hurtPed(hitPed, GUN_DMG);
      if (hitPed.hp > 0) this.webTarget(hitPed, false);
    }
    if (hitCop) {
      this.hurtCop(hitCop, GUN_DMG);
      if (hitCop.hp > 0) this.webTarget(hitCop, true);
    }
    if (hitCar) this.hurtCar(hitCar, GUN_DMG * 0.85, true);
    if (hitPed || hitCop || hitCar) this.notifyCrime(this.player.x, this.player.z, "gun");
  }

  private shotDir(origin: Vector3): Vector3 {
    const raw = lookDir(this.camYaw, this.camPitch * 0.7);
    raw.y = clamp(raw.y, -0.48, 0.55);
    raw.normalize();
    const assist = this.canAimAssist() ? this.assistHit : null;
    if (!assist) return raw;
    const to = new Vector3(assist.x - origin.x, assist.y - origin.y, assist.z - origin.z);
    const len = to.length();
    if (len < 0.25) return raw;
    to.scaleInPlace(1 / len);
    const ang = Math.acos(clamp(Vector3.Dot(raw, to), -1, 1));
    const cone = this.input.showTouch ? ASSIST.bulletTouch : ASSIST.bulletMouse;
    if (ang <= cone) return to;
    if (ang <= cone * 1.55) {
      const blended = Vector3.Lerp(raw, to, 0.64);
      blended.normalize();
      return blended;
    }
    return raw;
  }

  private applyGunPose() {
    if (this.drive) return;
    const holster = (this.mode === "swing" || this.mode === "zip" || this.mode === "crawl")
      && this.player.fireT <= 0
      && !this.input.fireHeld;
    setGunHolstered(this.playerMesh, holster);
    if (!holster) tickGunPose(this.playerMesh, this.player.fireT, this.input.fireHeld);
    this.playerMesh.computeWorldMatrix(true);
  }

  private spawnShotVfx(origin: Vector3, hit: Vector3, dir: Vector3) {
    this.spawnFlash(origin);
    this.spawnTracer(origin, hit, true);
    const bolt = MeshBuilder.CreateCylinder("bolt", { height: 1, diameter: 0.055, tessellation: 6 }, this.scene);
    bolt.material = mat(this.scene, CHAR[this.player.character].color, 1.1, 0);
    const tip = origin.add(dir.scale(0.85));
    bolt.position.copyFrom(origin.add(tip).scale(0.5));
    bolt.scaling.y = 1.7;
    const axis = Vector3.Cross(Vector3.Up(), dir);
    if (axis.length() > 0.0001) {
      bolt.rotationQuaternion = Quaternion.RotationAxis(axis.normalize(), Math.acos(clamp(Vector3.Dot(Vector3.Up(), dir), -1, 1)));
    }
    const casing = MeshBuilder.CreateCylinder("case", { height: 0.055, diameter: 0.016, tessellation: 6 }, this.scene);
    casing.material = mat(this.scene, "#c9a24a", 0.35);
    casing.position.copyFrom(origin.add(new Vector3(0.1, 0.05, 0.02)));
    casing.rotation.z = 1.15;
    const glow = new PointLight("mflash", origin.clone(), this.scene);
    glow.diffuse = new Color3(1, 0.86, 0.45);
    glow.intensity = 4.4;
    glow.range = 8;
    window.setTimeout(() => {
      if (!bolt.isDisposed()) bolt.dispose();
      if (!casing.isDisposed()) casing.dispose();
      glow.dispose();
    }, 95);
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
      resolveCapsule(this.player, this.worldCols(), PLAYER_R);
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
    if (p.state === "down") return;
    p.hp -= dmg;
    this.lastCombat = this.time;
    if (this.danceWith === p) this.stopDance();
    if (this.sexWith === p) this.stopSex();
    if (p.hp <= 0) {
      p.hp = 0;
      p.state = "down";
      p.downT = 999;
      this.stuns += 1;
      tickDownPose(p.mesh);
    } else if (p.role !== "clerk" && p.role !== "fence") p.state = "flee";
  }

  private hurtCop(c: Cop, dmg: number) {
    if (c.state === "down") return;
    c.hp -= dmg;
    this.lastCombat = this.time;
    this.lastSeen = this.time;
    this.addStar(1);
    if (c.hp <= 0) {
      c.hp = 0;
      c.state = "down";
      c.downT = 999;
      this.stuns += 1;
      tickDownPose(c.mesh);
      this.addStar(1);
    }
  }

  private notifyCrime(x: number, z: number, kind: "jack" | "gun" | "melee") {
    if (this.interior !== "street" && this.interior !== "club") return;
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
    const b = MeshBuilder.CreateSphere("mz", { diameter: 0.22, segments: 6 }, this.scene);
    b.position.copyFrom(p);
    b.material = mat(this.scene, "#ffe6a0", 1.2, 0);
    const core = MeshBuilder.CreateBox("mzc", { width: 0.08, height: 0.08, depth: 0.28 }, this.scene);
    core.position.copyFrom(p);
    core.material = mat(this.scene, "#fff4c8", 1.4, 0);
    window.setTimeout(() => {
      if (!b.isDisposed()) b.dispose();
      if (!core.isDisposed()) core.dispose();
    }, 70);
  }

  private spawnSpark(p: Vector3) {
    for (let i = 0; i < 6; i += 1) {
      const s = MeshBuilder.CreateBox("sp", { size: 0.055 }, this.scene);
      s.position.copyFrom(p.add(new Vector3((Math.random() - 0.5) * 0.4, Math.random() * 0.28, (Math.random() - 0.5) * 0.4)));
      s.material = mat(this.scene, i % 2 ? "#ffe08a" : CHAR[this.player.character].color, 1.1, 0);
      window.setTimeout(() => { if (!s.isDisposed()) s.dispose(); }, 70 + i * 14);
    }
    sharedSfx.impact();
  }

  private spawnTracer(a: Vector3, b: Vector3, web = false) {
    const line = MeshBuilder.CreateLines("tr", { points: [a, b] }, this.scene);
    line.color = web ? Color3.FromHexString(CHAR[this.player.character].color) : new Color3(1, 0.85, 0.35);
    this.tracers.push({ mesh: line, life: web ? 0.2 : TRACER_LIFE });
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
        tickDownPose(p.mesh);
        p.mesh.position.set(p.x, 0.22, p.z);
        continue;
      }
      if (this.danceWith === p || this.sexWith === p) continue;
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
        tickWalk(p.mesh, this.time, this.storeRobbed && this.interior === "mart");
        continue;
      }
      if (p.role === "fence" || p.role === "bouncer") {
        p.mesh.position.set(p.x, 0, p.z);
        p.mesh.rotation.y = p.yaw;
        tickWalk(p.mesh, this.time, false);
        continue;
      }
      if (p.role === "couple" && p.state !== "flee") {
        this.poseCouple(p);
        continue;
      }
      if ((p.role === "dancer" || p.role === "vip") && p.state !== "flee") {
        p.mesh.position.set(p.x, 0.22, p.z);
        p.mesh.rotation.y = p.yaw + Math.sin(this.time * 0.7) * 0.35;
        tickDancePose(p.mesh, this.time + p.x);
        continue;
      }
      if (p.role === "hostess" && p.state !== "flee") {
        if (p.state === "sit") {
          p.mesh.position.set(p.x, 0, p.z);
          p.mesh.rotation.y = p.yaw;
          tickSitPose(p.mesh, this.time);
          continue;
        }
        if (dist2(p.x, p.z, p.tx, p.tz) < 0.6) {
          p.tx = INT.club.ox + (Math.random() - 0.5) * 10;
          p.tz = INT.club.oz + (Math.random() - 0.5) * 8;
        }
        const ax = p.tx - p.x;
        const az = p.tz - p.z;
        const d = Math.hypot(ax, az) || 1;
        const nx = p.x + (ax / d) * 1.35 * dt;
        const nz = p.z + (az / d) * 1.35 * dt;
        if (
          (Math.abs(nx - INT.club.ox) < 7.4 && Math.abs(nz - INT.club.oz) < 6.2)
          || (Math.abs(nx - CLUB_VIP_ROOM.x) < CLUB_VIP_ROOM.hw - 0.4 && Math.abs(nz - CLUB_VIP_ROOM.z) < CLUB_VIP_ROOM.hd - 0.4)
        ) {
          if (!this.circleHitsCols(nx, p.z, 0.35, this.city.interiors.club.colliders)) p.x = nx;
          if (!this.circleHitsCols(p.x, nz, 0.35, this.city.interiors.club.colliders)) p.z = nz;
        }
        p.yaw = Math.atan2(ax, az);
        p.mesh.position.set(p.x, 0, p.z);
        p.mesh.rotation.y = p.yaw;
        tickWalk(p.mesh, this.time, true);
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
      tickWalk(p.mesh, this.time, p.role !== "group" || p.state === "flee");
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
        tickDownPose(c.mesh);
        c.mesh.position.set(c.x, 0.22, c.z);
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
    if (this.interior !== "street") return true;
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
    this.stopDance();
    this.stopSex();
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

  private updateFlowCars(dt: number) {
    for (const c of this.cars) {
      if (!c.flow || c.wrecked) continue;
      c.speed = 9.2;
      if (c.flowAxis === "z") {
        c.z += c.flowDir * c.speed * dt;
        if (c.flowDir > 0 && c.z > 68) c.z = -52;
        if (c.flowDir < 0 && c.z < -52) c.z = 68;
        c.yaw = c.flowDir > 0 ? 0 : Math.PI;
      } else {
        c.x += c.flowDir * c.speed * dt;
        if (c.flowDir > 0 && c.x > 78) c.x = -78;
        if (c.flowDir < 0 && c.x < -78) c.x = 78;
        c.yaw = c.flowDir > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
      unstickCircle(c, this.city.colliders, 1.15);
    }
  }

  private updateCarsFx(_dt: number) {
    for (const c of this.cars) {
      const spd = Math.abs(c.speed);
      const bob = spd > 1
        ? Math.sin(this.time * 10 + c.x) * 0.04 * Math.min(1, spd / 12)
        : Math.sin(this.time * 1.7 + c.x) * 0.01;
      c.mesh.position.set(c.x, bob, c.z);
      c.mesh.rotation.y = c.yaw;
      c.mesh.rotation.x = spd > 1 ? -spd * 0.0035 + Math.sin(this.time * 9) * 0.012 : 0;
      if (this.drive === c) {
        c.mesh.rotation.z = -this.input.moveX * 0.11 * Math.min(1, spd / 8);
      } else if (c.flow) {
        c.mesh.rotation.z = Math.sin(this.time * 3 + c.z) * 0.02;
      } else {
        c.mesh.rotation.z = 0;
      }
      if (spd > 0.4) {
        for (const ch of c.mesh.getChildMeshes(false)) {
          if (ch.name === "wh" || ch.name === "rim") ch.rotation.x += spd * _dt * 1.8;
        }
      }
    }
  }

  private cameraFollow() {
    const spd = Math.hypot(this.player.vx, this.player.vy, this.player.vz);
    const flying = this.mode === "swing" || this.mode === "zip" || this.mode === "air" || this.mode === "crawl";
    const wantDist = this.sexWith ? 2.65
      : this.drive ? 11.2
      : this.interior !== "street" ? this.camDist
      : flying ? 9.2 + Math.min(4.2, spd * 0.055)
      : 8.2;
    this.camDist += (wantDist - this.camDist) * (this.camDip > 0.04 ? 0.07 : 0.12);
    const wantFov = flying ? 0.86 + Math.min(0.24, spd * 0.0055) : 0.78;
    this.camFov += (wantFov - this.camFov) * 0.1;
    this.camera.fov = this.camFov;
    const wantRoll = flying
      ? -this.input.moveX * 0.06 - clamp(this.player.vx * 0.003, -0.08, 0.08)
      : -this.input.moveX * 0.03;
    this.camRoll += (wantRoll - this.camRoll) * 0.1;

    const dir = lookDir(this.camYaw, this.camPitch);
    const target = this.sexWith
      ? new Vector3(this.sexBed.x, this.sexKind === "sakso" ? 0.78 : 0.88, this.sexBed.z)
      : new Vector3(
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
    this.playerMesh.position.set(this.player.x, this.player.y - this.landCrouch * 0.32, this.player.z);
    this.playerMesh.rotation.y = this.player.yaw;
    const flying = this.mode === "swing" || this.mode === "zip" || this.mode === "air";
    this.playerMesh.setEnabled(!this.drive);
    if (this.drive) {
      this.silk.setEnabled(false);
      this.aimOrb.setEnabled(false);
    } else if (this.sexWith) {
      tickSexPose(this.playerMesh, this.time, this.sexKind, "player");
    } else if (this.danceWith) {
      tickSitPose(this.playerMesh, this.time);
    } else if (this.mode === "crawl") {
      const climbing = this.input.climbHeld || this.input.moveY < -0.12;
      tickClimbPose(this.playerMesh, this.time, climbing);
    }
    else if (flying) tickSwingPose(this.playerMesh, this.time, this.mode === "swing" || this.mode === "zip");
    else {
      const moving = Math.hypot(this.player.vx, this.player.vz) > 0.45;
      if (this.interior !== "jail") tickWalk(this.playerMesh, this.time, moving, true, this.input.sprint);
    }
    if (!this.drive) this.applyGunPose();
    if (this.aim && this.interior === "street") {
      this.aimOrb.setEnabled(true);
      this.aimOrb.position.set(this.aim.x, this.aim.y, this.aim.z);
      const pulse = 0.85 + Math.sin(this.time * 9) * 0.18;
      this.aimOrb.scaling.setAll(pulse);
    } else {
      this.aimOrb.setEnabled(false);
    }
    if (this.mode !== "swing" && this.mode !== "zip") this.silk.setEnabled(false);
    const showAssist = !!this.assistHit && this.canAimAssist() && (this.input.fireHeld || this.player.fireT > 0);
    if (showAssist && this.assistHit) {
      this.assistMark.setEnabled(true);
      this.assistMark.position.set(this.assistHit.x, this.assistHit.y + 0.12, this.assistHit.z);
      const pulse = 0.92 + Math.sin(this.time * 11) * 0.08;
      let size = pulse;
      switch (this.assistHit.kind) {
        case "car":
          size = pulse * 1.7;
          break;
        case "ped":
        case "cop":
          size = pulse;
          break;
        default: {
          const _never: never = this.assistHit.kind;
          void _never;
        }
      }
      this.assistMark.scaling.setAll(size);
    } else {
      this.assistMark.setEnabled(false);
    }
    this.placeMarker();
    this.placeClubPing();
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

  private placeClubPing() {
    const show = !this.clubEntered && this.interior === "street";
    this.clubPing.setEnabled(show);
    if (!show) return;
    const south = LOC.club.z - CLUB_SIZE.d * 0.5;
    this.clubPing.position.set(
      LOC.club.x,
      10.4 + Math.sin(this.time * 2.4) * 0.35,
      south - 1.1,
    );
    this.clubPing.rotation.y = this.time * 0.8;
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
        else if (this.mode === "crawl") this.prompt = "SPACE  ZIPLA    C  TIRMAN  DROP";
        break;
      default: {
        const _never: never = this.mission;
        void _never;
      }
    }
    if (this.drive) this.prompt = "F / BİN  İN";
    else if (this.sexWith) this.prompt = "F  ÇIK    1 YAT  2 SAKSO  3 SEKS";
    else if (this.danceWith) this.prompt = "F  ÇIK";
    else if (nearCar && this.mode === "ground" && this.player.y < 1.35 && !this.nearClubEnter()) {
      this.prompt = "F / BİN";
    } else if (this.mode === "crawl") this.prompt = "SPACE  ZIPLA    C  TIRMAN  DROP";
    else if (canClimb && this.mode === "ground") this.prompt = this.prompt || "C  TIRMAN";
    const door = this.nearDoor();
    if (door === "enter") this.prompt = "F  GİR";
    else if (door === "exit") this.prompt = "F  ÇIK";
    else if (this.nearSexSpot()) this.prompt = "1 YAT    2 SAKSO    3 / F  SEKS";
    else if (!this.danceWith && this.nearDancePed()) this.prompt = "F  DANS";
  }

  private nearClubEnter(): boolean {
    if (this.drive || this.interior !== "street") return false;
    if (this.player.y > 2.4) return false;
    const room = this.city.interiors.club;
    if (dist2(this.player.x, this.player.z, room.doorX, room.doorZ) < 8.2) return true;
    const south = LOC.club.z - CLUB_SIZE.d * 0.5;
    const west = LOC.club.x - CLUB_SIZE.w * 0.5;
    const southWalk = Math.abs(this.player.x - LOC.club.x) < 10.5
      && this.player.z > south - 7.2
      && this.player.z < south + 2.2;
    const westWalk = this.player.x > west - 6.5
      && this.player.x < west + 1.6
      && Math.abs(this.player.z - LOC.club.z) < 8.5;
    return southWalk || westWalk;
  }

  private nearDoor(): "enter" | "exit" | null {
    if (this.drive) return null;
    if (this.interior === "street") {
      if (this.nearClubEnter()) return "enter";
      if (this.mode !== "ground") return null;
      const rooms = [this.city.interiors.mart, this.city.interiors.garage];
      for (const room of rooms) {
        if (dist2(this.player.x, this.player.z, room.doorX, room.doorZ) < 2.8) return "enter";
      }
      return null;
    }
    if (this.interior === "jail") return null;
    const room = this.city.interiors[this.interior];
    if (dist2(this.player.x, this.player.z, room.exitX, room.exitZ) < 3.8) return "exit";
    return null;
  }

  private clubBooths(): { x: number; z: number; yaw: number }[] {
    return [
      { x: INT.club.ox - 5.4, z: INT.club.oz - 1.2, yaw: Math.PI / 2 },
      { x: INT.club.ox - 5.4, z: INT.club.oz + 1.6, yaw: Math.PI / 2 },
    ];
  }

  private nearBooth(): { x: number; z: number; yaw: number } | null {
    if (this.interior !== "club") return null;
    for (const b of this.clubBooths()) {
      if (dist2(this.player.x, this.player.z, b.x, b.z) < 2.6) return b;
    }
    return null;
  }

  private nearDancePed(): Ped | null {
    if (this.drive) return null;
    let best: Ped | null = null;
    let bestD = this.interior === "club" ? 2.8 : 2.2;
    for (const p of this.peds) {
      if (p.state === "down" || p.state === "flee" || p.state === "webbed") continue;
      if (p.role !== "dancer" && p.role !== "hostess" && p.role !== "nightlife") continue;
      const d = dist2(this.player.x, this.player.z, p.x, p.z);
      if (d < bestD) { bestD = d; best = p; }
    }
    if (best) return best;
    if (this.nearBooth()) {
      for (const p of this.peds) {
        if (p.role !== "hostess" && p.role !== "dancer") continue;
        if (p.state === "down" || p.state === "flee") continue;
        return p;
      }
    }
    return null;
  }

  private tryStartDance(): boolean {
    const her = this.nearDancePed();
    if (!her) return false;
    const booth = this.nearBooth();
    const seatX = booth ? booth.x : this.player.x;
    const seatZ = booth ? booth.z : this.player.z;
    const yaw = booth ? booth.yaw : this.player.yaw;
    this.player.x = seatX;
    this.player.z = seatZ;
    this.player.y = 0.42;
    this.player.vx = 0;
    this.player.vz = 0;
    this.player.vy = 0;
    this.player.yaw = yaw;
    this.camYaw = yaw;
    this.mode = "ground";
    her.x = seatX + Math.sin(yaw) * 0.62;
    her.z = seatZ + Math.cos(yaw) * 0.62;
    her.yaw = yaw + Math.PI;
    her.state = "sit";
    this.danceWith = her;
    this.danceT = 8.5;
    this.enterLock = 0.28;
    this.camDist = 4.4;
    return true;
  }

  private stopDance() {
    const her = this.danceWith;
    if (her && her.state === "sit" && her.hp > 0) her.state = "wander";
    this.danceWith = null;
    this.danceT = 0;
    this.player.y = 0;
    this.enterLock = 0.28;
    this.camDist = this.interior === "club" ? 6.4 : 8.2;
  }

  private nearestBed(): { x: number; z: number; yaw: number } {
    let best: { x: number; z: number; yaw: number } = CLUB_BEDS[1];
    let bestD = 99;
    for (const b of CLUB_BEDS) {
      const d = dist2(this.player.x, this.player.z, b.x, b.z);
      if (d < bestD) { bestD = d; best = b; }
    }
    return best;
  }

  private bedIndex(bed: { x: number; z: number }): number {
    return CLUB_BEDS.findIndex((b) => b.x === bed.x && b.z === bed.z);
  }

  private inVipSuite(): boolean {
    if (this.interior !== "club") return false;
    return Math.abs(this.player.x - CLUB_VIP_ROOM.x) < CLUB_VIP_ROOM.hw + 0.8
      && Math.abs(this.player.z - CLUB_VIP_ROOM.z) < CLUB_VIP_ROOM.hd + 0.8;
  }

  private nearSexSpot(): boolean {
    if (this.interior !== "club" || this.drive) return false;
    if (this.inVipSuite()) return true;
    if (dist2(this.player.x, this.player.z, CLUB_VIP.x, CLUB_VIP.z) < 3.2) return true;
    for (const b of CLUB_BEDS) {
      if (dist2(this.player.x, this.player.z, b.x, b.z) < 2.8) return true;
    }
    return false;
  }

  private nearSexPed(): Ped | null {
    if (this.interior !== "club") return null;
    let best: Ped | null = null;
    let bestD = 3.4;
    for (const p of this.peds) {
      if (p.state === "down" || p.state === "flee" || p.state === "webbed") continue;
      if (p.role !== "vip" && p.role !== "dancer" && p.role !== "hostess") continue;
      const d = dist2(this.player.x, this.player.z, p.x, p.z);
      if (d < bestD) { bestD = d; best = p; }
    }
    if (best) return best;
    if (this.nearSexSpot()) {
      for (const p of this.peds) {
        if (p.role === "vip" && p.state !== "down" && p.state !== "flee") return p;
      }
      for (const p of this.peds) {
        if ((p.role === "dancer" || p.role === "hostess") && p.state !== "down" && p.state !== "flee") return p;
      }
    }
    return null;
  }

  private tryStartOrSwitchSex(kind: SexKind) {
    if (this.sexWith) {
      this.sexKind = kind;
      this.placeSexBodies();
      return;
    }
    if (this.enterLock > 0) return;
    this.tryStartSex(kind);
  }

  private tryStartSex(kind: SexKind = "seks"): boolean {
    if (!this.nearSexSpot()) return false;
    const her = this.nearSexPed();
    if (!her) return false;
    this.stopDance();
    this.sexKind = kind;
    this.sexBed = this.nearestBed();
    this.setCoupleHidden(this.bedIndex(this.sexBed), true);
    this.player.vx = 0;
    this.player.vz = 0;
    this.player.vy = 0;
    this.mode = "ground";
    her.state = "sit";
    this.sexWith = her;
    this.placeSexBodies();
    this.camYaw = this.sexBed.yaw + 0.95;
    this.camPitch = 0.48;
    this.enterLock = 0.28;
    this.camDist = 2.75;
    clubBed.setLevel(this.inVipSuite() ? 1.35 : 1);
    this.rotateSexTalk(true);
    return true;
  }

  private placeSexBodies() {
    const bed = this.sexBed;
    const yaw = bed.yaw;
    const her = this.sexWith;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    switch (this.sexKind) {
      case "yat":
        this.player.x = bed.x;
        this.player.z = bed.z;
        this.player.y = 0.56;
        this.player.yaw = yaw;
        if (her) {
          her.x = bed.x + fx * 0.12 + fz * 0.1;
          her.z = bed.z + fz * 0.12 - fx * 0.1;
          her.yaw = yaw;
        }
        break;
      case "sakso":
        this.player.x = bed.x - fx * 0.05;
        this.player.z = bed.z - fz * 0.05;
        this.player.y = 0.58;
        this.player.yaw = yaw;
        if (her) {
          her.x = bed.x + fx * 0.52;
          her.z = bed.z + fz * 0.52;
          her.yaw = yaw + Math.PI;
        }
        break;
      case "seks":
        this.player.x = bed.x;
        this.player.z = bed.z;
        this.player.y = 0.62;
        this.player.yaw = yaw;
        if (her) {
          her.x = bed.x + fx * 0.16;
          her.z = bed.z + fz * 0.16;
          her.yaw = yaw + Math.PI;
        }
        break;
      default: {
        const _never: never = this.sexKind;
        void _never;
      }
    }
  }

  private setCoupleHidden(bedI: number, hide: boolean) {
    if (bedI < 0) return;
    for (const p of this.peds) {
      if (p.role === "couple" && p.coupleBed === bedI) p.mesh.setEnabled(!hide);
    }
  }

  private poseCouple(p: Ped) {
    if (!p.mesh.isEnabled()) return;
    const bed = CLUB_BEDS[p.coupleBed ?? 1];
    const kind = p.coupleKind ?? "seks";
    const who = p.mesh.name.startsWith("dancer") ? "partner" : "player";
    p.x = who === "partner" && kind === "sakso" ? bed.x + 0.5 : bed.x;
    p.z = bed.z;
    p.yaw = who === "partner" ? bed.yaw + Math.PI : bed.yaw;
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.rotation.y = p.yaw;
    tickSexPose(p.mesh, this.time + p.x, kind, who);
  }

  private stopSex() {
    const her = this.sexWith;
    if (!her) {
      clubBed.setLevel(this.inVipSuite() ? 0.2 : 0);
      return;
    }
    resetBodyPose(this.playerMesh);
    resetBodyPose(her.mesh);
    this.setCoupleHidden(this.bedIndex(this.sexBed), false);
    if (her.hp > 0 && her.state !== "down") {
      her.state = "wander";
      if (her.role === "vip") {
        her.x = this.sexBed.x + 0.85;
        her.z = this.sexBed.z;
        her.tx = her.x;
        her.tz = her.z;
      }
    }
    this.sexWith = null;
    this.player.x = this.sexBed.x + 1.7;
    this.player.z = this.sexBed.z;
    this.player.y = 0;
    this.player.vx = 0;
    this.player.vz = 0;
    this.enterLock = 0.28;
    this.camDist = 6.4;
    this.camPitch = 0.16;
    resetBodyPose(this.playerMesh);
    clubBed.setLevel(this.inVipSuite() ? 0.2 : 0);
  }

  private stepSex(dt: number) {
    const her = this.sexWith;
    if (!her || her.state === "down" || her.state === "flee") {
      this.stopSex();
      return;
    }
    void dt;
    const moving = Math.hypot(this.input.moveX, this.input.moveY) > 0.22;
    if (moving) {
      this.stopSex();
      return;
    }
    this.placeSexBodies();
    this.player.vx = 0;
    this.player.vz = 0;
    this.player.vy = 0;
    this.player.grounded = true;
    this.playerMesh.setEnabled(true);
    this.silk.setEnabled(false);
    tickSexPose(this.playerMesh, this.time, this.sexKind, "player");
    her.mesh.position.set(her.x, 0, her.z);
    her.mesh.rotation.y = her.yaw;
    tickSexPose(her.mesh, this.time, this.sexKind, "partner");
    clubBed.setLevel(this.inVipSuite() ? 1.35 : 1);
  }

  private nearTalkWoman(): boolean {
    if (this.sexWith || this.danceWith) return true;
    if (this.interior !== "club" && this.interior !== "street") return false;
    for (const p of this.peds) {
      if (p.state === "down" || p.state === "flee" || p.state === "webbed") continue;
      if (p.role !== "dancer" && p.role !== "hostess" && p.role !== "vip" && p.role !== "nightlife" && p.role !== "couple") continue;
      if (dist2(this.player.x, this.player.z, p.x, p.z) < 3.6) return true;
    }
    return this.nearSexSpot();
  }

  private rotateSexTalk(force = false) {
    if (!force && this.sexTalkT > 0) return;
    this.sexTalkI = (this.sexTalkI + 1) % SEX_LINES.length;
    const line = SEX_LINES[this.sexTalkI];
    this.sexTalk = line.tr;
    this.sexTalkEn = line.en;
    this.sexTalkT = 3.4;
    if (this.sexWith || this.inVipSuite()) clubBed.talk();
  }

  private tickSexTalk(dt: number) {
    if (!this.nearTalkWoman()) {
      this.sexTalkT = Math.max(0, this.sexTalkT - dt);
      if (this.sexTalkT <= 0) {
        this.sexTalk = "";
        this.sexTalkEn = "";
      }
      return;
    }
    this.sexTalkT -= dt;
    if (this.sexTalkT <= 0 || !this.sexTalk) this.rotateSexTalk();
  }

  private stepDance(dt: number) {
    const her = this.danceWith;
    if (!her || her.state === "down" || her.state === "flee") {
      this.stopDance();
      return;
    }
    this.danceT -= dt;
    const moving = Math.hypot(this.input.moveX, this.input.moveY) > 0.22;
    if (moving || this.danceT <= 0) {
      this.stopDance();
      return;
    }
    this.player.vx = 0;
    this.player.vz = 0;
    this.player.vy = 0;
    this.player.grounded = true;
    this.playerMesh.setEnabled(true);
    this.silk.setEnabled(false);
    tickSitPose(this.playerMesh, this.time);
    her.mesh.position.set(her.x, 0, her.z);
    her.mesh.rotation.y = her.yaw;
    tickLapDancePose(her.mesh, this.time);
  }

  private circleHitsCols(x: number, z: number, r: number, cols: AABB[]): boolean {
    for (const b of cols) {
      if (b.maxY < 0.25) continue;
      if (circleHitsAABB(x, z, r, b)) return true;
    }
    return false;
  }

  private tickClubBed() {
    if (this.interior === "club") {
      clubBass.setLevel(this.sexWith ? 0.28 : 1);
      const vip = this.inVipSuite();
      clubBed.setLevel(this.sexWith ? (vip ? 1.35 : 1) : vip ? 0.22 : 0);
      if (radio.el) radio.el.volume = this.sexWith ? 0.06 : 0.12;
      return;
    }
    clubBed.setLevel(0);
    if (radio.el) radio.el.volume = 0.4;
    if (this.interior !== "street") {
      clubBass.setLevel(0);
      return;
    }
    const d = dist2(this.player.x, this.player.z, LOC.club.x, LOC.club.z);
    clubBass.setLevel(d < 42 ? clamp(1 - d / 42, 0, 1) * 0.38 : 0);
  }

  private nearestCar(r: number): Car | null {
    let best: Car | null = null;
    let d0 = r;
    for (const c of this.cars) {
      if (c.wrecked || c.flow) continue;
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
    h.nearDoor = this.nearDoor() !== null;
    h.canClimb = !this.drive && !this.danceWith && !this.sexWith && (
      this.mode === "crawl"
      || !!nearestWall(this.player.x, Math.max(0.35, this.player.y + 0.4), this.player.z, this.city.colliders, 1.85)
    );
    h.nearSex = !this.drive && !this.sexWith && this.nearSexSpot();
    h.inSex = !!this.sexWith;
    h.sexActs = !this.drive && this.interior === "club" && (h.nearSex || h.inSex || this.inVipSuite());
    h.sexTalk = this.sexTalk;
    h.sexTalkEn = this.sexTalkEn;
    h.sexKind = this.sexWith ? this.sexKind : "";
    h.nearDance = !this.drive && !this.danceWith && !h.nearSex && !!this.nearDancePed();
    h.inDance = !!this.danceWith;
    if (this.drive) h.enterVerb = "BİN";
    else if (this.sexWith || this.danceWith) h.enterVerb = "ÇIK";
    else if (this.nearDoor() === "enter") h.enterVerb = "GİR";
    else if (this.nearDoor() === "exit") h.enterVerb = "ÇIK";
    else if (h.nearSex) h.enterVerb = "SEKS";
    else if (h.nearDance) h.enterVerb = "DANS";
    else if (h.nearCar) h.enterVerb = "BİN";
    else h.enterVerb = "";
    h.clubPing = !this.clubEntered && this.interior === "street";
    if (h.clubPing) {
      const d = Math.round(dist2(this.player.x, this.player.z, LOC.club.x, LOC.club.z - CLUB_SIZE.d * 0.5));
      h.clubHint = d < 8 ? "SALT GLOW  F  GİR" : "SALT GLOW  " + d + "m";
    }
    h.fade = this.fade;
    h.busted = this.busted;
    h.fps = this.fps;
    h.character = this.player.character;
    h.radioLive = radio.isLive();
    switch (this.interior) {
      case "mart": h.district = "Nova Mart"; h.mapX = LOC.mart.x; h.mapZ = LOC.mart.z; break;
      case "garage": h.district = "Maya Garage"; h.mapX = LOC.garage.x; h.mapZ = LOC.garage.z; break;
      case "jail": h.district = "NCPD Hold"; h.mapX = PD.x; h.mapZ = PD.z; break;
      case "club": h.district = "Salt Glow"; h.mapX = LOC.club.x; h.mapZ = LOC.club.z; break;
      case "street": h.district = "South Docks"; h.mapX = this.player.x; h.mapZ = this.player.z; break;
      default: {
        const _never: never = this.interior;
        void _never;
        h.district = "South Docks";
        h.mapX = this.player.x;
        h.mapZ = this.player.z;
      }
    }
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
