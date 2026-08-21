import {
  Color3, DynamicTexture, Mesh, MeshBuilder, Scene, StandardMaterial, Texture,
} from "@babylonjs/core";
import type { BuildingStyle } from "./types";

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

export function webSuitMat(scene: Scene, id: string, base: string, line: string): StandardMaterial {
  const key = "websuit-" + id + "-" + base + "-" + line;
  let m = matCache.get(key);
  if (m && m.getScene() === scene) return m;
  const tex = new DynamicTexture("ws-" + id, { width: 256, height: 256 }, scene, false);
  const ctx = tex.getContext();
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1400; i++) {
    const n = hash(i * 29 + id.length * 7);
    ctx.fillStyle = n > 0.55 ? shadeHex(base, 1.14) : shadeHex(base, 0.82);
    ctx.globalAlpha = 0.18;
    ctx.fillRect((i * 53) % 256, (i * 37) % 256, 1 + (n * 2), 1);
  }
  ctx.globalAlpha = 0.7;
  ctx.strokeStyle = line;
  const step = id === "cupsey" ? 16 : id === "orangie" ? 28 : 22;
  ctx.lineWidth = id === "orangie" ? 2.1 : 1.5;
  for (let y = -step; y < 256 + step; y += step) {
    ctx.beginPath();
    for (let x = 0; x <= 256; x += step) {
      const yy = y + ((Math.floor(x / step) % 2) * step * 0.5);
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  for (let x = -step; x < 256 + step; x += step) {
    ctx.beginPath();
    for (let y = 0; y <= 256; y += step) {
      const xx = x + ((Math.floor(y / step) % 2) * step * 0.5);
      if (y === 0) ctx.moveTo(xx, y);
      else ctx.lineTo(xx, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  tex.update();
  m = new StandardMaterial(key, scene);
  m.diffuseTexture = tex;
  m.diffuseColor = Color3.FromHexString(base);
  m.emissiveColor = Color3.FromHexString(line).scale(0.045);
  m.specularColor = new Color3(0.07, 0.07, 0.07);
  m.specularPower = 8;
  matCache.set(key, m);
  return m;
}

export function metalMat(scene: Scene, hex: string, shine = 0.55): StandardMaterial {
  const key = "metal-" + hex + "-" + shine;
  let m = matCache.get(key);
  if (m && m.getScene() === scene) return m;
  m = new StandardMaterial(key, scene);
  const c = Color3.FromHexString(hex);
  m.diffuseColor = c;
  m.specularColor = new Color3(shine, shine * 0.96, shine * 0.9);
  m.specularPower = 96;
  m.emissiveColor = c.scale(0.04);
  matCache.set(key, m);
  return m;
}

export function shadeHex(hex: string, mul: number): string {
  const c = Color3.FromHexString(hex);
  const to = (v: number) => {
    const n = Math.max(0, Math.min(255, Math.round(v * mul * 255)));
    return n.toString(16).padStart(2, "0");
  };
  return "#" + to(c.r) + to(c.g) + to(c.b);
}

function texMat(scene: Scene, key: string, tex: DynamicTexture, emit: Color3, spec = 0.08): StandardMaterial {
  let m = matCache.get(key);
  if (m && m.getScene() === scene) return m;
  m = new StandardMaterial(key, scene);
  m.diffuseTexture = tex;
  m.emissiveTexture = tex;
  m.emissiveColor = emit;
  m.specularColor = new Color3(spec, spec, spec);
  matCache.set(key, m);
  return m;
}

function hash(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export function facadeMat(scene: Scene, hex: string, style: BuildingStyle, face: "front" | "side", variant = 0): StandardMaterial {
  const v = variant & 1;
  const key = "fac-" + hex + "-" + style + "-" + face + "-" + v;
  let m = matCache.get(key);
  if (m && m.getScene() === scene) return m;
  const tex = paintFacade(scene, hex, style, face, v);
  const emit = style === "shop"
    ? new Color3(0.28, 0.22, 0.16)
    : style === "warehouse"
      ? new Color3(0.16, 0.14, 0.12)
      : new Color3(0.22, 0.18, 0.14);
  return texMat(scene, key, tex, emit, style === "warehouse" ? 0.04 : 0.1);
}

function paintFacade(scene: Scene, hex: string, style: BuildingStyle, face: "front" | "side", variant: number): DynamicTexture {
  const tw = 256;
  const th = 512;
  const tex = new DynamicTexture("ftx-" + hex + style + face + variant + uid++, { width: tw, height: th }, scene, false);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  const mortar = shadeHex(hex, variant ? 0.48 : 0.55);
  const brick = hex;
  const brickHi = shadeHex(hex, variant ? 1.2 : 1.12);
  const brickLo = shadeHex(hex, variant ? 0.74 : 0.82);
  ctx.fillStyle = mortar;
  ctx.fillRect(0, 0, tw, th);

  if (style === "warehouse") {
    paintCorrugated(ctx, tw, th, hex);
  } else if (style === "tower") {
    paintTowerSkin(ctx, tw, th, hex);
  } else {
    paintBrick(ctx, tw, th, brick, brickHi, brickLo, mortar);
  }
  paintStains(ctx, tw, th, variant);

  if (style === "shop" || (style === "walkup" && face === "front")) {
    paintStorefront(ctx, tw, th, hex, style === "shop");
  } else if (style === "warehouse" && face === "front") {
    paintBayDoor(ctx, tw, th);
  } else {
    paintGroundBand(ctx, tw, th, shadeHex(hex, 0.7));
  }

  if (style === "tower") paintTowerWindows(ctx, tw, th, face, variant);
  else if (style === "warehouse") paintHighWindows(ctx, tw, th, face);
  else paintWalkupWindows(ctx, tw, th, face, hex, variant);

  paintCornice(ctx, tw, th, shadeHex(hex, 0.45));
  if (face === "front" && style !== "warehouse") paintLedgeRows(ctx, tw, th);
  tex.update();
  return tex;
}

function paintBrick(
  ctx: CanvasRenderingContext2D, tw: number, th: number,
  brick: string, hi: string, lo: string, mortar: string,
) {
  const bh = 10;
  const bw = 22;
  for (let y = 0; y < th; y += bh) {
    const odd = ((y / bh) | 0) % 2;
    for (let x = -odd * (bw / 2); x < tw; x += bw) {
      const n = hash(x * 13 + y * 7);
      ctx.fillStyle = n > 0.72 ? hi : n < 0.22 ? lo : brick;
      ctx.fillRect(x + 1, y + 1, bw - 2, bh - 2);
    }
  }
  ctx.fillStyle = mortar;
  for (let y = 0; y < th; y += bh) ctx.fillRect(0, y, tw, 1);
}

function paintCorrugated(ctx: CanvasRenderingContext2D, tw: number, th: number, hex: string) {
  ctx.fillStyle = shadeHex(hex, 0.9);
  ctx.fillRect(0, 0, tw, th);
  for (let x = 0; x < tw; x += 7) {
    ctx.fillStyle = x % 14 === 0 ? shadeHex(hex, 0.7) : shadeHex(hex, 1.05);
    ctx.fillRect(x, 0, 3, th);
  }
  ctx.fillStyle = shadeHex(hex, 0.5);
  for (let y = 40; y < th; y += 86) ctx.fillRect(0, y, tw, 3);
}

function paintTowerSkin(ctx: CanvasRenderingContext2D, tw: number, th: number, hex: string) {
  ctx.fillStyle = shadeHex(hex, 0.88);
  ctx.fillRect(0, 0, tw, th);
  ctx.fillStyle = shadeHex(hex, 0.7);
  for (let y = 0; y < th; y += 28) ctx.fillRect(0, y + 24, tw, 3);
  ctx.fillStyle = shadeHex(hex, 1.08);
  ctx.fillRect(0, 0, 10, th);
  ctx.fillRect(tw - 10, 0, 10, th);
}

function paintStorefront(ctx: CanvasRenderingContext2D, tw: number, th: number, hex: string, neonShop: boolean) {
  const base = th - 118;
  ctx.fillStyle = "#1a1210";
  ctx.fillRect(0, base, tw, 118);
  ctx.fillStyle = neonShop ? "#7ec8e8" : "#5a7080";
  ctx.globalAlpha = 0.85;
  ctx.fillRect(18, base + 22, tw - 86, 72);
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#0e1014";
  ctx.fillRect(tw - 62, base + 18, 40, 88);
  ctx.fillStyle = neonShop ? "#c03028" : shadeHex(hex, 0.55);
  ctx.fillRect(8, base + 8, tw - 16, 12);
  if (neonShop) {
    ctx.fillStyle = "#ffc83d";
    ctx.fillRect(22, base + 28, 28, 6);
    ctx.fillRect(58, base + 28, 22, 6);
  }
  ctx.fillStyle = "#f2d27a";
  ctx.globalAlpha = 0.35;
  ctx.fillRect(28, base + 40, 36, 18);
  ctx.globalAlpha = 1;
}

function paintBayDoor(ctx: CanvasRenderingContext2D, tw: number, th: number) {
  const base = th - 150;
  ctx.fillStyle = "#2a2018";
  ctx.fillRect(28, base, tw - 56, 132);
  ctx.fillStyle = "#1a1612";
  for (let y = base + 8; y < th - 22; y += 14) ctx.fillRect(36, y, tw - 72, 6);
  ctx.fillStyle = "#c45a20";
  ctx.fillRect(tw / 2 - 8, base + 50, 16, 8);
}

function paintGroundBand(ctx: CanvasRenderingContext2D, tw: number, th: number, hex: string) {
  ctx.fillStyle = hex;
  ctx.fillRect(0, th - 70, tw, 70);
  ctx.fillStyle = "#1a1814";
  ctx.fillRect(tw / 2 - 16, th - 58, 32, 50);
}

function paintStains(ctx: CanvasRenderingContext2D, tw: number, th: number, variant: number) {
  if (!variant) return;
  ctx.fillStyle = "rgba(18,10,8,0.28)";
  ctx.fillRect(6, 64, 16, th - 180);
  ctx.fillStyle = "rgba(80,42,28,0.2)";
  ctx.fillRect(tw - 28, 48, 20, th * 0.38);
  ctx.fillStyle = "rgba(10,8,8,0.18)";
  for (let i = 0; i < 8; i++) ctx.fillRect((i * 37) % tw, 90 + i * 42, 28, 6);
}

function paintWalkupWindows(ctx: CanvasRenderingContext2D, tw: number, th: number, face: "front" | "side", hex: string, variant: number) {
  const cols = face === "front" ? 4 : 2;
  const gapX = tw / (cols + 1);
  const startY = 36 + (variant ? 10 : 0);
  const endY = th - 140;
  let row = 0;
  for (let y = startY; y < endY; y += 48) {
    for (let c = 0; c < cols; c++) {
      const x = gapX * (c + 1) - 14 + (variant ? 6 : 0);
      const lit = hash(x * 9 + y * 4 + hex.length + row + variant * 17) > 0.38;
      paintWindow(ctx, x, y, 28, 32, lit);
    }
    row += 1;
  }
}

function paintTowerWindows(ctx: CanvasRenderingContext2D, tw: number, th: number, face: "front" | "side", variant: number) {
  const cols = face === "front" ? 6 : 3;
  const gapX = tw / (cols + 0.4);
  for (let y = 28; y < th - 40; y += 26) {
    for (let c = 0; c < cols; c++) {
      const x = 10 + c * gapX + (variant ? 4 : 0);
      const lit = hash(x * 3 + y * 11 + variant * 19) > 0.45;
      ctx.fillStyle = "#0c1018";
      ctx.fillRect(x - 1, y - 1, 16, 18);
      ctx.fillStyle = lit ? (variant ? "#f0b45a" : "#e8c86a") : "#15202c";
      ctx.fillRect(x, y, 14, 16);
    }
  }
}

function paintHighWindows(ctx: CanvasRenderingContext2D, tw: number, th: number, face: "front" | "side") {
  const n = face === "front" ? 5 : 3;
  for (let i = 0; i < n; i++) {
    const x = 20 + i * ((tw - 40) / n);
    ctx.fillStyle = "#1a2830";
    ctx.fillRect(x, 48, 28, 16);
    ctx.fillStyle = "#2a5060";
    ctx.fillRect(x + 2, 50, 24, 12);
  }
}

function paintWindow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, lit: boolean) {
  ctx.fillStyle = "#1a1410";
  ctx.fillRect(x - 2, y - 2, w + 4, h + 6);
  ctx.fillStyle = lit ? "#f2d27a" : "#121820";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(x + 2, y + 2, w * 0.4, h * 0.35);
  ctx.fillStyle = "#2a2420";
  ctx.fillRect(x + w / 2 - 1, y, 2, h);
}

function paintCornice(ctx: CanvasRenderingContext2D, tw: number, th: number, hex: string) {
  ctx.fillStyle = hex;
  ctx.fillRect(0, 0, tw, 18);
  ctx.fillStyle = shadeHex(hex, 1.3);
  ctx.fillRect(0, 16, tw, 4);
}

function paintLedgeRows(ctx: CanvasRenderingContext2D, tw: number, th: number) {
  ctx.fillStyle = "rgba(10,8,8,0.35)";
  for (let y = 80; y < th - 130; y += 96) ctx.fillRect(0, y + 36, tw, 3);
}

export function asphaltMat(scene: Scene): StandardMaterial {
  const key = "asphalt";
  let m = matCache.get(key);
  if (m && m.getScene() === scene) return m;
  const tex = new DynamicTexture("asph", { width: 256, height: 256 }, scene, false);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  ctx.fillStyle = "#1c1e22";
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    const n = hash(i * 19);
    ctx.fillStyle = n > 0.5 ? "#24262a" : "#16181c";
    ctx.fillRect((i * 47) % 256, (i * 31) % 256, 2 + (n * 3), 2);
  }
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.moveTo(20, 40);
  ctx.quadraticCurveTo(120, 90, 230, 60);
  ctx.stroke();
  ctx.strokeStyle = "rgba(180,200,220,0.08)";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(0, 180);
  ctx.quadraticCurveTo(90, 200, 256, 160);
  ctx.stroke();
  tex.update();
  tex.wrapU = Texture.WRAP_ADDRESSMODE;
  tex.wrapV = Texture.WRAP_ADDRESSMODE;
  m = new StandardMaterial(key, scene);
  m.diffuseTexture = tex;
  m.specularColor = new Color3(0.32, 0.3, 0.28);
  m.specularPower = 42;
  m.emissiveColor = new Color3(0.03, 0.025, 0.02);
  matCache.set(key, m);
  return m;
}

export function sidewalkMat(scene: Scene): StandardMaterial {
  const key = "sidewalk";
  let m = matCache.get(key);
  if (m && m.getScene() === scene) return m;
  const tex = new DynamicTexture("swtx", { width: 256, height: 256 }, scene, false);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  ctx.fillStyle = "#6a5a50";
  ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 32) {
    for (let x = 0; x < 256; x += 32) {
      const n = hash(x + y * 3);
      ctx.fillStyle = n > 0.6 ? "#7a6a5e" : n < 0.25 ? "#5a4c44" : "#6a5a50";
      ctx.fillRect(x + 1, y + 1, 30, 30);
    }
  }
  ctx.fillStyle = "#3a3430";
  for (let i = 0; i <= 8; i++) {
    ctx.fillRect(i * 32, 0, 1, 256);
    ctx.fillRect(0, i * 32, 256, 1);
  }
  tex.update();
  tex.wrapU = Texture.WRAP_ADDRESSMODE;
  tex.wrapV = Texture.WRAP_ADDRESSMODE;
  return texMat(scene, key, tex, new Color3(0.12, 0.1, 0.08), 0.06);
}

export function woodDockMat(scene: Scene): StandardMaterial {
  const key = "dockwood";
  let m = matCache.get(key);
  if (m && m.getScene() === scene) return m;
  const tex = new DynamicTexture("wdtx", { width: 256, height: 256 }, scene, false);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  ctx.fillStyle = "#4a3220";
  ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 18) {
    ctx.fillStyle = hash(y) > 0.5 ? "#6a4a30" : "#3a2818";
    ctx.fillRect(0, y, 256, 16);
    ctx.fillStyle = "#2a1c12";
    ctx.fillRect(0, y + 16, 256, 2);
    for (let x = 12; x < 256; x += 64) {
      ctx.fillRect(x, y + 4, 2, 10);
    }
  }
  tex.update();
  tex.wrapU = Texture.WRAP_ADDRESSMODE;
  tex.wrapV = Texture.WRAP_ADDRESSMODE;
  return texMat(scene, key, tex, new Color3(0.14, 0.1, 0.06), 0.08);
}

export function waterMat(scene: Scene): StandardMaterial {
  const key = "water";
  let m = matCache.get(key);
  if (m && m.getScene() === scene) return m;
  const tex = new DynamicTexture("watx", { width: 256, height: 256 }, scene, false);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, "#0a3040");
  g.addColorStop(0.45, "#163848");
  g.addColorStop(1, "#082028");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = "rgba(90,180,200,0.22)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 12; i++) {
    ctx.beginPath();
    const y = 16 + i * 20;
    ctx.moveTo(0, y);
    for (let x = 0; x <= 256; x += 16) ctx.lineTo(x, y + Math.sin((x + i * 40) * 0.05) * 4);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(255,160,80,0.08)";
  ctx.fillRect(0, 0, 256, 40);
  tex.hasAlpha = false;
  tex.update();
  tex.wrapU = Texture.WRAP_ADDRESSMODE;
  tex.wrapV = Texture.WRAP_ADDRESSMODE;
  m = new StandardMaterial(key, scene);
  m.diffuseTexture = tex;
  m.emissiveTexture = tex;
  m.emissiveColor = new Color3(0.08, 0.14, 0.16);
  m.specularColor = new Color3(0.45, 0.65, 0.7);
  m.specularPower = 64;
  m.alpha = 0.96;
  matCache.set(key, m);
  return m;
}

