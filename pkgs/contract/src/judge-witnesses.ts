export const JudgePrivateStateId = "judgePrivateState" as const;

export type JudgePrivateState = {
  readonly secretKey: Uint8Array;
  readonly myScore: Uint8Array | null;
  readonly mySalt: Uint8Array | null;
};

type WebCrypto = { getRandomValues<T extends Uint8Array>(array: T): T };
// biome-ignore lint/suspicious/noExplicitAny: cross-env Web Crypto API
const _crypto: WebCrypto = (globalThis as unknown as { crypto: WebCrypto }).crypto;

export const INITIAL_JUDGE_PRIVATE_STATE: JudgePrivateState = {
  secretKey: _crypto.getRandomValues(new Uint8Array(32)),
  myScore: null,
  mySalt: null,
};

type WitnessCtx = { readonly privateState: JudgePrivateState };

export const judgeWitnesses = {
  local_secret_key: (ctx: WitnessCtx): [JudgePrivateState, Uint8Array] => [
    ctx.privateState,
    ctx.privateState.secretKey,
  ],

  get_my_score: (ctx: WitnessCtx): [JudgePrivateState, Uint8Array] => {
    const { myScore } = ctx.privateState;
    if (myScore === null) throw new Error("Score not set: call setScore() before commit()");
    return [ctx.privateState, myScore];
  },

  get_my_salt: (ctx: WitnessCtx): [JudgePrivateState, Uint8Array] => {
    const { mySalt } = ctx.privateState;
    if (mySalt === null) throw new Error("Salt not set: call setScore() before commit()");
    return [ctx.privateState, mySalt];
  },

  store_score_and_salt: (
    ctx: WitnessCtx,
    s_0: Uint8Array,
    salt_0: Uint8Array,
  ): [JudgePrivateState, []] => [
    { ...ctx.privateState, myScore: s_0, mySalt: salt_0 },
    [],
  ],

  compute_average: (
    ctx: WitnessCtx,
    sum: bigint,
    count: number,
  ): [JudgePrivateState, number] => [
    ctx.privateState,
    count === 0 ? 0 : Math.round(Number(sum) / count),
  ],
};

/** Encode a 1–10 integer score as Bytes<32> for the contract. */
export const encodeScore = (score: number): Uint8Array => {
  const b = new Uint8Array(32);
  b[31] = score;
  return b;
};

/** Decode Bytes<32> back to a 1–10 integer. */
export const decodeScore = (bytes: Uint8Array): number => bytes[31];
