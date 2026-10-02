import { Navigate, Route, Routes } from "react-router-dom";
import Home from "@/pages/home";
import Programs from "@/pages/programs";
import NewProgram from "@/pages/program-new";
import ProgramDossier from "@/pages/program-detail";
import Submit from "@/pages/program-submit";
import Disclosures from "@/pages/disclosures";
import DisclosureDossier from "@/pages/disclosure-detail";
import Precedent from "@/pages/precedent";
import Settlements from "@/pages/settlements";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/programs" element={<Programs />} />
      <Route path="/programs/new" element={<NewProgram />} />
      <Route path="/programs/:id" element={<ProgramDossier />} />
      <Route path="/programs/:id/submit" element={<Submit />} />
      <Route path="/disclosures" element={<Disclosures />} />
      <Route path="/disclosures/:id" element={<DisclosureDossier />} />
      <Route path="/precedent" element={<Precedent />} />
      <Route path="/settlements" element={<Settlements />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
