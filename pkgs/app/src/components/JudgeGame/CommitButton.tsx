import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface CommitButtonProps {
  onCommit: () => void;
  disabled: boolean;
  isLoading: boolean;
  selectedScore?: number | null;
}

export function CommitButton({ onCommit, disabled, isLoading, selectedScore }: CommitButtonProps) {
  if (isLoading) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-violet-500/40 bg-violet-500/5 px-4 py-5">
        <div
          className="absolute inset-x-0 h-px pointer-events-none animate-zk-scan"
          style={{ background: "linear-gradient(90deg, transparent, #a855f7, transparent)" }}
        />
        <div className="flex flex-col items-center gap-3">
          {selectedScore != null && (
            <span className="text-4xl font-bold text-violet-300">{selectedScore}<span className="text-lg text-violet-400/60">/10</span></span>
          )}
          <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full rounded-full animate-progress-grow" style={{ background: "linear-gradient(90deg, #a855f7, #22d3ee)" }} />
          </div>
          <span className="font-mono text-xs text-violet-300/80">Generating ZK Proof...</span>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onCommit}
      disabled={disabled}
      className={cn(
        "w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg",
        "font-semibold text-sm text-white transition-all duration-200",
        "disabled:opacity-40 disabled:cursor-not-allowed",
      )}
      style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)" }}
    >
      <Lock className="h-4 w-4" />
      Commit Score (ZK sealed)
    </button>
  );
}
