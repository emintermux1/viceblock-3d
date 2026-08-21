import { CHAR } from "../game/constants";
import type { CharacterId } from "../game/types";

type Props = { onPick: (id: CharacterId) => void };
const ORDER: CharacterId[] = ["ansem", "orangie", "cupsey"];

export function CharacterSelect({ onPick }: Props) {
  return (
    <div className="select-scr">
      <div className="select-fg">
        <p className="select-kicker">SOUTH DOCKS</p>
        <h2>WHO TAKES THE LINE</h2>
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
        <p className="select-hint">Phone: left stick · right look · SALIN / ZIP / ATEŞ · TIRMAN · tap BİN. Desktop: WASD · mouse look · hold F SALIN · E ZIP · C TIRMAN · click ATEŞ · tap F BİN near a car · Space jump</p>
      </div>
    </div>
  );
}

function CharFig({ id }: { id: CharacterId }) {
  return (
    <i className={"char-fig fig-" + id} aria-hidden>
      <i className="cf-cowl" />
      <i className="cf-helm" />
      <i className="cf-visor" />
      <i className="cf-torso" />
      <i className="cf-web" />
      <i className="cf-arm l" />
      <i className="cf-arm r" />
      <i className="cf-legs" />
      <i className="cf-shoes" />
    </i>
  );
}
