import { useContext } from "react";
import { NetworkContext, type NetworkContextValue } from "./networkContextDef";

/**
 * NetworkContext にアクセスするカスタムフック。
 * NetworkProvider の外で呼ばれた場合は即座にエラーを投げて誤用を防ぐ。
 */
export function useNetwork(): NetworkContextValue {
  const ctx = useContext(NetworkContext);
  if (!ctx) throw new Error("useNetwork must be used inside NetworkProvider");
  return ctx;
}
