import { Link, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { gen, program, programStatus, programTone, reports, type Program, type Report } from "@/lib/scope-data";

export default function ProgramDossier() {
  const { id = "" } = useParams<{ id: string }>();
  return <ProgramDossierView key={id} id={id} />;
}

function ProgramDossierView({ id }: { id: string }) {
  const [item, setItem] = useState<Program>();
  const [items, setItems] = useState<Report[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const p = await program(id);
        setItem(p);
        setItems((await reports()).filter((r) => String(r.program_id) === id));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to read program.");
      }
    })();
  }, [id]);

  if (error) {
    return (
      <main className="ledger-section">
        <p className="eyebrow">PROGRAM DOSSIER</p>
        <h1>RPC unavailable.</h1>
        <div className="empty-ledger"><strong>READ FAILED</strong><p>{error}</p></div>
      </main>
    );
  }

  if (!item) {
    return (
      <main className="ledger-section">
        <p className="eyebrow">PROGRAM / {id || "…"}</p>
        <h1>Reading chain record…</h1>
        <div className="table"><div className="table-inner">
          <div className="skeleton-row"><i /><i /></div>
          <div className="skeleton-row"><i /><i /></div>
          <div className="skeleton-row"><i /><i /></div>
        </div></div>
      </main>
    );
  }

  return (
    <main className="ledger-section">
      <header className="page-head">
        <div>
          <p className="eyebrow">PROGRAM / BB-P{item.id}</p>
          <h1>{String(item.name)}</h1>
          <p className="meta-line">
            <a href={String(item.repository_url)} target="_blank" rel="noreferrer">{String(item.repository_url)}</a>
            {" @ "}{String(item.repository_ref)}{" · "}
            <span className={programTone(item.status) ? `badge badge--${programTone(item.status)}` : "badge"}>{programStatus(item.status)}</span>
          </p>
        </div>
        <Link className="connect" to={`/programs/${item.id}/submit`}>Submit disclosure</Link>
      </header>

      <div className="detail-list">
        <section className="detail-row">
          <b>01 / Target</b>
          <span>Sponsor {String(item.sponsor)}<br />Pinned ref {String(item.repository_ref)}</span>
        </section>
        <section className="detail-row">
          <b>02 / Scope</b>
          <span>{String(item.scope)}</span>
        </section>
        <section className="detail-row">
          <b>03 / Payout matrix</b>
          <span>LOW <b>{gen(item.low_payout)}</b> · MEDIUM <b>{gen(item.medium_payout)}</b> · HIGH <b>{gen(item.high_payout)}</b> · CRITICAL <b>{gen(item.critical_payout)}</b></span>
        </section>
        <section className="detail-row">
          <b>04 / Program balance</b>
          <span>Funded <b>{gen(item.funded_total)}</b> · Remaining <b>{gen(item.remaining_pool)}</b> · Min bond <b>{gen(item.min_bond)}</b> · Slash {String(item.invalid_slash_bps)} bps</span>
        </section>
        <section className="detail-row">
          <b>05 / Disclosures</b>
          <span>{items.length} loaded / {String(item.report_count)} total<br />
            {items.map((r) => <Link key={String(r.id)} to={`/disclosures/${r.id}`}>BB-{String(r.id)} {String(r.title)}<br /></Link>)}
          </span>
        </section>
        <section className="detail-row">
          <b>06 / Contract proof</b>
          <span>Window {String(item.starts_at)} → {String(item.ends_at)} · {String(item.open_report_count)} unresolved</span>
        </section>
      </div>
    </main>
  );
}
