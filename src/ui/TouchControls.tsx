import { useEffect, useRef, useState } from "react";
import type { Input } from "../game/input";

type Props = {
  input: Input;
  hidden?: boolean;
  onPause: () => void;
  nearCar?: boolean;
  inCar?: boolean;
  canClimb?: boolean;
};

function hitOf(el: EventTarget | null): "stick" | "shoot" | "swing" | "zip" | "jump" | "enter" | "climb" | "look" | "pause" | "none" {
  const node = el as HTMLElement | null;
  const kind = node?.closest?.("[data-hit]")?.getAttribute("data-hit");
  if (
    kind === "stick" || kind === "shoot" || kind === "swing" || kind === "zip" ||
    kind === "jump" || kind === "enter" || kind === "climb" || kind === "look" || kind === "pause"
  ) {
    return kind;
  }
  return "none";
}

export function TouchControls({ input, hidden, onPause, nearCar, inCar, canClimb }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [, setTick] = useState(0);
  const bump = () => setTick((n) => n + 1);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const down = (e: PointerEvent) => {
      const hit = hitOf(e.target);
      if (hit === "pause") { e.preventDefault(); onPause(); return; }
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
        {(nearCar || inCar) && (
          <button type="button" className="pad-btn pad-bin" data-hit="enter" aria-label="Bin">{inCar ? "BİN" : "BİN"}</button>
        )}
        {canClimb && !inCar && (
          <button type="button" className="pad-btn pad-climb" data-hit="climb" aria-label="Tirman">TIRMAN</button>
        )}
      </div>
    </div>
  );
}
