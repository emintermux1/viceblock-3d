import {
  Color3, DynamicTexture, Mesh, MeshBuilder, Scene, StandardMaterial, Vector3,
} from "@babylonjs/core";
import type { CharacterId } from "./types";

const matCache = new Map<string, StandardMaterial>();
let uid = 0;

export function mat(scene: Scene, hex: string, emissive = 0, spec = 0.15): StandardMaterial {
  const key = hex + "|" + emissive + "|" + spec;
  let m = matCache.get(key);
  if (m && m.getScene() === scene) return m;
  m = new StandardMaterial("m-" + key, scene);
  const c = Color3.FromHexString(hex);
  m.diffuseColor = c;
  m.specularColor = new Color3(spec, spec, spec);
  if (emissive > 0) m.emissiveColor = c.scale(emissive);
  matCache.set(key, m);
  return m;
}

export function uniqueMat(scene: Scene, hex: string, emissive = 0, spec = 0.15): StandardMaterial {
  const m = new StandardMaterial("um-" + (++uid), scene);
  const c = Color3.FromHexString(hex);
  m.diffuseColor = c;
  m.specularColor = new Color3(spec, spec, spec);
  if (emissive > 0) m.emissiveColor = c.scale(emissive);
  return m;
}

export function windowTex(scene: Scene, base: string): DynamicTexture {
  const tex = new DynamicTexture("win-" + base, { width: 128, height: 256 }, scene, false);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 128, 256);
  for (let y = 14; y < 248; y += 26) {
    for (let x = 8; x < 120; x += 20) {
      const lit = ((x * 13 + y * 7 + base.length) % 10) > 3;
      ctx.fillStyle = lit ? "#f2d27a" : "#121820";
      ctx.fillRect(x, y, 10, 14);
    }
  }
  tex.update();
  return tex;
}

export function windowMat(scene: Scene, base: string): StandardMaterial {
  const key = "winmat-" + base;
  let m = matCache.get(key);
  if (m && m.getScene() === scene) return m;
  m = new StandardMaterial(key, scene);
  const tex = windowTex(scene, base);
  m.diffuseTexture = tex;
  m.emissiveTexture = tex;
  m.emissiveColor = new Color3(0.35, 0.3, 0.22);
  m.specularColor = new Color3(0.08, 0.08, 0.08);
  matCache.set(key, m);
  return m;
}

export function flareTex(scene: Scene): DynamicTexture {
  const tex = new DynamicTexture("flare", 32, scene, false);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  const g = ctx.createRadialGradient(16, 16, 1, 16, 16, 15);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  tex.update();
  return tex;
}

function box(scene: Scene, parent: Mesh, name: string, w: number, h: number, d: number, x: number, y: number, z: number, hex: string, em = 0): Mesh {
  const m = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
  m.position.set(x, y, z);
  m.material = mat(scene, hex, em);
  m.parent = parent;
  return m;
}

export function makeSign(scene: Scene, text: string, x: number, y: number, z: number, w: number, h: number, bg: string, fg: string, yaw = 0): Mesh {
  const plane = MeshBuilder.CreatePlane("sign-" + text, { width: w, height: h }, scene);
  plane.position.set(x, y, z);
  plane.rotation.y = yaw;
  const tw = 512;
  const th = Math.max(64, Math.round(512 * (h / Math.max(0.2, w))));
  const tex = new DynamicTexture("sg-" + text + uid++, { width: tw, height: th }, scene, false);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, tw, th);
  ctx.fillStyle = fg;
  ctx.strokeStyle = fg;
  const size = Math.floor(th * 0.62);
  ctx.font = "bold " + size + "px Impact, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, tw / 2, th / 2 + 2);
  tex.hasAlpha = false;
  tex.update();
  const m = new StandardMaterial("sm-" + text + uid, scene);
  m.diffuseTexture = tex;
  m.emissiveTexture = tex;
  m.emissiveColor = new Color3(0.55, 0.5, 0.4);
  m.specularColor = new Color3(0, 0, 0);
  m.backFaceCulling = false;
  plane.material = m;
  return plane;
}

