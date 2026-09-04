import { stdin as input, stdout as output } from "node:process";
import { createInterface, type Interface } from "node:readline/promises";
import type { Logger } from "pino";
import type { DeployedJudgeContract, JudgeProviders } from "shared";
import { JUDGING_STATE_KEYS } from "shared";
import type { DockerComposeEnvironment, StartedDockerComposeEnvironment } from "testcontainers";
import type { WalletContext } from "./api";
import * as api from "./api";
import { type Config, StandaloneConfig } from "./config";
import { DIVIDER, GENESIS_MINT_WALLET_SEED } from "./constants";
import { mapContainerPort } from "./docker-utils";

let logger: Logger;

const BANNER = `
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║              BlindJudge                                      ║
║              ──────────                                      ║
║              Tamper-proof hackathon judging on Midnight      ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`;

const WALLET_MENU = `
${DIVIDER}
  Wallet Setup
${DIVIDER}
  [1] Create a new wallet
  [2] Restore wallet from seed
  [3] Exit
${"─".repeat(62)}
> `;

const buildWalletFromSeed = async (config: Config, rli: Interface): Promise<WalletContext> => {
  const seed = await rli.question("Enter your wallet seed: ");
  return await api.buildWalletAndWaitForFunds(config, seed);
};

const buildWallet = async (config: Config, rli: Interface): Promise<WalletContext | null> => {
  if (config instanceof StandaloneConfig) {
    return await api.buildWalletAndWaitForFunds(config, GENESIS_MINT_WALLET_SEED);
  }
  while (true) {
    const choice = await rli.question(WALLET_MENU);
    switch (choice.trim()) {
      case "1": return await api.buildFreshWallet(config);
      case "2": return await buildWalletFromSeed(config, rli);
      case "3": return null;
      default: logger.error(`Invalid choice: ${choice}`);
    }
  }
};

const getDustLabel = async (wallet: api.WalletContext["wallet"]): Promise<string> => {
  try {
    const dust = await api.getDustBalance(wallet);
    return dust.available.toLocaleString();
  } catch { return ""; }
};

const startDustMonitor = async (wallet: api.WalletContext["wallet"], rli: Interface): Promise<void> => {
  console.log("");
  const stopPromise = rli.question("  Press Enter to return to menu...\n").then(() => {});
  await api.monitorDustBalance(wallet, stopPromise);
  console.log("");
};

const judgeContractMenu = (dustBalance: string) => `
${DIVIDER}
  BlindJudge Contract Setup${dustBalance ? `          DUST: ${dustBalance}` : ""}
${DIVIDER}
  [1] Deploy a new BlindJudge contract
  [2] Join an existing BlindJudge contract
  [3] Monitor DUST balance
  [4] Exit
${"─".repeat(62)}
> `;

const judgeActionsMenu = (address: string, dustBalance: string) => `
${DIVIDER}
  BlindJudge Actions${dustBalance ? `                  DUST: ${dustBalance}` : ""}
  Contract: ${address}
${DIVIDER}
  [1] Commit my score
  [2] Reveal my score
  [3] Show judging state
  [4] Exit
${"─".repeat(62)}
> `;

const selectScore = async (rli: Interface): Promise<number | null> => {
  while (true) {
    const input = await rli.question(`\n${DIVIDER}\n  Enter your score (1-10)\n${DIVIDER}\n> `);
    const n = parseInt(input.trim(), 10);
    if (!isNaN(n) && n >= 1 && n <= 10) return n;
    console.log("  Invalid score. Please enter a number between 1 and 10.");
  }
};

const deployOrJoinJudge = async (
  providers: JudgeProviders,
  walletCtx: api.WalletContext,
  rli: Interface,
): Promise<DeployedJudgeContract | null> => {
  while (true) {
    const dustLabel = await getDustLabel(walletCtx.wallet);
    const choice = await rli.question(judgeContractMenu(dustLabel));
    switch (choice.trim()) {
      case "1":
        try {
          const contract = await api.withStatus("Deploying BlindJudge contract", () =>
            api.deployJudge(providers, {
              secretKey: (globalThis as any).crypto.getRandomValues(new Uint8Array(32)),
              myScore: null,
              mySalt: null,
            }),
          );
          console.log(`  Contract deployed at: ${(contract as any).deployTxData.public.contractAddress}\n`);
          return contract;
        } catch (e) {
          console.log(`\n  ✗ Deploy failed: ${e instanceof Error ? e.message : String(e)}\n`);
        }
        break;
      case "2":
        try {
          const contractAddress = await rli.question("Enter the BlindJudge contract address (hex): ");
          const contract = await api.withStatus("Joining BlindJudge contract", () =>
            api.joinJudge(providers, contractAddress.trim()),
          );
          console.log(`  Joined contract at: ${(contract as any).deployTxData.public.contractAddress}\n`);
          return contract;
        } catch (e) {
          console.log(`  ✗ Failed to join: ${e instanceof Error ? e.message : String(e)}\n`);
        }
        break;
      case "3": await startDustMonitor(walletCtx.wallet, rli); break;
      case "4": return null;
      default: console.log(`  Invalid choice: ${choice}`);
    }
  }
};

