import type { ContractAddress } from "@midnight-ntwrk/compact-runtime";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Subscription } from "rxjs";
import { useNetwork } from "@/contexts/useNetwork";
import { useWallet } from "@/contexts/useWallet";
import { createJudgeProviders } from "@/lib/providers";
import {
  clearPrivateState,
  commitScore,
  getMyPublicKeyHex,
  joinJudgeContract,
  revealScore,
  setMyScore,
  subscribeToJudgeState,
} from "@/lib/judge";
import type { DeployedJudgeContract, JudgeLedgerState } from "@/lib/judge-types";
import { JudgingState } from "@/lib/judge-types";

const DEFAULT_CONTRACT_ADDRESS = "1024410d2e7c74fd0224bd22b23fa089d3bcf4bb9ce5a42156faac4871ee2b66";

const contractAddressStorageKey = (networkId: string) => `judge-contract-address:${networkId}`;
const judgeNameStorageKey = () => "judge-name";

const getInitialContract = (networkId: string): string => {
  const params = new URLSearchParams(window.location.search);
  return params.get("contract") ?? localStorage.getItem(contractAddressStorageKey(networkId)) ?? DEFAULT_CONTRACT_ADDRESS;
};

const getInitialJudgeName = (): string => {
  const params = new URLSearchParams(window.location.search);
  const name = params.get("judge");
  if (name) { localStorage.setItem(judgeNameStorageKey(), name); return name; }
  return localStorage.getItem(judgeNameStorageKey()) ?? "";
};

const formatError = (e: unknown): string => {
  const parts: string[] = [];
  let current: unknown = e;
  const seen = new Set<unknown>();
  while (current != null && !seen.has(current)) {
    seen.add(current);
    if (current instanceof Error) { parts.push(current.message); current = (current as { cause?: unknown }).cause; }
    else { parts.push(String(current)); break; }
  }
  return parts.join(" -> ");
};

export type JudgeStatus =
  | "idle" | "joining" | "joined" | "committing" | "committed"
  | "revealing" | "finished" | "error";

export interface UseJudgeGameResult {
  contractAddress: string;
  ledgerState: JudgeLedgerState | null;
  selectedScore: number | null;
  status: JudgeStatus;
  error: string | null;
  coinPublicKey: string;
  myPublicKey: string;
  judgeName: string;
  setContractAddress: (addr: string) => void;
  join: (addr: string) => Promise<void>;
  selectScore: (score: number) => void;
  commit: () => Promise<void>;
  reveal: () => Promise<void>;
  reset: () => void;
}

