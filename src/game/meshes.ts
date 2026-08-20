import { Mesh, MeshBuilder, Quaternion, Scene, Vector3 } from "@babylonjs/core";
import { facadeMat, flareTex, makeDecal, makeSign, mat, uniqueMat } from "./art";
import { clamp } from "./constants";
import type { CharacterId } from "./types";

export { facadeMat, flareTex, makeDecal, makeSign, mat, uniqueMat } from "./art";
export type { BuildingStyle } from "./types";

function box(scene: Scene, parent: Mesh, name: string, w: number, h: number, d: number, x: number, y: number, z: number, hex: string, em = 0): Mesh {
  const m = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
  m.position.set(x, y, z);
  m.material = mat(scene, hex, em);
  m.parent = parent;
  return m;
}

function cyl(scene: Scene, parent: Mesh, name: string, h: number, dia: number, x: number, y: number, z: number, hex: string, tess = 8, em = 0): Mesh {
  const m = MeshBuilder.CreateCylinder(name, { height: h, diameter: dia, tessellation: tess }, scene);
  m.position.set(x, y, z);
  m.material = mat(scene, hex, em);
  m.parent = parent;
  return m;
}

export function makeBuilding(
  scene: Scene, x: number, z: number, w: number, d: number, h: number,
  hex: string, style: import("./types").BuildingStyle = "walkup", yaw = 0,
): Mesh {
  const root = new Mesh("bldg", scene);
  root.position.set(x, 0, z);
  root.rotation.y = yaw;

  const body = MeshBuilder.CreateBox("body", { width: w, height: h, depth: d }, scene);
  body.position.y = h * 0.5;
  body.material = facadeMat(scene, hex, style, "side");
  body.parent = root;

  const front = MeshBuilder.CreateBox("fac", { width: w * 0.99, height: h * 0.99, depth: 0.1 }, scene);
  front.position.set(0, h * 0.5, d * 0.5 + 0.05);
  front.material = facadeMat(scene, hex, style, "front");
  front.parent = root;

  const back = MeshBuilder.CreateBox("facb", { width: w * 0.97, height: h * 0.97, depth: 0.08 }, scene);
  back.position.set(0, h * 0.5, -d * 0.5 - 0.04);
  back.material = facadeMat(scene, hex, style, "side");
  back.parent = root;

  box(scene, root, "plinth", w * 1.06, 0.42, d * 1.06, 0, 0.21, 0, "#1a1816");
  box(scene, root, "roof", w * 0.94, 0.2, d * 0.94, 0, h + 0.1, 0, "#141820");
  box(scene, root, "parapet", w * 1.04, 0.42, 0.16, 0, h + 0.28, d * 0.5, "#1a1c20");
  box(scene, root, "parapetB", w * 1.04, 0.42, 0.16, 0, h + 0.28, -d * 0.5, "#1a1c20");
  box(scene, root, "cornice", w * 1.08, 0.16, d * 1.08, 0, h + 0.02, 0, "#2a2420");

  switch (style) {
    case "tower":
      dressTower(scene, root, w, d, h, hex);
      break;
    case "walkup":
      dressWalkup(scene, root, w, d, h);
      addFrontWindows(scene, root, w, d, h, 3, Math.min(4, Math.max(2, Math.floor(h / 3.2))));
      break;
    case "warehouse":
      dressWarehouse(scene, root, w, d, h);
      break;
    case "shop":
      dressShop(scene, root, w, d, h, hex);
      addFrontWindows(scene, root, w, d, h, 3, 2, 3.4);
      break;
    default: {
      const _never: never = style;
      void _never;
    }
  }
  return root;
}

function dressTower(scene: Scene, root: Mesh, w: number, d: number, h: number, hex: string) {
  const tw = w * 0.62;
  const td = d * 0.62;
  const th = Math.max(3.2, h * 0.22);
  const crown = MeshBuilder.CreateBox("crown", { width: tw, height: th, depth: td }, scene);
  crown.position.set(0, h + th * 0.5, 0);
  crown.material = facadeMat(scene, hex, "tower", "front");
  crown.parent = root;
  box(scene, root, "ac", 1.5, 0.6, 1.2, w * 0.18, h + 0.55, d * 0.12, "#2a3038");
  box(scene, root, "ac2", 1.1, 0.45, 0.9, -w * 0.16, h + 0.48, -d * 0.12, "#323840");
  cyl(scene, root, "tk", 1.2, 1.35, -w * 0.12, h + 0.85, d * 0.12, "#3a4448");
  cyl(scene, root, "ant", 3.6, 0.08, w * 0.22, h + 2.0, -d * 0.14, "#1a1a1a", 6);
  const tip = MeshBuilder.CreateSphere("tip", { diameter: 0.18, segments: 6 }, scene);
  tip.position.set(w * 0.22, h + 3.8, -d * 0.14);
  tip.material = mat(scene, "#ff4d4d", 0.8);
  tip.parent = root;
}

