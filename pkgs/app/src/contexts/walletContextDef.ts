import type {
  WalletConnectionResult,
  WalletContextValue,
  WalletState,
} from "@/utils/types";
import { createContext } from "react";

export type { WalletConnectionResult, WalletContextValue, WalletState };

// null をデフォルト値にし、Provider 外での誤用を useWallet() の guard で検出する
export const WalletContext = createContext<WalletContextValue | null>(null);
