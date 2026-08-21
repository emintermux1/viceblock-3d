import {
  Color3, Color4, DirectionalLight, DynamicTexture, HemisphericLight, Mesh, MeshBuilder,
  ParticleSystem, PointLight, Quaternion, Scene, StandardMaterial, Vector3,
} from "@babylonjs/core";
import {
  asphaltMat, flareTex, makeDecal, makeSign, mat, roadMat, sidewalkMat, tickCityArt, uniqueMat, waterMat, woodDockMat,
} from "./art";
import { FENCE, INT, LOC } from "./constants";
import {
  makeAwning, makeBench, makeBillboard, makeBird, makeBoat, makeBollard, makeBuilding, makeCone, makeContainer,
  makeCrane, makeCrate, makeDumpster, makeFence, makeHydrant, makeLamp, makeNewsbox, makePalm,
  makePallet, makePiling, makePlate, makePuddle, makeScooter, makeTrafficLight, makeTrash, makeWallTag,
  makeWire,
  type BuildingStyle,
} from "./meshes";
import { addBuildingAnchors, type Anchor } from "./swing";
import type { AABB } from "./types";

export type Landmark = { x: number; z: number; r: number };
export type InteriorRoom = {
  id: "mart" | "garage" | "jail";
  colliders: AABB[];
  spawnX: number;
  spawnZ: number;
  exitX: number;
  exitZ: number;
  streetX: number;
  streetZ: number;
  doorX: number;
  doorZ: number;
  camDist: number;
};
export type CityData = {
  colliders: AABB[];
  roads: { x: number; z: number }[];
  spawn: Landmark;
  garage: Landmark;
  mart: Landmark;
  pier: AABB;
  waterZ: number;
  interiors: { mart: InteriorRoom; garage: InteriorRoom; jail: InteriorRoom };
  fence: { x: number; z: number };
  benches: { x: number; z: number }[];
  crossings: { x: number; z: number }[];
  anchors: Anchor[];
};

export { tickCityArt };

function boxAABB(x: number, z: number, w: number, d: number, h: number, yaw = 0): AABB {
  const swap = Math.abs(Math.sin(yaw)) > 0.7;
  const hw = (swap ? d : w) / 2;
  const hd = (swap ? w : d) / 2;
  return { minX: x - hw, maxX: x + hw, minZ: z - hd, maxZ: z + hd, minY: 0, maxY: h };
}

function isRoadCell(ix: number, iz: number): boolean {
  return ix === -3 || ix === -1 || ix === 1 || ix === 3 || iz === -2 || iz === 0 || iz === 2 || iz === 3;
}

function near(ax: number, az: number, bx: number, bz: number, r: number) {
  return Math.hypot(ax - bx, az - bz) < r;
}

function faceRoadYaw(x: number, z: number): number {
  const ns = [-60, -20, 20, 60];
  const ew = [-40, 0, 30, 60];
  let best = 0;
  let bestD = 999;
  for (const rx of ns) {
    const dist = Math.abs(x - rx);
    if (dist < bestD) {
      bestD = dist;
      best = x > rx ? -Math.PI / 2 : Math.PI / 2;
    }
  }
  for (const rz of ew) {
    const dist = Math.abs(z - rz);
    if (dist < bestD) {
      bestD = dist;
      best = z > rz ? Math.PI : 0;
    }
  }
  return best;
}

export function buildCity(scene: Scene): CityData {
  scene.clearColor = new Color4(0.08, 0.04, 0.1, 1);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogColor = new Color3(0.72, 0.34, 0.24);
  scene.fogDensity = 0.00255;
  scene.ambientColor = new Color3(0.12, 0.07, 0.1);
  const ipc = scene.imageProcessingConfiguration;
  ipc.toneMappingEnabled = true;
  ipc.exposure = 0.96;
  ipc.contrast = 1.4;

  const hemi = new HemisphericLight("hemi", new Vector3(0.15, 1, 0.1), scene);
  hemi.intensity = 0.3;
  hemi.diffuse = new Color3(1, 0.52, 0.55);
  hemi.groundColor = new Color3(0.22, 0.14, 0.16);

  const sun = new DirectionalLight("sun", new Vector3(-0.55, -0.42, 0.38), scene);
  sun.intensity = 1.52;
  sun.diffuse = new Color3(1, 0.42, 0.18);
  const rim = new DirectionalLight("rim", new Vector3(0.55, -0.15, -0.55), scene);
  rim.intensity = 0.72;
  rim.diffuse = new Color3(0.28, 0.72, 0.85);
  const bounce = new DirectionalLight("bounce", new Vector3(0.1, 0.65, 0.2), scene);
  bounce.intensity = 0.26;
  bounce.diffuse = new Color3(0.85, 0.38, 0.16);
  const waterBounce = new DirectionalLight("wbounce", new Vector3(0.05, 0.35, -0.8), scene);
  waterBounce.intensity = 0.18;
  waterBounce.diffuse = new Color3(0.2, 0.55, 0.62);

  paintSky(scene);
  paintGround(scene);
  paintRoads(scene);

  const colliders: AABB[] = [];
  const anchors: Anchor[] = [];
  const roads: { x: number; z: number }[] = [];

  for (let ix = -4; ix <= 4; ix++) {
    for (let iz = -3; iz <= 3; iz++) {
      if (isRoadCell(ix, iz)) roads.push({ x: ix * 20, z: iz * 20 });
    }
  }

  placeBlocks(scene, colliders, anchors);
  placeLandmarks(scene, colliders, anchors);
  placeStrip(scene, colliders, anchors);
  placeDocks(scene, colliders, anchors);
  placePalmsAndLamps(scene, anchors);
  placeSwingCables(scene, anchors);
  const benches = placeDressing(scene);
  placeDust(scene, LOC.spawn.x, LOC.spawn.z);
  placeDust(scene, 0, 34);
  const interiors = buildInteriors(scene);

  return {
    colliders,
    roads,
    spawn: { x: LOC.spawn.x, z: LOC.spawn.z, r: 3 },
    garage: { x: LOC.garage.x, z: LOC.garage.z, r: 7 },
    mart: { x: LOC.mart.x, z: LOC.mart.z, r: 5 },
    pier: { minX: 28, maxX: 62, minZ: 66, maxZ: 94, minY: 0, maxY: 2 },
    waterZ: 74,
    interiors,
    fence: { x: FENCE.x, z: FENCE.z },
    benches,
    anchors,
    crossings: [
      { x: -20, z: 0 }, { x: 20, z: 0 }, { x: -20, z: 30 }, { x: 20, z: 30 },
      { x: -60, z: 30 }, { x: 60, z: 0 },
    ],
  };
}

