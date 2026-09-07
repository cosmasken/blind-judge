import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useJudgeGame } from "@/hooks/useJudgeGame";
import { JudgingState } from "@/lib/judge-types";
import { Scale, Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { CommitButton } from "./CommitButton";
import { ScoreSelector } from "./ScoreSelector";
import { ResultDisplay } from "./ResultDisplay";
import { RevealButton } from "./RevealButton";
import { WaitingState } from "./WaitingState";

export function JudgeGame({ contractOverride }: { contractOverride?: string }) {
  const {
    contractAddress, ledgerState, selectedScore, status, error,
    myPublicKey, setContractAddress, join, selectScore, commit, reveal, reset,
  } = useJudgeGame(contractOverride);

  const prevStatusRef = useRef(status);

  useEffect(() => {
    const prev = prevStatusRef.current;
    if (prev === "committing" && status === "committed") toast.success("Score committed — ZK sealed on-chain!");
    if (prev === "revealing" && status === "finished") toast.success("Score revealed!");
    prevStatusRef.current = status;
  }, [status]);

  const isJoining = status === "joining";
  const isCommitting = status === "committing";
  const isRevealing = status === "revealing";

  const inAddressPhase = status === "idle" || status === "joining" || (status === "error" && ledgerState === null);
  const inScorePhase = status === "joined" || status === "committing" || (status === "error" && ledgerState !== null && ledgerState.state === JudgingState.waiting);
  const inWaitingPhase = status === "committed" || status === "revealing" || (status === "error" && ledgerState !== null && ledgerState.state === JudgingState.committed);
  const showRevealButton = inWaitingPhase && ledgerState?.state === JudgingState.committed;
  const showResult = status === "finished";

  return (
    <Card className="w-full border border-white/10 bg-white/5 backdrop-blur-md shadow-xl">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-white/80 uppercase tracking-wider">
          <Scale className="h-4 w-4 text-cyan-400" />
          BlindJudge — Private Score Submission
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Phase 1: Contract address */}
        {inAddressPhase && (
          <div className="space-y-2">
            <label className="block text-xs font-medium text-white/50 uppercase tracking-wider">
              Contract Address
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={contractAddress}
                onChange={(e) => setContractAddress(e.target.value)}
                placeholder="Enter deployed contract address..."
                disabled={isJoining}
                className="flex-1 min-w-0 rounded-lg px-3 py-2 text-sm bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-cyan-500/60 disabled:opacity-50 font-mono"
              />
              <Button
                onClick={() => void join(contractAddress)}
                disabled={!contractAddress || isJoining}
                size="sm"
                variant="outline"
                className="shrink-0 border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              >
                {isJoining ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Joining...</> : "Join"}
              </Button>
            </div>
          </div>
        )}

        {/* Contract address label (after join) */}
        {!inAddressPhase && !showResult && (
          <div className="rounded-lg bg-white/3 border border-white/[0.08] px-3 py-2">
            <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Contract</p>
            <p className="text-xs font-mono text-white/60 truncate">{contractAddress}</p>
          </div>
        )}

        {/* Phase 2: Score selection */}
        {inScorePhase && (
          <div className="space-y-3">
            <ScoreSelector selectedScore={selectedScore} onSelect={selectScore} disabled={isCommitting} />
            <CommitButton
              onCommit={() => void commit()}
              disabled={selectedScore === null || isCommitting}
              isLoading={isCommitting}
              selectedScore={selectedScore}
            />
          </div>
        )}

        {/* Phase 3: Waiting / Reveal */}
        {inWaitingPhase && ledgerState !== null && (
          <WaitingState ledgerState={ledgerState} myPublicKey={myPublicKey} />
        )}
        {showRevealButton && (
          <RevealButton onReveal={() => void reveal()} disabled={isRevealing} isLoading={isRevealing} />
        )}

        {/* Phase 4: Result */}
        {showResult && ledgerState !== null && (
          <ResultDisplay ledgerState={ledgerState} myPublicKey={myPublicKey} onJudgeAgain={reset} />
        )}

        {/* Error banner */}
        {error !== null && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2">
            <p className="text-xs font-medium text-red-400 uppercase tracking-wider mb-0.5">Error</p>
            <p className="text-xs text-red-300/80 font-mono break-all">{error}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
