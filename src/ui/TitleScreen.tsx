import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

type Props = { onPlay: () => void };

export function TitleScreen({ onPlay }: Props) {
  return (
    <div className="title-scr">
      <div className="title-sky" />
      <div className="title-fg">
        <p className="title-kicker">NOVA CITY</p>
        <h1>VICEBLOCK</h1>
        <p className="title-sub">SOUTH DOCKS · 3D</p>
        <p className="title-tag">One pier. One strip. Dusk till the heat dies.</p>
        <button type="button" className="title-play" onClick={onPlay}>PLAY</button>
        <div className="title-wallet">
          <WalletMultiButton />
          <SignChip />
        </div>
        <p className="title-guest">Guest first. Wallet optional. Sign only — no transfer.</p>
      </div>
    </div>
  );
}

function SignChip() {
  const { publicKey, signMessage, connected } = useWallet();
  const [ok, setOk] = useState("");
  if (!connected || !publicKey) return null;
  return (
    <button
      type="button"
      className="sign-chip"
      onClick={async () => {
        if (!signMessage) return;
        const msg = new TextEncoder().encode("VICEBLOCK identity — no transfer");
        await signMessage(msg);
        setOk(publicKey.toBase58().slice(0, 4) + "…" + publicKey.toBase58().slice(-4));
      }}
    >
      {ok ? "SIGNED " + ok : "SIGN MESSAGE"}
    </button>
  );
}
