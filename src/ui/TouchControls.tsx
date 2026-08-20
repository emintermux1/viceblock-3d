import { useEffect, useRef, useState } from "react";
import type { Input } from "../game/input";

type Props = { input: Input; hidden?: boolean; inCar?: boolean; onPause: () => void };

function hitOf(el: EventTarget | null): "stick" | "shoot" | "enter" | "jump" | "sprint" | "brake" | "look" | "reload" | "melee" | "pause" | "none" {
  const node = el as HTMLElement | null;
  const kind = node?.closest?.("[data-hit]")?.getAttribute("data-hit");
  if (
    kind === "stick" || kind === "shoot" || kind === "enter" || kind === "jump" ||
    kind === "sprint" || kind === "brake" || kind === "look" || kind === "pause" ||
    kind === "reload" || kind === "melee"
  ) return kind;
  return "none";
}

export function TouchControls({ input, hidden, inCar, onPause }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [, setTick] = useState(0);
  const bump = () => setTick((n) => n + 1);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const down = (e: PointerEvent) => {
      const hit = hitOf(e.target);
      if (hit === "pause") { e.preventDefault(); onPause(); return; }
      if (hit === "shoot" || hit === "enter" || hit === "jump" || hit === "sprint" || hit === "brake" || hit === "reload" || hit === "melee") {
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
        <button type="button" className="pad-btn pad-reload" data-hit="reload" aria-label="Reload">R</button>
        <button type="button" className="pad-btn pad-melee" data-hit="melee" aria-label="Melee">V</button>
        <button type="button" className="pad-btn pad-sprint" data-hit="sprint" aria-label="Sprint">SPR</button>
        {!inCar && <button type="button" className="pad-btn pad-jump" data-hit="jump" aria-label="Jump">⬆</button>}
        {inCar && <button type="button" className="pad-btn pad-brake" data-hit="brake" aria-label="Brake">🛑</button>}
        <button type="button" className="pad-btn pad-enter" data-hit="enter" aria-label="Enter vehicle">🚗</button>
        <button type="button" className="pad-btn pad-shoot" data-hit="shoot" aria-label="Shoot">🔫</button>
      </div>
    </div>
  );
}
