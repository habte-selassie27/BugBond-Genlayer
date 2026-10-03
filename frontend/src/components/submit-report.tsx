import { useCallback, useEffect, useState } from "react";
import { ensureContract, errorText, readClient, waitFinalizedSuccessful } from "@/lib/genlayer";
import { useWallet } from "@/components/wallet-provider";
import { gen, program } from "@/lib/scope-data";
import { CopyHash } from "@/components/copy-hash";

const EMPTY = { title:"", synopsis:"", url:"", component:"", severity:"MEDIUM" };
type Draft = typeof EMPTY;
const draftKey = (programId: string) => `bugbond:submit-report-draft:${programId}`;
function readDraft(programId: string): Draft {
  try {
    const raw = window.localStorage.getItem(draftKey(programId));
    if (!raw) return { ...EMPTY };
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { ...EMPTY };
    const draft = { ...EMPTY };
    for (const key of Object.keys(draft) as (keyof Draft)[]) {
      const value = (parsed as Record<string, unknown>)[key];
      if (typeof value === "string") draft[key] = value;
    }
    return draft;
  } catch { return { ...EMPTY }; }
}
function saveDraft(programId: string, draft: Draft) { try { window.localStorage.setItem(draftKey(programId), JSON.stringify(draft)); } catch { /* storage disabled: values still live in memory */ } }
function clearDraft(programId: string) { try { window.localStorage.removeItem(draftKey(programId)); } catch { /* ignore */ } }

export function SubmitReport({ programId }: { programId: string }) {
  const [state, setState] = useState<Draft>(() => readDraft(programId));
  const [bond, setBond] = useState<bigint>();
  const [bondError, setBondError] = useState("");
  const [window_ , setWindow] = useState<{ starts: number; ends: number; status: number }>();
  const [message, setMessage] = useState("");
  const [hash, setHash] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now);
  const wallet = useWallet();

  useEffect(() => { saveDraft(programId, state); }, [programId, state]);

  const loadBond = useCallback(() => {
    program(programId)
      .then((p) => {
        setBond(BigInt(String(p.min_bond)));
        setWindow({
          starts: Date.parse(String(p.starts_at)),
          ends: Date.parse(String(p.ends_at)),
          status: Number(p.status),
        });
        setBondError("");
      })
      .catch((e) => { setBond(undefined); setWindow(undefined); setBondError(errorText(e, "Unable to read the required bond.")); });
  }, [programId]);

  useEffect(() => { loadBond(); }, [loadBond]);

  // Refresh the clock at whichever boundary matters, so a window that closes
  // while the form is open is reflected without a manual reload.
  useEffect(() => {
    if (!window_) return;
    const next = window_.starts > now ? window_.starts : window_.ends;
    if (!Number.isFinite(next)) return;
    const timer = window.setTimeout(() => setNow(Date.now()), Math.max(0, next - now) + 50);
    return () => window.clearTimeout(timer);
  }, [window_, now]);

  const windowIssue = (() => {
    if (!window_) return "";
    if (window_.status !== 1) return "This program is not open for submissions.";
    if (!Number.isFinite(window_.starts) || !Number.isFinite(window_.ends)) return "This program has no readable submission window.";
    if (now < window_.starts) return `Submissions do not open until ${new Date(window_.starts).toISOString()}.`;
    if (now >= window_.ends) return `The submission window closed at ${new Date(window_.ends).toISOString()}. The contract rejects submissions after it ends, and programs are immutable, so this one cannot be reopened.`;
    return "";
  })();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (bond === undefined) return;
    if (windowIssue) { setMessage(windowIssue); return; }
    setBusy(true);
    setMessage("Wallet signature requested…");
    try {
      const client = await wallet.getWriteClient();
      const countBefore = Number(await readClient().readContract({ address: ensureContract(), functionName: "report_count", args: [] }) as number);
      const hash = await client.writeContract({
        address: ensureContract(),
        functionName: "submit_report",
        args: [BigInt(programId), state.title, state.synopsis, state.url, state.component, state.severity],
        value: bond,
        consensusMaxRotations: 3,
      });
      setHash(hash);
      setMessage(`Transaction submitted: ${hash}. Waiting for finalization and GenVM execution…`);
      // StudioNet often leaves the execution label unset on a finalized
      // receipt, so confirm against report_count instead of assuming failure.
      const landed = async () => {
        try { return Number(await readClient().readContract({ address: ensureContract(), functionName: "report_count", args: [] }) as number) > countBefore; }
        catch { return false; }
      };
      await waitFinalizedSuccessful(client as never, hash as never, landed);
      clearDraft(programId);
      setMessage("Finalized with successful GenVM execution. Read the new disclosure from the chain ledger.");
    } catch (error) {
      setMessage(errorText(error,"Report submission failed."));
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
        {bond === undefined
          ? <>Exact required researcher bond: {bondError ? "unavailable — the chain read failed." : "reading chain…"}</>
          : <>Exact required researcher bond: <b>{gen(bond)}</b>.</>}
        {" "}This value is read from the selected program and cannot be edited.
        {window_ ? (
          <>
            {" "}Submission window: {new Date(window_.starts).toISOString()} → {new Date(window_.ends).toISOString()}.
          </>
        ) : null}
        {windowIssue ? (
          <>
            {" "}
            <b className="form-block">{windowIssue}</b>
          </>
        ) : null}
        {bondError ? (
          <>
            {" "}
            <button
              type="button"
              className="text-link"
              onClick={() => { setBondError(""); setBond(undefined); loadBond(); }}
            >
              Retry chain read
            </button>
          </>
        ) : null}
      </p>
      {Object.keys(EMPTY).some((k) => state[k as keyof Draft] !== EMPTY[k as keyof Draft]) ? (
        <p className="form-note form-note--draft">Kept as a draft in this browser — this report is restored after a reload, a rejected signature, or a failed submission, and is cleared only once the disclosure finalizes.</p>
      ) : null}

      <div className="form-actions">
        <button className="connect" disabled={busy || !wallet.address || bond === undefined || Boolean(windowIssue)}>
          {busy
            ? "SUBMITTING…"
            : bond === undefined
              ? (bondError ? "RETRY THE CHAIN READ ABOVE" : "READING REQUIRED BOND…")
              : windowIssue
                ? "SUBMISSION WINDOW NOT OPEN"
                : wallet.address
                  ? "SUBMIT BONDED REPORT"
                  : "CONNECT WALLET TO SUBMIT"}
        </button>
      </div>
      <p className="form-message" aria-live="polite">{message}</p>
      {hash ? <CopyHash value={hash} label="Submission transaction hash" /> : null}
    </form>
  );
}
