import { useEffect, useState } from "react";
import { ensureContract, waitFinalizedSuccessful } from "@/lib/genlayer";
import { useWallet } from "@/components/wallet-provider";
import { gen, program } from "@/lib/scope-data";
import { CopyHash } from "@/components/copy-hash";

export function SubmitReport({ programId }: { programId: string }) {
  const [state, setState] = useState({ title:"", synopsis:"", url:"", component:"", severity:"MEDIUM" });
  const [bond, setBond] = useState<bigint>();
  const [message, setMessage] = useState("");
  const [hash, setHash] = useState("");
  const [busy, setBusy] = useState(false);
  const wallet = useWallet();

  useEffect(() => {
    program(programId)
      .then((p) => setBond(BigInt(String(p.min_bond))))
      .catch((e) => setMessage(e instanceof Error ? e.message : "Unable to read required bond."));
  }, [programId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!bond) return;
    setBusy(true);
    setMessage("Wallet signature requested…");
    try {
      const client = await wallet.getWriteClient();
      const hash = await client.writeContract({
        address: ensureContract(),
        functionName: "submit_report",
        args: [BigInt(programId), state.title, state.synopsis, state.url, state.component, state.severity],
        value: bond,
        consensusMaxRotations: 3,
      });
      setHash(hash);
      setMessage(`Transaction submitted: ${hash}. Waiting for finalization and GenVM execution…`);
      await waitFinalizedSuccessful(client as never, hash as never);
      setMessage("Finalized with successful GenVM execution. Read the new disclosure from the chain ledger.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Report submission failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="form-card">
      <div className="form-section">
        <h2>Disclosure</h2>
        <div className="form-grid">
          <label className="wide">Title<input required value={state.title} onChange={(e) => setState({ ...state, title: e.target.value })} /></label>
          <label className="wide">Public disclosure URL<input required type="url" value={state.url} onChange={(e) => setState({ ...state, url: e.target.value })} /></label>
          <label>Affected component<input required value={state.component} onChange={(e) => setState({ ...state, component: e.target.value })} /></label>
          <label>Claimed severity
            <select value={state.severity} onChange={(e) => setState({ ...state, severity: e.target.value })}>
              <option>LOW</option>
              <option>MEDIUM</option>
              <option>HIGH</option>
              <option>CRITICAL</option>
            </select>
          </label>
        </div>
      </div>

      <div className="form-section">
        <h2>Search synopsis</h2>
        <div className="form-grid">
          <label className="wide">Synopsis<textarea required value={state.synopsis} onChange={(e) => setState({ ...state, synopsis: e.target.value })} /></label>
        </div>
      </div>

      <p className="form-note">
        Exact required researcher bond: {bond === undefined ? "Reading chain…" : gen(bond)}.
        This value is read from the selected program and cannot be edited.
      </p>

      <div className="form-actions">
        <button className="connect" disabled={busy || !wallet.address || bond === undefined}>
          {busy ? "SUBMITTING…" : wallet.address ? "SUBMIT BONDED REPORT" : "CONNECT WALLET TO SUBMIT"}
        </button>
      </div>
      <p className="form-message" aria-live="polite">{message}</p>
      {hash ? <CopyHash value={hash} label="Submission transaction hash" /> : null}
    </form>
  );
}
