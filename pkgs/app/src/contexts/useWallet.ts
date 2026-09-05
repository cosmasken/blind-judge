import type { WalletContextValue } from "@/utils/types";
import { useContext } from "react";
import { WalletContext } from "./walletContextDef";

/**
 * WalletContext にアクセスするカスタムフック。
 * WalletProvider の外で呼ばれた場合は即座にエラーを投げて誤用を防ぐ。
 */
export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}
