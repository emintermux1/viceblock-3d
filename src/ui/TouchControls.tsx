import { useEffect, useRef, useState } from "react";
import type { Input } from "../game/input";

type Hit =
  | "stick" | "shoot" | "swing" | "zip" | "jump" | "enter" | "climb" | "look" | "pause"
  | "yat" | "sakso" | "seks" | "none";

type Props = {
  input: Input;
  hidden?: boolean;
  onPause: () => void;
  nearCar?: boolean;
  nearDoor?: boolean;
  inCar?: boolean;
  canClimb?: boolean;
  nearDance?: boolean;
  inDance?: boolean;
  nearSex?: boolean;
  inSex?: boolean;
  sexActs?: boolean;
  sexKind?: string;
  enterVerb?: string;
};

function hitOf(el: EventTarget | null): Hit {
  const node = el as HTMLElement | null;
  const kind = node?.closest?.("[data-hit]")?.getAttribute("data-hit");
  switch (kind) {
    case "stick":
    case "shoot":
    case "swing":
    case "zip":
    case "jump":
    case "enter":
    case "climb":
    case "look":
    case "pause":
    case "yat":
    case "sakso":
    case "seks":
      return kind;
    default:
      return "none";
  }
}

export function TouchControls({
  input, hidden, onPause, nearCar, nearDoor, inCar, canClimb, nearDance, inDance,
  nearSex, inSex, sexActs, sexKind, enterVerb,
}: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [, setTick] = useState(0);
  const bump = () => setTick((n) => n + 1);
  const showActs = !!(sexActs || nearSex || inSex) && !inCar;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const down = (e: PointerEvent) => {
      const hit = hitOf(e.target);
      if (hit === "pause") { e.preventDefault(); onPause(); return; }
      if (hit === "yat" || hit === "sakso" || hit === "seks") {
        e.preventDefault();
        e.stopPropagation();
        input.queueAct(hit);
        bump();
        return;
      }
      if (hit === "shoot" || hit === "swing" || hit === "zip" || hit === "jump" || hit === "enter" || hit === "climb") {
        e.preventDefault();
        input.onPointerDown(e, hit);
        bump();
        return;
      }
      if (hit === "look" || e.clientX >= window.innerWidth * 0.48) {
        e.preventDefault();
        input.onPointerDown(e, "look");
        bump();
        return;
      }
      if (hit === "stick" || e.clientX < window.innerWidth * 0.48) {
        e.preventDefault();
        input.onPointerDown(e, "stick");
        bump();
      }
    };
    const move = (e: PointerEvent) => {
      input.onPointerMove(e);
      bump();
    };
    const up = (e: PointerEvent) => { input.onPointerUp(e); bump(); };
    const blur = () => { input.clearStick(); bump(); };
    root.addEventListener("pointerdown", down, { passive: false });
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    window.addEventListener("blur", blur);
    return () => {
      root.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("blur", blur);
    };
  }, [input, onPause]);

  if (hidden) return null;
  return (
    <div ref={rootRef} className="touch-layer" aria-hidden>
      <div className="touch-left" data-hit="stick">
        {input.stickActive && (
          <>
            <i className="stick-base" style={{ left: input.stickBaseX, top: input.stickBaseY }} />
            <i className="stick-knob" style={{ left: input.stickKnobX, top: input.stickKnobY }} />
          </>
        )}
      </div>
      <div className="touch-look" data-hit="look" />
      <div className="touch-right">
        <button type="button" className="pad-btn pad-pause" data-hit="pause" aria-label="Pause">II</button>
        {!inCar && <button type="button" className="pad-btn pad-jump" data-hit="jump" aria-label="Jump">⬆</button>}
        {!inCar && <button type="button" className="pad-btn pad-zip" data-hit="zip" aria-label="Zip">ZIP</button>}
        {!inCar && <button type="button" className="pad-btn pad-swing" data-hit="swing" aria-label="Salin">SALIN</button>}
        {!inCar && <button type="button" className="pad-btn pad-shoot" data-hit="shoot" aria-label="Ates">ATEŞ</button>}
        {(nearCar || inCar || nearDoor || nearDance || inDance || nearSex || inSex) && (
          <button type="button" className="pad-btn pad-bin" data-hit="enter" aria-label={enterVerb || "Gir"}>
            {enterVerb || (inDance ? "ÇIK" : nearDance ? "DANS" : inCar ? "BİN" : nearDoor && !nearCar ? "GİR" : "BİN")}
          </button>
        )}
        {canClimb && !inCar && (
          <button type="button" className={"pad-btn pad-climb" + (showActs ? " up" : "")} data-hit="climb" aria-label="Tirman">TIRMAN</button>
        )}
        {showActs && (
          <div className="pad-sex-col">
            <button type="button" className={"pad-btn pad-sex" + (sexKind === "yat" ? " on" : "")} data-hit="yat" aria-label="Yat">YAT</button>
            <button type="button" className={"pad-btn pad-sex pad-sakso" + (sexKind === "sakso" ? " on" : "")} data-hit="sakso" aria-label="Sakso">SAKSO</button>
            <button type="button" className={"pad-btn pad-sex" + (sexKind === "seks" ? " on" : "")} data-hit="seks" aria-label="Seks">SEKS</button>
          </div>
        )}
      </div>
    </div>
  );
}
