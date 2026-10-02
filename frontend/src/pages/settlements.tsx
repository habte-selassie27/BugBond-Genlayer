import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { filterItems, gen, reports, reportStatus, severity, tone, type Report } from "@/lib/scope-data";

const final = (r: Report) => Number(r.status) >= 3;
const OUTCOMES = ["ALL OUTCOMES", "VALID", "DUPLICATE", "KNOWN ISSUE", "OUT OF SCOPE", "EXPLOITABILITY NOT ESTABLISHED", "EXPIRED", "WITHDRAWN"] as const;
const OUTCOME_STATUS = ["", "3", "4", "5", "6", "7", "8", "9"];
const badge = (t: string, label: string) => (
  <span className={t ? `badge badge--${t}` : "badge"}>{label}</span>
);

export default function Settlements() {
  const [items, setItems] = useState<Report[]>([]);
  const [state, setState] = useState("LOADING");
  const [query, setQuery] = useState("");
  const [outcome, setOutcome] = useState("");

  useEffect(() => {
    reports()
      .then((r) => { const done = r.filter(final); setItems(done); setState(done.length ? "READY" : "EMPTY"); })
      .catch(() => setState("RPC ERROR"));
  }, []);

  const status = OUTCOME_STATUS[OUTCOMES.indexOf(outcome as typeof OUTCOMES[number])] ?? "";
  const visible = filterItems(items, query, status);

  const lede =
    state === "LOADING" ? "Reading the settlement ledger…"
    : state === "RPC ERROR" ? "RPC failure. Retry after checking StudioNet."
    : state === "EMPTY" ? "No report has reached a terminal settlement yet."
    : "Terminal payout, refund, and slash values recorded by the contract.";

  return (
    <main className="ledger-section">
      <header className="page-head">
        <div>
          <p className="eyebrow">SETTLEMENT LEDGER</p>
          <h1>Final on-chain outcomes.</h1>
          <p className="lede">{lede}</p>
        </div>
      </header>

      {state === "RPC ERROR" ? (
        <div className="empty-ledger">
          <strong>RPC FAILURE</strong>
          <p>Retry after checking StudioNet and the configured contract address.</p>
        </div>
      ) : state === "EMPTY" ? (
        <div className="empty-ledger">
          <strong>NO SETTLEMENTS YET</strong>
          <p>A report settles once consensus returns a terminal verdict and the deterministic payout rule runs.</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="empty-ledger">
          <strong>NO MATCHING SETTLEMENTS</strong>
          <p>No settlement matches the current search and outcome filter.</p>
        </div>
      ) : (
        <>
        <div className="ledger-filters">
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search id, title, component, researcher…" aria-label="Search settlements" />
          <select value={outcome} onChange={(e) => setOutcome(e.target.value)} aria-label="Filter by outcome">
            {OUTCOMES.map((label) => <option key={label} value={label}>{label}</option>)}
          </select>
        </div>
        <p className="ledger-count">Showing {visible.length} of {items.length} settlements</p>
        <div className="table table--settlements">
          <div className="table-inner">
            <div className="table-head" aria-hidden="true">
              <span>Report</span><span>Outcome</span><span>Settlement</span>
            </div>
            <div className="rows">
              {state === "LOADING" && [0, 1, 2].map((i) => (
                <div className="skeleton-row" key={i}><i /><i /><i /></div>
              ))}
              {visible.map((r) => (
                <Link to={`/disclosures/${r.id}`} className="row" key={String(r.id)}>
                  <b>BB-{String(r.id)}</b>
                  <span>{badge(tone(r.status), String(r.verdict || reportStatus(r.status)))}</span>
                  <span className="cell-muted">
                    {severity(r) === "NONE" ? null : <>{severity(r)} · </>}payout {gen(r.payout)} · refund {gen(r.refund)} · slash {gen(r.slash)}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
        </>
      )}
    </main>
  );
}