function paintSky(scene: Scene) {
  const sky = MeshBuilder.CreateSphere("sky", { diameter: 460, segments: 20, sideOrientation: Mesh.BACKSIDE }, scene);
  const tex = new DynamicTexture("skytx", { width: 512, height: 512 }, scene, false);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, "#071028");
  g.addColorStop(0.32, "#1c1638");
  g.addColorStop(0.52, "#6a2848");
  g.addColorStop(0.7, "#d45a30");
  g.addColorStop(0.86, "#f08a38");
  g.addColorStop(1, "#1a1014");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);
  ctx.fillStyle = "rgba(255,250,230,0.7)";
  for (let i = 0; i < 80; i++) ctx.fillRect((i * 97) % 512, (i * 37) % 170, 1.4, 1.4);
  ctx.fillStyle = "rgba(255,180,140,0.18)";
  ctx.beginPath();
  ctx.ellipse(400, 210, 90, 28, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(120, 190, 70, 20, -0.15, 0, Math.PI * 2);
  ctx.fill();
  tex.update();
  const sm = new StandardMaterial("skym", scene);
  sm.diffuseTexture = tex;
  sm.emissiveTexture = tex;
  sm.emissiveColor = new Color3(0.62, 0.5, 0.42);
  sm.specularColor = new Color3(0, 0, 0);
  sm.backFaceCulling = false;
  sm.disableLighting = true;
  sky.material = sm;

  const glow = MeshBuilder.CreateSphere("sundisc", { diameter: 22, segments: 10 }, scene);
  glow.position.set(96, 44, -62);
  glow.material = mat(scene, "#ff8a40", 1, 0);
  const core = MeshBuilder.CreateSphere("suncore", { diameter: 10, segments: 8 }, scene);
  core.position.set(96, 44, -62);
  core.material = mat(scene, "#ffe0a0", 1, 0);

  const band = MeshBuilder.CreateCylinder("horizon", { height: 28, diameter: 390, tessellation: 20 }, scene);
  band.position.y = 10;
  const bm = new StandardMaterial("hz", scene);
  bm.diffuseColor = new Color3(0.85, 0.35, 0.18);
  bm.emissiveColor = new Color3(0.45, 0.16, 0.08);
  bm.alpha = 0.22;
  bm.backFaceCulling = false;
  band.material = bm;
}

function paintGround(scene: Scene) {
  const ground = MeshBuilder.CreateGround("gnd", { width: 200, height: 200, subdivisions: 2 }, scene);
  ground.material = asphaltMat(scene);

  const sidewalk = MeshBuilder.CreateGround("sw", { width: 188, height: 148, subdivisions: 1 }, scene);
  sidewalk.position.y = 0.02;
  sidewalk.position.z = -8;
  sidewalk.material = sidewalkMat(scene);

  const curb = mat(scene, "#1a1c1e");
  const ns = [-60, -20, 20, 60];
  for (const x of ns) {
    for (const side of [-4.55, 4.55]) {
      const c = MeshBuilder.CreateGround("curb", { width: 0.3, height: 168 }, scene);
      c.position.set(x + side, 0.05, 4);
      c.material = curb;
    }
  }

  const water = MeshBuilder.CreateGround("water", { width: 200, height: 44, subdivisions: 8 }, scene);
  water.position.set(0, -0.18, 88);
  water.material = waterMat(scene);

  const foam = MeshBuilder.CreateGround("foam", { width: 200, height: 2.1 }, scene);
  foam.position.set(0, 0.06, 74);
  foam.material = mat(scene, "#c8d4dc", 0.28);

  const grass = MeshBuilder.CreateGround("grass", { width: 16, height: 12 }, scene);
  grass.position.set(-28, 0.045, -8);
  grass.material = mat(scene, "#2a4a28", 0.05);
  const dirt = MeshBuilder.CreateGround("dirt", { width: 13, height: 11 }, scene);
  dirt.position.set(8, 0.045, -18);
  dirt.material = mat(scene, "#4a3828", 0.03);
  const lot = MeshBuilder.CreateGround("lot", { width: 18, height: 14 }, scene);
  lot.position.set(-70, 0.045, 48);
  lot.material = mat(scene, "#3a3024", 0.03);
}