export function makeDecal(scene: Scene, text: string, x: number, z: number, w: number, d: number, yaw: number, fg = "#e8d8a0"): Mesh {
  const g = MeshBuilder.CreateGround("dc-" + text, { width: w, height: d }, scene);
  g.position.set(x, 0.07, z);
  g.rotation.y = yaw;
  const tex = new DynamicTexture("dtx-" + text, { width: 256, height: 64 }, scene, false);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, 256, 64);
  ctx.fillStyle = fg;
  ctx.font = "bold 36px Impact, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 128, 32);
  tex.hasAlpha = true;
  tex.update();
  const m = new StandardMaterial("dm-" + text, scene);
  m.diffuseTexture = tex;
  m.emissiveTexture = tex;
  m.emissiveColor = new Color3(0.4, 0.35, 0.2);
  m.specularColor = new Color3(0, 0, 0);
  m.opacityTexture = tex;
  g.material = m;
  return g;
}

export type BuildingStyle = "tower" | "walkup" | "warehouse" | "shop";

export function makeBuilding(scene: Scene, x: number, z: number, w: number, d: number, h: number, hex: string, style: BuildingStyle = "walkup"): Mesh {
  const root = MeshBuilder.CreateBox("b", { width: w, height: h, depth: d }, scene);
  root.position.set(x, h * 0.5, z);
  if (style === "warehouse") root.material = mat(scene, hex, 0.02, 0.08);
  else root.material = windowMat(scene, hex);

  const roof = box(scene, root, "r", w * 0.92, 0.22, d * 0.92, 0, h * 0.5 + 0.12, 0, "#141820");
  void roof;

  if (style === "tower") {
    box(scene, root, "ac", 1.4, 0.55, 1.1, w * 0.22, h * 0.5 + 0.5, d * 0.18, "#2a3038");
    box(scene, root, "ac2", 1.1, 0.4, 0.9, -w * 0.2, h * 0.5 + 0.42, -d * 0.15, "#323840");
    const tank = MeshBuilder.CreateCylinder("tk", { height: 1.1, diameter: 1.3, tessellation: 8 }, scene);
    tank.position.set(-w * 0.15, h * 0.5 + 0.7, d * 0.15);
    tank.material = mat(scene, "#3a4448");
    tank.parent = root;
    const ant = MeshBuilder.CreateCylinder("ant", { height: 3.2, diameter: 0.08, tessellation: 6 }, scene);
    ant.position.set(w * 0.28, h * 0.5 + 1.8, -d * 0.2);
    ant.material = mat(scene, "#1a1a1a");
    ant.parent = root;
  } else if (style === "walkup") {
    const floors = Math.max(2, Math.floor(h / 3.2));
    for (let i = 0; i < floors; i++) {
      const ly = -h * 0.5 + 2.1 + i * 2.8;
      if (ly > h * 0.45) break;
      box(scene, root, "bal", w * 0.55, 0.08, 0.38, 0, ly, d * 0.5 + 0.16, "#2a2420");
      box(scene, root, "rail", w * 0.55, 0.22, 0.05, 0, ly + 0.18, d * 0.5 + 0.32, "#1a1814");
    }
    for (let i = 0; i < Math.min(8, Math.floor(h / 0.55)); i++) {
      box(scene, root, "lad", 0.08, 0.08, 0.28, w * 0.46, -h * 0.5 + 0.5 + i * 0.55, d * 0.5 + 0.18, "#4a4038");
    }
  } else if (style === "warehouse") {
    box(scene, root, "door", w * 0.42, h * 0.42, 0.12, 0, -h * 0.18, d * 0.5 + 0.05, "#2a2018");
    box(scene, root, "rust", w * 0.2, h * 0.12, 0.06, w * 0.28, -h * 0.28, d * 0.5 + 0.04, "#6a3a28", 0.04);
    box(scene, root, "win", w * 0.5, 0.7, 0.08, 0, h * 0.22, d * 0.5 + 0.04, "#1a2830", 0.08);
  } else if (style === "shop") {
    box(scene, root, "glass", w * 0.86, h * 0.28, 0.1, 0, -h * 0.22, d * 0.5 + 0.06, "#7ec8e8", 0.18);
    box(scene, root, "awn", w * 0.92, 0.1, 1.1, 0, -h * 0.02, d * 0.5 + 0.55, "#c03040", 0.12);
    box(scene, root, "poleL", 0.08, 0.7, 0.08, -w * 0.4, -h * 0.18, d * 0.5 + 0.9, "#2a2020");
    box(scene, root, "poleR", 0.08, 0.7, 0.08, w * 0.4, -h * 0.18, d * 0.5 + 0.9, "#2a2020");
  }

  return root;
}

