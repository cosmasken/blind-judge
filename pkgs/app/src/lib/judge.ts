import * as CompactJs from "@midnight-ntwrk/compact-js";
import type { ContractAddress } from "@midnight-ntwrk/compact-runtime";
import {
  deployContract,
  findDeployedContract,
} from "@midnight-ntwrk/midnight-js-contracts";
import { assertIsContractAddress, toHex } from "@midnight-ntwrk/midnight-js-utils";
import { INITIAL_JUDGE_PRIVATE_STATE, Judge, judgeWitnesses, encodeScore } from "contract";
import * as Rx from "rxjs";
import type {
  DeployedJudgeContract,
  JudgeContractInstance,
  JudgeLedgerState,
  JudgeProviders,
} from "./judge-types";
import { JudgePrivateStateId } from "./judge-types";

// biome-ignore lint/suspicious/noExplicitAny: Judge.Contract generic not externally accessible
const _judgeBase = CompactJs.CompiledContract.make("judge", Judge.Contract as any) as any;
export const judgeContractInstance: JudgeContractInstance =
  // biome-ignore lint/suspicious/noExplicitAny: bypass TS6 never-assignability
  (CompactJs.CompiledContract.withWitnesses as any)(
    _judgeBase,
    judgeWitnesses,
  ) as unknown as JudgeContractInstance;

export const joinJudgeContract = async (
  providers: JudgeProviders,
  contractAddress: string,
): Promise<DeployedJudgeContract> => {
  return findDeployedContract(providers, {
    compiledContract: judgeContractInstance as any,
    contractAddress: contractAddress as ContractAddress,
    privateStateId: JudgePrivateStateId,
    initialPrivateState: INITIAL_JUDGE_PRIVATE_STATE,
  }) as unknown as Promise<DeployedJudgeContract>;
};

export const deployJudgeContract = async (
  providers: JudgeProviders,
  organiserPk: Uint8Array,
  judgeCount: number,
): Promise<DeployedJudgeContract> => {
  const contract = await deployContract(providers, {
    compiledContract: judgeContractInstance as any,
    privateStateId: JudgePrivateStateId,
    initialPrivateState: INITIAL_JUDGE_PRIVATE_STATE,
    args: [],
  }) as unknown as DeployedJudgeContract;
  // biome-ignore lint/suspicious/noExplicitAny: see commitScore
  await (contract as any).callTx.initialize(organiserPk, judgeCount);
  return contract;
};

export const setMyScore = async (
  providers: JudgeProviders,
  score: number,
): Promise<void> => {
  const current = (await providers.privateStateProvider.get(JudgePrivateStateId)) ?? INITIAL_JUDGE_PRIVATE_STATE;
  const salt = current.mySalt ?? crypto.getRandomValues(new Uint8Array(32));
  await providers.privateStateProvider.set(JudgePrivateStateId, {
    ...current,
    myScore: encodeScore(score),
    mySalt: salt,
  });
};

export const getMyPublicKeyHex = async (providers: JudgeProviders): Promise<string> => {
  const current = (await providers.privateStateProvider.get(JudgePrivateStateId)) ?? INITIAL_JUDGE_PRIVATE_STATE;
  return toHex(Judge.pureCircuits.derive_pk(current.secretKey));
};

export const clearPrivateState = async (providers: JudgeProviders): Promise<void> => {
  const current = (await providers.privateStateProvider.get(JudgePrivateStateId)) ?? INITIAL_JUDGE_PRIVATE_STATE;
  await providers.privateStateProvider.set(JudgePrivateStateId, {
    ...current,
    myScore: null,
    mySalt: null,
  });
};

export const commitScore = async (contract: DeployedJudgeContract): Promise<void> => {
  // biome-ignore lint/suspicious/noExplicitAny: DeployedJudgeContract uses AnyProvableCircuitId
  await (contract as any).callTx.commit();
};

export const revealScore = async (contract: DeployedJudgeContract): Promise<void> => {
  // biome-ignore lint/suspicious/noExplicitAny: see commitScore
  await (contract as any).callTx.reveal();
};

export const registerJudge = async (contract: DeployedJudgeContract, judgePk: Uint8Array): Promise<void> => {
  // biome-ignore lint/suspicious/noExplicitAny: see commitScore
  await (contract as any).callTx.register_judge(judgePk);
};

export const cancelJudging = async (contract: DeployedJudgeContract): Promise<void> => {
  // biome-ignore lint/suspicious/noExplicitAny: see commitScore
  await (contract as any).callTx.cancel();
};

export const getJudgeLedgerState = async (
  providers: JudgeProviders,
  contractAddress: ContractAddress,
): Promise<JudgeLedgerState | null> => {
  assertIsContractAddress(contractAddress);
  const contractState = await providers.publicDataProvider.queryContractState(contractAddress);
  return contractState != null
    ? // biome-ignore lint/suspicious/noExplicitAny: StateValue/ChargedState union not re-exported
      (Judge.ledger(contractState.data as any) as unknown as JudgeLedgerState)
    : null;
};

export const subscribeToJudgeState = (
  providers: JudgeProviders,
  contractAddress: ContractAddress,
): Rx.Observable<JudgeLedgerState> => {
  return providers.publicDataProvider
    .contractStateObservable(contractAddress, { type: "latest" })
    .pipe(
      Rx.map(
        (contractState) =>
          // biome-ignore lint/suspicious/noExplicitAny: see getJudgeLedgerState
          Judge.ledger(contractState.data as any) as unknown as JudgeLedgerState,
      ),
    );
};