function paintRoads(scene: Scene) {
  const nsMat = roadMat(scene, true);
  const ewMat = roadMat(scene, false);
  const ns = [-60, -20, 20, 60];
  for (const x of ns) {
    const r = MeshBuilder.CreateGround("rd", { width: 8.6, height: 168 }, scene);
    r.position.set(x, 0.035, 4);
    r.material = nsMat;
  }
  const ew = [-40, 0, 30, 60];
  for (const z of ew) {
    const r = MeshBuilder.CreateGround("rd", { width: 176, height: 8.6 }, scene);
    r.position.set(0, 0.036, z);
    r.material = ewMat;
  }
  const zebra = mat(scene, "#e8e0d0", 0.1);
  for (const x of ns) {
    for (const z of ew) {
      for (let i = -3; i <= 3; i++) {
        const s = MeshBuilder.CreateGround("zw", { width: 0.4, height: 3.2 }, scene);
        s.position.set(x + i * 0.54, 0.06, z);
        s.material = zebra;
      }
    }
  }
}

type Block = {
  x: number; z: number; w: number; d: number; h: number; hex: string; style: BuildingStyle; yaw?: number;
};

function placeBlocks(scene: Scene, colliders: AABB[], anchors: Anchor[]) {
  const colors = ["#1a3a44", "#3a2040", "#c4a070", "#2a3048", "#8a4038", "#1a2820", "#4a3048", "#2a4450"];
  const extras: Block[] = [
    { x: 0, z: -58, w: 14, d: 12, h: 46, hex: "#1a3a44", style: "tower" },
    { x: -38, z: -56, w: 12, d: 10, h: 34, hex: "#2a3048", style: "tower" },
    { x: 38, z: -54, w: 11, d: 11, h: 38, hex: "#3a2040", style: "tower" },
    { x: -72, z: -28, w: 10, d: 12, h: 18, hex: "#8a4038", style: "walkup" },
    { x: 72, z: -28, w: 11, d: 10, h: 22, hex: "#2a4450", style: "walkup" },
    { x: -72, z: 12, w: 10, d: 9, h: 14, hex: "#4a3048", style: "shop" },
    { x: 74, z: 14, w: 9, d: 10, h: 16, hex: "#1a2820", style: "walkup" },
    { x: -38, z: 16, w: 9, d: 8, h: 20, hex: "#2a3048", style: "walkup" },
    { x: 4, z: 16, w: 8, d: 8, h: 18, hex: "#3a2040", style: "walkup" },
    { x: 38, z: 14, w: 10, d: 8, h: 16, hex: "#c4a070", style: "shop" },
    { x: -72, z: -8, w: 9, d: 9, h: 24, hex: "#1a3a44", style: "walkup" },
    { x: 8, z: -28, w: 10, d: 9, h: 26, hex: "#2a4450", style: "walkup" },
    { x: -8, z: 52, w: 14, d: 10, h: 12, hex: "#4a4038", style: "warehouse" },
    { x: 8, z: 52, w: 12, d: 9, h: 11, hex: "#3a3830", style: "warehouse" },
    { x: 72, z: 52, w: 13, d: 11, h: 14, hex: "#4a4038", style: "warehouse" },
  ];

  for (const b of extras) {
    if (near(b.x, b.z, LOC.spawn.x, LOC.spawn.z, 12)) continue;
    if (near(b.x, b.z, LOC.garage.x, LOC.garage.z, 14)) continue;
    if (near(b.x, b.z, LOC.mart.x, LOC.mart.z, 12)) continue;
    const yaw = b.yaw ?? faceRoadYaw(b.x, b.z);
    makeBuilding(scene, b.x, b.z, b.w, b.d, b.h, b.hex, b.style, yaw);
    colliders.push(boxAABB(b.x, b.z, b.w, b.d, b.h, yaw));
    addBuildingAnchors(anchors, b.x, b.z, b.w, b.d, b.h);
    if (b.x === 0 && b.z === -58) {
      makeSign(scene, "VICEBLOCK", b.x, b.h + 3.1, b.z + b.d * 0.5 + 0.2, 9.2, 1.2, "#100810", "#ff4da6", Math.PI);
      makeSign(scene, "NOVA CITY", b.x, b.h + 1.7, b.z + b.d * 0.5 + 0.2, 8.6, 1.45, "#120808", "#ffc83d", Math.PI);
      makeSign(scene, "SOUTH DOCKS", b.x, b.h + 0.25, b.z + b.d * 0.5 + 0.2, 7.4, 0.82, "#081018", "#2ef2d0", Math.PI);
    }
  }

  const cell = 20;
  let ci = 0;
  for (let ix = -4; ix <= 4; ix++) {
    for (let iz = -3; iz <= 3; iz++) {
      const x0 = ix * cell;
      const z0 = iz * cell;
      if (isRoadCell(ix, iz)) continue;
      if (near(x0, z0, LOC.spawn.x, LOC.spawn.z, 14)) continue;
      if (near(x0, z0, LOC.garage.x, LOC.garage.z, 16)) continue;
      if (near(x0, z0, LOC.mart.x, LOC.mart.z, 14)) continue;
      if (extras.some((b) => near(x0, z0, b.x, b.z, 12))) continue;
      if (((ix * 5 + iz * 11) % 7) === 0) continue;

      const ox = ((ix * 7 + iz * 3) % 5) - 2;
      const oz = ((ix * 3 + iz * 9) % 5) - 2;
      const x = x0 + ox * 0.7;
      const z = z0 + oz * 0.55;
      let w = 9 + ((ix * 5 + iz * 3) % 5);
      let d = 8 + ((ix * 2 + iz * 7) % 5);
      let h = 12 + ((ix * 11 + iz * 17 + 20) % 18);
      const hex = colors[ci++ % colors.length];
      let style: BuildingStyle = "walkup";
      if (iz <= -2) { style = "tower"; h += 16; }
      else if (iz >= 1 && Math.abs(ix) >= 2) { style = "warehouse"; h = 9 + (ix % 4); }
      else if (iz === 1) style = "shop";
      const yaw = faceRoadYaw(x, z);
      makeBuilding(scene, x, z, w, d, h, hex, style, yaw);
      colliders.push(boxAABB(x, z, w, d, h, yaw));
      addBuildingAnchors(anchors, x, z, w, d, h);
    }
  }
}

