import { formatBalance } from "@/lib/utils";
import type { BalanceState } from "@/utils/types";
import type { DAppConnectorWalletAPI } from "@midnight-ntwrk/dapp-connector-api";
import { useCallback, useState } from "react";

export type { BalanceState };

/**
 * ウォレット API から shielded / unshielded / dust 残高を並列取得する。
 *
 * Lace SDK の型定義には残高取得メソッドが含まれていないため、
 * unknown キャストで動的にメソッドの存在を確認してから呼び出す。
 * Promise.allSettled を使うことで、1 つが失敗しても残りの結果を受け取れる。
 */
async function fetchBalances(walletAPI: DAppConnectorWalletAPI): Promise<{
  shielded: string;
  unshielded: string;
  dust: string;
}> {
  const raw = walletAPI as unknown as Record<string, unknown>;

  // 並列で残高取得を試みる。存在しないメソッドは null を返す。
  const [shieldedResult, unshieldedResult, dustResult] =
    await Promise.allSettled([
      typeof raw.getShieldedBalances === "function"
        ? (raw.getShieldedBalances as () => Promise<unknown>)()
        : Promise.resolve(null),
      typeof raw.getUnshieldedBalances === "function"
        ? (raw.getUnshieldedBalances as () => Promise<unknown>)()
        : Promise.resolve(null),
      typeof raw.getDustBalance === "function"
        ? (raw.getDustBalance as () => Promise<unknown>)()
        : Promise.resolve(null),
    ]);

  return {
    shielded:
      shieldedResult.status === "fulfilled"
        ? formatBalance(shieldedResult.value)
        : "--",
    unshielded:
      unshieldedResult.status === "fulfilled"
        ? formatBalance(unshieldedResult.value)
        : "--",
    dust:
      dustResult.status === "fulfilled"
        ? formatBalance(dustResult.value)
        : "--",
  };
}

/**
 * 残高の取得・更新を管理するカスタムフック。
 *
 * @param walletAPI - 接続済みウォレット API。null の場合は何もしない
 * @returns balanceState: 現在の残高状態 / refresh: 手動更新トリガー関数
 */
export function useBalance(walletAPI: DAppConnectorWalletAPI | null) {
  const [balanceState, setBalanceState] = useState<BalanceState>({
    status: "idle",
  });

  /**
   * ウォレット API から残高を取得して状態を更新する関数。
   * walletAPI が null の場合は何もしない。
   * 取得中は status を "loading" に、成功したら "loaded" と残高をセット。
   * 失敗したら status を "error" にする。
   */
  const refresh = useCallback(async () => {
    if (!walletAPI) return;
    setBalanceState({ status: "loading" });
    try {
      const balances = await fetchBalances(walletAPI);
      setBalanceState({ status: "loaded", ...balances });
    } catch (e: unknown) {
      console.error("[useBalance] Failed to fetch balances:", e);
      setBalanceState({ status: "error" });
    }
  }, [walletAPI]);

  return { balanceState, refresh };
}