function addFrontWindows(scene: Scene, root: Mesh, w: number, d: number, h: number, cols: number, rows: number, startY = 3.15) {
  const gapX = w / (cols + 1);
  const gapY = Math.min(2.7, (h - startY - 1.2) / Math.max(1, rows));
  for (let r = 0; r < rows; r++) {
    const ly = startY + r * gapY;
    if (ly > h - 0.8) break;
    for (let c = 0; c < cols; c++) {
      const lx = -w * 0.5 + gapX * (c + 1);
      const lit = ((r * 11 + c * 17 + Math.round(w * 10)) % 7) > 2;
      box(scene, root, "win", 0.72, 0.95, 0.1, lx, ly, d * 0.5 + 0.08, lit ? "#f2d27a" : "#121820", lit ? 0.62 : 0.04);
      box(scene, root, "sill", 0.82, 0.08, 0.16, lx, ly - 0.52, d * 0.5 + 0.1, "#2a2420");
    }
  }
}

function dressWalkup(scene: Scene, root: Mesh, w: number, d: number, h: number) {
  const floors = Math.max(2, Math.floor(h / 3.1));
  for (let i = 0; i < floors; i++) {
    const ly = 2.15 + i * 2.75;
    if (ly > h - 0.6) break;
    box(scene, root, "bal", w * 0.52, 0.08, 0.42, 0, ly, d * 0.5 + 0.22, "#2a2420");
    box(scene, root, "rail", w * 0.52, 0.28, 0.05, 0, ly + 0.2, d * 0.5 + 0.4, "#1a1814");
  }
  for (let i = 0; i < Math.min(10, Math.floor(h / 0.5)); i++) {
    box(scene, root, "lad", 0.07, 0.07, 0.3, w * 0.44, 0.45 + i * 0.5, d * 0.5 + 0.2, "#4a4038");
  }
  box(scene, root, "stoop", 2.1, 0.32, 1.15, 0, 0.16, d * 0.5 + 0.7, "#3a3834");
}

function dressWarehouse(scene: Scene, root: Mesh, w: number, d: number, h: number) {
  box(scene, root, "door", w * 0.4, h * 0.42, 0.14, 0, h * 0.28, d * 0.5 + 0.06, "#2a2018");
  box(scene, root, "rust", w * 0.22, h * 0.1, 0.06, w * 0.28, h * 0.18, d * 0.5 + 0.05, "#6a3a28", 0.04);
  const roofL = MeshBuilder.CreateBox("sl", { width: w * 0.98, height: 0.16, depth: d * 0.58 }, scene);
  roofL.position.set(0, h + 0.55, d * 0.18);
  roofL.rotation.x = -0.28;
  roofL.material = mat(scene, "#3a2a22");
  roofL.parent = root;
  const roofR = MeshBuilder.CreateBox("sr", { width: w * 0.98, height: 0.16, depth: d * 0.58 }, scene);
  roofR.position.set(0, h + 0.55, -d * 0.18);
  roofR.rotation.x = 0.28;
  roofR.material = mat(scene, "#32241c");
  roofR.parent = root;
}

function dressShop(scene: Scene, root: Mesh, w: number, d: number, h: number, hex: string) {
  void hex;
  box(scene, root, "glass", w * 0.86, Math.min(2.2, h * 0.34), 0.1, 0, 1.25, d * 0.5 + 0.07, "#7ec8e8", 0.22);
  box(scene, root, "awn", w * 0.94, 0.1, 1.15, 0, 2.45, d * 0.5 + 0.58, "#c03040", 0.14);
  box(scene, root, "poleL", 0.08, 0.85, 0.08, -w * 0.4, 2.0, d * 0.5 + 0.95, "#2a2020");
  box(scene, root, "poleR", 0.08, 0.85, 0.08, w * 0.4, 2.0, d * 0.5 + 0.95, "#2a2020");
  box(scene, root, "door", 0.7, 1.7, 0.08, w * 0.32, 0.85, d * 0.5 + 0.08, "#1a1210");
}

export function makePalm(scene: Scene, x: number, z: number): Mesh {
  const root = new Mesh("palm", scene);
  root.position.set(x, 0, z);
  const trunk = MeshBuilder.CreateCylinder("t", { height: 4.4, diameterTop: 0.16, diameterBottom: 0.34, tessellation: 7 }, scene);
  trunk.position.y = 2.2;
  trunk.rotation.z = 0.08;
  trunk.material = mat(scene, "#5a3a22");
  trunk.parent = root;
  for (let i = 0; i < 8; i++) {
    const leaf = MeshBuilder.CreateBox("lf", { width: 0.16, height: 0.06, depth: 2.35 }, scene);
    leaf.material = mat(scene, i % 2 === 0 ? "#1a6a3a" : "#228046", 0.1);
    const a = (i / 8) * Math.PI * 2;
    leaf.position.set(Math.sin(a) * 0.45, 4.35, Math.cos(a) * 0.45);
    leaf.rotation.y = a;
    leaf.rotation.x = 0.55 + (i % 3) * 0.08;
    leaf.parent = root;
  }
  const crown = MeshBuilder.CreateSphere("pc", { diameter: 0.35, segments: 6 }, scene);
  crown.position.y = 4.3;
  crown.material = mat(scene, "#2a5a28", 0.06);
  crown.parent = root;
  return root;
}