function placeLandmarks(scene: Scene, colliders: AABB[], anchors: Anchor[]) {
  const mx = LOC.mart.x, mz = LOC.mart.z;
  makeBuilding(scene, mx, mz, 14, 10, 5.4, "#c8b070", "shop", Math.PI);
  colliders.push(boxAABB(mx, mz, 14, 10, 5.4));
  addBuildingAnchors(anchors, mx, mz, 14, 10, 5.4);
  makeSign(scene, "NOVA MART", mx, 5.85, mz + 5.3, 7.8, 1.0, "#1a1000", "#ffc83d", Math.PI);
  const awn = MeshBuilder.CreateBox("mawn", { width: 13.2, height: 0.12, depth: 1.5 }, scene);
  awn.position.set(mx, 3.5, mz + 5.7);
  awn.material = mat(scene, "#c03028", 0.14);
  const glass = MeshBuilder.CreateBox("mgl", { width: 11.6, height: 2.2, depth: 0.12 }, scene);
  glass.position.set(mx, 1.45, mz + 5.1);
  glass.material = mat(scene, "#7ec8e8", 0.24);
  const stripe = mat(scene, "#e8d8a0", 0.08);
  for (let i = 0; i < 4; i++) {
    const st = MeshBuilder.CreateGround("pk", { width: 0.18, height: 3.5 }, scene);
    st.position.set(mx - 4 + i * 2.4, 0.065, mz + 7.6);
    st.material = stripe;
  }

  const gx = LOC.garage.x, gz = LOC.garage.z;
  const gar = MeshBuilder.CreateBox("gar", { width: 16, height: 5.1, depth: 12 }, scene);
  gar.position.set(gx, 2.55, gz);
  gar.material = mat(scene, "#3a4044");
  const door = MeshBuilder.CreateBox("gd", { width: 8.2, height: 3.5, depth: 0.18 }, scene);
  door.position.set(gx, 1.75, gz + 6.08);
  door.material = mat(scene, "#0e1012", 0.04);
  makeSign(scene, "MAYA GARAGE", gx, 5.55, gz + 6.3, 8.6, 0.8, "#041814", "#2ef2d0", Math.PI);
  colliders.push(boxAABB(gx, gz, 16, 12, 5.1));
  addBuildingAnchors(anchors, gx, gz, 16, 12, 5.1);
  const oil = MeshBuilder.CreateGround("oil", { width: 6.6, height: 4.3 }, scene);
  oil.position.set(gx, 0.05, gz + 8.2);
  oil.material = mat(scene, "#1a1410", 0.02);
  makeCone(scene, gx - 8.2, gz + 5.4);
  makeCone(scene, gx + 8.2, gz + 5.4);
  makeCone(scene, gx - 8.4, gz + 3.2);

  const ax = LOC.spawn.x - 10, az = LOC.spawn.z - 8;
  makeBuilding(scene, ax, az, 12, 10, 22, "#2a3048", "walkup", Math.PI);
  colliders.push(boxAABB(ax, az, 12, 10, 22));
  addBuildingAnchors(anchors, ax, az, 12, 10, 22);
  const warm = MeshBuilder.CreateBox("aptw", { width: 1.5, height: 1.7, depth: 0.08 }, scene);
  warm.position.set(ax + 2.2, 3.3, az + 5.1);
  warm.material = mat(scene, "#f2c46a", 0.75);

  makeBuilding(scene, 52, -18, 16, 12, 14, "#e8eef4", "walkup", Math.PI);
  colliders.push(boxAABB(52, -18, 16, 12, 14));
  addBuildingAnchors(anchors, 52, -18, 16, 12, 14);
  const stripeB = MeshBuilder.CreateBox("pds", { width: 16.2, height: 0.75, depth: 0.12 }, scene);
  stripeB.position.set(52, 3.3, -11.9);
  stripeB.material = mat(scene, "#1a3a88", 0.22);
  makeSign(scene, "NCPD", 52, 8.5, -11.82, 6.4, 0.75, "#0a1428", "#7eb0ff", Math.PI);
  const pole = MeshBuilder.CreateCylinder("flag", { height: 5.4, diameter: 0.1, tessellation: 6 }, scene);
  pole.position.set(58.6, 2.7, -11.4);
  pole.material = mat(scene, "#c4c4c4");
  const flag = MeshBuilder.CreateBox("fl", { width: 1.45, height: 0.72, depth: 0.04 }, scene);
  flag.position.set(59.35, 4.9, -11.4);
  flag.material = mat(scene, "#1a3a88", 0.18);
}

