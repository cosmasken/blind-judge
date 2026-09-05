import type React from "react";
import { useCallback, useState } from "react";
import {
  DEFAULT_NETWORK_ID,
  NETWORK_STORAGE_KEY,
  type NetworkId,
} from "@/utils/networks";
import { NetworkContext } from "./networkContextDef";

function loadStoredNetworkId(): NetworkId {
  const stored = localStorage.getItem(NETWORK_STORAGE_KEY);
  return stored === "preprod" || stored === "preview"
    ? stored
    : DEFAULT_NETWORK_ID;
}

/**
 * ユーザーが選択したネットワーク(preprod/preview)を管理するコンテキストプロバイダー。
 * 選択は localStorage に永続化し、次回起動時に復元する。
 * WalletProvider より外側に配置し、接続前にネットワークを確定できるようにする。
 */
export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [networkId, setNetworkIdState] =
    useState<NetworkId>(loadStoredNetworkId);

  const setNetworkId = useCallback((id: NetworkId) => {
    setNetworkIdState(id);
    localStorage.setItem(NETWORK_STORAGE_KEY, id);
  }, []);

  return (
    <NetworkContext.Provider value={{ networkId, setNetworkId }}>
      {children}
    </NetworkContext.Provider>
  );
}