export function makePalm(scene: Scene, x: number, z: number): Mesh {
  const root = new Mesh("palm", scene);
  root.position.set(x, 0, z);
  const trunk = MeshBuilder.CreateCylinder("t", { height: 4.2, diameterTop: 0.18, diameterBottom: 0.32, tessellation: 6 }, scene);
  trunk.position.y = 2.1;
  trunk.material = mat(scene, "#5a3a22");
  trunk.parent = root;
  for (let i = 0; i < 6; i++) {
    const leaf = MeshBuilder.CreateBox("lf", { width: 0.18, height: 0.08, depth: 2.1 }, scene);
    leaf.material = mat(scene, "#1a6a3a", 0.08);
    leaf.position.set(Math.sin(i) * 0.4, 4.15, Math.cos(i) * 0.4);
    leaf.rotation.y = (i / 6) * Math.PI * 2;
    leaf.rotation.x = 0.45;
    leaf.parent = root;
  }
  return root;
}

export function makeLamp(scene: Scene, x: number, z: number, lit: boolean): Mesh {
  const root = new Mesh("lamp", scene);
  root.position.set(x, 0, z);
  const pole = MeshBuilder.CreateCylinder("p", { height: 4.6, diameter: 0.12, tessellation: 6 }, scene);
  pole.position.y = 2.3;
  pole.material = mat(scene, "#1a1e22");
  pole.parent = root;
  const bulb = MeshBuilder.CreateSphere("bulb", { diameter: 0.32, segments: 6 }, scene);
  bulb.position.y = 4.55;
  bulb.material = mat(scene, "#ffd27a", lit ? 0.9 : 0.2);
  bulb.parent = root;
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
  box(scene, root, "d", 1.5, 1.05, 0.85, 0, 0.52, 0, "#2a5a38");
  box(scene, root, "lid", 1.52, 0.08, 0.88, 0, 1.08, 0, "#1a3a28");
  return root;
}

export function makeHydrant(scene: Scene, x: number, z: number): Mesh {
  const root = new Mesh("hyd", scene);
  root.position.set(x, 0, z);
  const c = MeshBuilder.CreateCylinder("h", { height: 0.7, diameter: 0.28, tessellation: 8 }, scene);
  c.position.y = 0.35;
  c.material = mat(scene, "#c03030", 0.08);
  c.parent = root;
  box(scene, root, "cap", 0.38, 0.12, 0.16, 0, 0.48, 0, "#8a2020");
  return root;
}

export function makeBench(scene: Scene, x: number, z: number, yaw = 0): Mesh {
  const root = new Mesh("bench", scene);
  root.position.set(x, 0, z);
  root.rotation.y = yaw;
  box(scene, root, "seat", 1.6, 0.08, 0.42, 0, 0.42, 0, "#4a3020");
  box(scene, root, "back", 1.6, 0.4, 0.08, 0, 0.66, -0.18, "#3a2418");
  box(scene, root, "l", 0.08, 0.42, 0.4, -0.7, 0.21, 0, "#2a2a2a");
  box(scene, root, "r", 0.08, 0.42, 0.4, 0.7, 0.21, 0, "#2a2a2a");
  return root;
}

export function makeTrash(scene: Scene, x: number, z: number): Mesh {
  const root = new Mesh("bag", scene);
  root.position.set(x, 0, z);
  const b = MeshBuilder.CreateSphere("bg", { diameter: 0.42, segments: 6 }, scene);
  b.position.y = 0.2;
  b.scaling.y = 0.85;
  b.material = mat(scene, "#1a2818");
  b.parent = root;
  return root;
}

export function makeNewsbox(scene: Scene, x: number, z: number): Mesh {
  const root = new Mesh("news", scene);
  root.position.set(x, 0, z);
  box(scene, root, "n", 0.42, 0.7, 0.32, 0, 0.35, 0, "#1a4a88", 0.06);
  box(scene, root, "w", 0.36, 0.22, 0.04, 0, 0.48, 0.16, "#c8d0d8", 0.1);
  return root;
}