function placeStrip(scene: Scene, colliders: AABB[], anchors: Anchor[]) {
  const shops: [number, string, string, string][] = [
    [-44, "#2a1020", "#ff4d8d", "PINK HOUR"],
    [-32, "#102028", "#2ef2d0", "VICE"],
    [2, "#2a2210", "#ffc83d", "RICO'S"],
    [28, "#201028", "#b46aff", "NOVA FM"],
    [40, "#2a1410", "#ff6a3d", "6IX"],
  ];
  for (const [x, base, neon, name] of shops) {
    makeBuilding(scene, x, 42, 9.2, 8.2, 11, base, "shop", Math.PI);
    colliders.push(boxAABB(x, 42, 9.2, 8.2, 11));
    addBuildingAnchors(anchors, x, 42, 9.2, 8.2, 11);
    makeSign(scene, name, x, 6.95, 46.2, name.length > 6 ? 6.3 : 4.7, 0.76, "#08080c", neon, Math.PI);
    makeAwning(scene, x, 3.15, 46.1, 8.4, neon === "#ff4d8d" ? "#c03050" : neon === "#2ef2d0" ? "#0a4a44" : "#c45a20", Math.PI);
  }
  makeBillboard(scene, -8, 48, "VICEBLOCK", "#ff4da6", Math.PI);
  makeSign(scene, "NOVA CITY FM", -8, 4.9, 48.2, 5.4, 0.48, "#100810", "#ffc83d", Math.PI);
  makeSign(scene, "SALT LINE", -44, 4.4, 46.15, 4.4, 0.42, "#100810", "#ff4d8d", Math.PI);
  makeSign(scene, "LATE RICE", 2, 4.35, 46.15, 4.6, 0.4, "#100c04", "#ffc83d", Math.PI);
  const neonM = new PointLight("neonm", new Vector3(-32, 6.2, 46), scene);
  neonM.diffuse = new Color3(1, 0.28, 0.62);
  neonM.intensity = 0.55;
  neonM.range = 16;
  const neonT = new PointLight("neont", new Vector3(2, 6.1, 46), scene);
  neonT.diffuse = new Color3(1, 0.72, 0.28);
  neonT.intensity = 0.42;
  neonT.range = 14;
}

function placeDocks(scene: Scene, colliders: AABB[], anchors: Anchor[]) {
  const deck = MeshBuilder.CreateBox("pier", { width: 32, height: 0.42, depth: 24 }, scene);
  deck.position.set(44, 0.16, 79);
  deck.material = woodDockMat(scene);
  makeBuilding(scene, 44, 64, 18, 10, 12, "#4a4038", "warehouse", Math.PI);
  colliders.push(boxAABB(44, 64, 18, 10, 12));
  addBuildingAnchors(anchors, 44, 64, 18, 10, 12);
  anchors.push({ x: 58, y: 17.2, z: 80 });
  anchors.push({ x: 58, y: 17.4, z: 86 });
  anchors.push({ x: 58, y: 14, z: 92 });
  makeSign(scene, "DOCKS", 44, 7.5, 69.2, 5.6, 0.65, "#1a1008", "#ffc83d", Math.PI);

  makeContainer(scene, 32, 80, 0, "#ff8a3d", 0.12);
  makeContainer(scene, 32, 80, 2.2, "#2ef2d0", 0.08);
  makeContainer(scene, 36.8, 85, 0, "#ff4da6", -0.18);
  makeContainer(scene, 36.8, 85, 2.2, "#ff8a3d", -0.1);
  makeContainer(scene, 52, 87, 0, "#2a6a88", 1.15);
  makeContainer(scene, 56.4, 84, 0, "#c4a070", 0.4);
  makeCrane(scene, 58, 80);
  makeBoat(scene, 8, 88, "#2a4a58");
  makeBoat(scene, -26, 91, "#8a4030");
  makeBoat(scene, -52, 89, "#1a3a44");

  for (const [x, z] of [[30, 90], [38, 91], [48, 91], [56, 90], [62, 86], [28, 84]] as [number, number][]) {
    makePiling(scene, x, z);
  }
  makeCrate(scene, 40, 76, 0.3);
  makeCrate(scene, 41.1, 77.2, -0.4);
  makeCrate(scene, 48, 74, 0.8);
  makeCrate(scene, 49.1, 73.2, 0.15);
  makeCrate(scene, 33, 77.4, -0.5);
  makeCone(scene, 30.4, 74.2);
  makeCone(scene, 31.2, 75);
  makeBollard(scene, 34, 74.6);
  makeBollard(scene, 50, 74.8);
  makeBollard(scene, 58, 86);
  makePallet(scene, 42.4, 75.2, -0.3);
  makeCrate(scene, 42.6, 75.4, 0.2);

  makeFence(scene, -20, 73.4, 36, 0);
  makeFence(scene, 8, 73.4, 22, 0);
}

