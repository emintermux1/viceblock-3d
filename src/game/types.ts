export type CharacterId = "ansem" | "orangie" | "cupsey";
export type MissionId = "launch" | "crane" | "sweep" | "ghost" | "free";
export type PedState = "wander" | "flee" | "down" | "call" | "sit" | "wait" | "webbed";
export type MoveMode = "ground" | "air" | "swing" | "zip" | "crawl";
export type CopState = "chase" | "down" | "webbed";
export type InteriorId = "street" | "mart" | "garage" | "jail";
export type BuildingStyle = "tower" | "walkup" | "warehouse" | "shop";

export type HudState = {
  cash: number;
  stars: number;
  health: number;
  maxHealth: number;
  ammo: number;
  reserve: number;
  reloading: boolean;
  prompt: string;
  subtitle: string;
  inCar: boolean;
  missionTitle: string;
  missionHint: string;
  fade: number;
  busted: boolean;
  fps: number;
  character: CharacterId;
  radioLive: boolean;
  district: string;
  vehicleHp: number;
  mapX: number;
  mapZ: number;
  mapYaw: number;
  mapGoalX: number;
  mapGoalZ: number;
  mapCars: { x: number; z: number }[];
  searching: boolean;
  localSave: boolean;
  interior: InteriorId;
  mode: MoveMode;
  speed: number;
  canAttach: boolean;
  nearCar: boolean;
  canClimb: boolean;
};

export const emptyHud = (): HudState => ({
  cash: 0,
  stars: 0,
  health: 100,
  maxHealth: 100,
  ammo: 12,
  reserve: 36,
  reloading: false,
  prompt: "",
  subtitle: "",
  inCar: false,
  missionTitle: "",
  missionHint: "",
  fade: 0,
  busted: false,
  fps: 60,
  character: "ansem",
  radioLive: false,
  district: "South Docks",
  vehicleHp: 0,
  mapX: 0,
  mapZ: 0,
  mapYaw: 0,
  mapGoalX: 0,
  mapGoalZ: 0,
  mapCars: [],
  searching: false,
  localSave: false,
  interior: "street",
  mode: "ground",
  speed: 0,
  canAttach: false,
  nearCar: false,
  canClimb: false,
});

export type AABB = {
  minX: number;
  maxX: number;
  maxZ: number;
  minZ: number;
  minY: number;
  maxY: number;
};

export function aabbHit(a: AABB, b: AABB): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ && a.minY < b.maxY && a.maxY > b.minY;
}

export function pointInAABB(x: number, z: number, b: AABB, pad = 0): boolean {
  return x >= b.minX - pad && x <= b.maxX + pad && z >= b.minZ - pad && z <= b.maxZ + pad;
}
