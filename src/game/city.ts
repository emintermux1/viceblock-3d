import {
  Color3, Color4, DirectionalLight, DynamicTexture, HemisphericLight, Mesh, MeshBuilder,
  PointLight, Scene, StandardMaterial, Vector3,
} from "@babylonjs/core";
import type { AABB } from "./types";
import { FENCE, INT, LOC } from "./constants";
import {
  makeBench, makeBoat, makeBuilding, makeCone, makeContainer, makeCrane, makeDecal,
  makeDumpster, makeFence, makeHydrant, makeLamp, makeNewsbox, makePalm, makeSign,
  makeTrash, mat, type BuildingStyle,
} from "./meshes";

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
};

function boxAABB(x: number, z: number, w: number, d: number, h: number): AABB {
  return { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, minY: 0, maxY: h };
}

function isRoadCell(ix: number, iz: number): boolean {
  return ix === -3 || ix === -1 || ix === 1 || ix === 3 || iz === -2 || iz === 0 || iz === 2 || iz === 3;
}

function near(ax: number, az: number, bx: number, bz: number, r: number) {
  return Math.hypot(ax - bx, az - bz) < r;
}

export function buildCity(scene: Scene): CityData {
  scene.clearColor = new Color4(0.22, 0.08, 0.16, 1);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogColor = new Color3(0.55, 0.22, 0.28);
  scene.fogDensity = 0.0055;
  scene.ambientColor = new Color3(0.28, 0.14, 0.18);

  const hemi = new HemisphericLight("hemi", new Vector3(0.15, 1, 0.2), scene);
  hemi.intensity = 0.68;
  hemi.diffuse = new Color3(1, 0.55, 0.62);
  hemi.groundColor = new Color3(0.18, 0.08, 0.12);

  const sun = new DirectionalLight("sun", new Vector3(-0.45, -0.55, 0.4), scene);
  sun.intensity = 1.15;
  sun.diffuse = new Color3(1, 0.48, 0.22);

  paintSky(scene);
  paintGround(scene);
  paintRoads(scene);

  const colliders: AABB[] = [];
  const roads: { x: number; z: number }[] = [];
  const colors = ["#1a3a44", "#3a2040", "#c4a070", "#2a3048", "#8a4038", "#1a2820", "#4a3048", "#2a4450"];

  const cell = 20;
  let ci = 0;
  for (let ix = -4; ix <= 4; ix++) {
    for (let iz = -3; iz <= 3; iz++) {
      const x = ix * cell;
      const z = iz * cell;
      if (isRoadCell(ix, iz)) {
        roads.push({ x, z });
        continue;
      }
      if (near(x, z, LOC.spawn.x, LOC.spawn.z, 14)) continue;
      if (near(x, z, LOC.garage.x, LOC.garage.z, 16)) continue;
      if (near(x, z, LOC.mart.x, LOC.mart.z, 14)) continue;
      let w = 11 + ((ix * 5 + iz * 3) % 4);
      let d = 11 + ((ix * 2 + iz * 7) % 4);
      let h = 7 + ((ix * 11 + iz * 17 + 20) % 16);
      if (h < 6) h = 8 + ((ix + 9) % 6);
      const hex = colors[ci++ % colors.length];
      let style: BuildingStyle = "walkup";
      if (ix === 0 && iz === -3) { h = 22; style = "tower"; }
      else if (iz <= -1 && (ix === 0 || ix === 2 || ix === -4)) style = "tower";
      else if (iz === 1 && ix >= 2) style = "warehouse";
      else if (iz === 1 && Math.abs(ix) % 2 === 0) style = "shop";
      else if (z >= 20) style = "warehouse";
      makeBuilding(scene, x, z, w, d, h, hex, style);
      colliders.push(boxAABB(x, z, w, d, h));
      if (ix === 0 && iz === -3) {
        makeSign(scene, "NOVA CITY", x, h + 1.6, z + d * 0.5 + 0.2, 8.4, 1.4, "#120808", "#ffc83d", Math.PI);
        makeSign(scene, "SOUTH DOCKS", x, h + 0.2, z + d * 0.5 + 0.2, 7.2, 0.8, "#081018", "#2ef2d0", Math.PI);
      }
    }
  }

  placeLandmarks(scene, colliders);
  placeStrip(scene, colliders);
  placeDocks(scene, colliders);
  placePalmsAndLamps(scene);
  const benches = placeDressing(scene);
  const interiors = buildInteriors(scene);

  const wall = boxAABB(0, 78, 200, 2, 4);
  colliders.push(wall);

  const crossings = [
    { x: -20, z: 0 }, { x: 20, z: 0 }, { x: -20, z: 30 }, { x: 20, z: 30 },
    { x: -60, z: 30 }, { x: 60, z: 0 },
  ];

  return {
    colliders,
    roads,
    spawn: { x: LOC.spawn.x, z: LOC.spawn.z, r: 3 },
    garage: { x: LOC.garage.x, z: LOC.garage.z, r: 7 },
    mart: { x: LOC.mart.x, z: LOC.mart.z, r: 5 },
    pier: { minX: 28, maxX: 58, minZ: 68, maxZ: 92, minY: 0, maxY: 2 },
    waterZ: 74,
    interiors,
    fence: { x: FENCE.x, z: FENCE.z },
    benches,
    crossings,
  };
}

