import { Link, useParams } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { gen, report, reportStatus, severity, severityTone, tone, type Report } from "@/lib/scope-data";
import { ReportActions } from "@/components/report-actions";

export default function DisclosureDossier() {
  const { id = "" } = useParams<{ id: string }>();
  return <DisclosureDossierView key={id} id={id} />;
}

function DisclosureDossierView({ id }: { id: string }) {
  const [item, setItem] = useState<Report>();
  const [error, setError] = useState("");
  const apply = useCallback((record: Report) => { setItem(record); setError(""); }, []);
  const refresh = useCallback(async () => { if (!id) return; apply(await report(id)); }, [id, apply]);

  useEffect(() => {
    if (!id) return;
    report(id).then(apply, (e) => setError(e instanceof Error ? e.message : "Unable to read disclosure."));
  }, [id, apply]);

  if (error) {
    return (
      <main className="ledger-section">
        <p className="eyebrow">DISCLOSURE DOSSIER</p>
        <h1>RPC unavailable.</h1>
        <div className="empty-ledger"><strong>READ FAILED</strong><p>{error}</p></div>
      </main>
    );
  }

  if (!item) {
    return (
      <main className="ledger-section">
        <p className="eyebrow">DISCLOSURE DOSSIER</p>
        <h1>Reading chain record…</h1>
        <div className="table"><div className="table-inner">
          <div className="skeleton-row"><i /><i /></div>
          <div className="skeleton-row"><i /><i /></div>
          <div className="skeleton-row"><i /><i /></div>
        </div></div>
      </main>
    );
  }

  let precedents: unknown[] = [];
  try { precedents = JSON.parse(String(item.precedents || "[]")); } catch {}

  const statusTone = tone(item.status);
  const sevTone = severityTone(severity(item));

  return (
    <main className="rail-section">
      <div>
        <p className="eyebrow">DISCLOSURE DOSSIER / BB-{String(item.id)}</p>
        <h1>{String(item.title)}</h1>
        <p className="meta-line">
          <span className={statusTone ? `badge badge--${statusTone}` : "badge"}>{reportStatus(item.status)}</span>
          {" "}
          <span className={sevTone ? `badge badge--${sevTone}` : "badge"}>{severity(item)}</span>
        </p>
        <ReportActions item={item} onRefresh={refresh} />
      </div>

      <ol className="rail">
        <li>
          <time>01</time><b>TARGET</b>
          <small><Link to={`/programs/${item.program_id}`}>Program BB-P{String(item.program_id)}</Link> · {String(item.component)}</small>
        </li>
        <li>
          <time>02</time><b>DISCLOSURE</b>
          <small>
            Researcher {String(item.researcher)} · bond {gen(item.bond)} · {String(item.submitted_at)}<br />
            <a target="_blank" rel="noreferrer" href={String(item.disclosure_url)}>Public evidence</a>
          </small>
        </li>
        <li>
          <time>03</time><b>PRECEDENT SCAN</b>
          <small>{precedents.length ? JSON.stringify(precedents) : "No same-program settled-valid candidates selected."}</small>
        </li>
        <li>
          <time>04</time><b>EVIDENCE</b>
          <small>
            Supplementary: {item.supplementary_url
              ? <a target="_blank" rel="noreferrer" href={String(item.supplementary_url)}>public URL</a>
              : "none"}<br />
            {String(item.evidence_digest || "Awaiting consensus evidence summary.")}
          </small>
        </li>
        <li>
          <time>05</time><b>CONSENSUS</b>
          <small>
            {String(item.verdict || "UNDER REVIEW")} · duplicate of {String(item.duplicate_of || 0)}<br />
            {String(item.reasoning || "No finalized reasoning.")}
          </small>
        </li>
        <li>
          <time>06</time><b>SETTLEMENT</b>
          <small>Payout {gen(item.payout)} · refund {gen(item.refund)} · slash {gen(item.slash)}</small>
        </li>
      </ol>
    </main>
  );
}
