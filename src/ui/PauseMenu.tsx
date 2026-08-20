type Props = { muted: boolean; onResume: () => void; onMute: () => void; onExit: () => void };

export function PauseMenu({ muted, onResume, onMute, onExit }: Props) {
  return (
    <div className="pause-scrim">
      <div className="pause-card">
        <h2>PAUSED</h2>
        <button type="button" onClick={onResume}>Resume</button>
        <button type="button" onClick={onMute}>{muted ? "Unmute" : "Mute"}</button>
        <button type="button" className="ghost" onClick={onExit}>Exit to title</button>
      </div>
    </div>
  );
}