export function makeCone(scene: Scene, x: number, z: number): Mesh {
  const root = new Mesh("cone", scene);
  root.position.set(x, 0, z);
  const c = MeshBuilder.CreateCylinder("cn", { height: 0.55, diameterTop: 0.08, diameterBottom: 0.28, tessellation: 6 }, scene);
  c.position.y = 0.28;
  c.material = mat(scene, "#ff6a1a", 0.2);
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
    const p = MeshBuilder.CreateCylinder("fp", { height: 1.8, diameter: 0.08, tessellation: 6 }, scene);
    p.position.set(px, 0.9, 0);
    p.material = mat(scene, "#4a4a48");
    p.parent = root;
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
  box(scene, root, "c", 2.4, 2.2, 6.0, 0, 1.1, 0, hex);
  box(scene, root, "rib", 2.42, 2.0, 0.08, 0, 1.1, 2.6, "#1a1a1a");
  box(scene, root, "rib2", 2.42, 2.0, 0.08, 0, 1.1, -2.6, "#1a1a1a");
  return root;
}

export function makeCrane(scene: Scene, x: number, z: number): Mesh {
  const root = new Mesh("crane", scene);
  root.position.set(x, 0, z);
  const pole = MeshBuilder.CreateCylinder("cp", { height: 16, diameter: 0.55, tessellation: 8 }, scene);
  pole.position.y = 8;
  pole.material = mat(scene, "#c45a20", 0.06);
  pole.parent = root;
  box(scene, root, "jib", 0.35, 0.35, 14, 0, 15.2, 5, "#d46a28", 0.08);
  box(scene, root, "cab", 1.4, 1.2, 1.6, 0, 14.4, 0, "#2a2a28");
  const hook = MeshBuilder.CreateCylinder("hk", { height: 4, diameter: 0.06, tessellation: 6 }, scene);
  hook.position.set(0, 13, 11);
  hook.material = mat(scene, "#1a1a1a");
  hook.parent = root;
  return root;
}

export function makeBoat(scene: Scene, x: number, z: number, hex: string): Mesh {
  const root = new Mesh("boat", scene);
  root.position.set(x, -0.05, z);
  box(scene, root, "hull", 2.4, 0.7, 6.2, 0, 0.2, 0, hex);
  box(scene, root, "cab", 1.6, 1.1, 2.2, 0, 1.05, -0.4, "#d8d0c4");
  box(scene, root, "bow", 1.6, 0.35, 1.2, 0, 0.35, 2.4, hex);
  return root;
}