export function useJudgeGame(contractOverride?: string): UseJudgeGameResult {
  const { state } = useWallet();
  const { networkId } = useNetwork();

  const connection = state.status === "connected" ? state.connection : null;
  const coinPublicKey = state.status === "connected" ? state.connection.state.coinPublicKey : "";

  const providers = useMemo(
    () => (connection ? createJudgeProviders(connection, networkId) : null),
    [connection, networkId],
  );

  const [contractAddress, setContractAddressState] = useState<string>(
    () => contractOverride ?? getInitialContract(networkId),
  );
  const [judgeName] = useState<string>(() => getInitialJudgeName());
  const [ledgerState, setLedgerState] = useState<JudgeLedgerState | null>(null);
  const [selectedScore, setSelectedScore] = useState<number | null>(null);
  const [deployedContract, setDeployedContract] = useState<DeployedJudgeContract | null>(null);
  const [status, setStatus] = useState<JudgeStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [myPublicKey, setMyPublicKey] = useState<string>("");

  const prevStatusRef = useRef<JudgeStatus>("idle");
  const subscriptionRef = useRef<Subscription | null>(null);

  useEffect(() => {
    setContractAddressState(getInitialContract(networkId));
  }, [networkId]);

  // Auto-join when wallet connects
  useEffect(() => {
    if (providers && contractAddress && status === "idle") {
      void join(contractAddress);
    }
  }, [providers]); // eslint-disable-line react-hooks/exhaustive-deps

  const setContractAddress = useCallback((addr: string) => {
    setContractAddressState(addr);
    localStorage.setItem(contractAddressStorageKey(networkId), addr);
  }, [networkId]);

  const join = useCallback(async (addr: string) => {
    if (!providers) return;
    prevStatusRef.current = "idle";
    setStatus("joining");
    setError(null);
    try {
      const contract = await joinJudgeContract(providers, addr);
      setDeployedContract(contract);
      setContractAddress(addr);
      setMyPublicKey(await getMyPublicKeyHex(providers));

      subscriptionRef.current?.unsubscribe();
      subscriptionRef.current = subscribeToJudgeState(providers, addr as ContractAddress).subscribe({
        next: (ls) => {
          setLedgerState(ls);
          if (ls.state === JudgingState.finished) setStatus("finished");
          else if (ls.state === JudgingState.committed) {
            setStatus((prev) => (prev === "joined" || prev === "idle" ? "committed" : prev));
          }
        },
        error: (e: unknown) => { console.error("[judge] subscription error:", e); setError(formatError(e)); },
      });
      setStatus("joined");
    } catch (e) {
      console.error("[judge] join failed:", e);
      prevStatusRef.current = "idle";
      setStatus("error");
      setError(formatError(e));
    }
  }, [providers, setContractAddress]);

  const selectScore = useCallback((score: number) => { setSelectedScore(score); }, []);

  const commit = useCallback(async () => {
    if (!providers || !deployedContract || selectedScore === null) return;
    if (status === "error") { setStatus(prevStatusRef.current); setError(null); return; }
    if (ledgerState !== null && ledgerState.state !== JudgingState.waiting) { setStatus("committed"); return; }

    prevStatusRef.current = "joined";
    setStatus("committing");
    setError(null);
    try {
      await setMyScore(providers, selectedScore);
      await commitScore(deployedContract);
      setStatus("committed");
    } catch (e) {
      console.error("[judge] commit failed:", e);
      prevStatusRef.current = "joined";
      setStatus("error");
      setError(formatError(e));
    }
  }, [providers, deployedContract, selectedScore, status, ledgerState]);

  const reveal = useCallback(async () => {
    if (!deployedContract) return;
    if (status === "error") {
      const restoredStatus =
        prevStatusRef.current === "joined" && ledgerState?.state === JudgingState.committed
          ? "committed"
          : prevStatusRef.current;
      setStatus(restoredStatus);
      setError(null);
      return;
    }
    prevStatusRef.current = "committed";
    setStatus("revealing");
    setError(null);
    try {
      await revealScore(deployedContract);
    } catch (e) {
      console.error("[judge] reveal failed:", e);
      prevStatusRef.current = "committed";
      setStatus("error");
      setError(formatError(e));
    }
  }, [deployedContract, status, ledgerState]);

  const reset = useCallback(() => {
    subscriptionRef.current?.unsubscribe();
    subscriptionRef.current = null;
    if (providers) void clearPrivateState(providers);
    setDeployedContract(null);
    setLedgerState(null);
    setSelectedScore(null);
    setStatus("idle");
    setError(null);
  }, [providers]);

  useEffect(() => {
    if (state.status !== "connected") {
      subscriptionRef.current?.unsubscribe();
      subscriptionRef.current = null;
      startTransition(() => {
        setDeployedContract(null);
        setLedgerState(null);
        setSelectedScore(null);
        setStatus("idle");
        setMyPublicKey("");
      });
    }
  }, [state.status]);

  useEffect(() => { return () => { subscriptionRef.current?.unsubscribe(); }; }, []);

  return {
    contractAddress, ledgerState, selectedScore, status, error,
    coinPublicKey, myPublicKey, judgeName, setContractAddress, join, selectScore,
    commit, reveal, reset,
  };
}
