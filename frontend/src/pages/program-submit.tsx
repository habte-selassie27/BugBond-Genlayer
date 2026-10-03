import { useParams } from "react-router-dom";
import { SubmitReport } from "@/components/submit-report";

export default function Submit() {
  const { id = "" } = useParams<{ id: string }>();
  return (
    <main className="ledger-section">
      <header className="page-head">
        <div>
          <p className="eyebrow">SUBMIT REPORT / PROGRAM {id}</p>
          <h1>Bind public evidence.</h1>
          <p className="lede">
            Similarity is a search signal. It never decides whether your report is a duplicate.
            Bugbond returns final status only from chain state after consensus.
          </p>
        </div>
      </header>
      <SubmitReport key={id} programId={id} />
    </main>
  );
}