function placePalmsAndLamps(scene: Scene, anchors: Anchor[]) {
  const palms = [-70, -50, -36, -10, 6, 22, 38, 54, 70];
  for (const x of palms) {
    makePalm(scene, x, 25);
    makePalm(scene, x + 3, 35);
  }
  for (const x of [-64, -40, -8, 16, 48, 72]) makePalm(scene, x, 70);
  const lamps: [number, number, number][] = [
    [-56, 30, Math.PI / 2], [-24, 30, -Math.PI / 2], [16, 30, Math.PI / 2], [56, 30, -Math.PI / 2],
    [-56, 0, Math.PI / 2], [16, 0, Math.PI / 2], [56, 60, -Math.PI / 2], [-24, 60, Math.PI / 2],
    [14, 20, 0], [-50, 42, Math.PI], [44, 72, 0], [-26, 16, 0],
  ];
  lamps.forEach(([x, z, yaw], i) => {
    makeLamp(scene, x, z, true, yaw);
    anchors.push({ x, y: 4.6, z });
    anchors.push({ x, y: 7.2, z });
    if (i < 8) {
      const pl = new PointLight("pl", new Vector3(x, 4.5, z + 1), scene);
      pl.diffuse = new Color3(1, 0.78, 0.42);
      pl.intensity = 0.42;
      pl.range = 18;
    }
  });
  makeWire(scene, -56, 4.7, 30, -24, 4.7, 30);
  makeWire(scene, -24, 4.7, 30, 16, 4.7, 30);
  makeWire(scene, 16, 4.7, 30, 56, 4.7, 30);
  makeWire(scene, -56, 4.7, 0, 16, 4.7, 0);
  makeWire(scene, 14, 4.7, 20, -26, 4.7, 16);
  makeWire(scene, -50, 4.7, 42, 14, 4.7, 20);
}

function placeSwingCables(scene: Scene, anchors: Anchor[]) {
  const matC = mat(scene, "#2a2a30", 0.08);
  const span = (ax: number, ay: number, az: number, bx: number, by: number, bz: number) => {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const len = Math.hypot(dx, dy, dz) || 0.01;
    const m = MeshBuilder.CreateCylinder("cab", { height: 1, diameter: 0.06, tessellation: 4 }, scene);
    m.position.set((ax + bx) * 0.5, (ay + by) * 0.5, (az + bz) * 0.5);
    m.scaling.set(1, len, 1);
    m.material = matC;
    const dir = new Vector3(dx / len, dy / len, dz / len);
    const axis = Vector3.Cross(Vector3.Up(), dir);
    if (axis.length() > 0.0001) {
      m.rotationQuaternion = Quaternion.RotationAxis(axis.normalize(), Math.acos(Math.max(-1, Math.min(1, Vector3.Dot(Vector3.Up(), dir)))));
    }
    const steps = Math.max(2, Math.floor(len / 10));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      anchors.push({ x: ax + dx * t, y: ay + dy * t, z: az + dz * t });
    }
  };
  const xs = [-60, -20, 20, 60];
  const zs = [-40, 0, 30, 60];
  for (const x of xs) {
    span(x, 14, -56, x, 14, 68);
    span(x, 22, -40, x, 22, 50);
    for (let z = -50; z <= 70; z += 14) {
      anchors.push({ x, y: 11, z });
      anchors.push({ x, y: 18, z });
    }
  }
  for (const z of zs) {
    span(-72, 13, z, 72, 13, z);
    for (let x = -70; x <= 70; x += 14) anchors.push({ x, y: 12, z });
  }
  anchors.push({ x: LOC.spawn.x + 6, y: 9, z: LOC.spawn.z + 4 });
  anchors.push({ x: LOC.spawn.x - 4, y: 12, z: LOC.spawn.z - 6 });
  anchors.push({ x: LOC.spawn.x + 2, y: 16, z: LOC.spawn.z - 10 });
}