export function makeLamp(scene: Scene, x: number, z: number, lit: boolean, yaw = 0): Mesh {
  const root = new Mesh("lamp", scene);
  root.position.set(x, 0, z);
  root.rotation.y = yaw;
  cyl(scene, root, "p", 4.4, 0.12, 0, 2.2, 0, "#1a1e22", 6);
  box(scene, root, "arm", 0.1, 0.08, 1.15, 0, 4.45, 0.5, "#1a1e22");
  const bulb = MeshBuilder.CreateSphere("bulb", { diameter: 0.38, segments: 7 }, scene);
  bulb.position.set(0, 4.35, 1.05);
  bulb.material = mat(scene, "#ffd27a", lit ? 0.95 : 0.2);
  bulb.parent = root;
  const shade = MeshBuilder.CreateCylinder("sh", { height: 0.16, diameterTop: 0.55, diameterBottom: 0.22, tessellation: 8 }, scene);
  shade.position.set(0, 4.52, 1.05);
  shade.material = mat(scene, "#2a2a28");
  shade.parent = root;
  return root;
}

export function makeNeon(scene: Scene, x: number, y: number, z: number, w: number, h: number, hex: string, yaw = 0): Mesh {
  const p = MeshBuilder.CreatePlane("neon", { width: w, height: h }, scene);
  p.position.set(x, y, z);
  p.rotation.y = yaw;
  p.material = mat(scene, hex, 0.85, 0);
  return p;
}

export function makeDumpster(scene: Scene, x: number, z: number, yaw = 0): Mesh {
  const root = new Mesh("dump", scene);
  root.position.set(x, 0, z);
  root.rotation.y = yaw;
  box(scene, root, "d", 1.55, 1.08, 0.9, 0, 0.54, 0, "#2a5a38");
  box(scene, root, "lid", 1.58, 0.08, 0.92, 0, 1.1, 0, "#1a3a28");
  box(scene, root, "bar", 1.5, 0.06, 0.06, 0, 0.72, 0.46, "#1a3a28");
  return root;
}

export function makeHydrant(scene: Scene, x: number, z: number): Mesh {
  const root = new Mesh("hyd", scene);
  root.position.set(x, 0, z);
  cyl(scene, root, "h", 0.72, 0.28, 0, 0.36, 0, "#c03030", 8, 0.08);
  box(scene, root, "cap", 0.4, 0.12, 0.16, 0, 0.5, 0, "#8a2020");
  return root;
}

export function makeBench(scene: Scene, x: number, z: number, yaw = 0): Mesh {
  const root = new Mesh("bench", scene);
  root.position.set(x, 0, z);
  root.rotation.y = yaw;
  box(scene, root, "seat", 1.65, 0.08, 0.44, 0, 0.42, 0, "#4a3020");
  box(scene, root, "back", 1.65, 0.42, 0.08, 0, 0.68, -0.18, "#3a2418");
  box(scene, root, "l", 0.08, 0.42, 0.4, -0.72, 0.21, 0, "#2a2a2a");
  box(scene, root, "r", 0.08, 0.42, 0.4, 0.72, 0.21, 0, "#2a2a2a");
  return root;
}

export function makeTrash(scene: Scene, x: number, z: number): Mesh {
  const root = new Mesh("bag", scene);
  root.position.set(x, 0, z);
  const b = MeshBuilder.CreateSphere("bg", { diameter: 0.44, segments: 6 }, scene);
  b.position.y = 0.2;
  b.scaling.y = 0.85;
  b.material = mat(scene, "#1a2818");
  b.parent = root;
  return root;
}

export function makeNewsbox(scene: Scene, x: number, z: number): Mesh {
  const root = new Mesh("news", scene);
  root.position.set(x, 0, z);
  box(scene, root, "n", 0.44, 0.72, 0.34, 0, 0.36, 0, "#1a4a88", 0.06);
  box(scene, root, "w", 0.38, 0.24, 0.04, 0, 0.5, 0.17, "#c8d0d8", 0.1);
  return root;
}

export function makeCone(scene: Scene, x: number, z: number): Mesh {
  const root = new Mesh("cone", scene);
  root.position.set(x, 0, z);
  const c = MeshBuilder.CreateCylinder("cn", { height: 0.58, diameterTop: 0.08, diameterBottom: 0.3, tessellation: 7 }, scene);
  c.position.y = 0.29;
  c.material = mat(scene, "#ff6a1a", 0.22);
  c.parent = root;
  return root;
}

export function makeFence(scene: Scene, x: number, z: number, len: number, yaw: number): Mesh {
  const root = new Mesh("fence", scene);
  root.position.set(x, 0, z);
  root.rotation.y = yaw;
  const posts = Math.max(2, Math.round(len / 2.2));
  for (let i = 0; i < posts; i++) {
    const px = -len / 2 + (i / (posts - 1)) * len;
    cyl(scene, root, "fp", 1.8, 0.08, px, 0.9, 0, "#4a4a48", 6);
  }
  box(scene, root, "rail", len, 0.05, 0.05, 0, 1.55, 0, "#5a5a56");
  box(scene, root, "rail2", len, 0.05, 0.05, 0, 0.7, 0, "#5a5a56");
  box(scene, root, "mesh", len, 1.3, 0.02, 0, 0.95, 0, "#3a3a38");
  return root;
}

export function makeContainer(scene: Scene, x: number, z: number, y: number, hex: string, yaw = 0): Mesh {
  const root = new Mesh("ctr", scene);
  root.position.set(x, y, z);
  root.rotation.y = yaw;
  box(scene, root, "c", 2.45, 2.2, 6.1, 0, 1.1, 0, hex);
  box(scene, root, "rib", 2.48, 2.0, 0.1, 0, 1.1, 2.55, "#1a1a1a");
  box(scene, root, "rib2", 2.48, 2.0, 0.1, 0, 1.1, 0, "#1a1a1a");
  box(scene, root, "rib3", 2.48, 2.0, 0.1, 0, 1.1, -2.55, "#1a1a1a");
  box(scene, root, "door", 0.06, 1.9, 2.4, 1.24, 1.05, 0, shadeSafe(hex));
  return root;
}

