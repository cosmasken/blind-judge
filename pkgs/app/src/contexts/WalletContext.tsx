import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import i18next from "i18next";
import type React from "react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  connectToWallet,
  NetworkMismatchError,
  UserRejectedError,
  VersionMismatchError,
  WalletNotFoundError,
  WalletSyncingError,
  WalletTimeoutError,
} from "@/lib/wallet";
import { useNetwork } from "./useNetwork";
import { WalletContext, type WalletState } from "./walletContextDef";

/**
 * ウォレット接続状態を管理するコンテキストプロバイダー。
 *
 * connect():
 *   - 接続中は "connecting" 状態に設定し、ボタンを無効化する
 *   - 成功時は "connected" + WalletConnectionResult を保持
 *   - 失敗時はエラー種別に応じたトーストを表示。
 *     UserRejectedError のみ "disconnected" に戻す（ユーザー自身がキャンセルした場合）
 *
 * disconnect():
 *   - 状態を "disconnected" にリセットするだけ（ウォレット側のセッション破棄は不要）
 */
export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<WalletState>({ status: "disconnected" });
  const { networkId } = useNetwork();

  /**
   * ウォレットに接続する関数。接続中は状態を "connecting" にしてボタンを無効化。
   * 接続成功時は "connected" と接続結果を状態にセット。
   * 接続失敗時はエラーの種類に応じたトーストを表示し、UserRejectedError の場合は "disconnected" に戻す。
   * その他のエラーは "error" 状態にして、再度接続を試みることができるようにする。
   */
  const connect = useCallback(async () => {
    setState({ status: "connecting" });
    try {
      // NetworkContext で選択中のネットワークを SDK に反映してから接続する
      setNetworkId(networkId);
      const connection = await connectToWallet(networkId);
      setState({ status: "connected", connection });
    } catch (e: unknown) {
      // Always log the raw error so unclassified failures are diagnosable
      // from the console instead of only surfacing a generic toast.
      console.error("[wallet] connect() failed:", e);
      setState({ status: "error" });
      if (e instanceof WalletNotFoundError) {
        toast.error(e.message);
      } else if (e instanceof VersionMismatchError) {
        toast.error(e.message);
      } else if (e instanceof NetworkMismatchError) {
        toast.error(e.message);
      } else if (e instanceof UserRejectedError) {
        toast.warning(e.message);
        // ユーザー自身がキャンセルしたので error ではなく disconnected に戻す
        setState({ status: "disconnected" });
      } else if (e instanceof WalletTimeoutError) {
        toast.error(e.message);
      } else if (e instanceof WalletSyncingError) {
        toast.error(e.message);
      } else {
        toast.error(i18next.t("error.connectGeneric"));
      }
    }
  }, [networkId]);

  /**
   * ウォレットから切断する関数。状態を "disconnected" にリセットするだけで、ウォレット側のセッション破棄は不要。
   */
  const disconnect = useCallback(() => {
    setState({ status: "disconnected" });
  }, []);

  return (
    <WalletContext.Provider value={{ state, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  );
}