const judgeMainLoop = async (
  providers: JudgeProviders,
  walletCtx: api.WalletContext,
  rli: Interface,
): Promise<void> => {
  const judgeContract = await deployOrJoinJudge(providers, walletCtx, rli);
  if (judgeContract === null) return;

  const contractAddress: string = (judgeContract as any).deployTxData.public.contractAddress;

  while (true) {
    const dustLabel = await getDustLabel(walletCtx.wallet);
    const choice = await rli.question(judgeActionsMenu(contractAddress, dustLabel));
    switch (choice.trim()) {
      case "1": {
        const score = await selectScore(rli);
        if (score === null) break;
        try {
          await api.withStatus(`Committing score (${score}/10) — generating ZK proof`, () =>
            api.commitScore(providers, judgeContract, score),
          );
        } catch (e) {
          console.log(`  ✗ Commit failed: ${e instanceof Error ? e.message : String(e)}\n`);
        }
        break;
      }
      case "2":
        try {
          await api.withStatus("Revealing score — generating ZK proof", () =>
            api.revealScore(judgeContract),
          );
        } catch (e) {
          console.log(`  ✗ Reveal failed: ${e instanceof Error ? e.message : String(e)}\n`);
        }
        break;
      case "3":
        try {
          const state = await api.getJudgeState(providers, contractAddress);
          if (state == null) {
            console.log("  No state found at this contract address.\n");
          } else {
            const slots = [0,1,2,3,4].slice(0, state.judge_count);
            const judgeLines = slots.map(i => {
              const revealed = state[`revealed${i}` as keyof typeof state] as boolean;
              const score = state[`score${i}` as keyof typeof state] as Uint8Array;
              return `  Judge ${i+1}:        ${revealed ? `revealed — score: ${score[31]}` : state.judges_committed > i ? "committed" : state.judges_joined > i ? "joined" : "waiting"}`;
            }).join("\n");
            console.log(`
  Judging State:  ${JUDGING_STATE_KEYS[state.state] ?? state.state}
  Judges:         ${state.judges_joined}/${state.judge_count} joined, ${state.judges_committed}/${state.judge_count} committed, ${state.judges_revealed}/${state.judge_count} revealed
${judgeLines}
  Final Score:    ${state.judging_over ? state.final_score : "(pending)"}
`);
          }
        } catch (e) {
          console.log(`  ✗ Failed to get state: ${e instanceof Error ? e.message : String(e)}\n`);
        }
        break;
      case "4": return;
      default: console.log(`  Invalid choice: ${choice}`);
    }
  }
};

export const run = async (
  config: Config,
  _logger: Logger,
  dockerEnv?: DockerComposeEnvironment,
): Promise<void> => {
  logger = _logger;
  api.setLogger(_logger);
  console.log(BANNER);

  const rli = createInterface({ input, output, terminal: true });
  let env: StartedDockerComposeEnvironment | undefined;

  try {
    if (dockerEnv !== undefined) {
      env = await dockerEnv.up();
      if (config instanceof StandaloneConfig) {
        config.indexer = mapContainerPort(env, config.indexer, "judge-indexer");
        config.indexerWS = mapContainerPort(env, config.indexerWS, "judge-indexer");
        config.node = mapContainerPort(env, config.node, "judge-node");
        config.proofServer = mapContainerPort(env, config.proofServer, "judge-proof-server");
      }
    }

    const walletCtx = await buildWallet(config, rli);
    if (walletCtx === null) return;

    try {
      const providers = await api.withStatus("Configuring BlindJudge providers", () =>
        api.configureJudgeProviders(walletCtx, config),
      );
      console.log("");
      await judgeMainLoop(providers, walletCtx, rli);
    } catch (e) {
      if (e instanceof Error) { logger.error(`Error: ${e.message}`); logger.debug(`${e.stack}`); }
      else throw e;
    } finally {
      try { await walletCtx.wallet.stop(); } catch (e) { logger.error(`Error stopping wallet: ${e}`); }
    }
  } finally {
    rli.close();
    rli.removeAllListeners();
    if (env !== undefined) {
      try { await env.down(); } catch (e) { logger.error(`Error shutting down docker: ${e}`); }
    }
    logger.info("Goodbye.");
  }
};