function placeDressing(scene: Scene): { x: number; z: number }[] {
  makeDumpster(scene, -38, 37.4, 0.2);
  makeDumpster(scene, 8, 37.2, -0.1);
  makeDumpster(scene, 34, 37.5, 0.4);
  makeDumpster(scene, -22, 8.6, 0.15);
  makeTrash(scene, -37, 36.2);
  makeTrash(scene, 9.2, 36.4);
  makeTrash(scene, -24.6, 7.2);
  makeTrash(scene, -8.4, 14.2);
  makeHydrant(scene, -56, 26);
  makeHydrant(scene, 16, 4);
  makeHydrant(scene, 24, 32);
  makeHydrant(scene, -20, 8);
  const benches = [
    { x: -24, z: 4 },
    { x: 8, z: 32 },
    { x: 18, z: 4 },
  ];
  makeBench(scene, -24, 4, 0.4);
  makeBench(scene, 8, 32, Math.PI);
  makeBench(scene, 18, 4, -0.2);
  makeNewsbox(scene, 10, 26);
  makeNewsbox(scene, -30, 4);
  makeNewsbox(scene, -18, 7.4);
  makeCone(scene, -8, 12.5);
  makeCone(scene, -7.2, 13.4);
  makeCrate(scene, -16, 9.2, 0.25);
  makeCrate(scene, -15.1, 10.1, -0.3);
  makePlate(scene, "DOCK ST", -22, 2.2, 0.1, "#2ef2d0");
  makePlate(scene, "NOVA WAY", -4, 18, 1.2, "#ffc83d");
  makePlate(scene, "PIER RD", 36, 68, 0.05, "#2ef2d0");
  makePlate(scene, "SALT LN", 8, 36, Math.PI, "#ff4d8d");
  makeTrafficLight(scene, -16.6, 3.6, Math.PI / 2);
  makeTrafficLight(scene, 16.6, -3.6, -Math.PI / 2);
  makeTrafficLight(scene, -16.6, 33.6, Math.PI / 2);
  makeTrafficLight(scene, 23.4, 26.6, 0);
  makeWallTag(scene, "NOVA", -36.6, 2.2, 37.9, 2.6, 0.7, Math.PI, "#2ef2d0");
  makeWallTag(scene, "DOCKS", 9.8, 2.4, 37.9, 2.8, 0.65, Math.PI, "#ff8a3d");
  makeWallTag(scene, "SALT", -21.2, 1.8, 8.8, 2.2, 0.55, 0.2, "#ff4d8d");
  makeWallTag(scene, "VICEBLOCK", -14.4, 2.5, 8.6, 3.4, 0.85, 0.15, "#ffc83d");
  makeSign(scene, "VICEBLOCK", -22, 7.1, 8.15, 6.4, 0.72, "#100810", "#ff4da6", Math.PI);
  makeSign(scene, "SOUTH DOCKS", -18, 6.4, 8.2, 7.2, 0.85, "#081018", "#2ef2d0", Math.PI);
  makeScooter(scene, -22.6, 7.1, 0.4);
  makePallet(scene, -17.2, 10.4, 0.2);
  makeCrate(scene, -17.0, 10.5, 0.5);
  makePuddle(scene, -24.2, 7.4, 2.8, 1.6);
  makePuddle(scene, 2.2, 33.6, 3.4, 1.8);
  makeSign(scene, "OPEN LATE", -36, 4.8, 2.2, 4.2, 0.55, "#120808", "#ff4d8d", Math.PI * 0.15);
  makeSign(scene, "CARGO 6", 40, 5.4, 69.2, 4.4, 0.48, "#1a1008", "#ffc83d", Math.PI);
  makeSign(scene, "PIER RADIO", 28, 8.4, 46.2, 5.2, 0.5, "#100818", "#b46aff", Math.PI);
  makeDecal(scene, "DOCK ST", -26, 5.4, 5.6, 1.15, 0, "#e8d8a0");
  makeDecal(scene, "STRIP", 0, 32.4, 4.8, 1.05, 0, "#ffc83d");
  makeDecal(scene, "PIER", 40, 72, 3.6, 0.9, 0, "#2ef2d0");
  makeDecal(scene, "SALT", -10, 8.2, 3.4, 0.8, 0.2, "#ff4da6");
  makeBird(scene, -20, 16, 12);
  makeBird(scene, 8, 18, 40);
  makeBird(scene, 40, 14, 78);
  makeBird(scene, -40, 20, 30);
  for (const [x, y, z] of [[-38, 1.25, 37.4], [-22, 1.2, 8.6], [44, 1.1, 64]] as [number, number, number][]) {
    const puff = MeshBuilder.CreateSphere("steam", { diameter: 0.5, segments: 5 }, scene);
    puff.position.set(x, y, z);
    const sm = uniqueMat(scene, "#d0d8dc", 0.08, 0);
    sm.alpha = 0.22;
    puff.material = sm;
  }
  return benches;
}

function placeDust(scene: Scene, x: number, z: number) {
  const ps = new ParticleSystem("dust", 28, scene);
  ps.particleTexture = flareTex(scene);
  ps.emitter = new Vector3(x, 1.4, z);
  ps.minEmitBox = new Vector3(-6, 0, -6);
  ps.maxEmitBox = new Vector3(6, 2.2, 6);
  ps.color1 = new Color4(1, 0.72, 0.42, 0.18);
  ps.color2 = new Color4(0.7, 0.55, 0.4, 0.06);
  ps.minSize = 0.08;
  ps.maxSize = 0.28;
  ps.minLifeTime = 1.6;
  ps.maxLifeTime = 3.4;
  ps.emitRate = 9;
  ps.direction1 = new Vector3(-0.15, 0.12, -0.1);
  ps.direction2 = new Vector3(0.15, 0.35, 0.1);
  ps.gravity = new Vector3(0, -0.04, 0);
  ps.minEmitPower = 0.08;
  ps.maxEmitPower = 0.22;
  ps.updateSpeed = 0.02;
  ps.start();
}

function roomWalls(scene: Scene, cx: number, cz: number, w: number, d: number, h: number, hex: string, doorZ: "neg" | "pos"): AABB[] {
  const t = 0.4;
  const colliders: AABB[] = [];
  const north = MeshBuilder.CreateBox("iw", { width: w, height: h, depth: t }, scene);
  north.position.set(cx, h * 0.5, cz + d / 2);
  north.material = mat(scene, hex);
  colliders.push(boxAABB(cx, cz + d / 2, w, t, h));
  const southGap = 2.4;
  const sw = (w - southGap) * 0.5;
  const sideZ = doorZ === "neg" ? cz - d / 2 : cz + d / 2;
  if (doorZ === "neg") {
    const sl = MeshBuilder.CreateBox("iw", { width: sw, height: h, depth: t }, scene);
    sl.position.set(cx - (southGap + sw) * 0.5, h * 0.5, sideZ);
    sl.material = mat(scene, hex);
    const sr = MeshBuilder.CreateBox("iw", { width: sw, height: h, depth: t }, scene);
    sr.position.set(cx + (southGap + sw) * 0.5, h * 0.5, sideZ);
    sr.material = mat(scene, hex);
    colliders.push(boxAABB(cx - (southGap + sw) * 0.5, sideZ, sw, t, h));
    colliders.push(boxAABB(cx + (southGap + sw) * 0.5, sideZ, sw, t, h));
  }
  const east = MeshBuilder.CreateBox("iw", { width: t, height: h, depth: d }, scene);
  east.position.set(cx + w / 2, h * 0.5, cz);
  east.material = mat(scene, hex);
  const west = MeshBuilder.CreateBox("iw", { width: t, height: h, depth: d }, scene);
  west.position.set(cx - w / 2, h * 0.5, cz);
  west.material = mat(scene, hex);
  colliders.push(boxAABB(cx + w / 2, cz, t, d, h));
  colliders.push(boxAABB(cx - w / 2, cz, t, d, h));
  void doorZ;
  return colliders;
}