function paintSky(scene: Scene) {
  const sky = MeshBuilder.CreateSphere("sky", { diameter: 420, segments: 16, sideOrientation: Mesh.BACKSIDE }, scene);
  const tex = new DynamicTexture("skytx", { width: 256, height: 256 }, scene, false);
  const ctx = tex.getContext();
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, "#0a1430");
  g.addColorStop(0.42, "#2a1840");
  g.addColorStop(0.68, "#c45a32");
  g.addColorStop(0.86, "#e87838");
  g.addColorStop(1, "#1a1014");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = "rgba(255,245,220,0.55)";
  for (let i = 0; i < 40; i++) {
    ctx.fillRect((i * 47) % 256, (i * 19) % 90, 1, 1);
  }
  tex.update();
  const sm = new StandardMaterial("skym", scene);
  sm.diffuseTexture = tex;
  sm.emissiveTexture = tex;
  sm.emissiveColor = new Color3(0.55, 0.45, 0.4);
  sm.specularColor = new Color3(0, 0, 0);
  sm.backFaceCulling = false;
  sm.disableLighting = true;
  sky.material = sm;

  const disc = MeshBuilder.CreateSphere("sundisc", { diameter: 16, segments: 8 }, scene);
  disc.position.set(90, 46, -58);
  disc.material = mat(scene, "#ff8a40", 1, 0);
}

function paintGround(scene: Scene) {
  const ground = MeshBuilder.CreateGround("gnd", { width: 200, height: 200, subdivisions: 2 }, scene);
  ground.material = mat(scene, "#1c1416");

  const sidewalk = MeshBuilder.CreateGround("sw", { width: 188, height: 148, subdivisions: 1 }, scene);
  sidewalk.position.y = 0.02;
  sidewalk.position.z = -8;
  sidewalk.material = mat(scene, "#5a4a42");

  const curb = mat(scene, "#1a1c1e");
  const ns = [-60, -20, 20, 60];
  for (const x of ns) {
    for (const side of [-4.55, 4.55]) {
      const c = MeshBuilder.CreateGround("curb", { width: 0.28, height: 168 }, scene);
      c.position.set(x + side, 0.045, 4);
      c.material = curb;
    }
  }

  const water = MeshBuilder.CreateGround("water", { width: 200, height: 40, subdivisions: 1 }, scene);
  water.position.set(0, -0.15, 86);
  const wm = new StandardMaterial("water", scene);
  wm.diffuseColor = new Color3(0.06, 0.2, 0.3);
  wm.specularColor = new Color3(0.45, 0.65, 0.7);
  wm.specularPower = 64;
  wm.alpha = 0.94;
  wm.emissiveColor = new Color3(0.02, 0.05, 0.08);
  water.material = wm;

  const foam = MeshBuilder.CreateGround("foam", { width: 200, height: 1.6 }, scene);
  foam.position.set(0, 0.05, 74);
  foam.material = mat(scene, "#c8d4dc", 0.22);

  const grass = MeshBuilder.CreateGround("grass", { width: 14, height: 10 }, scene);
  grass.position.set(-28, 0.04, -8);
  grass.material = mat(scene, "#2a4a28", 0.04);
  const dirt = MeshBuilder.CreateGround("dirt", { width: 12, height: 10 }, scene);
  dirt.position.set(8, 0.04, -18);
  dirt.material = mat(scene, "#4a3828", 0.02);
  const lot = MeshBuilder.CreateGround("lot", { width: 16, height: 12 }, scene);
  lot.position.set(-70, 0.04, 48);
  lot.material = mat(scene, "#3a3024", 0.02);
}

