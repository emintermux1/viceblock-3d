import { useMemo, type ReactNode, type FC } from "react";
import type { Adapter } from "@solana/wallet-adapter-base";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl } from "@solana/web3.js";

type Props = { children: ReactNode };

const Conn = ConnectionProvider as unknown as FC<{ endpoint: string; children?: ReactNode }>;
const WProv = WalletProvider as unknown as FC<{
  wallets: Adapter[];
  autoConnect?: boolean;
  children?: ReactNode;
}>;
const Modal = WalletModalProvider as unknown as FC<{ children?: ReactNode }>;

export function WalletProviders({ children }: Props) {
  const endpoint = useMemo(() => clusterApiUrl("mainnet-beta"), []);
  const wallets = useMemo<Adapter[]>(() => [], []);

  return (
    <Conn endpoint={endpoint}>
      <WProv wallets={wallets} autoConnect={false}>
        <Modal>{children}</Modal>
      </WProv>
    </Conn>
  );
}
