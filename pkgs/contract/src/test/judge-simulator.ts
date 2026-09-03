import {
  type CircuitContext,
  type ChargedState,
  type EncodedZswapLocalState,
  sampleContractAddress,
  createConstructorContext,
  createCircuitContext,
} from "@midnight-ntwrk/compact-runtime";
import {
  Contract,
  type Ledger,
  ledger,
  type Witnesses,
  JudgingState,
} from "../managed/judge/contract/index.js";
import { type JudgePrivateState, judgeWitnesses, encodeScore } from "../judge-witnesses.js";

export { JudgingState, encodeScore };

export class JudgeSimulator {
  private readonly contract: Contract<JudgePrivateState>;
  private j1PrivateState: JudgePrivateState;
  private j2PrivateState: JudgePrivateState;
  private j1ZswapState: EncodedZswapLocalState;
  private j2ZswapState: EncodedZswapLocalState;
  private sharedState: ChargedState;
  private readonly contractAddress = sampleContractAddress();

  constructor(
    j1SecretKey: Uint8Array = new Uint8Array(32).fill(1),
    j2SecretKey: Uint8Array = new Uint8Array(32).fill(2),
  ) {
    // biome-ignore lint/suspicious/noExplicitAny: witness type compat
    this.contract = new Contract<JudgePrivateState>(
      judgeWitnesses as unknown as Witnesses<JudgePrivateState>,
    );
    this.j1PrivateState = { secretKey: j1SecretKey, myScore: null, mySalt: null };
    this.j2PrivateState = { secretKey: j2SecretKey, myScore: null, mySalt: null };

    const j1Init = this.contract.initialState(
      createConstructorContext(this.j1PrivateState, "0".repeat(64)),
    );
    const j2Init = this.contract.initialState(
      createConstructorContext(this.j2PrivateState, "0".repeat(64)),
    );
    this.j1ZswapState = j1Init.currentZswapLocalState;
    this.j2ZswapState = j2Init.currentZswapLocalState;
    this.sharedState = j1Init.currentContractState.data;
  }

  getLedger(): Ledger { return ledger(this.sharedState); }

  private j1Ctx(ps: JudgePrivateState): CircuitContext<JudgePrivateState> {
    return createCircuitContext(this.contractAddress, this.j1ZswapState, this.sharedState, ps);
  }
  private j2Ctx(ps: JudgePrivateState): CircuitContext<JudgePrivateState> {
    return createCircuitContext(this.contractAddress, this.j2ZswapState, this.sharedState, ps);
  }

  j1Commit(score: number, salt: Uint8Array = new Uint8Array(32).fill(0xaa)): Ledger {
    const ps: JudgePrivateState = { ...this.j1PrivateState, myScore: encodeScore(score), mySalt: salt };
    const result = this.contract.impureCircuits.commit(this.j1Ctx(ps));
    this.j1PrivateState = result.context.currentPrivateState;
    this.j1ZswapState = result.context.currentZswapLocalState;
    this.sharedState = result.context.currentQueryContext.state;
    return ledger(this.sharedState);
  }

  j2Commit(score: number, salt: Uint8Array = new Uint8Array(32).fill(0xbb)): Ledger {
    const ps: JudgePrivateState = { ...this.j2PrivateState, myScore: encodeScore(score), mySalt: salt };
    const result = this.contract.impureCircuits.commit(this.j2Ctx(ps));
    this.j2PrivateState = result.context.currentPrivateState;
    this.j2ZswapState = result.context.currentZswapLocalState;
    this.sharedState = result.context.currentQueryContext.state;
    return ledger(this.sharedState);
  }

  j1Reveal(): Ledger {
    const result = this.contract.impureCircuits.reveal(this.j1Ctx(this.j1PrivateState));
    this.j1PrivateState = result.context.currentPrivateState;
    this.j1ZswapState = result.context.currentZswapLocalState;
    this.sharedState = result.context.currentQueryContext.state;
    return ledger(this.sharedState);
  }

  j2Reveal(): Ledger {
    const result = this.contract.impureCircuits.reveal(this.j2Ctx(this.j2PrivateState));
    this.j2PrivateState = result.context.currentPrivateState;
    this.j2ZswapState = result.context.currentZswapLocalState;
    this.sharedState = result.context.currentQueryContext.state;
    return ledger(this.sharedState);
  }
}
