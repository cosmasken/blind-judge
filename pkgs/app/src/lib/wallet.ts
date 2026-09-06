import type {
  DAppConnectorAPI,
  DAppConnectorWalletAPI,
  ServiceUriConfig,
} from "@midnight-ntwrk/dapp-connector-api";
import i18next from "i18next";
import { filter, firstValueFrom, interval, map, take, timeout } from "rxjs";
import semver from "semver";
import {
  COMPATIBLE_CONNECTOR_VERSION,
  DETECT_TIMEOUT_MS,
  POLL_INTERVAL_MS,
} from "@/utils/constants";
import { NETWORKS, type NetworkId } from "@/utils/networks";
import type {
  LaceLegacyConnector,
  LaceV4Connector,
  WalletConnectionResult,
} from "@/utils/types";

export class WalletNotFoundError extends Error {
  constructor() {
    super(i18next.t("error.walletNotFound"));
    this.name = "WalletNotFoundError";
  }
}

export class VersionMismatchError extends Error {
  constructor(version: string) {
    super(i18next.t("error.versionMismatch", { version }));
    this.name = "VersionMismatchError";
  }
}

export class NetworkMismatchError extends Error {
  constructor(networkLabel: string) {
    super(i18next.t("error.networkMismatch", { network: networkLabel }));
    this.name = "NetworkMismatchError";
  }
}

export class UserRejectedError extends Error {
  constructor() {
    super(i18next.t("error.userRejected"));
    this.name = "UserRejectedError";
  }
}

export class WalletTimeoutError extends Error {
  constructor() {
    super(i18next.t("error.walletTimeout"));
    this.name = "WalletTimeoutError";
  }
}

export class WalletSyncingError extends Error {
  constructor() {
    super(i18next.t("error.walletSyncing"));
    this.name = "WalletSyncingError";
  }
}

/**
 * window.midnight.mnLace が注入されるまで 100ms ポーリングで待機する。
 * mnLace が見つからない場合は、apiVersion プロパティを持つ任意のキーを探す（旧命名規則対応）。
 * DETECT_TIMEOUT_MS 以内に見つからなければ WalletNotFoundError を投げる。
 */
function detectConnectorAPI(): Promise<DAppConnectorAPI> {
  return firstValueFrom(
    interval(POLL_INTERVAL_MS).pipe(
      map(() => {
        const midnight = (
          globalThis.window as unknown as Record<string, unknown>
        )?.midnight as Record<string, unknown> | undefined;
        if (!midnight) return null;
        if (midnight.mnLace) return midnight.mnLace as DAppConnectorAPI;
        return (
          (Object.values(midnight).find(
            (v) =>
              typeof (v as Record<string, unknown>)?.apiVersion === "string",
          ) as DAppConnectorAPI | undefined) ?? null
        );
      }),
      filter((api): api is DAppConnectorAPI => api !== null),
      take(1),
      timeout({ first: DETECT_TIMEOUT_MS }),
    ),
  ).catch(() => {
    throw new WalletNotFoundError();
  });
}

/**
 * Lace v4 API (connect() 方式) でウォレットに接続する。
 * ユーザーが選択した networkId のみを指定して接続を試みる(dAppがLaceのネットワークを
 * 強制的に変えることはできないため、Lace側が同じネットワークでなければ失敗する)。
 * 接続後に getConfiguration() から Indexer / Proof Server の URI を取得する。
 */