function shadeSafe(hex: string): string {
  return hex === "#ff8a3d" ? "#c45a20" : hex === "#2ef2d0" ? "#1a8a78" : "#1a1a1a";
}

export function makeCrane(scene: Scene, x: number, z: number): Mesh {
  const root = new Mesh("crane", scene);
  root.position.set(x, 0, z);
  cyl(scene, root, "cp", 18, 0.7, 0, 9, 0, "#c45a20", 8, 0.06);
  box(scene, root, "jib", 0.38, 0.38, 18, 0, 17.4, 6.2, "#d46a28", 0.1);
  box(scene, root, "counter", 0.38, 0.38, 6, 0, 17.4, -4.2, "#d46a28", 0.08);
  box(scene, root, "cab", 1.6, 1.35, 1.8, 0, 16.2, 0.2, "#2a2a28");
  box(scene, root, "win", 1.2, 0.55, 0.08, 0, 16.45, 1.12, "#7ec8e8", 0.2);
  cyl(scene, root, "hk", 5.2, 0.07, 0, 14.4, 14.2, "#1a1a1a", 6);
  const hook = MeshBuilder.CreateBox("hookb", { width: 0.35, height: 0.25, depth: 0.18 }, scene);
  hook.position.set(0, 11.7, 14.2);
  hook.material = mat(scene, "#2a2a2a");
  hook.parent = root;
  return root;
}

export function makeBoat(scene: Scene, x: number, z: number, hex: string): Mesh {
  const root = new Mesh("boat", scene);
  root.position.set(x, -0.02, z);
  box(scene, root, "hull", 2.5, 0.75, 6.4, 0, 0.22, 0, hex);
  box(scene, root, "bow", 1.5, 0.4, 1.4, 0, 0.38, 2.7, hex);
  box(scene, root, "cab", 1.55, 1.15, 2.1, 0, 1.1, -0.35, "#d8d0c4");
  box(scene, root, "glass", 1.35, 0.4, 0.08, 0, 1.25, 0.7, "#7ec8e8", 0.18);
  cyl(scene, root, "mast", 2.4, 0.08, 0.4, 2.4, -0.2, "#c8c0b4", 6);
  return root;
}

export function makePiling(scene: Scene, x: number, z: number): Mesh {
  const root = new Mesh("pil", scene);
  root.position.set(x, 0, z);
  const p = MeshBuilder.CreateCylinder("p", { height: 2.4, diameterTop: 0.28, diameterBottom: 0.36, tessellation: 7 }, scene);
  p.position.y = 0.2;
  p.material = mat(scene, "#4a3224");
  p.parent = root;
  return root;
}

export function makeCrate(scene: Scene, x: number, z: number, yaw = 0): Mesh {
  const root = new Mesh("crate", scene);
  root.position.set(x, 0, z);
  root.rotation.y = yaw;
  box(scene, root, "c", 0.85, 0.7, 0.85, 0, 0.35, 0, "#8a6238");
  box(scene, root, "x", 0.88, 0.08, 0.08, 0, 0.35, 0, "#5a3e22");
  return root;
}

export function makeBillboard(scene: Scene, x: number, z: number, title: string, fg: string, yaw = 0): Mesh {
  const root = new Mesh("bb", scene);
  root.position.set(x, 0, z);
  root.rotation.y = yaw;
  cyl(scene, root, "p1", 7.2, 0.16, -1.6, 3.6, 0, "#2a2a2a", 6);
  cyl(scene, root, "p2", 7.2, 0.16, 1.6, 3.6, 0, "#2a2a2a", 6);
  box(scene, root, "board", 4.6, 2.2, 0.12, 0, 6.4, 0, "#101014");
  const sign = makeSign(scene, title, 0, 6.4, 0.08, 4.2, 1.6, "#08080c", fg, 0);
  sign.parent = root;
  sign.position.set(0, 6.4, 0.08);
  sign.rotation.y = 0;
  return root;
}

