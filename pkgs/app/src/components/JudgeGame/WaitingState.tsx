import { toHex } from "@midnight-ntwrk/midnight-js-utils";
import { CheckCircle2, Clock } from "lucide-react";
import type { JudgeLedgerState } from "@/lib/judge-types";

interface WaitingStateProps {
  ledgerState: JudgeLedgerState;
  myPublicKey: string;
}

export function WaitingState({ ledgerState, myPublicKey }: WaitingStateProps) {
  const myIdx = [0,1,2,3,4].findIndex(i =>
    toHex(ledgerState[`key${i}` as keyof typeof ledgerState] as Uint8Array) === myPublicKey
  );
  const myCommitHash = myIdx >= 0 ? toHex(ledgerState[`commit${myIdx}` as keyof typeof ledgerState] as Uint8Array) : "";
  const myRevealed = myIdx >= 0 ? ledgerState[`revealed${myIdx}` as keyof typeof ledgerState] as boolean : false;
  const allCommitted = ledgerState.judges_committed >= ledgerState.judge_count;
  const pendingReveals = ledgerState.judge_count - ledgerState.judges_revealed;

  return (
    <div className="flex flex-col gap-3 animate-fade-in-up">
      {/* Sealed score */}
      <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 px-4 py-3">
        <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Your score is ZK sealed</p>
        <p className="text-xs font-mono text-violet-300/60 truncate">{myCommitHash.slice(0, 32)}...</p>
      </div>

      {/* Opponent status */}
      <div className="rounded-xl border border-white/10 bg-white/3 px-4 py-3 flex items-center gap-3">
        {allCommitted ? (
          <CheckCircle2 className="h-4 w-4 text-cyan-400 shrink-0" />
        ) : (
          <Clock className="h-4 w-4 text-white/30 shrink-0" />
        )}
        <div>
          <p className="text-xs text-white/40 uppercase tracking-wider">Judges</p>
          <p className="text-xs font-medium text-white/60">
            {allCommitted ? "All committed — ready to reveal" : `${ledgerState.judges_committed}/${ledgerState.judge_count} committed`}
          </p>
        </div>
      </div>

      {/* Waiting for others to reveal */}
      {myRevealed && pendingReveals > 0 && (
        <div className="flex flex-col items-center gap-2 py-3">
          <CheckCircle2 className="h-8 w-8 text-cyan-400" />
          <p className="text-sm text-white/60">Waiting for {pendingReveals} judge{pendingReveals > 1 ? "s" : ""} to reveal...</p>
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-1.5 w-1.5 rounded-full bg-cyan-500/60 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
