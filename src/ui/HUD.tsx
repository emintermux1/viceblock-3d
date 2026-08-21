import { useEffect, useRef } from "react";
import type { HudState } from "../game/types";
import { LOC } from "../game/constants";

type Props = {
  hud: HudState;
  onTapMusic?: () => void;
  onSexAct?: (kind: "yat" | "sakso" | "seks") => void;
};

export function HUD({ hud, onTapMusic, onSexAct }: Props) {
  const live = hud.radioLive;
  return (
    <div className="hud" aria-hidden>
      <div className="hud-left">
        <div className="hud-bars">
          <span className="hud-hp-lab">HP</span>
          <i className="bar-track">
            <i className="bar health" style={{ width: (hud.health / Math.max(1, hud.maxHealth)) * 100 + "%" }} />
          </i>
        </div>
        <div className="hud-job">
          <b>{hud.missionTitle}</b>
          <span>{hud.missionHint}</span>
        </div>
        <div className={"hud-line" + (hud.canAttach ? " ready" : "")}>
          {hud.canAttach ? "SALIN READY" : hud.mode.toUpperCase()}
          <em>SPD {Math.round(hud.speed)}</em>
        </div>
      </div>
      <div className="hud-tr">
        {hud.localSave ? <div className="hud-save">LOCAL SAVE</div> : null}
        <button
          type="button"
          className={"hud-radio-chip" + (live ? " live" : " tap")}
          onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); onTapMusic?.(); }}
        >
          {live ? "NOVA CITY FM" : "TAP FOR MUSIC"}
        </button>
        <div className="hud-stars">
          {Array.from({ length: 5 }, (_, i) => (
            <span key={i} className={i < hud.stars ? "star on" : "star"}>★</span>
          ))}
        </div>
        {hud.searching ? <div className="hud-search">SEARCHING</div> : null}
      </div>
      <div className="hud-map"><MiniMap hud={hud} /></div>
      {hud.clubPing && hud.clubHint ? <div className="hud-club-ping">{hud.clubHint}</div> : null}
      {hud.sexTalk ? (
        <div className="hud-sex-talk">
          <b>{hud.sexTalk}</b>
          <i>{hud.sexTalkEn}</i>
        </div>
      ) : null}
      {hud.sexActs ? (
        <div className="hud-sex-acts">
          <button type="button" className={hud.sexKind === "yat" ? "on" : ""} onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); onSexAct?.("yat"); }}>1 YAT</button>
          <button type="button" className={hud.sexKind === "sakso" ? "on" : ""} onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); onSexAct?.("sakso"); }}>2 SAKSO</button>
          <button type="button" className={hud.sexKind === "seks" ? "on" : ""} onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); onSexAct?.("seks"); }}>3 SEKS</button>
        </div>
      ) : null}
      {hud.prompt ? <div className="hud-prompt">{hud.prompt}</div> : null}
      {hud.subtitle ? <div className="hud-sub">{hud.subtitle}</div> : null}
      {hud.busted ? <div className="hud-bust">BUSTED</div> : null}
    </div>
  );
}

function MiniMap({ hud }: { hud: HudState }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const S = 140;
    c.width = S;
    c.height = S;
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = "#0c1018";
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2);
    ctx.clip();

    const yaw = hud.mapYaw;
    const scale = 1.15;
    const to = (wx: number, wz: number) => {
      const dx = wx - hud.mapX;
      const dz = wz - hud.mapZ;
      const cs = Math.cos(-yaw);
      const sn = Math.sin(-yaw);
      const rx = dx * cs - dz * sn;
      const rz = dx * sn + dz * cs;
      return { x: S / 2 + rx * scale, y: S / 2 - rz * scale };
    };

    const waterA = to(-90, 74);
    const waterB = to(90, 94);
    ctx.fillStyle = "#163040";
    ctx.fillRect(Math.min(waterA.x, waterB.x), Math.min(waterA.y, waterB.y), Math.abs(waterB.x - waterA.x), Math.abs(waterB.y - waterA.y));

    ctx.strokeStyle = "#2a3038";
    ctx.lineWidth = 3.2;
    const ns = [-60, -20, 20, 60];
    const ew = [-40, 0, 30, 60];
    for (const x of ns) {
      const a = to(x, -70);
      const b = to(x, 90);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    for (const z of ew) {
      const a = to(-90, z);
      const b = to(90, z);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    const pip = (x: number, z: number, col: string, r = 4) => {
      const p = to(x, z);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    };
    pip(LOC.garage.x, LOC.garage.z, "#2ef2d0", 4);
    pip(LOC.mart.x, LOC.mart.z, "#ffc83d", 4);
    pip(LOC.club.x, LOC.club.z, "#ff4da6", hud.clubPing ? 6 : 4);
    for (const car of hud.mapCars) pip(car.x, car.z, "#c8d0d4", 2.2);
    if (Math.abs(hud.mapGoalX) < 200) pip(hud.mapGoalX, hud.mapGoalZ, "#ffc83d", 5);

    ctx.fillStyle = "#efe6d0";
    ctx.beginPath();
    ctx.moveTo(S / 2, S / 2 - 7);
    ctx.lineTo(S / 2 - 5, S / 2 + 6);
    ctx.lineTo(S / 2 + 5, S / 2 + 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = "rgba(255,200,61,0.45)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S / 2 - 1.5, 0, Math.PI * 2);
    ctx.stroke();
  }, [hud.mapX, hud.mapZ, hud.mapYaw, hud.mapGoalX, hud.mapGoalZ, hud.mapCars, hud.clubPing]);

  return (
    <div className="hud-minimap">
      <canvas ref={ref} width={140} height={140} />
      <span>SOUTH DOCKS</span>
    </div>
  );
}