function roadTex(scene: Scene, vertical: boolean): StandardMaterial {
  const key = vertical ? "rdv" : "rdh";
  const tex = new DynamicTexture(key, { width: 64, height: 512 }, scene, false);
  const ctx = tex.getContext();
  ctx.fillStyle = "#1a1c1e";
  ctx.fillRect(0, 0, 64, 512);
  ctx.fillStyle = "#c4b46a";
  for (let y = 10; y < 512; y += 28) ctx.fillRect(30, y, 4, 13);
  tex.update();
  const m = new StandardMaterial(key + "m", scene);
  m.diffuseTexture = tex;
  m.emissiveTexture = tex;
  m.emissiveColor = new Color3(0.12, 0.1, 0.06);
  m.specularColor = new Color3(0.04, 0.04, 0.04);
  return m;
}

function paintRoads(scene: Scene) {
  const nsMat = roadTex(scene, true);
  const ewMat = roadTex(scene, false);
  const ns = [-60, -20, 20, 60];
  for (const x of ns) {
    const r = MeshBuilder.CreateGround("rd", { width: 8.4, height: 168 }, scene);
    r.position.set(x, 0.03, 4);
    r.material = nsMat;
  }
  const ew = [-40, 0, 30, 60];
  for (const z of ew) {
    const r = MeshBuilder.CreateGround("rd", { width: 176, height: 8.4 }, scene);
    r.position.set(0, 0.031, z);
    r.material = ewMat;
  }
  const zebra = mat(scene, "#e8e0d0", 0.08);
  for (const x of ns) {
    for (const z of ew) {
      for (let i = -3; i <= 3; i++) {
        const s = MeshBuilder.CreateGround("zw", { width: 0.38, height: 3.1 }, scene);
        s.position.set(x + i * 0.52, 0.055, z);
        s.material = zebra;
      }
    }
  }
}

function placeLandmarks(scene: Scene, colliders: AABB[]) {
  const mx = LOC.mart.x, mz = LOC.mart.z;
  makeBuilding(scene, mx, mz, 14, 10, 5.2, "#c8b070", "shop");
  colliders.push(boxAABB(mx, mz, 14, 10, 5.2));
  makeSign(scene, "NOVA MART", mx, 5.7, mz + 5.2, 7.6, 0.95, "#1a1000", "#ffc83d", Math.PI);
  const awn = MeshBuilder.CreateBox("mawn", { width: 13, height: 0.12, depth: 1.4 }, scene);
  awn.position.set(mx, 3.4, mz + 5.6);
  awn.material = mat(scene, "#c03028", 0.12);
  const glass = MeshBuilder.CreateBox("mgl", { width: 11.5, height: 2.1, depth: 0.12 }, scene);
  glass.position.set(mx, 1.4, mz + 5.08);
  glass.material = mat(scene, "#7ec8e8", 0.2);
  const stripe = mat(scene, "#e8d8a0", 0.06);
  for (let i = 0; i < 4; i++) {
    const st = MeshBuilder.CreateGround("pk", { width: 0.18, height: 3.4 }, scene);
    st.position.set(mx - 4 + i * 2.4, 0.06, mz + 7.6);
    st.material = stripe;
  }

  const gx = LOC.garage.x, gz = LOC.garage.z;
  const gar = MeshBuilder.CreateBox("gar", { width: 16, height: 5, depth: 12 }, scene);
  gar.position.set(gx, 2.5, gz);
  gar.material = mat(scene, "#3a4044");
  const door = MeshBuilder.CreateBox("gd", { width: 8, height: 3.4, depth: 0.18 }, scene);
  door.position.set(gx, 1.7, gz + 6.05);
  door.material = mat(scene, "#0e1012", 0.04);
  makeSign(scene, "MAYA GARAGE", gx, 5.45, gz + 6.25, 8.4, 0.75, "#041814", "#2ef2d0", Math.PI);
  colliders.push(boxAABB(gx, gz, 16, 12, 5));
  const oil = MeshBuilder.CreateGround("oil", { width: 6.5, height: 4.2 }, scene);
  oil.position.set(gx, 0.045, gz + 8.2);
  oil.material = mat(scene, "#1a1410", 0.02);
  makeCone(scene, gx - 8.2, gz + 5.4);
  makeCone(scene, gx + 8.2, gz + 5.4);
  makeCone(scene, gx - 8.4, gz + 3.2);

  const ax = LOC.spawn.x - 10, az = LOC.spawn.z - 8;
  makeBuilding(scene, ax, az, 12, 10, 14, "#2a3048", "walkup");
  colliders.push(boxAABB(ax, az, 12, 10, 14));
  const warm = MeshBuilder.CreateBox("aptw", { width: 1.4, height: 1.6, depth: 0.08 }, scene);
  warm.position.set(ax + 2.2, 3.2, az + 5.08);
  warm.material = mat(scene, "#f2c46a", 0.7);
  const stoop = MeshBuilder.CreateBox("stoop", { width: 2.2, height: 0.35, depth: 1.3 }, scene);
  stoop.position.set(ax, 0.18, az + 5.7);
  stoop.material = mat(scene, "#3a3834");

  const pd = makeBuilding(scene, 52, -18, 16, 12, 8, "#e8eef4", "walkup");
  void pd;
  colliders.push(boxAABB(52, -18, 16, 12, 8));
  const stripeB = MeshBuilder.CreateBox("pds", { width: 16.1, height: 0.7, depth: 0.12 }, scene);
  stripeB.position.set(52, 3.2, -11.92);
  stripeB.material = mat(scene, "#1a3a88", 0.2);
  makeSign(scene, "NCPD", 52, 8.35, -11.85, 6.2, 0.7, "#0a1428", "#7eb0ff", Math.PI);
  const pole = MeshBuilder.CreateCylinder("flag", { height: 5.2, diameter: 0.1, tessellation: 6 }, scene);
  pole.position.set(58.6, 2.6, -11.4);
  pole.material = mat(scene, "#c4c4c4");
  const flag = MeshBuilder.CreateBox("fl", { width: 1.4, height: 0.7, depth: 0.04 }, scene);
  flag.position.set(59.3, 4.8, -11.4);
  flag.material = mat(scene, "#1a3a88", 0.15);
}