export function makeCar(scene: Scene, color: string, kind: "hatch" | "sedan" | "muscle" | "cop"): Mesh {
  const root = new Mesh("car-" + kind, scene);
  const len = kind === "muscle" ? 4.7 : kind === "hatch" ? 3.7 : 4.2;
  const bodyH = kind === "muscle" ? 0.48 : 0.55;
  const bodyY = kind === "muscle" ? 0.44 : 0.48;
  const bodyCol = kind === "cop" ? "#f0f2f4" : color;
  const body = MeshBuilder.CreateBox("bd", { width: 1.85, height: bodyH, depth: len }, scene);
  body.position.y = bodyY;
  body.material = uniqueMat(scene, bodyCol, 0.04);
  body.parent = root;

  const cabinD = kind === "hatch" ? 1.45 : kind === "muscle" ? 1.7 : 1.85;
  const cabin = MeshBuilder.CreateBox("cb", { width: 1.62, height: kind === "muscle" ? 0.42 : 0.5, depth: cabinD }, scene);
  cabin.position.set(0, kind === "muscle" ? 0.84 : 0.92, kind === "hatch" ? -0.2 : -0.12);
  cabin.material = mat(scene, kind === "cop" ? "#1a3a88" : "#1a2830", 0.05);
  cabin.parent = root;

  const hood = MeshBuilder.CreateBox("hd", { width: 1.78, height: 0.16, depth: len * 0.28 }, scene);
  hood.position.set(0, bodyY + bodyH * 0.45, len * 0.28);
  hood.rotation.x = 0.2;
  hood.material = uniqueMat(scene, bodyCol, 0.05);
  hood.parent = root;

  const trunkD = kind === "hatch" ? 0.45 : 0.72;
  const trunk = MeshBuilder.CreateBox("trk", { width: 1.78, height: 0.22, depth: trunkD }, scene);
  trunk.position.set(0, 0.62, -len * 0.34);
  trunk.material = uniqueMat(scene, bodyCol, 0.04);
  trunk.parent = root;

  box(scene, root, "bmp", 1.9, 0.16, 0.14, 0, 0.32, len * 0.5 - 0.02, "#1a1a1a");
  box(scene, root, "bmp2", 1.9, 0.14, 0.12, 0, 0.3, -len * 0.5 + 0.02, "#1a1a1a");

  const hl = box(scene, root, "hl", 0.28, 0.12, 0.06, -0.58, 0.52, len * 0.5 - 0.02, "#f2e6c0", 0.85);
  const hr = box(scene, root, "hr", 0.28, 0.12, 0.06, 0.58, 0.52, len * 0.5 - 0.02, "#f2e6c0", 0.85);
  box(scene, root, "tl", 0.26, 0.1, 0.06, -0.62, 0.5, -len * 0.5 + 0.02, "#ff2a2a", 0.8);
  box(scene, root, "tr", 0.26, 0.1, 0.06, 0.62, 0.5, -len * 0.5 + 0.02, "#ff2a2a", 0.8);
  void hl; void hr;

  const glass = MeshBuilder.CreateBox("gl", { width: 1.5, height: 0.26, depth: 0.08 }, scene);
  glass.position.set(0, kind === "muscle" ? 0.88 : 0.95, len * 0.16);
  glass.material = mat(scene, "#7ec8e8", 0.18);
  glass.parent = root;

  if (kind === "cop") {
    box(scene, root, "bar", 0.95, 0.14, 0.32, 0, 1.22, 0.08, "#1a1a1a");
    box(scene, root, "lbr", 0.4, 0.12, 0.28, -0.22, 1.28, 0.08, "#ff2a3a", 0.9);
    box(scene, root, "lbb", 0.4, 0.12, 0.28, 0.22, 1.28, 0.08, "#2a6aff", 0.9);
  }

  const wheelMat = mat(scene, "#111111");
  const rimMat = mat(scene, "#3a3a3a", 0.05);
  const spots: [number, number][] = [[-0.82, len * 0.32], [0.82, len * 0.32], [-0.82, -len * 0.32], [0.82, -len * 0.32]];
  for (const [wx, wz] of spots) {
    const wh = MeshBuilder.CreateCylinder("wh", { height: 0.28, diameter: 0.62, tessellation: 8 }, scene);
    wh.rotation.z = Math.PI / 2;
    wh.position.set(wx, 0.31, wz);
    wh.material = wheelMat;
    wh.parent = root;
    const rim = MeshBuilder.CreateCylinder("rim", { height: 0.3, diameter: 0.34, tessellation: 8 }, scene);
    rim.rotation.z = Math.PI / 2;
    rim.position.set(wx, 0.31, wz);
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
};

function limb(scene: Scene, root: Mesh, name: string, x: number, y: number, w: number, h: number, d: number, hex: string): Mesh {
  const piv = new Mesh(name, scene);
  piv.parent = root;
  piv.position.set(x, y, 0);
  const b = MeshBuilder.CreateBox(name + "m", { width: w, height: h, depth: d }, scene);
  b.position.y = -h * 0.5;
  b.material = mat(scene, hex);
  b.parent = piv;
  return piv;
}

function face(scene: Scene, root: Mesh, y: number, z: number, skin: string) {
  const le = MeshBuilder.CreateSphere("eye", { diameter: 0.07, segments: 6 }, scene);
  le.position.set(-0.07, y, z);
  le.material = mat(scene, "#f4f4f0", 0.15);
  le.parent = root;
  const re = MeshBuilder.CreateSphere("eye", { diameter: 0.07, segments: 6 }, scene);
  re.position.set(0.07, y, z);
  re.material = mat(scene, "#f4f4f0", 0.15);
  re.parent = root;
  box(scene, root, "pup", 0.03, 0.03, 0.02, -0.07, y, z + 0.03, "#1a1410");
  box(scene, root, "pup", 0.03, 0.03, 0.02, 0.07, y, z + 0.03, "#1a1410");
  box(scene, root, "mouth", 0.12, 0.03, 0.02, 0, y - 0.1, z, "#5a3030");
  void skin;
}

function hairOn(scene: Scene, root: Mesh, style: Hair, hex: string, headY: number) {
  if (style === "beanie") {
    const c = MeshBuilder.CreateCylinder("hat", { height: 0.16, diameter: 0.36, tessellation: 8 }, scene);
    c.position.y = headY + 0.16;
    c.material = mat(scene, hex);
    c.parent = root;
    box(scene, root, "brim", 0.38, 0.05, 0.38, 0, headY + 0.08, 0, hex);
  } else if (style === "messy") {
    box(scene, root, "h1", 0.28, 0.16, 0.22, -0.04, headY + 0.18, 0.02, hex);
    box(scene, root, "h2", 0.18, 0.2, 0.16, 0.1, headY + 0.2, -0.04, hex);
    box(scene, root, "h3", 0.14, 0.12, 0.2, 0, headY + 0.14, 0.12, hex);
  } else if (style === "bun") {
    const bun = MeshBuilder.CreateSphere("bun", { diameter: 0.18, segments: 6 }, scene);
    bun.position.set(0, headY + 0.2, -0.1);
    bun.material = mat(scene, hex);
    bun.parent = root;
    box(scene, root, "bang", 0.3, 0.08, 0.12, 0, headY + 0.12, 0.12, hex);
  } else if (style === "cap" || style === "peak") {
    const c = MeshBuilder.CreateCylinder("hat", { height: 0.14, diameter: 0.38, tessellation: 8 }, scene);
    c.position.y = headY + 0.16;
    c.material = mat(scene, hex);
    c.parent = root;
    box(scene, root, "peak", 0.28, 0.04, 0.22, 0, headY + 0.1, 0.2, hex);
  } else {
    const c = MeshBuilder.CreateSphere("hair", { diameter: 0.36, segments: 6 }, scene);
    c.position.y = headY + 0.08;
    c.scaling.y = 0.45;
    c.material = mat(scene, hex);
    c.parent = root;
  }
}

function assemblePerson(scene: Scene, kit: Kit): Mesh {
  const root = new Mesh(kit.name, scene);
  const sx = kit.sx;
  const sy = kit.sy;
  const tw = 0.44 * sx;
  const td = 0.26 * sx;
  const th = (kit.crop ? 0.36 : 0.5) * sy;
  const torsoY = (kit.crop ? 1.22 : 1.26) * sy;
  const pelvisY = 0.88 * sy;
  const hipY = 0.8 * sy;
  const headY = 1.62 * sy;
  const skin = kit.skin;

  box(scene, root, "pelvis", tw * 0.92, 0.18 * sy, td * 0.95, 0, pelvisY, 0, kit.skirt || kit.pelvis);
  if (kit.shirt) box(scene, root, "tee", tw * 0.88, 0.16, td * 0.88, 0, torsoY - th * 0.42, 0, kit.shirt);
  const torso = box(scene, root, "torso", tw, th, td, 0, torsoY, 0, kit.torso, kit.torsoE ?? 0);
  void torso;
  if (kit.vest) box(scene, root, "vest", tw * 1.06, th * 0.85, td * 1.08, 0, torsoY, 0, kit.vest, 0.04);
  if (kit.glow) {
    box(scene, root, "trim", tw * 1.02, 0.04, td * 1.02, 0, torsoY + th * 0.42, 0, kit.glow, 0.55);
    box(scene, root, "trim2", 0.04, th * 0.8, td * 1.02, -tw * 0.5, torsoY, 0, kit.glow, 0.4);
  }
  if (kit.crop) box(scene, root, "mid", tw * 0.7, 0.14, td * 0.7, 0, torsoY - th * 0.62, 0, skin);

  const neck = MeshBuilder.CreateCylinder("nk", { height: 0.12 * sy, diameter: kit.neck, tessellation: 6 }, scene);
  neck.position.y = headY - 0.2 * sy;
  neck.material = mat(scene, skin);
  neck.parent = root;

  const head = MeshBuilder.CreateSphere("hd", { diameter: 0.34, segments: 6 }, scene);
  head.position.y = headY;
  head.material = mat(scene, skin);
  head.parent = root;
  face(scene, root, headY + 0.02, 0.15, skin);
  hairOn(scene, root, kit.hairStyle, kit.hair, headY);

  const armH = 0.5 * sy;
  const legH = (kit.shorts ? 0.38 : 0.7) * sy;
  limb(scene, root, "larm", -tw * 0.5 - 0.08, torsoY + th * 0.35, 0.12, armH, 0.12, kit.torso);
  limb(scene, root, "rarm", tw * 0.5 + 0.08, torsoY + th * 0.35, 0.12, armH, 0.12, kit.torso);
  const ll = limb(scene, root, "lleg", -0.13 * sx, hipY, 0.16, legH, 0.2, kit.legs);
  const rl = limb(scene, root, "rleg", 0.13 * sx, hipY, 0.16, legH, 0.2, kit.legs);
  box(scene, ll, "shoe", 0.17, 0.1, 0.26, 0, -legH - 0.02, 0.02, kit.shoes);
  box(scene, rl, "shoe", 0.17, 0.1, 0.26, 0, -legH - 0.02, 0.02, kit.shoes);
  if (kit.shorts) {
    box(scene, ll, "calf", 0.14, 0.32 * sy, 0.16, 0, -legH - 0.16 * sy, 0, skin);
    box(scene, rl, "calf", 0.14, 0.32 * sy, 0.16, 0, -legH - 0.16 * sy, 0, skin);
  }

  if (kit.chain) {
    const ch = MeshBuilder.CreateTorus("chain", { diameter: 0.22, thickness: 0.018, tessellation: 8 }, scene);
    ch.position.y = torsoY + th * 0.38;
    ch.rotation.x = 1.2;
    ch.material = mat(scene, "#e0b040", 0.35);
    ch.parent = root;
  }
  if (kit.earring) {
    const hoop = MeshBuilder.CreateTorus("ear", { diameter: 0.06, thickness: 0.01, tessellation: 8 }, scene);
    hoop.position.set(0.16, headY, 0.02);
    hoop.material = mat(scene, "#e8c860", 0.4);
    hoop.parent = root;
  }
  if (kit.badge) box(scene, root, "badge", 0.1, 0.08, 0.03, 0.16, torsoY + 0.08, td * 0.52, "#e0b040", 0.5);
  return root;
}

export function makeHero(scene: Scene, id: CharacterId): Mesh {
  if (id === "orangie") {
    return assemblePerson(scene, {
      name: "hero-orangie", skin: "#c4a070", torso: "#ff8a3d", torsoE: 0.06,
      pelvis: "#6a6048", legs: "#6a6048", shoes: "#2a2018", hair: "#e07020",
      hairStyle: "messy", sx: 1.22, sy: 0.94, neck: 0.2, shirt: "#f4f0e8",
    });
  }
  if (id === "cupsey") {
    return assemblePerson(scene, {
      name: "hero-cupsey", skin: "#f5dcc8", torso: "#ff4da6", torsoE: 0.1,
      pelvis: "#1a1a1e", legs: "#1a1a1e", shoes: "#f0f0f0", hair: "#ff4da6",
      hairStyle: "bun", sx: 0.88, sy: 0.9, neck: 0.12, crop: true, shorts: true, earring: true,
    });
  }
  return assemblePerson(scene, {
    name: "hero-ansem", skin: "#f0d4c0", torso: "#2ef2d0", torsoE: 0.12,
    pelvis: "#1a2430", legs: "#1a2430", shoes: "#111114", hair: "#111114",
    hairStyle: "beanie", sx: 0.92, sy: 1.0, neck: 0.13, chain: true, glow: "#2ef2d0",
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
    shoes: "#111114", hair: "#1a2438", hairStyle: "peak", sx: 1.02, sy: 1.0, neck: 0.15,
    vest: "#1a3a88", badge: true,
  });
}

export function tickWalk(mesh: Mesh, t: number, moving: boolean) {
  const amp = moving ? 0.42 : 0;
  const s = Math.sin(t * 9) * amp;
  for (const ch of mesh.getChildMeshes(false)) {
    if (ch.name === "lleg") ch.rotation.x = s;
    else if (ch.name === "rleg") ch.rotation.x = -s;
    else if (ch.name === "larm") ch.rotation.x = -s * 0.75;
    else if (ch.name === "rarm") ch.rotation.x = s * 0.75;
  }
}

export function lookDir(yaw: number, pitch: number): Vector3 {
  const cp = Math.cos(pitch);
  return new Vector3(Math.sin(yaw) * cp, -Math.sin(pitch), Math.cos(yaw) * cp);
}