export function roadMat(scene: Scene, vertical: boolean): StandardMaterial {
  const key = vertical ? "rdv" : "rdh";
  let m = matCache.get(key);
  if (m && m.getScene() === scene) return m;
  const tex = new DynamicTexture(key, { width: 64, height: 512 }, scene, false);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  ctx.fillStyle = "#1a1c1e";
  ctx.fillRect(0, 0, 64, 512);
  ctx.fillStyle = "#2a2c30";
  for (let i = 0; i < 80; i++) ctx.fillRect((i * 17) % 64, (i * 23) % 512, 3, 2);
  ctx.fillStyle = "#c4b46a";
  for (let y = 10; y < 512; y += 28) ctx.fillRect(30, y, 4, 13);
  tex.update();
  m = new StandardMaterial(key + "m", scene);
  m.diffuseTexture = tex;
  m.specularColor = new Color3(0.26, 0.24, 0.2);
  m.specularPower = 36;
  m.emissiveColor = new Color3(0.04, 0.03, 0.02);
  matCache.set(key + "m", m);
  return m;
}

export function flareTex(scene: Scene): DynamicTexture {
  const key = "flare";
  const existing = scene.getTextureByName?.("flare") as DynamicTexture | null;
  if (existing) return existing;
  const tex = new DynamicTexture(key, 32, scene, false);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  const g = ctx.createRadialGradient(16, 16, 1, 16, 16, 15);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  tex.hasAlpha = true;
  tex.update();
  return tex;
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
  ctx.strokeStyle = fg;
  ctx.lineWidth = 6;
  ctx.strokeRect(4, 4, tw - 8, th - 8);
  ctx.fillStyle = fg;
  const size = Math.floor(th * 0.58);
  ctx.font = "bold " + size + "px Impact, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, tw / 2, th / 2 + 2);
  tex.update();
  const m = new StandardMaterial("sm-" + text + uid, scene);
  m.diffuseTexture = tex;
  m.emissiveTexture = tex;
  m.emissiveColor = new Color3(0.7, 0.6, 0.45);
  m.specularColor = new Color3(0, 0, 0);
  m.backFaceCulling = false;
  plane.material = m;
  return plane;
}

