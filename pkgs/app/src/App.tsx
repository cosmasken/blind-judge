import { useState } from "react";
import { AddressCard } from "./components/AddressCard";
import { ConnectSection } from "./components/ConnectSection";
import { JudgeGame } from "./components/JudgeGame";
import { ProjectList } from "./components/ProjectList";
import { Setup } from "./components/Setup";
import { useWallet } from "./contexts/useWallet";

const params = new URLSearchParams(window.location.search);
const eventId = params.get("event");
const isSetup = window.location.pathname === "/setup";

function App() {
  const { state } = useWallet();
  const [selectedContract, setSelectedContract] = useState<string | null>(
    params.get("contract"),
  );

  if (isSetup) return <Setup />;

  if (state.status !== "connected") return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <ConnectSection />
    </main>
  );

  // event mode — show project list, then drill into a project
  if (eventId) return (
    <main className="flex min-h-screen items-start justify-center px-4 py-10">
      <div className="flex flex-col gap-4 w-full max-w-lg">
        <AddressCard />
        {selectedContract
          ? <>
              <button type="button" onClick={() => setSelectedContract(null)}
                className="text-xs text-white/40 hover:text-white/70 text-left">← Back to projects</button>
              <JudgeGame contractOverride={selectedContract} />
            </>
          : <ProjectList eventId={eventId} onSelectProject={(contract) => setSelectedContract(contract)} />
        }
      </div>
    </main>
  );

  // single contract mode (direct link or default)
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="flex flex-col gap-4 w-full max-w-md">
        <AddressCard />
        <JudgeGame />
      </div>
    </main>
  );
}

export default App;