export function makeCar(scene: Scene, color: string, kind: "hatch" | "sedan" | "muscle" | "cop"): Mesh {
  const root = new Mesh("car-" + kind, scene);
  const len = kind === "muscle" ? 4.85 : kind === "hatch" ? 3.75 : 4.3;
  const bodyH = kind === "muscle" ? 0.46 : 0.52;
  const bodyY = kind === "muscle" ? 0.46 : 0.5;
  const bodyCol = kind === "cop" ? "#f0f2f4" : color;
  const body = MeshBuilder.CreateBox("bd", { width: 1.88, height: bodyH, depth: len }, scene);
  body.position.y = bodyY;
  body.material = uniqueMat(scene, bodyCol, 0.05, 0.35);
  body.parent = root;

  const cabinD = kind === "hatch" ? 1.55 : kind === "muscle" ? 1.62 : 1.9;
  const cabinH = kind === "muscle" ? 0.4 : kind === "hatch" ? 0.56 : 0.5;
  const cabin = MeshBuilder.CreateBox("cb", { width: 1.64, height: cabinH, depth: cabinD }, scene);
  cabin.position.set(0, kind === "muscle" ? 0.86 : 0.96, kind === "hatch" ? -0.18 : -0.1);
  cabin.material = mat(scene, kind === "cop" ? "#1a3a88" : "#152028", 0.06);
  cabin.parent = root;

  const hood = MeshBuilder.CreateBox("hd", { width: 1.8, height: 0.14, depth: len * 0.3 }, scene);
  hood.position.set(0, bodyY + bodyH * 0.5, len * 0.28);
  hood.rotation.x = 0.18;
  hood.material = uniqueMat(scene, bodyCol, 0.06, 0.35);
  hood.parent = root;

  const trunkD = kind === "hatch" ? 0.42 : 0.74;
  box(scene, root, "trk", 1.8, 0.2, trunkD, 0, 0.64, -len * 0.34, bodyCol);

  if (kind === "muscle") {
    box(scene, root, "scoop", 0.55, 0.1, 0.7, 0, 0.78, len * 0.18, shadeSafe(bodyCol));
    box(scene, root, "spoiler", 1.7, 0.08, 0.22, 0, 0.92, -len * 0.46, bodyCol);
  }

  box(scene, root, "bmp", 1.92, 0.16, 0.16, 0, 0.32, len * 0.5 - 0.02, "#1a1a1a");
  box(scene, root, "bmp2", 1.92, 0.14, 0.14, 0, 0.3, -len * 0.5 + 0.02, "#1a1a1a");
  box(scene, root, "skirtL", 0.08, 0.16, len * 0.7, -0.94, 0.28, 0, "#111111");
  box(scene, root, "skirtR", 0.08, 0.16, len * 0.7, 0.94, 0.28, 0, "#111111");

  box(scene, root, "hl", 0.3, 0.13, 0.07, -0.58, 0.54, len * 0.5 - 0.01, "#f2e6c0", 0.95);
  box(scene, root, "hr", 0.3, 0.13, 0.07, 0.58, 0.54, len * 0.5 - 0.01, "#f2e6c0", 0.95);
  const glowL = MeshBuilder.CreateSphere("hlg", { diameter: 0.22, segments: 6 }, scene);
  glowL.position.set(-0.58, 0.54, len * 0.5 + 0.04);
  glowL.material = mat(scene, "#ffe6a8", 1);
  glowL.parent = root;
  const glowR = MeshBuilder.CreateSphere("hrg", { diameter: 0.22, segments: 6 }, scene);
  glowR.position.set(0.58, 0.54, len * 0.5 + 0.04);
  glowR.material = mat(scene, "#ffe6a8", 1);
  glowR.parent = root;
  box(scene, root, "tl", 0.28, 0.11, 0.07, -0.62, 0.52, -len * 0.5 + 0.01, "#ff2a2a", 0.85);
  box(scene, root, "tr", 0.28, 0.11, 0.07, 0.62, 0.52, -len * 0.5 + 0.01, "#ff2a2a", 0.85);

  const glass = MeshBuilder.CreateBox("gl", { width: 1.52, height: 0.3, depth: 0.08 }, scene);
  glass.position.set(0, kind === "muscle" ? 0.9 : 0.98, len * 0.14);
  glass.rotation.x = 0.35;
  glass.material = mat(scene, "#7ec8e8", 0.22);
  glass.parent = root;

  if (kind === "cop") {
    box(scene, root, "bar", 1.0, 0.14, 0.34, 0, 1.26, 0.08, "#1a1a1a");
    box(scene, root, "lbr", 0.42, 0.13, 0.3, -0.24, 1.32, 0.08, "#ff2a3a", 0.95);
    box(scene, root, "lbb", 0.42, 0.13, 0.3, 0.24, 1.32, 0.08, "#2a6aff", 0.95);
    box(scene, root, "push", 1.7, 0.18, 0.12, 0, 0.42, len * 0.52, "#2a2a2a");
  }

  const shadow = MeshBuilder.CreateGround("shd", { width: 2.1, height: len * 0.95 }, scene);
  shadow.position.y = 0.02;
  shadow.material = mat(scene, "#000000", 0);
  shadow.material.alpha = 0.35;
  shadow.parent = root;

  const wheelMat = mat(scene, "#111111");
  const rimMat = mat(scene, "#4a4a4a", 0.06);
  const spots: [number, number][] = [[-0.84, len * 0.32], [0.84, len * 0.32], [-0.84, -len * 0.32], [0.84, -len * 0.32]];
  for (const [wx, wz] of spots) {
    const well = MeshBuilder.CreateBox("well", { width: 0.22, height: 0.28, depth: 0.55 }, scene);
    well.position.set(wx > 0 ? 0.82 : -0.82, 0.32, wz);
    well.material = mat(scene, "#0a0a0a");
    well.parent = root;
    const wh = MeshBuilder.CreateCylinder("wh", { height: 0.3, diameter: 0.64, tessellation: 10 }, scene);
    wh.rotation.z = Math.PI / 2;
    wh.position.set(wx, 0.32, wz);
    wh.material = wheelMat;
    wh.parent = root;
    const rim = MeshBuilder.CreateCylinder("rim", { height: 0.32, diameter: 0.36, tessellation: 10 }, scene);
    rim.rotation.z = Math.PI / 2;
    rim.position.set(wx, 0.32, wz);
    rim.material = rimMat;
    rim.parent = root;
  }
  return root;
}

