import { Link } from "react-router-dom";
import { reports, severity, severityTone, type Report } from "@/lib/scope-data";
import { useChainData } from "@/lib/use-chain-data";

const badge = (t: string, label: string) => (
  <span className={t ? `badge badge--${t}` : "badge"}>{label}</span>
);

export default function Precedent() {
  const { items, state, retry } = useChainData<Report>(
    () => reports().then((r) => r.filter((x) => Number(x.status) === 3)),
    [],
  );

  const lede =
    state === "LOADING" ? "Scanning settled reports for same-program precedent…"
    : state === "RPC ERROR" ? "RPC failure. Retry after checking StudioNet."
    : state === "EMPTY" ? "No settled VALID reports are available as precedent."
    : "Settled VALID reports in the same program. Candidates only — never a duplicate decision.";

  return (
    <main className="ledger-section">
      <header className="page-head">
        <div>
          <p className="eyebrow">PRECEDENT INDEX</p>
          <h1>Possible precedent.</h1>
          <p className="lede">{lede}</p>
        </div>
      </header>

      <p className="status-line">
        Semantic distance is a retrieval measure, never a probability or a duplicate verdict.
        Only consensus can mark a report DUPLICATE, and only against one of these selected candidates.
      </p>

      {state === "RPC ERROR" ? (
        <div className="empty-ledger">
          <strong>RPC FAILURE</strong>
          <p>The StudioNet endpoint did not answer. Reads are retried automatically; retry here once the network responds.</p>
          <button className="connect" onClick={retry}>Retry chain read</button>
        </div>
      ) : state === "EMPTY" ? (
        <div className="empty-ledger">
          <strong>NO VALID PRECEDENT</strong>
          <p>Only settled VALID reports from the same program can be offered as precedent candidates.</p>
        </div>
      ) : (
        <div className="table table--precedent">
          <div className="table-inner">
            <div className="table-head" aria-hidden="true">
              <span>Report</span><span>Candidate</span><span>Synopsis</span>
            </div>
            <div className="rows">
              {state === "LOADING" && [0, 1, 2].map((i) => (
                <div className="skeleton-row" key={i}><i /><i /><i /></div>
              ))}
              {items.map((r) => (
                <Link to={`/disclosures/${r.id}`} className="row" key={String(r.id)}>
                  <b>BB-{String(r.id)}</b>
                  <span>{badge(severityTone(severity(r)), severity(r))} <span className="cell-muted">{String(r.component)}</span></span>
                  <span className="cell-muted">{String(r.synopsis)}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