export function makeGraffiti(scene: Scene, text: string, x: number, y: number, z: number, w: number, h: number, yaw: number, fg: string): Mesh {
  const plane = MeshBuilder.CreatePlane("tag-" + text, { width: w, height: h }, scene);
  plane.position.set(x, y, z);
  plane.rotation.y = yaw;
  const tw = 256;
  const th = 128;
  const tex = new DynamicTexture("gfx-" + text + uid++, { width: tw, height: th }, scene, false);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, tw, th);
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = fg;
  for (let i = 0; i < 18; i++) {
    const n = hash(i * 17 + text.length * 9);
    ctx.beginPath();
    ctx.ellipse(20 + n * 210, 20 + ((i * 29) % 90), 8 + n * 18, 4 + n * 10, n * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = shadeHex(fg, 0.45);
  ctx.lineWidth = 8;
  ctx.font = "italic 700 52px Impact, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.strokeText(text, 128, 68);
  ctx.fillStyle = fg;
  ctx.fillText(text, 128, 68);
  tex.hasAlpha = true;
  tex.update();
  const m = new StandardMaterial("gm-" + text + uid, scene);
  m.diffuseTexture = tex;
  m.emissiveTexture = tex;
  m.emissiveColor = new Color3(0.35, 0.32, 0.22);
  m.opacityTexture = tex;
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

export function tickCityArt(scene: Scene, t: number) {
  const water = scene.getMeshByName("water");
  if (water?.material instanceof StandardMaterial && water.material.diffuseTexture instanceof Texture) {
    water.material.diffuseTexture.uOffset = t * 0.022;
    water.material.diffuseTexture.vOffset = Math.sin(t * 0.18) * 0.055;
    const shimmer = 0.42 + Math.sin(t * 1.4) * 0.08;
    water.material.specularColor.set(shimmer, shimmer * 1.15, shimmer * 1.25);
  }
  const phase = Math.floor(t / 3.2) % 3;
  for (const mesh of scene.meshes) {
    if (mesh.name === "palm") {
      mesh.rotation.z = Math.sin(t * 0.65 + mesh.position.x * 0.08) * 0.045;
    }
    if (mesh.name.startsWith("sign-") && mesh.material instanceof StandardMaterial) {
      const flick = 0.58 + 0.16 * Math.sin(t * 7.1 + mesh.position.x) + (Math.sin(t * 23 + mesh.position.z) > 0.92 ? -0.18 : 0);
      mesh.material.emissiveColor.set(flick, flick * 0.82, flick * 0.62);
    }
    if (mesh.name === "sundisc") {
      mesh.scaling.setAll(1 + Math.sin(t * 0.8) * 0.03);
    }
    if (mesh.name === "bird") {
      mesh.position.x += Math.sin(t * 0.35 + mesh.position.z) * 0.012;
      mesh.position.z += Math.cos(t * 0.28 + mesh.position.x) * 0.01;
      mesh.rotation.y = t * 0.25 + mesh.position.x * 0.02;
      for (const ch of mesh.getChildMeshes(false)) {
        if (ch.name.startsWith("wing")) ch.rotation.z = Math.sin(t * 14 + mesh.position.x) * 0.55;
      }
    }
    if (mesh.name === "steam") {
      const lift = (t * 0.35 + mesh.position.x * 0.1) % 1.4;
      mesh.position.y = 1.15 + lift;
      mesh.scaling.setAll(0.7 + lift * 0.55);
      if (mesh.material instanceof StandardMaterial) mesh.material.alpha = 0.2 * (1 - lift / 1.4);
    }
    if ((mesh.name === "tlr" || mesh.name === "tly" || mesh.name === "tlg") && mesh.material instanceof StandardMaterial) {
      const on = (mesh.name === "tlr" && phase === 0) || (mesh.name === "tly" && phase === 1) || (mesh.name === "tlg" && phase === 2);
      const c = mesh.name === "tlr" ? new Color3(1, 0.16, 0.14) : mesh.name === "tly" ? new Color3(1, 0.78, 0.2) : new Color3(0.2, 0.85, 0.32);
      mesh.material.emissiveColor = on ? c : c.scale(0.08);
    }
  }
}