type Hair = "beanie" | "messy" | "bun" | "cap" | "short" | "peak";

type Kit = {
  name: string;
  skin: string;
  torso: string;
  torsoE?: number;
  pelvis: string;
  legs: string;
  shoes: string;
  hair: string;
  hairStyle: Hair;
  sx: number;
  sy: number;
  neck: number;
  crop?: boolean;
  shorts?: boolean;
  chain?: boolean;
  earring?: boolean;
  badge?: boolean;
  shirt?: string;
  glow?: string;
  skirt?: string;
  vest?: string;
  mask?: boolean;
  lens?: string;
};

function limb(scene: Scene, root: Mesh, name: string, x: number, y: number, dia: number, h: number, hex: string): Mesh {
  const piv = new Mesh(name, scene);
  piv.parent = root;
  piv.position.set(x, y, 0);
  const b = MeshBuilder.CreateCylinder(name + "m", { height: h, diameter: dia, tessellation: 8 }, scene);
  b.position.y = -h * 0.5;
  b.material = mat(scene, hex);
  b.parent = piv;
  return piv;
}

function face(scene: Scene, root: Mesh, y: number, z: number) {
  const le = MeshBuilder.CreateSphere("eye", { diameter: 0.075, segments: 6 }, scene);
  le.position.set(-0.075, y, z);
  le.material = mat(scene, "#f4f4f0", 0.2);
  le.parent = root;
  const re = MeshBuilder.CreateSphere("eye", { diameter: 0.075, segments: 6 }, scene);
  re.position.set(0.075, y, z);
  re.material = mat(scene, "#f4f4f0", 0.2);
  re.parent = root;
  box(scene, root, "pup", 0.03, 0.03, 0.02, -0.075, y, z + 0.03, "#1a1410");
  box(scene, root, "pup", 0.03, 0.03, 0.02, 0.075, y, z + 0.03, "#1a1410");
  box(scene, root, "brow", 0.22, 0.025, 0.03, 0, y + 0.07, z, "#2a2018");
  box(scene, root, "mouth", 0.13, 0.03, 0.02, 0, y - 0.1, z, "#5a3030");
}

function hairOn(scene: Scene, root: Mesh, style: Hair, hex: string, headY: number) {
  switch (style) {
    case "beanie": {
      cyl(scene, root, "hat", 0.18, 0.38, 0, headY + 0.16, 0, hex, 8);
      box(scene, root, "brim", 0.4, 0.05, 0.4, 0, headY + 0.08, 0, hex);
      break;
    }
    case "messy": {
      box(scene, root, "h1", 0.3, 0.18, 0.24, -0.04, headY + 0.2, 0.02, hex);
      box(scene, root, "h2", 0.2, 0.22, 0.18, 0.1, headY + 0.22, -0.04, hex);
      box(scene, root, "h3", 0.16, 0.14, 0.22, 0, headY + 0.16, 0.14, hex);
      break;
    }
    case "bun": {
      const bun = MeshBuilder.CreateSphere("bun", { diameter: 0.2, segments: 7 }, scene);
      bun.position.set(0, headY + 0.22, -0.1);
      bun.material = mat(scene, hex);
      bun.parent = root;
      box(scene, root, "bang", 0.32, 0.08, 0.13, 0, headY + 0.13, 0.13, hex);
      break;
    }
    case "cap":
    case "peak": {
      cyl(scene, root, "hat", 0.15, 0.4, 0, headY + 0.16, 0, hex, 8);
      box(scene, root, "peak", 0.3, 0.04, 0.24, 0, headY + 0.1, 0.2, hex);
      break;
    }
    case "short": {
      const c = MeshBuilder.CreateSphere("hair", { diameter: 0.38, segments: 7 }, scene);
      c.position.y = headY + 0.08;
      c.scaling.y = 0.48;
      c.material = mat(scene, hex);
      c.parent = root;
      break;
    }
    default: {
      const _never: never = style;
      void _never;
    }
  }
}

