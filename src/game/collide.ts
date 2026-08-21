import { PLAYER_H, PLAYER_R, clamp } from "./constants";
import type { AABB } from "./types";

const SKIN = 0.05;
const CORNER = 0.38;
const ROOF_SNAP = 0.95;
const ITERS = 6;

export type Body = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
};

export type HitKind = "roof" | "out" | "ok";

export function circleHitsAABB(x: number, z: number, r: number, b: AABB): boolean {
  const cx = clamp(x, b.minX, b.maxX);
  const cz = clamp(z, b.minZ, b.maxZ);
  const dx = x - cx;
  const dz = z - cz;
  return dx * dx + dz * dz < r * r;
}

export function centerInside(x: number, y: number, z: number, cols: AABB[]): boolean {
  for (const b of cols) {
    if (y >= b.maxY - 0.05) continue;
    if (x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ) return true;
  }
  return false;
}

export function blockedAt(x: number, y: number, z: number, r: number, cols: AABB[], h = PLAYER_H): boolean {
  const top = y + h;
  for (const b of cols) {
    if (y >= b.maxY - 0.02) continue;
    if (top <= b.minY + 0.02) continue;
    if (circleHitsAABB(x, z, r, b)) return true;
  }
  return false;
}

function pushOutXZ(x: number, z: number, r: number, b: AABB): { x: number; z: number } {
  const cx = clamp(x, b.minX, b.maxX);
  const cz = clamp(z, b.minZ, b.maxZ);
  let dx = x - cx;
  let dz = z - cz;
  const dist = Math.hypot(dx, dz);
  const out = r + SKIN;
  if (dist > 1e-5) {
    const need = out / dist;
    return { x: cx + dx * need, z: cz + dz * need };
  }
  const left = x - b.minX;
  const right = b.maxX - x;
  const back = z - b.minZ;
  const fwd = b.maxZ - z;
  const m = Math.min(left, right, back, fwd);
  let nx = x;
  let nz = z;
  if (left <= m + CORNER && left <= right) nx = b.minX - out;
  else if (right <= m + CORNER) nx = b.maxX + out;
  if (back <= m + CORNER && back <= fwd) nz = b.minZ - out;
  else if (fwd <= m + CORNER) nz = b.maxZ + out;
  if (nx === x && nz === z) {
    if (m === left) nx = b.minX - out;
    else if (m === right) nx = b.maxX + out;
    else if (m === back) nz = b.minZ - out;
    else nz = b.maxZ + out;
  }
  return { x: nx, z: nz };
}

export function resolveCapsule(p: Body, cols: AABB[], r = PLAYER_R, h = PLAYER_H): HitKind {
  let result: HitKind = "ok";
  for (let i = 0; i < ITERS; i++) {
    let moved = false;
    for (const b of cols) {
      const top = p.y + h;
      if (p.y >= b.maxY - 0.02) continue;
      if (top <= b.minY + 0.02) continue;
      if (!circleHitsAABB(p.x, p.z, r, b)) continue;
      const toRoof = b.maxY - p.y;
      const over = p.x > b.minX && p.x < b.maxX && p.z > b.minZ && p.z < b.maxZ;
      if (over && toRoof >= -0.02 && toRoof <= ROOF_SNAP) {
        p.y = b.maxY;
        if (p.vy < 0) p.vy = 0;
        result = "roof";
        moved = true;
        continue;
      }
      const next = pushOutXZ(p.x, p.z, r, b);
      const px = next.x - p.x;
      const pz = next.z - p.z;
      p.x = next.x;
      p.z = next.z;
      if (px * p.vx + pz * p.vz < 0) {
        const inv = Math.hypot(px, pz) || 1;
        const nx = px / inv;
        const nz = pz / inv;
        const vdot = p.vx * nx + p.vz * nz;
        p.vx -= vdot * nx;
        p.vz -= vdot * nz;
      }
      result = result === "roof" ? "roof" : "out";
      moved = true;
    }
    if (!moved) break;
  }
  return result;
}

export function slideMove(
  p: Body, dx: number, dz: number, cols: AABB[], r = PLAYER_R,
): boolean {
  if (!blockedAt(p.x + dx, p.y, p.z + dz, r, cols)) {
    p.x += dx;
    p.z += dz;
    return false;
  }
  let hit = false;
  if (!blockedAt(p.x + dx, p.y, p.z, r, cols)) p.x += dx;
  else hit = true;
  if (!blockedAt(p.x, p.y, p.z + dz, r, cols)) p.z += dz;
  else hit = true;
  if (blockedAt(p.x, p.y, p.z, r, cols)) resolveCapsule(p, cols, r);
  return hit;
}

export function unstickCircle(o: { x: number; z: number }, cols: AABB[], r: number): boolean {
  let hit = false;
  for (let i = 0; i < ITERS; i++) {
    let moved = false;
    for (const b of cols) {
      if (b.maxY < 0.4) continue;
      if (!circleHitsAABB(o.x, o.z, r, b)) continue;
      const next = pushOutXZ(o.x, o.z, r, b);
      o.x = next.x;
      o.z = next.z;
      hit = true;
      moved = true;
    }
    if (!moved) break;
  }
  return hit;
}

export function landFloor(x: number, y: number, z: number, cols: AABB[], pad = 0.1): number {
  const floor = standFloor(x, z, cols, pad);
  if (floor < 0.45) return floor;
  if (y >= floor - 2.4) return floor;
  return 0;
}

export function standFloor(x: number, z: number, cols: AABB[], pad = 0.12): number {
  let y = 0;
  const r = 0.28;
  const samples: [number, number, number][] = [
    [x, z, pad],
    [x + r, z, 0.04],
    [x - r, z, 0.04],
    [x, z + r, 0.04],
    [x, z - r, 0.04],
  ];
  for (const [sx, sz, p] of samples) {
    for (const b of cols) {
      if (sx >= b.minX - p && sx <= b.maxX + p && sz >= b.minZ - p && sz <= b.maxZ + p) {
        if (b.maxY > y) y = b.maxY;
      }
    }
  }
  return y;
}
