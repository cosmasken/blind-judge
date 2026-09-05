import type { ServiceUriConfig } from "@midnight-ntwrk/dapp-connector-api";
import {
  DEFAULT_PROOF_SERVER_URL,
  MIDNIGHT_NETWORK_ENDPOINTS,
  type MidnightNetworkId,
} from "shared";

/** フロントエンドが対応するネットワーク */
export type NetworkId = MidnightNetworkId;

/** ユーザーが選択可能なネットワークの表示順 */
export const NETWORK_IDS: readonly NetworkId[] = ["preview"];

/** ネットワーク選択の localStorage キー */
export const NETWORK_STORAGE_KEY = "network";

/** ユーザーが明示的に選択しなかった場合の既定ネットワーク */
export const DEFAULT_NETWORK_ID: NetworkId = "preview";

export interface NetworkDefinition {
  /** UI表示ラベル */
  label: string;
  /** テストネット用フォーセットURL */
  faucetUrl: string;
  /**
   * ウォレットの getConfiguration() が使えない場合のフォールバックURI。
   * pkgs/shared/src/network-config.ts (pkgs/cli と共有) と同じエンドポイントに揃えてある。
   */
  fallbackUris: ServiceUriConfig;
}

const NETWORK_LABELS: Record<NetworkId, string> = {
  preprod: "PreProd Testnet",
  preview: "Preview Testnet",
};

export const NETWORKS: Record<NetworkId, NetworkDefinition> =
  Object.fromEntries(
    NETWORK_IDS.map((networkId) => {
      const endpoints = MIDNIGHT_NETWORK_ENDPOINTS[networkId];
      const definition: NetworkDefinition = {
        label: NETWORK_LABELS[networkId],
        faucetUrl: endpoints.faucetUrl,
        fallbackUris: {
          indexerUri: endpoints.indexer,
          indexerWsUri: endpoints.indexerWS,
          proverServerUri: DEFAULT_PROOF_SERVER_URL,
          substrateNodeUri: endpoints.node,
        },
      };
      return [networkId, definition];
    }),
  ) as Record<NetworkId, NetworkDefinition>;
