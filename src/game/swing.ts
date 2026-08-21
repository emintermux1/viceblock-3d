import { Vector3 } from "@babylonjs/core";
import { clamp } from "./constants";
import { lookDir } from "./meshes";
import type { AABB } from "./types";

export type Anchor = { x: number; y: number; z: number };

export type SwingRope = {
  ax: number;
  ay: number;
  az: number;
  length: number;
};

export const SWING_GRAVITY = -46;
export const SWING_STEER = 34;
export const SWING_MIN = 7;
export const SWING_MAX = 52;
export const SWING_SPEED_CAP = 52;
export const ZIP_SPEED = 46;
export const AIR_DRAG = 0.12;
export const WALL_STICK = 0.55;

export function addBuildingAnchors(out: Anchor[], x: number, z: number, w: number, d: number, h: number) {
  const hw = w * 0.46;
  const hd = d * 0.46;
  out.push({ x, y: h + 0.15, z });
  out.push({ x: x + hw, y: h + 0.15, z: z + hd });
  out.push({ x: x - hw, y: h + 0.15, z: z + hd });
  out.push({ x: x + hw, y: h + 0.15, z: z - hd });
  out.push({ x: x - hw, y: h + 0.15, z: z - hd });
  const mid = h * 0.72;
  const low = h * 0.42;
  out.push({ x: x + w * 0.5, y: mid, z });
  out.push({ x: x - w * 0.5, y: mid, z });
  out.push({ x, y: mid, z: z + d * 0.5 });
  out.push({ x, y: mid, z: z - d * 0.5 });
  out.push({ x: x + w * 0.5, y: low, z });
  out.push({ x: x - w * 0.5, y: low, z });
  out.push({ x, y: low, z: z + d * 0.5 });
  out.push({ x, y: low, z: z - d * 0.5 });
}

export function pickAnchor(
  px: number, py: number, pz: number,
  vx: number, vy: number, vz: number,
  camYaw: number, camPitch: number,
  anchors: Anchor[],
): Anchor | null {
  const look = lookDir(camYaw, camPitch * 0.35 - 0.28);
  const speed = Math.hypot(vx, vy, vz);
  let best: Anchor | null = null;
  let bestScore = 0.55;
  for (const a of anchors) {
    const dx = a.x - px;
    const dy = a.y - py;
    const dz = a.z - pz;
    const dist = Math.hypot(dx, dy, dz);
    if (dist < SWING_MIN || dist > SWING_MAX) continue;
    if (a.y < py - 1.2) continue;
    const inv = 1 / dist;
    const nx = dx * inv;
    const ny = dy * inv;
    const nz = dz * inv;
    const align = nx * look.x + ny * look.y + nz * look.z;
    if (align < 0.18) continue;
    const vAlign = speed > 1.2 ? (vx * nx + vy * ny + vz * nz) / speed : 0;
    const height = clamp((a.y - py) / 18, 0, 1.2);
    const score = align * 2.1 + height * 0.85 + vAlign * 0.7 + (1 - dist / SWING_MAX) * 0.45;
    if (score > bestScore) {
      bestScore = score;
      best = a;
    }
  }
  return best;
}

export function constrainRope(
  p: { x: number; y: number; z: number; vx: number; vy: number; vz: number },
  rope: SwingRope,
) {
  const dx = p.x - rope.ax;
  const dy = p.y - rope.ay;
  const dz = p.z - rope.az;
  const dist = Math.hypot(dx, dy, dz) || 0.001;
  if (dist <= rope.length) return;
  const inv = 1 / dist;
  const nx = dx * inv;
  const ny = dy * inv;
  const nz = dz * inv;
  p.x = rope.ax + nx * rope.length;
  p.y = rope.ay + ny * rope.length;
  p.z = rope.az + nz * rope.length;
  const vrad = p.vx * nx + p.vy * ny + p.vz * nz;
  if (vrad > 0) {
    p.vx -= vrad * nx;
    p.vy -= vrad * ny;
    p.vz -= vrad * nz;
  }
}

export function stepSwing(
  p: { x: number; y: number; z: number; vx: number; vy: number; vz: number },
  rope: SwingRope,
  moveX: number,
  moveY: number,
  camYaw: number,
  dt: number,
) {
  p.vy += SWING_GRAVITY * dt;
  const fwd = lookDir(camYaw, 0);
  const right = new Vector3(fwd.z, 0, -fwd.x);
  const pump = 1 + (p.y < rope.ay - rope.length * 0.35 && moveY < -0.2 ? 0.55 : 0);
  p.vx += (fwd.x * -moveY + right.x * moveX) * SWING_STEER * pump * dt;
  p.vz += (fwd.z * -moveY + right.z * moveX) * SWING_STEER * pump * dt;
  p.vx *= 1 - AIR_DRAG * dt;
  p.vz *= 1 - AIR_DRAG * dt;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.z += p.vz * dt;
  constrainRope(p, rope);
  const spd = Math.hypot(p.vx, p.vy, p.vz);
  if (spd > SWING_SPEED_CAP) {
    const k = SWING_SPEED_CAP / spd;
    p.vx *= k;
    p.vy *= k;
    p.vz *= k;
  }
}

