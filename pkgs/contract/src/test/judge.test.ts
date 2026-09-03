import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { describe, expect, it } from "vitest";
import { JudgingState, JudgeSimulator, encodeScore } from "./judge-simulator.js";

setNetworkId("undeployed");

const J1_KEY = new Uint8Array(32).fill(1);
const J2_KEY = new Uint8Array(32).fill(2);
const SALT_A = new Uint8Array(32).fill(0xaa);
const SALT_B = new Uint8Array(32).fill(0xbb);

describe("BlindJudge smart contract", () => {
  it("starts in waiting state with no judges joined", () => {
    const sim = new JudgeSimulator(J1_KEY, J2_KEY);
    const l = sim.getLedger();
    expect(l.state).toBe(JudgingState.waiting);
    expect(l.judging_over).toBe(false);
    expect(l.j1_joined).toBe(false);
    expect(l.j2_joined).toBe(false);
  });

  it("state transitions: waiting → committed → finished", () => {
    const sim = new JudgeSimulator(J1_KEY, J2_KEY);
    sim.j1Commit(8, SALT_A);
    expect(sim.getLedger().state).toBe(JudgingState.waiting);
    expect(sim.getLedger().j1_joined).toBe(true);

    sim.j2Commit(6, SALT_B);
    expect(sim.getLedger().state).toBe(JudgingState.committed);
    expect(sim.getLedger().j2_joined).toBe(true);

    sim.j1Reveal();
    expect(sim.getLedger().j1_revealed).toBe(true);

    sim.j2Reveal();
    expect(sim.getLedger().state).toBe(JudgingState.finished);
    expect(sim.getLedger().judging_over).toBe(true);
  });

  it("commitment is binding: same score + salt → same hash", () => {
    const sim1 = new JudgeSimulator(J1_KEY, J2_KEY);
    sim1.j1Commit(7, SALT_A);
    const hash1 = Buffer.from(sim1.getLedger().j1_commit).toString("hex");

    const sim2 = new JudgeSimulator(J1_KEY, J2_KEY);
    sim2.j1Commit(7, SALT_A);
    const hash2 = Buffer.from(sim2.getLedger().j1_commit).toString("hex");

    expect(hash1).toBe(hash2);
  });

  it("commitment is hiding: same score + different salt → different hash", () => {
    const sim1 = new JudgeSimulator(J1_KEY, J2_KEY);
    sim1.j1Commit(7, SALT_A);
    const hash1 = Buffer.from(sim1.getLedger().j1_commit).toString("hex");

    const sim2 = new JudgeSimulator(J1_KEY, J2_KEY);
    sim2.j1Commit(7, SALT_B);
    const hash2 = Buffer.from(sim2.getLedger().j1_commit).toString("hex");

    expect(hash1).not.toBe(hash2);
  });

  it("rejects a third commit after both judges committed", () => {
    const sim = new JudgeSimulator(J1_KEY, J2_KEY);
    sim.j1Commit(8, SALT_A);
    sim.j2Commit(6, SALT_B);
    expect(() => sim.j1Commit(5, SALT_A)).toThrow();
  });

  it("rejects double reveal from same judge", () => {
    const sim = new JudgeSimulator(J1_KEY, J2_KEY);
    sim.j1Commit(8, SALT_A);
    sim.j2Commit(6, SALT_B);
    sim.j1Reveal();
    expect(() => sim.j1Reveal()).toThrow();
  });

  it("encodeScore round-trips correctly", () => {
    for (const n of [1, 5, 7, 10]) {
      const encoded = encodeScore(n);
      expect(encoded[31]).toBe(n);
    }
  });
});
