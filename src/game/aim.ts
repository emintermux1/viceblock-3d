import { angWrap, clamp } from "./constants";

export type AssistKind = "ped" | "cop" | "car";

export type AssistHit = {
  kind: AssistKind;
  id: number;
  x: number;
  y: number;
  z: number;
  r: number;
};

export const ASSIST = {
  minR: 2.15,
  maxR: 28,
  coneTouch: 0.58,
  coneMouse: 0.34,
  stickTouch: 0.8,
  stickMouse: 0.5,
  stickTime: 0.36,
  pullTouch: 7.4,
  pullMouse: 2.5,
  fricTouch: 0.34,
  fricMouse: 0.7,
  fricConeTouch: 0.4,
  fricConeMouse: 0.22,
  bulletTouch: 0.44,
  bulletMouse: 0.24,
} as const;

export function aimAngles(px: number, py: number, pz: number, tx: number, ty: number, tz: number) {
  const dx = tx - px;
  const dy = ty - (py + 1.18);
  const dz = tz - pz;
  const horiz = Math.hypot(dx, dz) || 0.001;
  return {
    yaw: Math.atan2(dx, dz),
    pitch: clamp(Math.atan2(-dy, horiz), -0.62, 0.98),
    dist: Math.hypot(dx, dy, dz),
  };
}

export function angError(camYaw: number, camPitch: number, wantYaw: number, wantPitch: number) {
  return Math.hypot(angWrap(wantYaw - camYaw), wantPitch - camPitch);
}

export function scoreAssist(
  hit: AssistHit,
  px: number,
  py: number,
  pz: number,
  camYaw: number,
  camPitch: number,
  stickyId: number | null,
  touch: boolean,
): number | null {
  const dist = Math.hypot(hit.x - px, hit.z - pz);
  if (dist < ASSIST.minR || dist > ASSIST.maxR) return null;
  const want = aimAngles(px, py, pz, hit.x, hit.y, hit.z);
  const err = angError(camYaw, camPitch, want.yaw, want.pitch);
  const sticky = stickyId === hit.id;
  const cone = touch
    ? (sticky ? ASSIST.stickTouch : ASSIST.coneTouch)
    : (sticky ? ASSIST.stickMouse : ASSIST.coneMouse);
  if (err > cone) return null;
  let score = err + dist * 0.007;
  if (sticky) score *= 0.58;
  if (hit.kind === "cop") score *= 0.92;
  return score;
}

export function lookFriction(err: number, touch: boolean): number {
  const cone = touch ? ASSIST.fricConeTouch : ASSIST.fricConeMouse;
  if (err > cone) return 1;
  const t = 1 - err / cone;
  const damp = touch ? ASSIST.fricTouch : ASSIST.fricMouse;
  return 1 - t * (1 - damp);
}

export function magnetBlend(dt: number, touch: boolean, lookMag: number): number {
  const k = touch ? ASSIST.pullTouch : ASSIST.pullMouse;
  const fight = clamp(lookMag / 48, 0, 1);
  return (1 - Math.exp(-k * dt)) * (1 - fight * 0.88);
}
