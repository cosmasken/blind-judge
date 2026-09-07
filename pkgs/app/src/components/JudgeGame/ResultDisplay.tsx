import { toHex } from "@midnight-ntwrk/midnight-js-utils";
import { RotateCcw, Trophy } from "lucide-react";
import type { JudgeLedgerState } from "@/lib/judge-types";

interface ResultDisplayProps {
  ledgerState: JudgeLedgerState;
  myPublicKey: string;
  onJudgeAgain?: () => void;
}

export function ResultDisplay({ ledgerState, myPublicKey, onJudgeAgain }: ResultDisplayProps) {
  // find my slot index
  const myIdx = [0,1,2,3,4].findIndex(i =>
    toHex(ledgerState[`key${i}` as keyof typeof ledgerState] as Uint8Array) === myPublicKey
  );
  const myScore = myIdx >= 0 ? (ledgerState[`score${myIdx}` as keyof typeof ledgerState] as Uint8Array)[31] : 0;
  const finalScore = ledgerState.final_score;

  return (
    <div className="flex flex-col gap-4 animate-fade-in-up">
      {/* Final score banner */}
      <div className="rounded-xl px-4 py-4 flex flex-col items-center gap-1"
        style={{ background: "rgba(34,211,238,0.08)", border: "1px solid rgba(34,211,238,0.25)" }}>
        <Trophy className="h-6 w-6 text-cyan-400 mb-1" />
        <p className="text-xs text-white/40 uppercase tracking-wider">Final Score (on-chain)</p>
        <p className="text-4xl font-bold text-cyan-300">{finalScore}<span className="text-lg text-cyan-400/60">/10</span></p>
        <p className="text-xs text-white/30 mt-1">Immutable · Tamper-proof · ZK verified</p>
      </div>

      {/* Individual scores */}
      <div className="grid grid-cols-2 gap-3">
        <ScoreCard label="Your Score" score={myScore} color="#a855f7" />
        <ScoreCard label="Avg Score" score={finalScore} color="#22d3ee" />
      </div>

      {onJudgeAgain && (
        <button
          type="button"
          onClick={onJudgeAgain}
          className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg font-semibold text-sm text-white"
          style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)" }}
        >
          <RotateCcw className="h-4 w-4" />
          Judge Another Project
        </button>
      )}
    </div>
  );
}

function ScoreCard({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/5 py-3 px-2">
      <p className="text-xs text-white/40 uppercase tracking-wider">{label}</p>
      <p className="text-3xl font-bold" style={{ color }}>{score}</p>
      <p className="text-xs text-white/30">/10</p>
    </div>
  );
}
