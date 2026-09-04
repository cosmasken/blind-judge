import path from "node:path";
import { CompiledContract } from "@midnight-ntwrk/compact-js";
import type { ContractAddress } from "@midnight-ntwrk/compact-runtime";
import * as ledger from "@midnight-ntwrk/ledger-v8";
import { unshieldedToken } from "@midnight-ntwrk/ledger-v8";
import {
  deployContract,
  findDeployedContract,
} from "@midnight-ntwrk/midnight-js-contracts";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { levelPrivateStateProvider } from "@midnight-ntwrk/midnight-js-level-private-state-provider";
import { getNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { NodeZkConfigProvider } from "@midnight-ntwrk/midnight-js-node-zk-config-provider";
import type {
  FinalizedTxData,
  MidnightProvider,
  WalletProvider,
} from "@midnight-ntwrk/midnight-js-types";
import {
  assertIsContractAddress,
  toHex,
} from "@midnight-ntwrk/midnight-js-utils";
import {
  MidnightBech32m,
  ShieldedAddress,
  ShieldedCoinPublicKey,
  ShieldedEncryptionPublicKey,
} from "@midnight-ntwrk/wallet-sdk-address-format";
import { DustWallet } from "@midnight-ntwrk/wallet-sdk-dust-wallet";
import { WalletFacade } from "@midnight-ntwrk/wallet-sdk-facade";
import {
  generateRandomSeed,
  HDWallet,
  Roles,
} from "@midnight-ntwrk/wallet-sdk-hd";
import { ShieldedWallet } from "@midnight-ntwrk/wallet-sdk-shielded";
import {
  createKeystore,
  InMemoryTransactionHistoryStorage,
  PublicKey,
  type UnshieldedKeystore,
  UnshieldedWallet,
} from "@midnight-ntwrk/wallet-sdk-unshielded-wallet";
import { Buffer } from "buffer";
import {
  INITIAL_JUDGE_PRIVATE_STATE,
  Judge,
  type JudgePrivateState,
  judgeWitnesses,
  encodeScore,
} from "contract";
import fs from "node:fs";
import type { Logger } from "pino";
import * as Rx from "rxjs";
import {
  type DeployedJudgeContract,
  faucetUrlFor,
  type JudgeCircuits,
  type JudgeLedgerState,
  JudgePrivateStateId,
  type JudgeProviders,
} from "shared";
import { WebSocket } from "ws";
import { type Config, currentDir } from "./config";
import { DIVIDER } from "./constants";

let logger: Logger;

// biome-ignore lint/suspicious/noExplicitAny: WebSocket global for Node.js GraphQL subscriptions
(globalThis as any).WebSocket = WebSocket;

export interface WalletContext {
  wallet: WalletFacade;
  shieldedSecretKeys: ledger.ZswapSecretKeys;
  dustSecretKey: ledger.DustSecretKey;
  unshieldedKeystore: UnshieldedKeystore;
}

const signTransactionIntents = (
  tx: { intents?: Map<number, any> },
  signFn: (payload: Uint8Array) => ledger.Signature,
  proofMarker: "proof" | "pre-proof",
): void => {
  if (!tx.intents || tx.intents.size === 0) return;
  for (const segment of tx.intents.keys()) {
    const intent = tx.intents.get(segment);
    if (!intent) continue;
    const cloned = ledger.Intent.deserialize<
      ledger.SignatureEnabled,
      ledger.Proofish,
      ledger.PreBinding
    >("signature", proofMarker, "pre-binding", intent.serialize());
    const sigData = cloned.signatureData(segment);
    const signature = signFn(sigData);
    if (cloned.fallibleUnshieldedOffer) {
      const sigs = cloned.fallibleUnshieldedOffer.inputs.map(
        (_: ledger.UtxoSpend, i: number) =>
          cloned.fallibleUnshieldedOffer!.signatures.at(i) ?? signature,
      );
      cloned.fallibleUnshieldedOffer = cloned.fallibleUnshieldedOffer.addSignatures(sigs);
    }
    if (cloned.guaranteedUnshieldedOffer) {
      const sigs = cloned.guaranteedUnshieldedOffer.inputs.map(
        (_: ledger.UtxoSpend, i: number) =>
          cloned.guaranteedUnshieldedOffer!.signatures.at(i) ?? signature,
      );
      cloned.guaranteedUnshieldedOffer = cloned.guaranteedUnshieldedOffer.addSignatures(sigs);
    }
    tx.intents.set(segment, cloned);
  }
};

export const createWalletAndMidnightProvider = async (
  ctx: WalletContext,
): Promise<WalletProvider & MidnightProvider> => {
  const state = await Rx.firstValueFrom(
    ctx.wallet.state().pipe(Rx.filter((s) => s.isSynced)),
  );
  return {
    getCoinPublicKey() { return state.shielded.coinPublicKey.toHexString(); },
    getEncryptionPublicKey() { return state.shielded.encryptionPublicKey.toHexString(); },
    async balanceTx(tx, ttl?) {
      const recipe = await ctx.wallet.balanceUnboundTransaction(
        tx,
        { shieldedSecretKeys: ctx.shieldedSecretKeys, dustSecretKey: ctx.dustSecretKey },
        { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) },
      );
      const signFn = (payload: Uint8Array) => ctx.unshieldedKeystore.signData(payload);
      signTransactionIntents(recipe.baseTransaction, signFn, "proof");
      if (recipe.balancingTransaction) {
        signTransactionIntents(recipe.balancingTransaction, signFn, "pre-proof");
      }
      return ctx.wallet.finalizeRecipe(recipe);
    },
    submitTx(tx) { return ctx.wallet.submitTransaction(tx) as any; },
  };
};