export function stepAir(
  p: { x: number; y: number; z: number; vx: number; vy: number; vz: number },
  moveX: number,
  moveY: number,
  camYaw: number,
  dt: number,
) {
  p.vy += SWING_GRAVITY * dt;
  const fwd = lookDir(camYaw, 0);
  const right = new Vector3(fwd.z, 0, -fwd.x);
  p.vx += (fwd.x * -moveY + right.x * moveX) * 10 * dt;
  p.vz += (fwd.z * -moveY + right.z * moveX) * 10 * dt;
  p.vx *= 1 - 0.08 * dt;
  p.vz *= 1 - 0.08 * dt;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.z += p.vz * dt;
}

export function stepZip(
  p: { x: number; y: number; z: number; vx: number; vy: number; vz: number },
  target: Anchor,
  dt: number,
): boolean {
  const dx = target.x - p.x;
  const dy = target.y - 1.4 - p.y;
  const dz = target.z - p.z;
  const dist = Math.hypot(dx, dy, dz) || 0.001;
  if (dist < 2.2) {
    p.vx *= 0.4;
    p.vy *= 0.4;
    p.vz *= 0.4;
    return true;
  }
  const inv = 1 / dist;
  p.vx = dx * inv * ZIP_SPEED;
  p.vy = dy * inv * ZIP_SPEED;
  p.vz = dz * inv * ZIP_SPEED;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.z += p.vz * dt;
  return false;
}

export function roofY(x: number, z: number, cols: AABB[], pad = 0): number {
  let y = 0;
  for (const b of cols) {
    if (x >= b.minX - pad && x <= b.maxX + pad && z >= b.minZ - pad && z <= b.maxZ + pad) {
      if (b.maxY > y) y = b.maxY;
    }
  }
  return y;
}

export function standY(x: number, z: number, cols: AABB[]): number {
  const r = 0.32;
  return Math.max(
    roofY(x, z, cols, 0.42),
    roofY(x + r, z, cols, 0.08),
    roofY(x - r, z, cols, 0.08),
    roofY(x, z + r, cols, 0.08),
    roofY(x, z - r, cols, 0.08),
  );
}

export function unstickPlayer(
  p: { x: number; y: number; z: number; vx: number; vy: number; vz: number },
  cols: AABB[],
): "roof" | "out" | "ok" {
  let result: "roof" | "out" | "ok" = "ok";
  for (const b of cols) {
    if (p.x <= b.minX || p.x >= b.maxX || p.z <= b.minZ || p.z >= b.maxZ) continue;
    if (p.y >= b.maxY - 0.06) continue;
    if (p.y >= b.maxY - 1.45) {
      p.y = b.maxY;
      if (p.vy < 0) p.vy = 0;
      result = "roof";
      continue;
    }
    const left = p.x - b.minX;
    const right = b.maxX - p.x;
    const back = p.z - b.minZ;
    const fwd = b.maxZ - p.z;
    const m = Math.min(left, right, back, fwd);
    if (m === left) { p.x = b.minX - 0.55; if (p.vx > 0) p.vx = 0; }
    else if (m === right) { p.x = b.maxX + 0.55; if (p.vx < 0) p.vx = 0; }
    else if (m === back) { p.z = b.minZ - 0.55; if (p.vz > 0) p.vz = 0; }
    else { p.z = b.maxZ + 0.55; if (p.vz < 0) p.vz = 0; }
    result = "out";
  }
  return result;
}

export type WallHit = { x: number; y: number; z: number; nx: number; nz: number; maxY: number; d: number };

export function nearestWall(
  x: number, y: number, z: number, cols: AABB[], reach: number,
): WallHit | null {
  let best: WallHit | null = null;
  for (const b of cols) {
    if (b.maxY < 1.6) continue;
    if (y < 0 || y > b.maxY + 0.35) continue;
    const faces: { d: number; nx: number; nz: number; px: number; pz: number }[] = [
      { d: Math.abs(x - b.maxX), nx: 1, nz: 0, px: b.maxX, pz: clamp(z, b.minZ, b.maxZ) },
      { d: Math.abs(x - b.minX), nx: -1, nz: 0, px: b.minX, pz: clamp(z, b.minZ, b.maxZ) },
      { d: Math.abs(z - b.maxZ), nx: 0, nz: 1, px: clamp(x, b.minX, b.maxX), pz: b.maxZ },
      { d: Math.abs(z - b.minZ), nx: 0, nz: -1, px: clamp(x, b.minX, b.maxX), pz: b.minZ },
    ];
    for (const f of faces) {
      const along = f.nx !== 0 ? (z >= b.minZ - 0.55 && z <= b.maxZ + 0.55) : (x >= b.minX - 0.55 && x <= b.maxX + 0.55);
      if (!along || f.d > reach) continue;
      if (!best || f.d < best.d) best = { x: f.px, y, z: f.pz, nx: f.nx, nz: f.nz, maxY: b.maxY, d: f.d };
    }
  }
  return best;
}
