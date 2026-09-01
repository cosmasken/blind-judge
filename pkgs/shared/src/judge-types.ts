import type { CompiledContract } from "@midnight-ntwrk/compact-js";
import type { DeployedContract, FoundContract } from "@midnight-ntwrk/midnight-js-contracts";
import type { AnyProvableCircuitId, MidnightProviders } from "@midnight-ntwrk/midnight-js-types";
import type { JudgePrivateState } from "contract";
import { JudgePrivateStateId } from "contract";

export { JudgePrivateStateId };

export type JudgeCircuits = AnyProvableCircuitId;

export type JudgeProviders = MidnightProviders<
  JudgeCircuits,
  typeof JudgePrivateStateId,
  JudgePrivateState
>;

export type JudgeContractInstance = CompiledContract.CompiledContract<
  // biome-ignore lint/suspicious/noExplicitAny: Judge.Contract generic not externally accessible
  any,
  JudgePrivateState
>;

export type DeployedJudgeContract =
  // biome-ignore lint/suspicious/noExplicitAny: see JudgeContractInstance
  | DeployedContract<any>
  // biome-ignore lint/suspicious/noExplicitAny: see JudgeContractInstance
  | FoundContract<any>;

export const JudgingState = { waiting: 0, committed: 1, finished: 2, cancelled: 3 } as const;
export type JudgingState = (typeof JudgingState)[keyof typeof JudgingState];
export const JUDGING_STATE_KEYS: readonly (keyof typeof JudgingState)[] = [
  "waiting", "committed", "finished", "cancelled",
];

export type JudgeLedgerState = {
  state: JudgingState;
  judging_over: boolean;
  organiser_key: Uint8Array;
  judge_count: number;
  judges_joined: number;
  judges_committed: number;
  judges_revealed: number;
  score_sum: bigint;
  final_score: number;
  // slots 0-4
  key0: Uint8Array; key1: Uint8Array; key2: Uint8Array; key3: Uint8Array; key4: Uint8Array;
  commit0: Uint8Array; commit1: Uint8Array; commit2: Uint8Array; commit3: Uint8Array; commit4: Uint8Array;
  score0: Uint8Array; score1: Uint8Array; score2: Uint8Array; score3: Uint8Array; score4: Uint8Array;
  revealed0: boolean; revealed1: boolean; revealed2: boolean; revealed3: boolean; revealed4: boolean;
};