export const waitForSync = (wallet: WalletFacade) =>
  Rx.firstValueFrom(
    wallet.state().pipe(Rx.throttleTime(5_000), Rx.filter((s) => s.isSynced)),
  );

export const waitForFunds = (wallet: WalletFacade): Promise<bigint> =>
  Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.throttleTime(10_000),
      Rx.filter((s) => s.isSynced),
      Rx.map((s) => s.unshielded.balances[unshieldedToken().raw] ?? 0n),
      Rx.filter((balance) => balance > 0n),
    ),
  );

const buildShieldedConfig = ({ indexer, indexerWS, node, proofServer }: Config) => ({
  networkId: getNetworkId(),
  indexerClientConnection: { indexerHttpUrl: indexer, indexerWsUrl: indexerWS, keepAlive: 0 },
  batchSize: 1000,
  provingServerUrl: new URL(proofServer),
  relayURL: new URL(node.replace(/^http/, "ws")),
});

const buildUnshieldedConfig = ({ indexer, indexerWS }: Config) => ({
  networkId: getNetworkId(),
  indexerClientConnection: { indexerHttpUrl: indexer, indexerWsUrl: indexerWS, keepAlive: 0 },
  txHistoryStorage: new InMemoryTransactionHistoryStorage(),
});

const buildDustConfig = ({ indexer, indexerWS, node, proofServer }: Config) => ({
  networkId: getNetworkId(),
  costParameters: { additionalFeeOverhead: 300_000_000_000_000n, feeBlocksMargin: 5 },
  indexerClientConnection: { indexerHttpUrl: indexer, indexerWsUrl: indexerWS, keepAlive: 0 },
  provingServerUrl: new URL(proofServer),
  relayURL: new URL(node.replace(/^http/, "ws")),
});

const walletCacheDir = (networkId: string, seed: string) =>
  path.resolve(currentDir, "..", "wallet-cache", networkId, seed.slice(0, 16));

const loadCachedState = (dir: string, name: string): string | null => {
  const p = path.join(dir, `${name}.json`);
  try { return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null; } catch { return null; }
};