function assemblePerson(scene: Scene, kit: Kit): Mesh {
  const root = new Mesh(kit.name, scene);
  const sx = kit.sx;
  const sy = kit.sy;
  const tw = 0.46 * sx;
  const td = 0.28 * sx;
  const th = (kit.crop ? 0.36 : 0.52) * sy;
  const torsoY = (kit.crop ? 1.24 : 1.28) * sy;
  const pelvisY = 0.9 * sy;
  const hipY = 0.82 * sy;
  const headY = 1.66 * sy;
  const skin = kit.skin;

  box(scene, root, "pelvis", tw * 0.9, 0.2 * sy, td * 0.95, 0, pelvisY, 0, kit.skirt || kit.pelvis);
  if (kit.shirt) box(scene, root, "tee", tw * 0.88, 0.16, td * 0.88, 0, torsoY - th * 0.42, 0, kit.shirt);
  const torso = MeshBuilder.CreateSphere("torso", { diameter: 1, segments: 8 }, scene);
  torso.scaling.set(tw, th, td);
  torso.position.y = torsoY;
  torso.material = mat(scene, kit.torso, kit.torsoE ?? 0);
  torso.parent = root;
  if (kit.vest) box(scene, root, "vest", tw * 1.08, th * 0.85, td * 1.1, 0, torsoY, 0, kit.vest, 0.05);
  if (kit.glow) {
    box(scene, root, "trim", tw * 1.04, 0.05, td * 1.04, 0, torsoY + th * 0.42, 0, kit.glow, 0.65);
    box(scene, root, "trim2", 0.05, th * 0.8, td * 1.04, -tw * 0.52, torsoY, 0, kit.glow, 0.45);
  }
  if (kit.crop) box(scene, root, "mid", tw * 0.7, 0.14, td * 0.7, 0, torsoY - th * 0.62, 0, skin);

  cyl(scene, root, "nk", 0.13 * sy, kit.neck, 0, headY - 0.2 * sy, 0, kit.mask ? kit.torso : skin, 7);
  const head = MeshBuilder.CreateSphere("hd", { diameter: 0.36, segments: 8 }, scene);
  head.position.y = headY;
  head.material = mat(scene, kit.mask ? kit.torso : skin, kit.mask ? 0.08 : 0);
  head.parent = root;
  if (kit.mask) {
    box(scene, root, "visor", 0.28, 0.07, 0.08, 0, headY + 0.02, 0.15, kit.lens || "#2ef2d0", 0.85);
    box(scene, root, "helm", 0.32, 0.12, 0.28, 0, headY + 0.12, 0, kit.torso, 0.1);
    box(scene, root, "shootL", 0.08, 0.06, 0.1, -tw * 0.52, torsoY + th * 0.05, 0.08, "#111114", 0.2);
    box(scene, root, "shootR", 0.08, 0.06, 0.1, tw * 0.52, torsoY + th * 0.05, 0.08, "#111114", 0.2);
  } else {
    face(scene, root, headY + 0.02, 0.155);
    hairOn(scene, root, kit.hairStyle, kit.hair, headY);
  }

  const armH = 0.52 * sy;
  const legH = (kit.shorts ? 0.38 : 0.72) * sy;
  limb(scene, root, "larm", -tw * 0.5 - 0.08, torsoY + th * 0.35, 0.13, armH, kit.torso);
  limb(scene, root, "rarm", tw * 0.5 + 0.08, torsoY + th * 0.35, 0.13, armH, kit.torso);
  const ll = limb(scene, root, "lleg", -0.14 * sx, hipY, 0.17, legH, kit.legs);
  const rl = limb(scene, root, "rleg", 0.14 * sx, hipY, 0.17, legH, kit.legs);
  box(scene, ll, "shoe", 0.18, 0.1, 0.28, 0, -legH - 0.02, 0.04, kit.shoes);
  box(scene, rl, "shoe", 0.18, 0.1, 0.28, 0, -legH - 0.02, 0.04, kit.shoes);
  if (kit.shorts) {
    box(scene, ll, "calf", 0.14, 0.32 * sy, 0.16, 0, -legH - 0.16 * sy, 0, skin);
    box(scene, rl, "calf", 0.14, 0.32 * sy, 0.16, 0, -legH - 0.16 * sy, 0, skin);
  }

  if (kit.chain) {
    const ch = MeshBuilder.CreateTorus("chain", { diameter: 0.24, thickness: 0.02, tessellation: 10 }, scene);
    ch.position.y = torsoY + th * 0.38;
    ch.rotation.x = 1.2;
    ch.material = mat(scene, "#e0b040", 0.4);
    ch.parent = root;
  }
  if (kit.earring) {
    const hoop = MeshBuilder.CreateTorus("ear", { diameter: 0.065, thickness: 0.012, tessellation: 8 }, scene);
    hoop.position.set(0.17, headY, 0.02);
    hoop.material = mat(scene, "#e8c860", 0.45);
    hoop.parent = root;
  }
  if (kit.badge) box(scene, root, "badge", 0.1, 0.08, 0.03, 0.16, torsoY + 0.08, td * 0.55, "#e0b040", 0.55);
  return root;
}

export function makeHero(scene: Scene, id: CharacterId): Mesh {
  if (id === "orangie") {
    return assemblePerson(scene, {
      name: "hero-orangie", skin: "#c4a070", torso: "#1a2438", torsoE: 0.04,
      pelvis: "#ff8a3d", legs: "#1a2438", shoes: "#111114", hair: "#e07020",
      hairStyle: "messy", sx: 1.24, sy: 0.95, neck: 0.2, glow: "#ff8a3d",
      mask: true, lens: "#ff8a3d",
    });
  }
  if (id === "cupsey") {
    return assemblePerson(scene, {
      name: "hero-cupsey", skin: "#f5dcc8", torso: "#1a1018", torsoE: 0.06,
      pelvis: "#ff4da6", legs: "#1a1018", shoes: "#f0f0f0", hair: "#ff4da6",
      hairStyle: "bun", sx: 0.88, sy: 0.9, neck: 0.12, glow: "#ff4da6",
      mask: true, lens: "#ff4da6",
    });
  }
  return assemblePerson(scene, {
    name: "hero-ansem", skin: "#f0d4c0", torso: "#102028", torsoE: 0.08,
    pelvis: "#0a1818", legs: "#102028", shoes: "#111114", hair: "#111114",
    hairStyle: "beanie", sx: 0.92, sy: 1.0, neck: 0.13, glow: "#2ef2d0",
    mask: true, lens: "#2ef2d0",
  });
}

