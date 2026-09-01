/**
 * Public testnets this dApp can target. `pkgs/cli` and `pkgs/app` both read
 * their indexer/node/faucet URLs from {@link MIDNIGHT_NETWORK_ENDPOINTS} so the
 * two front-ends can never drift apart on which endpoint a network points to.
 */
export type MidnightNetworkId = "preprod" | "preview";

export const MIDNIGHT_NETWORK_IDS: readonly MidnightNetworkId[] = [
  "preprod",
  "preview",
];

export interface MidnightNetworkEndpoints {
  readonly indexer: string;
  readonly indexerWS: string;
  readonly node: string;
  readonly faucetUrl: string;
}

/** Default local proof server URL used by both the CLI and the app's dev-server proxy. */
export const DEFAULT_PROOF_SERVER_URL = "http://127.0.0.1:6300";

export const MIDNIGHT_NETWORK_ENDPOINTS: Record<
  MidnightNetworkId,
  MidnightNetworkEndpoints
> = {
  preprod: {
    indexer: "https://indexer.preprod.midnight.network/api/v3/graphql",
    indexerWS: "wss://indexer.preprod.midnight.network/api/v3/graphql/ws",
    node: "https://rpc.preprod.midnight.network",
    faucetUrl: "https://faucet.preprod.midnight.network/",
  },
  preview: {
    indexer: "https://indexer.preview.midnight.network/api/v3/graphql",
    indexerWS: "wss://indexer.preview.midnight.network/api/v3/graphql/ws",
    node: "https://rpc.preview.midnight.network",
    faucetUrl: "https://faucet.preview.midnight.network/",
  },
};

/** Faucet URL for a network, or undefined for networks without one (e.g. standalone). */
export const faucetUrlFor = (networkId: string): string | undefined =>
  (MIDNIGHT_NETWORK_ENDPOINTS as Record<string, MidnightNetworkEndpoints>)[
    networkId
  ]?.faucetUrl;
