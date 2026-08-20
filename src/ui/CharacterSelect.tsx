import { CHAR } from "../game/constants";
import type { CharacterId } from "../game/types";

type Props = { onPick: (id: CharacterId) => void };
const ORDER: CharacterId[] = ["ansem", "orangie", "cupsey"];

export function CharacterSelect({ onPick }: Props) {
  return (
    <div className="select-scr">
      <div className="select-fg">
        <p className="select-kicker">SOUTH DOCKS</p>
        <h2>WHO WALKS THE BLOCK</h2>
        <div className="select-grid">
          {ORDER.map((id) => {
            const def = CHAR[id];
            return (
              <button key={id} type="button" className={"char-card char-" + id} onClick={() => onPick(id)}>
                <CharFig id={id} />
                <b>{def.name}</b>
                <span>{def.kit}</span>
              </button>
            );
          })}
        </div>
        <p className="select-hint">Phone: left stick walk · right drag look · 🔫 shoot · 🚗 enter · ⬆ jump. Desktop: WASD · mouse look · Q/E · click shoot · F · V</p>
      </div>
    </div>
  );
}

function CharFig({ id }: { id: CharacterId }) {
  return (
    <i className={"char-fig fig-" + id} aria-hidden>
      <i className="cf-hair" />
      <i className="cf-head" />
      <i className="cf-ear" />
      <i className="cf-torso" />
      <i className="cf-arm l" />
      <i className="cf-arm r" />
      <i className="cf-legs" />
      <i className="cf-shoes" />
    </i>
  );
}
