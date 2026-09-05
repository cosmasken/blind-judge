import type {
  DAppConnectorWalletAPI,
  DAppConnectorWalletState,
  ServiceUriConfig,
} from "@midnight-ntwrk/dapp-connector-api";

// ---------------------------------------------------------------------------
// Lace Wallet Connector 内部型
// ---------------------------------------------------------------------------

/** Lace v4: connect() を直接持つコネクター */
export type LaceV4Connector = {
  connect: (networkId: string) => Promise<DAppConnectorWalletAPI>;
  getConfiguration?: () => Promise<Record<string, string>>;
};

/** Legacy Lace: enable() で API を取得するコネクター */
export type LaceLegacyConnector = {
  enable: () => Promise<DAppConnectorWalletAPI>;
};

// ---------------------------------------------------------------------------
// Wallet 接続結果
// ---------------------------------------------------------------------------

/** connectToWallet() の戻り値。ウォレット API・URI 設定・アドレス情報を含む */
export type WalletConnectionResult = {
  wallet: DAppConnectorWalletAPI;
  uris: ServiceUriConfig;
  state: DAppConnectorWalletState;
};

// ---------------------------------------------------------------------------
// WalletContext 関連
// ---------------------------------------------------------------------------

/**
 * ウォレット接続状態を表す判別共用体型。
 * status フィールドでナローイングして使う：
 *   "disconnected" → 未接続
 *   "connecting"   → 接続処理中（ボタン無効化などに利用）
 *   "connected"    → 接続済み（connection に API・アドレス・URI が入る）
 *   "error"        → 接続失敗（トースト表示後にこの状態になる）
 */
export type WalletState =
  | { status: "disconnected" }
  | { status: "connecting" }
  | { status: "connected"; connection: WalletConnectionResult }
  | { status: "error" };

export interface WalletContextValue {
  state: WalletState;
  connect: () => Promise<void>;
  disconnect: () => void;
}

// ---------------------------------------------------------------------------
// Balance 関連
// ---------------------------------------------------------------------------

/** 残高取得の非同期ステートマシン */
export type BalanceState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "loaded";
      shielded: string;
      unshielded: string;
      dust: string;
    }
  | { status: "error" };
