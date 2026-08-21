import type { CharacterId } from "./types";

export const STICK_RADIUS = 56;
export const STICK_DEAD = 8;

export const WALK = 5.7;
export const SPRINT = 9.3;
export const JUMP_VEL = 8.8;
export const GRAVITY = -26;
export const PLAYER_R = 0.42;
export const PLAYER_H = 1.8;

export const MAG = 12;
export const RESERVE = 36;
export const FIRE_CD = 0.16;
export const RELOAD_T = 1.35;
export const GUN_DMG = 28;
export const MELEE_DMG = 34;
export const MELEE_RANGE = 1.85;
export const MELEE_CD = 0.45;
export const TRACER_LIFE = 0.09;
export const GUN_RANGE = 48;

export const CAR_HP = 100;
export const CAR_MAX = 21;
export const CAR_REV = 7;
export const CAR_ACC = 16;
export const CAR_BRAKE = 24;
export const CAR_FRICTION = 5.5;

export const STAR_MAX = 5;
export const LOS_FORGET = 8;
export const COP_FOOT = 5.4;
export const COP_SHOT_CD = 1.25;
export const COP_DMG = 7;
export const SPAWN_PAD = 28;

export const REGEN_DELAY = 6;
export const REGEN_RATE = 8;

export const CHAR: Record<CharacterId, { name: string; kit: string; hp: number; speed: number; cash: number; color: string; accent: string }> = {
  ansem: { name: "ANSEM", kit: "LINE", hp: 100, speed: 1, cash: 1, color: "#2ef2d0", accent: "#0a3a38" },
  orangie: { name: "ORANGIE", kit: "ANCHOR", hp: 130, speed: 0.88, cash: 0.9, color: "#ff8a3d", accent: "#3a2010" },
  cupsey: { name: "CUPSEY", kit: "DART", hp: 80, speed: 1.14, cash: 1.25, color: "#ff4da6", accent: "#3a1028" },
};

export const LOC = {
  spawn: { x: -26, z: 6 },
  garage: { x: -50, z: 50 },
  mart: { x: 14, z: 28 },
  carA: { x: -22, z: 12, yaw: 0.15 },
  carB: { x: 34, z: 22, yaw: Math.PI * 0.5 },
  carC: { x: 46, z: 56, yaw: -0.4 },
  club: { x: -6, z: 22 },
};

export const CLUB_SIZE = { w: 16, d: 12, h: 15 };

export function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function angWrap(a: number) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function dist2(ax: number, az: number, bx: number, bz: number) {
  return Math.hypot(ax - bx, az - bz);
}

export const SAVE_KEY = "viceblock3d-line-v2";
export const CRANE_GOAL = { x: 58, z: 80, y: 16 };

export const CAR_SPEC: Record<"hatch" | "sedan" | "muscle" | "cop", {
  mass: number; torque: number; top: number; brake: number; steer: number; traction: number; drift: number;
}> = {
  hatch: { mass: 0.82, torque: 19, top: 18, brake: 27, steer: 2.15, traction: 0.86, drift: 0.34 },
  sedan: { mass: 1.0, torque: 16, top: 21, brake: 24, steer: 1.7, traction: 1.0, drift: 0.2 },
  muscle: { mass: 1.28, torque: 23, top: 26, brake: 21, steer: 1.35, traction: 0.72, drift: 0.56 },
  cop: { mass: 1.16, torque: 19, top: 23, brake: 28, steer: 1.55, traction: 1.18, drift: 0.12 },
};

export const WITNESS_R = 18;
export const CALL_T = 1.5;
export const SEARCH_R0 = 40;
export const SEARCH_T0 = 25;
export const ARREST_R = 1.6;
export const BAIL = 400;
export const JAIL_WAIT = 8;
export const REPAIR_COST = 90;

export const INT = {
  mart: { ox: 220, oz: 0 },
  garage: { ox: 220, oz: 40 },
  jail: { ox: 220, oz: 80 },
  club: { ox: 260, oz: 0 },
};

export const CLUB_BED = { x: 254.2, z: 4.6, yaw: Math.PI * 0.5 };
export const CLUB_VIP = { x: 252.6, z: 3.4 };

export const PD = { x: 52, z: -18 };
export const FENCE = { x: 36, z: 70 };
export const PD_OUT = { x: 52, z: -8 };