const saveCachedState = (dir: string, name: string, data: string): void => {
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${name}.json`), data, "utf8");
  } catch { /* non-fatal */ }
};

const persistWalletState = async (wallet: WalletFacade, cacheDir: string): Promise<void> => {
  try {
    const [shielded, unshielded, dust] = await Promise.all([
      wallet.shielded.serializeState(),
      wallet.unshielded.serializeState(),
      wallet.dust.serializeState(),
    ]);
    saveCachedState(cacheDir, "shielded", shielded);
    saveCachedState(cacheDir, "unshielded", unshielded);
    saveCachedState(cacheDir, "dust", dust);
  } catch { /* non-fatal */ }
};

const deriveKeysFromSeed = (seed: string) => {
  const hdWallet = HDWallet.fromSeed(Buffer.from(seed, "hex"));
  if (hdWallet.type !== "seedOk") throw new Error("Failed to initialize HDWallet from seed");
  const derivationResult = hdWallet.hdWallet
    .selectAccount(0)
    .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
    .deriveKeysAt(0);
  if (derivationResult.type !== "keysDerived") throw new Error("Failed to derive keys");
  hdWallet.hdWallet.clear();
  return derivationResult.keys;
};

const formatBalance = (balance: bigint): string => balance.toLocaleString();

export const withStatus = async <T>(message: string, fn: () => Promise<T>): Promise<T> => {
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let i = 0;
  const interval = setInterval(() => {
    process.stdout.write(`\r  ${frames[i++ % frames.length]} ${message}`);
  }, 80);
  try {
    const result = await fn();
    clearInterval(interval);
    process.stdout.write(`\r  ✓ ${message}\n`);
    return result;
  } catch (e) {
    clearInterval(interval);
    process.stdout.write(`\r  ✗ ${message}\n`);
    throw e;
  }
};

const registerForDustGeneration = async (
  wallet: WalletFacade,
  unshieldedKeystore: UnshieldedKeystore,
): Promise<void> => {
  const state = await Rx.firstValueFrom(wallet.state().pipe(Rx.filter((s) => s.isSynced)));
  if (state.dust.availableCoins.length > 0) {
    const dustBal = state.dust.balance(new Date());
    console.log(`  ✓ Dust tokens already available (${formatBalance(dustBal)} DUST)`);
    return;
  }
  const nightUtxos = state.unshielded.availableCoins.filter(
    (coin: any) => coin.meta?.registeredForDustGeneration !== true,
  );
  if (nightUtxos.length === 0) {
    await withStatus("Waiting for dust tokens to generate", () =>
      Rx.firstValueFrom(
        wallet.state().pipe(
          Rx.throttleTime(5_000),
          Rx.filter((s) => s.isSynced),
          Rx.filter((s) => s.dust.balance(new Date()) > 0n),
        ),
      ),
    );
    return;
  }
  await withStatus(`Registering ${nightUtxos.length} NIGHT UTXO(s) for dust generation`, async () => {
    const recipe = await wallet.registerNightUtxosForDustGeneration(
      nightUtxos,
      unshieldedKeystore.getPublicKey(),
      (payload) => unshieldedKeystore.signData(payload),
    );
    const finalized = await wallet.finalizeRecipe(recipe);
    await wallet.submitTransaction(finalized);
  });
  await withStatus("Waiting for dust tokens to generate", () =>
    Rx.firstValueFrom(
      wallet.state().pipe(
        Rx.throttleTime(5_000),
        Rx.filter((s) => s.isSynced),
        Rx.filter((s) => s.dust.balance(new Date()) > 0n),
      ),
    ),
  );
};

const printWalletSummary = (state: any, unshieldedKeystore: UnshieldedKeystore) => {
  const networkId = getNetworkId();
  const unshieldedBalance = state.unshielded.balances[unshieldedToken().raw] ?? 0n;
  const coinPubKey = ShieldedCoinPublicKey.fromHexString(state.shielded.coinPublicKey.toHexString());
  const encPubKey = ShieldedEncryptionPublicKey.fromHexString(state.shielded.encryptionPublicKey.toHexString());
  const shieldedAddress = MidnightBech32m.encode(networkId, new ShieldedAddress(coinPubKey, encPubKey)).toString();
  console.log(`
${DIVIDER}
  Wallet Overview                            Network: ${networkId}
${DIVIDER}
  Shielded (ZSwap)
  └─ Address: ${shieldedAddress}
  Unshielded
  ├─ Address: ${unshieldedKeystore.getBech32Address()}
  └─ Balance: ${formatBalance(unshieldedBalance)} tNight
  Dust
  └─ Address: ${MidnightBech32m.encode(networkId, state.dust.address).toString()}
${DIVIDER}`);
};

export const buildWalletAndWaitForFunds = async (
  config: Config,
  seed: string,
): Promise<WalletContext> => {
  console.log("");
  const networkId = getNetworkId();
  const cacheDir = walletCacheDir(networkId, seed);

  const { wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore } =
    await withStatus("Building wallet", async () => {
      const keys = deriveKeysFromSeed(seed);
      const shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
      const dustSecretKey = ledger.DustSecretKey.fromSeed(keys[Roles.Dust]);
      const unshieldedKeystore = createKeystore(keys[Roles.NightExternal], networkId);
      const walletConfig = {
        ...buildShieldedConfig(config),
        ...buildUnshieldedConfig(config),
        ...buildDustConfig(config),
      };
      const shieldedCache = loadCachedState(cacheDir, "shielded");
      const unshieldedCache = loadCachedState(cacheDir, "unshielded");
      const dustCache = loadCachedState(cacheDir, "dust");
      const fromCache = shieldedCache && unshieldedCache && dustCache;
      const wallet = await WalletFacade.init({
        configuration: walletConfig,
        shielded: (cfg) =>
          fromCache ? ShieldedWallet(cfg).restore(shieldedCache) : ShieldedWallet(cfg).startWithSecretKeys(shieldedSecretKeys),
        unshielded: (cfg) =>
          fromCache ? UnshieldedWallet(cfg).restore(unshieldedCache) : UnshieldedWallet(cfg).startWithPublicKey(PublicKey.fromKeyStore(unshieldedKeystore)),
        dust: (cfg) =>
          fromCache ? DustWallet(cfg).restore(dustCache) : DustWallet(cfg).startWithSecretKey(dustSecretKey, ledger.LedgerParameters.initialParameters().dust),
      });
      await wallet.start(shieldedSecretKeys, dustSecretKey);
      return { wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore };
    });

  const faucet = faucetUrlFor(networkId);
  console.log(`
${DIVIDER}
  Wallet Overview                            Network: ${networkId}
${DIVIDER}
  Unshielded Address (send tNight here):
  ${unshieldedKeystore.getBech32Address()}
${faucet ? `\n  Fund your wallet: ${faucet}\n` : ""}${DIVIDER}
`);

  const syncedState = await withStatus("Syncing with network", () => waitForSync(wallet));
  await persistWalletState(wallet, cacheDir);
  printWalletSummary(syncedState, unshieldedKeystore);

  const balance = syncedState.unshielded.balances[unshieldedToken().raw] ?? 0n;
  if (balance === 0n) {
    const fundedBalance = await withStatus("Waiting for incoming tokens", () => waitForFunds(wallet));
    console.log(`    Balance: ${formatBalance(fundedBalance)} tNight\n`);
  }

  await registerForDustGeneration(wallet, unshieldedKeystore);
  return { wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore };
};

export const buildFreshWallet = async (config: Config): Promise<WalletContext> => {
  const seed = toHex(Buffer.from(generateRandomSeed()));
  console.log(`\n${DIVIDER}\n  New Wallet Seed — save this before continuing\n${DIVIDER}\n  ${seed}\n${DIVIDER}\n`);
  return await buildWalletAndWaitForFunds(config, seed);
};

export const getDustBalance = async (wallet: WalletFacade) => {
  const state = await Rx.firstValueFrom(wallet.state().pipe(Rx.filter((s) => s.isSynced)));
  const available = state.dust.balance(new Date());
  const availableCoins = state.dust.availableCoins.length;
  const pendingCoins = state.dust.pendingCoins.length;
  const pending = state.dust.pendingCoins.reduce((sum, c) => sum + c.initialValue, 0n);
  return { available, pending, availableCoins, pendingCoins };
};

export const monitorDustBalance = async (wallet: WalletFacade, stopSignal: Promise<void>): Promise<void> => {
  let stopped = false;
  void stopSignal.then(() => { stopped = true; });
  const sub = wallet.state().pipe(Rx.throttleTime(5_000), Rx.filter((s) => s.isSynced)).subscribe((state) => {
    if (stopped) return;
    const now = new Date();
    const available = state.dust.balance(now);
    const availableCoins = state.dust.availableCoins.length;
    const pendingCoins = state.dust.pendingCoins.length;
    const registeredNight = state.unshielded.availableCoins.filter((c: any) => c.meta?.registeredForDustGeneration === true).length;
    const totalNight = state.unshielded.availableCoins.length;
    let status = available > 0n ? "✓ ready to deploy" : availableCoins > 0 ? "accruing..." : registeredNight > 0 ? "waiting for generation..." : "no NIGHT registered";
    if (pendingCoins > 0 && availableCoins === 0) status = "⚠ locked by pending tx";
    console.log(`  [${now.toLocaleTimeString()}] DUST: ${formatBalance(available)} (${availableCoins} coins, ${pendingCoins} pending) | NIGHT: ${totalNight} UTXOs, ${registeredNight} registered | ${status}`);
  });
  await stopSignal;
  sub.unsubscribe();
};

export function setLogger(_logger: Logger) { logger = _logger; }

// ─── Judge Contract ───────────────────────────────────────────────────────────

const judgeContractConfig = {
  privateStateStoreName: "judge-private-state",
  zkConfigPath: path.resolve(currentDir, "..", "..", "contract", "src", "managed", "judge"),
};

// biome-ignore lint/suspicious/noExplicitAny: CompiledContract generics not externally accessible
const CC = CompiledContract as any;
const judgeCompiledContract = CC.make("judge", Judge.Contract).pipe(
  CC.withWitnesses(judgeWitnesses),
  CC.withCompiledFileAssets(judgeContractConfig.zkConfigPath),
);

export const configureJudgeProviders = async (
  ctx: WalletContext,
  config: Config,
  accountId?: string,
): Promise<JudgeProviders> => {
  const walletAndMidnightProvider = await createWalletAndMidnightProvider(ctx);
  const effectiveAccountId = accountId ?? walletAndMidnightProvider.getCoinPublicKey();
  const storagePassword = `${Buffer.from(effectiveAccountId, "hex").toString("base64")}!`;
  const zkConfigProvider = new NodeZkConfigProvider<JudgeCircuits>(judgeContractConfig.zkConfigPath);
  return {
    privateStateProvider: levelPrivateStateProvider<typeof JudgePrivateStateId>({
      privateStateStoreName: judgeContractConfig.privateStateStoreName,
      accountId: effectiveAccountId,
      privateStoragePasswordProvider: () => storagePassword,
    }),
    publicDataProvider: indexerPublicDataProvider(config.indexer, config.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(config.proofServer, zkConfigProvider),
    walletProvider: walletAndMidnightProvider,
    midnightProvider: walletAndMidnightProvider,
  };
};

export const deployJudge = async (
  providers: JudgeProviders,
  initialPrivateState: JudgePrivateState,
): Promise<DeployedJudgeContract> => {
  logger.info("Deploying BlindJudge contract...");
  const contract = await deployContract(providers, {
    compiledContract: judgeCompiledContract as any,
    privateStateId: JudgePrivateStateId,
    initialPrivateState,
    args: [] as any,
  });
  logger.info(`Deployed BlindJudge contract at: ${contract.deployTxData.public.contractAddress}`);
  return contract as unknown as DeployedJudgeContract;
};

export const joinJudge = async (
  providers: JudgeProviders,
  contractAddress: string,
): Promise<DeployedJudgeContract> => {
  assertIsContractAddress(contractAddress);
  logger.info(`Joining BlindJudge contract at: ${contractAddress}`);
  const contract = await findDeployedContract(providers, {
    contractAddress: contractAddress as any,
    compiledContract: judgeCompiledContract as any,
    privateStateId: JudgePrivateStateId,
    initialPrivateState: INITIAL_JUDGE_PRIVATE_STATE,
  });
  logger.info(`Joined BlindJudge contract at: ${contract.deployTxData.public.contractAddress}`);
  return contract as unknown as DeployedJudgeContract;
};

export const commitScore = async (
  providers: JudgeProviders,
  contract: DeployedJudgeContract,
  score: number,
): Promise<FinalizedTxData> => {
  logger.info(`Committing score ${score}...`);
  const salt = (globalThis as any).crypto.getRandomValues(new Uint8Array(32));
  const current = (await providers.privateStateProvider.get(JudgePrivateStateId)) ?? INITIAL_JUDGE_PRIVATE_STATE;
  await providers.privateStateProvider.set(JudgePrivateStateId, {
    ...current,
    myScore: encodeScore(score),
    mySalt: salt,
  });
  const finalizedTxData = await (contract as any).callTx.commit();
  logger.info(`Commit TX ${finalizedTxData.public.txId} added in block ${finalizedTxData.public.blockHeight}`);
  return finalizedTxData.public as FinalizedTxData;
};

export const revealScore = async (contract: DeployedJudgeContract): Promise<FinalizedTxData> => {
  logger.info("Revealing score...");
  const finalizedTxData = await (contract as any).callTx.reveal();
  logger.info(`Reveal TX ${finalizedTxData.public.txId} added in block ${finalizedTxData.public.blockHeight}`);
  return finalizedTxData.public as FinalizedTxData;
};

export const getJudgeState = async (
  providers: JudgeProviders,
  contractAddress: string,
): Promise<JudgeLedgerState | null> => {
  assertIsContractAddress(contractAddress);
  logger.info("Checking BlindJudge ledger state...");
  const state = await providers.publicDataProvider
    .queryContractState(contractAddress as any)
    .then((contractState) =>
      contractState != null
        ? (Judge.ledger(contractState.data as any) as unknown as JudgeLedgerState)
        : null,
    );
  logger.info(`Judge state: ${JSON.stringify(state, (_k, v) => (v instanceof Uint8Array ? `0x${Buffer.from(v).toString("hex").slice(0, 8)}...` : v))}`);
  return state;
};