async function connectViaV4(
  connector: LaceV4Connector,
  networkId: NetworkId,
): Promise<WalletConnectionResult> {
  const fallbackUris = NETWORKS[networkId].fallbackUris;
  let walletAPI: DAppConnectorWalletAPI | null = null;
  let uris: ServiceUriConfig = fallbackUris;

  try {
    walletAPI = await connector.connect(networkId);
    // Lace v4: getConfiguration() is on walletAPI (not connector)
    const walletRaw = walletAPI as unknown as Record<string, unknown>;

    if (typeof walletRaw.getConfiguration === "function") {
      const cfg = (await (
        walletRaw.getConfiguration as () => Promise<Record<string, string>>
      )()) as Record<string, string>;
      uris = {
        indexerUri: cfg.indexerUri ?? cfg.indexerUrl ?? fallbackUris.indexerUri,
        indexerWsUri:
          cfg.indexerWsUri ?? cfg.indexerWsUrl ?? fallbackUris.indexerWsUri,
        proverServerUri:
          cfg.proverServerUri ??
          cfg.proofServerUri ??
          fallbackUris.proverServerUri,
        substrateNodeUri:
          cfg.substrateNodeUri ?? cfg.nodeUri ?? fallbackUris.substrateNodeUri,
      };
    }
  } catch (e: unknown) {
    const lowerMsg = String(
      (e as Record<string, unknown>)?.message ?? e,
    ).toLowerCase();
    if (lowerMsg.includes("rejected") || lowerMsg.includes("cancel")) {
      throw new UserRejectedError();
    }
    if (lowerMsg.includes("sync")) {
      throw new WalletSyncingError();
    }
    throw new NetworkMismatchError(NETWORKS[networkId].label);
  }

  // Lace v4: state() does not exist — use getShieldedAddresses() instead
  const walletRaw = walletAPI as unknown as Record<string, unknown>;
  let address = "";
  let coinPublicKey = "";
  let encryptionPublicKey = "";

  if (typeof walletRaw.getShieldedAddresses === "function") {
    try {
      // getShieldedAddresses() may return an array (old versions) or a single object (new versions), so handle both cases
      const result = await (
        walletRaw.getShieldedAddresses as () => Promise<
          Record<string, unknown>
        >
      )();
      // Lace v4 returns a single object (not array):
      // { shieldedAddress, shieldedCoinPublicKey, shieldedEncryptionPublicKey }
      const entry = (Array.isArray(result) ? result[0] : result) as
        | Record<string, unknown>
        | undefined;
      if (entry) {
        address = String(entry.shieldedAddress ?? entry.address ?? "");
        coinPublicKey = String(
          entry.shieldedCoinPublicKey ?? entry.coinPublicKey ?? "",
        );
        encryptionPublicKey = String(
          entry.shieldedEncryptionPublicKey ?? entry.encryptionPublicKey ?? "",
        );
      }
    } catch (e: unknown) {
      // Previously unguarded: a failure here fell through as an unclassified
      // error with no logging, so the root cause never reached the console.
      console.error("[wallet] getShieldedAddresses() failed:", e);
      const lowerMsg = String(
        (e as Record<string, unknown>)?.message ?? e,
      ).toLowerCase();
      if (lowerMsg.includes("sync")) {
        throw new WalletSyncingError();
      }
      throw e;
    }
  }

  const state = {
    address,
    coinPublicKey,
    encryptionPublicKey,
    addressLegacy: "",
    coinPublicKeyLegacy: "",
    encryptionPublicKeyLegacy: "",
  };
  return { wallet: walletAPI, uris, state };
}

/**
 * Lace Wallet への接続エントリーポイント。
 *
 * 処理フロー:
 * 1. window.midnight.mnLace を検出（ポーリング）
 * 2. apiVersion を semver で互換性チェック
 * 3. connect() があれば Lace v4 方式で接続
 * 4. enable() があれば Legacy 方式で接続
 *
 * @param networkId 接続を要求するネットワーク(preprod/preview)。Lace側が別ネットワークに
 *                  設定されている場合は NetworkMismatchError になる。
 * @throws WalletNotFoundError   - ウォレット拡張機能が未インストール
 * @throws VersionMismatchError  - API バージョンが非互換
 * @throws NetworkMismatchError  - Lace が指定ネットワークに接続できなかった
 * @throws UserRejectedError     - ユーザーが接続を拒否
 * @throws WalletTimeoutError    - 接続タイムアウト
 */
export async function connectToWallet(
  networkId: NetworkId,
): Promise<WalletConnectionResult> {
  // 1. window.midnight.mnLace を検出（ポーリング）
  const connectorAPI = await detectConnectorAPI();

  if (
    !semver.satisfies(connectorAPI.apiVersion, COMPATIBLE_CONNECTOR_VERSION)
  ) {
    throw new VersionMismatchError(connectorAPI.apiVersion);
  }

  const raw = connectorAPI as unknown as Record<string, unknown>;

  // Lace v4: connect() directly on the connector (no enable() step)
  if (typeof raw.connect === "function") {
    return connectViaV4(connectorAPI as unknown as LaceV4Connector, networkId);
  }

  // Legacy: enable() first, then optional connect()
  if (typeof raw.enable !== "function") {
    throw new Error(i18next.t("error.unsupportedApi"));
  }

  try {
    const legacyConnector = connectorAPI as unknown as LaceLegacyConnector;
    const enabledAPI = await legacyConnector.enable();
    const enabledRaw = enabledAPI as unknown as Record<string, unknown>;

    // Some legacy versions expose connect() on the enabled API
    if (typeof enabledRaw.connect === "function") {
      return connectViaV4(enabledAPI as unknown as LaceV4Connector, networkId);
    }

    // Legacy API has no network selection — assume it matches the requested network
    const state = await enabledAPI.state();
    return {
      wallet: enabledAPI,
      uris: NETWORKS[networkId].fallbackUris,
      state,
    };
  } catch (e: unknown) {
    const msg = String((e as Record<string, unknown>)?.message ?? e);
    if (
      msg.toLowerCase().includes("rejected") ||
      msg.toLowerCase().includes("cancel")
    ) {
      throw new UserRejectedError();
    }
    throw e;
  }
}