function buildInteriors(scene: Scene): CityData["interiors"] {
  const martC = roomWalls(scene, INT.mart.ox, INT.mart.oz, 12, 10, 4.2, "#c8b898", "neg");
  const mf = MeshBuilder.CreateGround("if", { width: 11.6, height: 9.6 }, scene);
  mf.position.set(INT.mart.ox, 0.01, INT.mart.oz);
  mf.material = sidewalkMat(scene);
  const ceil = MeshBuilder.CreateGround("ic", { width: 11.6, height: 9.6 }, scene);
  ceil.position.set(INT.mart.ox, 4.05, INT.mart.oz);
  ceil.rotation.x = Math.PI;
  ceil.material = mat(scene, "#d8c8b0");
  const counter = MeshBuilder.CreateBox("cnt", { width: 3.4, height: 1.1, depth: 0.8 }, scene);
  counter.position.set(INT.mart.ox, 0.55, INT.mart.oz + 3);
  counter.material = mat(scene, "#5a4030");
  martC.push(boxAABB(INT.mart.ox, INT.mart.oz + 3, 3.4, 0.8, 1.1));
  for (let i = 0; i < 3; i++) {
    const aisle = MeshBuilder.CreateBox("ais", { width: 0.4, height: 1.65, depth: 4.2 }, scene);
    aisle.position.set(INT.mart.ox - 3 + i * 3, 0.82, INT.mart.oz - 0.4);
    aisle.material = mat(scene, "#2a3040");
    martC.push(boxAABB(INT.mart.ox - 3 + i * 3, INT.mart.oz - 0.4, 0.4, 4.2, 1.65));
    for (let k = 0; k < 4; k++) {
      const can = MeshBuilder.CreateBox("can", { width: 0.18, height: 0.2, depth: 0.18 }, scene);
      can.position.set(INT.mart.ox - 3 + i * 3, 1.75, INT.mart.oz - 1.6 + k * 1.0);
      can.material = mat(scene, k % 2 ? "#c03028" : "#ffc83d", 0.08);
    }
  }
  makeSign(scene, "NOVA MART", INT.mart.ox, 3.4, INT.mart.oz + 4.7, 4.6, 0.5, "#1a1000", "#ffc83d", Math.PI);

  const garC = roomWalls(scene, INT.garage.ox, INT.garage.oz, 14, 12, 5, "#3a4044", "neg");
  const gf = MeshBuilder.CreateGround("ig", { width: 13.6, height: 11.6 }, scene);
  gf.position.set(INT.garage.ox, 0.01, INT.garage.oz);
  gf.material = asphaltMat(scene);
  const lift = MeshBuilder.CreateBox("lift", { width: 3.2, height: 0.2, depth: 5.2 }, scene);
  lift.position.set(INT.garage.ox + 3.4, 0.12, INT.garage.oz);
  lift.material = mat(scene, "#4a4a40");
  makeSign(scene, "MAYA", INT.garage.ox, 4.2, INT.garage.oz + 5.7, 3.6, 0.5, "#041814", "#2ef2d0", Math.PI);
  makeCone(scene, INT.garage.ox - 5, INT.garage.oz + 3);
  makeCrate(scene, INT.garage.ox - 4.2, INT.garage.oz - 3, 0.2);

  const jailC = roomWalls(scene, INT.jail.ox, INT.jail.oz, 9, 8, 3.6, "#3a4048", "neg");
  const jf = MeshBuilder.CreateGround("ij", { width: 8.6, height: 7.6 }, scene);
  jf.position.set(INT.jail.ox, 0.01, INT.jail.oz);
  jf.material = mat(scene, "#2a2e32");
  makeBench(scene, INT.jail.ox, INT.jail.oz + 1.4, Math.PI);
  makeSign(scene, "NCPD HOLD", INT.jail.ox, 3.1, INT.jail.oz + 3.7, 4.4, 0.4, "#0a1428", "#7eb0ff", Math.PI);

  return {
    mart: {
      id: "mart", colliders: martC,
      spawnX: INT.mart.ox, spawnZ: INT.mart.oz - 3.6,
      exitX: INT.mart.ox, exitZ: INT.mart.oz - 4.5,
      streetX: LOC.mart.x, streetZ: LOC.mart.z + 6.4,
      doorX: LOC.mart.x, doorZ: LOC.mart.z + 5.7,
      camDist: 5.1,
    },
    garage: {
      id: "garage", colliders: garC,
      spawnX: INT.garage.ox, spawnZ: INT.garage.oz - 4.2,
      exitX: INT.garage.ox, exitZ: INT.garage.oz - 5.5,
      streetX: LOC.garage.x, streetZ: LOC.garage.z + 7.2,
      doorX: LOC.garage.x, doorZ: LOC.garage.z + 6.6,
      camDist: 6.2,
    },
    jail: {
      id: "jail", colliders: jailC,
      spawnX: INT.jail.ox, spawnZ: INT.jail.oz,
      exitX: INT.jail.ox, exitZ: INT.jail.oz - 3.6,
      streetX: 52, streetZ: -8,
      doorX: 52, doorZ: -11.2,
      camDist: 4.8,
    },
  };
}