function placeStrip(scene: Scene, colliders: AABB[]) {
  const shops: [number, string, string, string][] = [
    [-44, "#2a1020", "#ff4d8d", "PINK HOUR"],
    [-32, "#102028", "#2ef2d0", "VICE"],
    [2, "#2a2210", "#ffc83d", "RICO'S"],
    [28, "#201028", "#b46aff", "NOVA FM"],
    [40, "#2a1410", "#ff6a3d", "6IX"],
  ];
  for (const [x, base, neon, name] of shops) {
    makeBuilding(scene, x, 42, 9, 8, 6.5, base, "shop");
    colliders.push(boxAABB(x, 42, 9, 8, 6.5));
    makeSign(scene, name, x, 6.85, 46.12, name.length > 6 ? 6.2 : 4.6, 0.72, "#08080c", neon, Math.PI);
  }
}

function placeDocks(scene: Scene, colliders: AABB[]) {
  const deck = MeshBuilder.CreateBox("pier", { width: 28, height: 0.4, depth: 22 }, scene);
  deck.position.set(43, 0.15, 78);
  deck.material = mat(scene, "#6a4a30");
  makeBuilding(scene, 44, 64, 18, 10, 7, "#4a4038", "warehouse");
  colliders.push(boxAABB(44, 64, 18, 10, 7));
  makeSign(scene, "DOCKS", 44, 7.3, 69.1, 5.4, 0.6, "#1a1008", "#ffc83d", Math.PI);

  makeContainer(scene, 34, 80, 0, "#ff8a3d", 0.15);
  makeContainer(scene, 34, 80, 2.2, "#2ef2d0", 0.08);
  makeContainer(scene, 38.6, 84, 0, "#ff4da6", -0.2);
  makeContainer(scene, 38.6, 84, 2.2, "#ff8a3d", -0.12);
  makeContainer(scene, 50, 86, 0, "#2a6a88", 1.2);
  makeCrane(scene, 54, 80);
  makeBoat(scene, 8, 88, "#2a4a58");
  makeBoat(scene, -28, 90, "#8a4030");

  const bollard = MeshBuilder.CreateCylinder("bol", { height: 0.9, diameter: 0.35, tessellation: 6 }, scene);
  bollard.position.set(56, 0.5, 86);
  bollard.material = mat(scene, "#2a2a2a");

  makeFence(scene, -20, 73.4, 36, 0);
  makeFence(scene, 8, 73.4, 22, 0);
}

