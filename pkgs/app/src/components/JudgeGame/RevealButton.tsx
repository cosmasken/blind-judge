import { Eye, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface RevealButtonProps {
  onReveal: () => void;
  disabled: boolean;
  isLoading: boolean;
}

export function RevealButton({ onReveal, disabled, isLoading }: RevealButtonProps) {
  return (
    <button
      type="button"
      onClick={onReveal}
      disabled={disabled || isLoading}
      className={cn(
        "w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg",
        "font-semibold text-sm text-black transition-all duration-200",
        "disabled:opacity-40 disabled:cursor-not-allowed",
      )}
      style={{ background: "linear-gradient(135deg, #22d3ee, #0ea5e9)" }}
    >
      {isLoading ? (
        <><Loader2 className="h-4 w-4 animate-spin" /><span className="font-mono text-xs">Generating ZK Proof...</span></>
      ) : (
        <><Eye className="h-4 w-4" />Reveal Score</>
      )}
    </button>
  );
}
