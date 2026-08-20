type Props = {
  muted: boolean;
  lookInvert: boolean;
  onResume: () => void;
  onMute: () => void;
  onInvert: () => void;
  onExit: () => void;
};

export function PauseMenu({ muted, lookInvert, onResume, onMute, onInvert, onExit }: Props) {
  return (
    <div className="pause-scrim">
      <div className="pause-card">
        <h2>PAUSED</h2>
        <button type="button" onClick={onResume}>Resume</button>
        <button type="button" onClick={onMute}>{muted ? "Unmute" : "Mute"}</button>
        <button type="button" onClick={onInvert}>Look invert: {lookInvert ? "ON" : "OFF"}</button>
        <button type="button" className="ghost" onClick={onExit}>Exit to title</button>
        <p className="pause-hint">
          Desktop: WASD move, move mouse to look (no lock), Q/E turn, click shoot, F enter, Shift sprint, V melee.
          Phone: left stick walk, right drag look. Drag up looks up.
        </p>
      </div>
    </div>
  );
}