function placePalmsAndLamps(scene: Scene) {
  const palms = [-70, -50, -36, -10, 6, 22, 38, 54, 70];
  for (const x of palms) {
    makePalm(scene, x, 25);
    makePalm(scene, x, 35);
  }
  for (const x of [-64, -40, -8, 16, 48, 72]) makePalm(scene, x, 70);
  const lamps: [number, number][] = [
    [-60, 30], [-20, 30], [20, 30], [60, 30],
    [-60, 0], [20, 0], [60, 60], [-20, 60],
    [14, 20], [-50, 42], [44, 72], [-26, 16],
  ];
  lamps.forEach(([x, z], i) => {
    makeLamp(scene, x, z, true);
    if (i < 8) {
      const pl = new PointLight("pl", new Vector3(x, 4.6, z), scene);
      pl.diffuse = new Color3(1, 0.78, 0.45);
      pl.intensity = 0.35;
      pl.range = 16;
    }
  });
}

function placeDressing(scene: Scene): { x: number; z: number }[] {
  makeDumpster(scene, -38, 37.4, 0.2);
  makeDumpster(scene, 8, 37.2, -0.1);
  makeDumpster(scene, 34, 37.5, 0.4);
  makeTrash(scene, -37, 36.2);
  makeTrash(scene, 9.2, 36.4);
  makeHydrant(scene, -56, 26);
  makeHydrant(scene, 16, 4);
  makeHydrant(scene, 24, 32);
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
  makeDecal(scene, "DOCK ST", -26, 1.2, 5.4, 1.1, 0, "#e8d8a0");
  makeDecal(scene, "STRIP", 0, 32.4, 4.6, 1.0, 0, "#ffc83d");
  return benches;
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
  if (doorZ === "pos") {
    const north2 = north;
    void north2;
  }
  return colliders;
}

function buildInteriors(scene: Scene): CityData["interiors"] {
  const martC = roomWalls(scene, INT.mart.ox, INT.mart.oz, 12, 10, 4.2, "#c8b898", "neg");
  const mf = MeshBuilder.CreateGround("if", { width: 11.6, height: 9.6 }, scene);
  mf.position.set(INT.mart.ox, 0.01, INT.mart.oz);
  mf.material = mat(scene, "#3a3028");
  const counter = MeshBuilder.CreateBox("cnt", { width: 3.4, height: 1.1, depth: 0.8 }, scene);
  counter.position.set(INT.mart.ox, 0.55, INT.mart.oz + 3);
  counter.material = mat(scene, "#5a4030");
  martC.push(boxAABB(INT.mart.ox, INT.mart.oz + 3, 3.4, 0.8, 1.1));
  for (let i = 0; i < 3; i++) {
    const aisle = MeshBuilder.CreateBox("ais", { width: 0.35, height: 1.6, depth: 4.2 }, scene);
    aisle.position.set(INT.mart.ox - 3 + i * 3, 0.8, INT.mart.oz - 0.4);
    aisle.material = mat(scene, "#2a3040");
    martC.push(boxAABB(INT.mart.ox - 3 + i * 3, INT.mart.oz - 0.4, 0.35, 4.2, 1.6));
  }
  makeSign(scene, "NOVA MART", INT.mart.ox, 3.4, INT.mart.oz + 4.7, 4.6, 0.5, "#1a1000", "#ffc83d", Math.PI);

  const garC = roomWalls(scene, INT.garage.ox, INT.garage.oz, 14, 12, 5, "#3a4044", "neg");
  const gf = MeshBuilder.CreateGround("ig", { width: 13.6, height: 11.6 }, scene);
  gf.position.set(INT.garage.ox, 0.01, INT.garage.oz);
  gf.material = mat(scene, "#2a2a2a");
  const lift = MeshBuilder.CreateBox("lift", { width: 3.2, height: 0.2, depth: 5.2 }, scene);
  lift.position.set(INT.garage.ox + 3.4, 0.12, INT.garage.oz);
  lift.material = mat(scene, "#4a4a40");
  makeSign(scene, "MAYA", INT.garage.ox, 4.2, INT.garage.oz + 5.7, 3.6, 0.5, "#041814", "#2ef2d0", Math.PI);

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