const PED_KITS: Omit<Kit, "name" | "sx" | "sy" | "neck">[] = [
  { skin: "#e8c4a0", torso: "#c45c4a", pelvis: "#2a3040", legs: "#2a3040", shoes: "#1a1a1a", hair: "#1a1210", hairStyle: "short" },
  { skin: "#c09060", torso: "#2a6a8a", pelvis: "#3a3830", legs: "#3a3830", shoes: "#2a2018", hair: "#3a2010", hairStyle: "messy" },
  { skin: "#d4a070", torso: "#e8e0d0", pelvis: "#8a2040", legs: "#4a1828", shoes: "#2a1a18", hair: "#201810", hairStyle: "bun", skirt: "#8a2040" },
  { skin: "#8a6038", torso: "#3a8a50", pelvis: "#1a1a22", legs: "#1a1a22", shoes: "#111110", hair: "#4a3020", hairStyle: "short" },
  { skin: "#f0d0b0", torso: "#6a4a8a", pelvis: "#2a2a38", legs: "#2a2a38", shoes: "#1a1a22", hair: "#f0d080", hairStyle: "messy" },
  { skin: "#c4b090", torso: "#d4a040", pelvis: "#403830", legs: "#403830", shoes: "#2a2010", hair: "#1a1a1a", hairStyle: "beanie" },
  { skin: "#f5d8c4", torso: "#a03040", pelvis: "#f0a0b0", legs: "#c07080", shoes: "#f0e0e0", hair: "#2a1820", hairStyle: "bun", skirt: "#f0a0b0" },
  { skin: "#b08058", torso: "#203040", pelvis: "#1a2430", legs: "#1a2430", shoes: "#111114", hair: "#0a0a0a", hairStyle: "cap" },
];

export function makePed(scene: Scene, seed: number): Mesh {
  const k = PED_KITS[Math.abs(seed | 0) % PED_KITS.length];
  const sx = 0.9 + ((Math.abs(seed * 13) % 9) * 0.02);
  const sy = 0.92 + ((Math.abs(seed * 7) % 7) * 0.015);
  return assemblePerson(scene, { ...k, name: "ped" + seed, sx, sy, neck: 0.13 + (seed % 3) * 0.015 });
}

export function makeCop(scene: Scene): Mesh {
  return assemblePerson(scene, {
    name: "cop", skin: "#e8d0b8", torso: "#e8e4dc", pelvis: "#1a1e28", legs: "#1a1e28",
    shoes: "#111114", hair: "#1a2438", hairStyle: "peak", sx: 1.04, sy: 1.02, neck: 0.15,
    vest: "#1a3a88", badge: true,
  });
}

export function tickSwingPose(mesh: Mesh, t: number, attached: boolean) {
  const tuck = attached ? 0.85 : 0.35;
  const pump = Math.sin(t * 8) * 0.12;
  for (const ch of mesh.getChildMeshes(false)) {
    if (ch.name === "larm") ch.rotation.x = attached ? -2.3 : -1.1;
    else if (ch.name === "rarm") ch.rotation.x = attached ? -2.15 + pump : -0.8;
    else if (ch.name === "lleg") ch.rotation.x = tuck;
    else if (ch.name === "rleg") ch.rotation.x = tuck * 0.7;
  }
}

export function makeSilk(scene: Scene, hex: string): Mesh {
  const m = MeshBuilder.CreateCylinder("silk", { height: 1, diameter: 0.09, tessellation: 6 }, scene);
  m.material = mat(scene, hex, 1.15, 0);
  m.setEnabled(false);
  return m;
}

export function placeSilk(mesh: Mesh, ax: number, ay: number, az: number, bx: number, by: number, bz: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const dz = bz - az;
  const len = Math.hypot(dx, dy, dz) || 0.01;
  mesh.setEnabled(true);
  mesh.position.set((ax + bx) * 0.5, (ay + by) * 0.5, (az + bz) * 0.5);
  mesh.scaling.set(1, len, 1);
  const dir = new Vector3(dx / len, dy / len, dz / len);
  const up = new Vector3(0, 1, 0);
  const axis = Vector3.Cross(up, dir);
  if (axis.length() > 0.0001) {
    mesh.rotationQuaternion = Quaternion.RotationAxis(axis.normalize(), Math.acos(clamp(Vector3.Dot(up, dir), -1, 1)));
  } else {
    mesh.rotationQuaternion = null;
    mesh.rotation.set(0, 0, 0);
  }
}

export function tickWalk(mesh: Mesh, t: number, moving: boolean) {
  const amp = moving ? 0.48 : 0;
  const s = Math.sin(t * 9.4) * amp;
  const bob = moving ? Math.abs(Math.sin(t * 9.4)) * 0.04 : 0;
  mesh.position.y += bob;
  for (const ch of mesh.getChildMeshes(false)) {
    if (ch.name === "lleg") ch.rotation.x = s;
    else if (ch.name === "rleg") ch.rotation.x = -s;
    else if (ch.name === "larm") ch.rotation.x = -s * 0.8;
    else if (ch.name === "rarm") ch.rotation.x = s * 0.8;
  }
}

export function lookDir(yaw: number, pitch: number): Vector3 {
  const cp = Math.cos(pitch);
  return new Vector3(Math.sin(yaw) * cp, -Math.sin(pitch), Math.cos(yaw) * cp);
}
