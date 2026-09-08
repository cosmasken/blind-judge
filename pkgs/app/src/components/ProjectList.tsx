import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Scale, ExternalLink, CheckCircle2, Clock, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";

type ProjectState = {
  name: string;
  url: string;
  contract: string | null;
  index: number;
  contractState: {
    state: string;
    judges_committed: number;
    judges_revealed: number;
    judge_count: number;
    judging_over: boolean;
    final_score: number | null;
  } | null;
};

type EventData = {
  name: string;
  hackathon: string;
  judgeCount: number;
  projects: ProjectState[];
};

interface ProjectListProps {
  eventId: string;
  onSelectProject: (contract: string, projectName: string) => void;
}

export function ProjectList({ eventId, onSelectProject }: ProjectListProps) {
  const [event, setEvent] = useState<EventData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/badge/event/${eventId}`);
        if (!res.ok) throw new Error("Event not found");
        setEvent(await res.json() as EventData);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load event");
      }
    };
    void load();
    const interval = setInterval(() => void load(), 15_000);
    return () => clearInterval(interval);
  }, [eventId]);

  if (error) return (
    <Card className="w-full border border-white/10 bg-white/5">
      <CardContent className="pt-4"><p className="text-sm text-red-400">{error}</p></CardContent>
    </Card>
  );

  if (!event) return (
    <Card className="w-full border border-white/10 bg-white/5">
      <CardContent className="pt-4"><p className="text-sm text-white/40">Loading event...</p></CardContent>
    </Card>
  );

  return (
    <Card className="w-full border border-white/10 bg-white/5 backdrop-blur-md shadow-xl">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-white/80 uppercase tracking-wider">
          <Scale className="h-4 w-4 text-cyan-400" />
          {event.name}
        </CardTitle>
        {event.hackathon && (
          <a href={event.hackathon} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-cyan-400/70 hover:text-cyan-400 mt-1">
            <ExternalLink className="h-3 w-3" />View on hackathon platform
          </a>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-white/40 uppercase tracking-wider mb-3">Select a project to judge</p>
        {event.projects.map((p) => {
          const cs = p.contractState;
          const done = cs?.judging_over;
          const allCommitted = cs && cs.judges_committed >= cs.judge_count;

          return (
            <div key={p.index} className="rounded-xl border border-white/10 bg-white/3 px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-white truncate">{p.name}</p>
                  {p.url && (
                    <a href={p.url} target="_blank" rel="noreferrer" className="text-white/30 hover:text-cyan-400 shrink-0">
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  {done ? (
                    <><Trophy className="h-3 w-3 text-cyan-400" /><span className="text-xs text-cyan-400">Score: {cs.final_score}/10</span></>
                  ) : allCommitted ? (
                    <><CheckCircle2 className="h-3 w-3 text-yellow-400" /><span className="text-xs text-yellow-400/80">All committed — reveal phase</span></>
                  ) : cs ? (
                    <><Clock className="h-3 w-3 text-white/30" /><span className="text-xs text-white/40">{cs.judges_committed}/{cs.judge_count} committed</span></>
                  ) : (
                    <span className="text-xs text-white/30">No contract</span>
                  )}
                </div>
              </div>
              {p.contract && !done && (
                <Button size="sm" onClick={() => onSelectProject(p.contract!, p.name)}
                  className="shrink-0 bg-cyan-600 hover:bg-cyan-500 text-white text-xs">
                  Judge
                </Button>
              )}
              {done && <CheckCircle2 className="h-5 w-5 text-cyan-400 shrink-0" />}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
