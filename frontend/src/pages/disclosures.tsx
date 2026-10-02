import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { filterItems, reports, reportStatus, severity, severityTone, shortAddr, tone, type Report } from "@/lib/scope-data";

const STATUS_LABELS = ["", "UNDER REVIEW", "NEEDS EVIDENCE", "VALID", "DUPLICATE", "KNOWN ISSUE", "OUT OF SCOPE", "EXPLOITABILITY NOT ESTABLISHED", "EXPIRED", "WITHDRAWN"] as const;

const badge = (t: string, label: string) => (
  <span className={t ? `badge badge--${t}` : "badge"}>{label}</span>
);

export default function Disclosures() {
  const [items, setItems] = useState<Report[]>([]);
  const [state, setState] = useState("LOADING");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    reports()
      .then((x) => { setItems(x); setState(x.length ? "READY" : "EMPTY"); })
      .catch(() => setState("RPC ERROR"));
  }, []);

  const visible = filterItems(items, query, status);

  const lede =
    state === "LOADING" ? "Reading bounded report records…"
    : state === "RPC ERROR" ? "RPC failure. Retry after checking StudioNet."
    : state === "EMPTY" ? "No bonded report has finalized yet."
    : "Every bonded disclosure, its consensus verdict, and its current lifecycle state.";

  return (
    <main className="ledger-section">
      <header className="page-head">
        <div>
          <p className="eyebrow">PUBLIC DISCLOSURE LEDGER</p>
          <h1>Disclosures</h1>
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
          <strong>NO DISCLOSURES YET</strong>
          <p>Reports appear here only after their bonded transaction finalizes on chain.</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="empty-ledger">
          <strong>NO MATCHING DISCLOSURES</strong>
          <p>No disclosure matches the current search and status filter.</p>
        </div>
      ) : (
        <>
        <div className="ledger-filters">
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search id, title, component, verdict, researcher…" aria-label="Search disclosures" />
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
            {STATUS_LABELS.map((label, index) => <option key={index} value={String(index)}>{label || "ALL STATUSES"}</option>)}
          </select>
        </div>
        <p className="ledger-count">Showing {visible.length} of {items.length} disclosures</p>
        <div className="table table--disclosures">
          <div className="table-inner">
            <div className="table-head" aria-hidden="true">
              <span>Report</span><span>Severity</span><span>Component</span><span>Verdict</span><span>Researcher</span>
            </div>
            <div className="rows">
              {state === "LOADING" && [0, 1, 2].map((i) => (
                <div className="skeleton-row" key={i}><i /><i /><i /><i /><i /></div>
              ))}
              {visible.map((r) => (
                <Link to={`/disclosures/${r.id}`} className="row" key={String(r.id)}>
                  <b>SL-{r.id}</b>
                  <span>{badge(severityTone(severity(r)), severity(r))}</span>
                  <span className="cell-muted">{String(r.component)}</span>
                  <span>{badge(tone(r.status), String(r.verdict || reportStatus(r.status)))}</span>
                  <span className="cell-muted">{shortAddr(r.researcher)}</span>
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
