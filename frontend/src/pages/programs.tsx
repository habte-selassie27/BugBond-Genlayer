import { Link } from "react-router-dom";
import { gen, programs, programStatus, programTone, type Program } from "@/lib/scope-data";
import { useChainData } from "@/lib/use-chain-data";

const badge = (tone: string, label: string) => (
  <span className={tone ? `badge badge--${tone}` : "badge"}>{label}</span>
);

export default function Programs() {
  const { items, state, retry } = useChainData<Program>(programs, []);

  const lede =
    state === "LOADING" ? "Reading the StudioNet program index…"
    : state === "RPC ERROR" ? "RPC failure. Retry after checking StudioNet."
    : state === "EMPTY" ? "No funded scope has been locked on chain yet."
    : "Real Bugbond programs only. Every row is read from the deployed contract.";

  return (
    <main className="ledger-section">
      <header className="page-head">
        <div>
          <p className="eyebrow">BUGBOND / PROGRAM LEDGER</p>
          <h1>Programs</h1>
          <p className="lede">{lede}</p>
        </div>
        <Link className="connect" to="/programs/new">Create program</Link>
      </header>

      {state === "RPC ERROR" ? (
        <div className="empty-ledger">
          <strong>RPC FAILURE</strong>
          <p>The StudioNet endpoint did not answer. Reads are retried automatically; retry here once the network responds.</p>
          <button className="connect" onClick={retry}>Retry chain read</button>
        </div>
      ) : state === "EMPTY" ? (
        <div className="empty-ledger">
          <strong>NO PROGRAMS YET</strong>
          <p>Create the first public, funded security scope. Sponsors lock GEN against an immutable target and scope.</p>
          <Link className="connect" to="/programs/new">Create program</Link>
        </div>
      ) : (
        <div className="table table--programs">
          <div className="table-inner">
            <div className="table-head" aria-hidden="true">
              <span>Program</span><span>Repository</span><span>Status</span><span>Pool</span><span>Bond</span><span>Reports</span>
            </div>
            <div className="rows">
              {state === "LOADING" && items.length === 0 && [0, 1, 2].map((i) => (
                <div className="skeleton-row" key={i}><i /><i /><i /><i /><i /><i /></div>
              ))}
              {items.map((p) => (
                <Link to={`/programs/${p.id}`} className="row" key={String(p.id)}>
                  <b>BB-P{p.id}</b>
                  <span className="cell-muted">{String(p.repository_url).replace(/^https:\/\//, "")}</span>
                  <span>{badge(programTone(p.status), programStatus(p.status))}</span>
                  <span>{gen(p.remaining_pool)}</span>
                  <span className="cell-muted">{gen(p.min_bond)}</span>
                  <span className="cell-muted">{String(p.report_count)} RPT</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
