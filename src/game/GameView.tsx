import { useEffect, useRef, type MutableRefObject } from "react";
import { bootAudio, ViceGame } from "./engine";
import type { Input } from "./input";
import type { CharacterId, HudState } from "./types";

type Props = {
  input: Input;
  character: CharacterId;
  frozen: boolean;
  muted: boolean;
  onHud: (h: HudState) => void;
  gameRef: MutableRefObject<ViceGame | null>;
};

export function GameView({ input, character, frozen, muted, onHud, gameRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hudKey = useRef("");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = new ViceGame(canvas, input, character);
    gameRef.current = game;
    canvas.focus();
    if (!input.showTouch) void canvas.requestPointerLock?.().catch(() => undefined);
    const id = window.setInterval(() => {
      onHud(game.hud());
    }, 80);
    return () => {
      window.clearInterval(id);
      game.dispose();
      gameRef.current = null;
    };
  }, [character, input, onHud, gameRef]);

  useEffect(() => { gameRef.current?.setPaused(frozen); }, [frozen, gameRef]);
  useEffect(() => { gameRef.current?.setMuted(muted); }, [muted, gameRef]);

  return <canvas ref={canvasRef} className="game-canvas" tabIndex={0} />;
}
