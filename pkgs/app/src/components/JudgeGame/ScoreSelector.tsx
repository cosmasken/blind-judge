import { cn } from "@/lib/utils";

interface ScoreSelectorProps {
  selectedScore: number | null;
  onSelect: (score: number) => void;
  disabled: boolean;
}

const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const scoreColor = (score: number): string => {
  if (score <= 3) return "#f472b6";
  if (score <= 6) return "#fb923c";
  if (score <= 8) return "#facc15";
  return "#22d3ee";
};

export function ScoreSelector({ selectedScore, onSelect, disabled }: ScoreSelectorProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-white/50 uppercase tracking-wider">Select your score (1–10)</p>
      <div className="grid grid-cols-5 gap-2">
        {SCORES.map((score) => {
          const isSelected = selectedScore === score;
          const color = scoreColor(score);
          return (
            <button
              key={score}
              type="button"
              onClick={() => onSelect(score)}
              disabled={disabled}
              className={cn(
                "flex flex-col items-center justify-center py-3 rounded-xl border transition-all duration-200",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                !disabled && !isSelected && "hover:-translate-y-0.5 hover:bg-white/5",
                isSelected ? "border-current" : "border-white/10 bg-white/3",
              )}
              style={isSelected ? { borderColor: color, backgroundColor: `${color}18`, boxShadow: `0 0 16px ${color}30` } : undefined}
            >
              <span className="text-lg font-bold" style={isSelected ? { color } : { color: "rgba(255,255,255,0.6)" }}>
                {score}
              </span>
            </button>
          );
        })}
      </div>
      {selectedScore != null && (
        <p className="text-center text-sm font-medium" style={{ color: scoreColor(selectedScore) }}>
          Score: {selectedScore}/10
        </p>
      )}
    </div>
  );
}
