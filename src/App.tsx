import { useCallback, useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { GameView } from "./game/GameView";
import { bootAudio } from "./game/engine";
import { sharedSfx } from "./game/audio";
import type { ViceGame } from "./game/engine";
import { Input } from "./game/input";
import { emptyHud, type CharacterId, type HudState } from "./game/types";
import { HUD } from "./ui/HUD";
import { PauseMenu } from "./ui/PauseMenu";
import { TitleScreen } from "./ui/TitleScreen";
import { CharacterSelect } from "./ui/CharacterSelect";
import { TouchControls } from "./ui/TouchControls";
import { WalletProviders } from "./wallet/WalletProviders";

function detectMobile() {
  try {
    if (window.matchMedia("(pointer: coarse)").matches) return true;
    if (window.matchMedia("(hover: none)").matches && navigator.maxTouchPoints > 0) return true;
    if (navigator.maxTouchPoints > 0 && window.innerWidth < 900) return true;
  } catch { /* ignore */ }
  return false;
}

function Shell() {
  const { connected } = useWallet();
  const [playing, setPlaying] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [character, setCharacter] = useState<CharacterId>("ansem");
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [lookInvert, setLookInvert] = useState(() => {
    try { return localStorage.getItem("viceblock3d-look-invert") === "1"; } catch { return false; }
  });
  const [hud, setHud] = useState<HudState>(emptyHud);
  const [touch, setTouch] = useState(() => detectMobile());
  const inputRef = useRef(new Input());
  const gameRef = useRef<ViceGame | null>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (detectMobile()) input.showTouch = true;
    input.attach();
    const sync = () => setTouch(input.showTouch || detectMobile());
    sync();
    const id = window.setInterval(sync, 800);
    const stop = (e: Event) => e.preventDefault();
    document.addEventListener("gesturestart", stop, { passive: false } as AddEventListenerOptions);
    document.addEventListener("gesturechange", stop, { passive: false } as AddEventListenerOptions);
    document.addEventListener("gestureend", stop, { passive: false } as AddEventListenerOptions);
    const pinch = (e: TouchEvent) => { if (e.touches.length > 1) e.preventDefault(); };
    document.addEventListener("touchmove", pinch, { passive: false });
    return () => {
      window.clearInterval(id);
      input.detach();
      document.removeEventListener("gesturestart", stop);
      document.removeEventListener("gesturechange", stop);
      document.removeEventListener("gestureend", stop);
      document.removeEventListener("touchmove", pinch);
    };
  }, []);

  useEffect(() => {
    inputRef.current.lookInvert = lookInvert;
  }, [lookInvert]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!playing) return;
      if (e.key === "Escape") { e.preventDefault(); setPaused((p) => !p); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playing]);

  const onHud = useCallback((h: HudState) => setHud(h), []);

  const start = () => {
    bootAudio();
    setSelecting(true);
  };

  const pick = (id: CharacterId) => {
    bootAudio();
    inputRef.current.attach();
    setCharacter(id);
    setPaused(false);
    setSelecting(false);
    setPlaying(true);
  };

  const exitTitle = () => {
    setPlaying(false);
    setSelecting(false);
    setPaused(false);
    sharedSfx.stopEngine();
    sharedSfx.stopSiren();
  };

  return (
    <div className="app">
      {!playing && !selecting && <TitleScreen onPlay={start} />}
      {selecting && !playing && <CharacterSelect onPick={pick} />}
      {playing && (
        <>
          <div className="stage">
            <GameView input={inputRef.current} frozen={paused} muted={muted} character={character} onHud={onHud} gameRef={gameRef} />
          </div>
          <HUD hud={hud} onTapMusic={() => bootAudio()} />
          <TouchControls input={inputRef.current} hidden={!touch || paused} onPause={() => setPaused(true)} />
          {paused && (
            <PauseMenu
              muted={muted}
              lookInvert={lookInvert}
              onResume={() => setPaused(false)}
              onMute={() => setMuted((m) => !m)}
              onInvert={() => {
                setLookInvert((v) => {
                  const next = !v;
                  inputRef.current.lookInvert = next;
                  try { localStorage.setItem("viceblock3d-look-invert", next ? "1" : "0"); } catch { /* ignore */ }
                  return next;
                });
              }}
              onExit={exitTitle}
            />
          )}
        </>
      )}
      {connected && !playing && <span className="sr-only">wallet connected</span>}
    </div>
  );
}

export default function App() {
  return (
    <WalletProviders>
      <Shell />
    </WalletProviders>
  );
}
