import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ensureContract, errorText, waitFinalizedSuccessful } from "@/lib/genlayer";
import { useWallet } from "@/components/wallet-provider";
import { CopyHash } from "@/components/copy-hash";

const atto=(v:string)=>{if(!/^\d+(\.\d{0,18})?$/.test(v))throw new Error("Use a non-negative GEN amount with at most 18 decimals.");const [w,f=""]=v.split(".");return BigInt(w)*1000000000000000000n+BigInt((f+"0".repeat(18)).slice(0,18));};

const DRAFT_KEY="bugbond:new-program-draft";
const EMPTY={name:"",repo:"",ref:"",scope:"",start:"",end:"",bond:"1",slash:"2500",low:"1",medium:"5",high:"20",critical:"50",funding:"100"};
function readDraft():typeof EMPTY{
 try{
  const raw=window.localStorage.getItem(DRAFT_KEY);
  if(!raw)return {...EMPTY};
  const parsed:unknown=JSON.parse(raw);
  if(!parsed||typeof parsed!=="object")return {...EMPTY};
  const draft={...EMPTY};
  for(const key of Object.keys(draft) as (keyof typeof EMPTY)[]){
   const value=(parsed as Record<string,unknown>)[key];
   if(typeof value==="string")draft[key]=value;
  }
  return draft;
 }catch{return {...EMPTY}}
}
function saveDraft(draft:typeof EMPTY){try{window.localStorage.setItem(DRAFT_KEY,JSON.stringify(draft))}catch{ /* storage disabled: the form still holds values in memory */ }}
function clearDraft(){try{window.localStorage.removeItem(DRAFT_KEY)}catch{ /* ignore */ }}

export default function NewProgram(){
  const navigate=useNavigate(),wallet=useWallet();
  const [f,setF]=useState(readDraft);
  const [message,setMessage]=useState("");
  const [hash,setHash]=useState("");
  const [busy,setBusy]=useState(false);
  useEffect(()=>{saveDraft(f)},[f]);
  const edit=(k:keyof typeof f)=>(e:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>)=>setF({...f,[k]:e.target.value});
  const draftTouched=Object.keys(EMPTY).some((k)=>f[k as keyof typeof EMPTY]!==EMPTY[k as keyof typeof EMPTY]);

  async function submit(e:React.FormEvent){
    e.preventDefault();
    try{
      if(!f.repo.startsWith("https://")||!f.ref||!f.scope||Date.parse(f.start)>=Date.parse(f.end))throw new Error("Provide HTTPS target, immutable ref, scope, and a valid time window.");
      const payouts=[atto(f.low),atto(f.medium),atto(f.high),atto(f.critical)];
      if(payouts.some(x=>x<=0n)||payouts.some((x,i)=>i>0&&x<payouts[i-1]))throw new Error("Payouts must be ascending positive GEN values.");
      const slash=Number(f.slash);
      if(!Number.isInteger(slash)||slash<0||slash>5000)throw new Error("Slash must be 0-5000 bps; the protocol caps it so a bond can never be fully confiscated.");
      setBusy(true);
      const c=await wallet.getWriteClient();
      const hash=await c.writeContract({address:ensureContract(),functionName:"create_program",args:[f.name,f.repo,f.ref,f.scope,new Date(f.start).toISOString(),new Date(f.end).toISOString(),atto(f.bond),slash,...payouts],value:atto(f.funding),consensusMaxRotations:3});
      setHash(hash);setMessage(`Submitted ${hash}; waiting for finalization and GenVM execution…`);
      await waitFinalizedSuccessful(c as never,hash as never);
      clearDraft();
      setMessage("Finalized with successful GenVM execution. The new program is discoverable from the chain ledger.");
      navigate("/programs");
    }catch(err){
      setMessage(errorText(err,"Program creation failed."));
    }finally{
      setBusy(false);
    }
  }

  return (
    <main className="ledger-section">
      <header className="page-head">
        <div>
          <p className="eyebrow">01 / NEW PROGRAM</p>
          <h1>Bind a scope.</h1>
          <p className="lede">A funded program is immutable. Target, ref, scope, window, bond, and payout matrix are locked at creation.</p>
        </div>
      </header>

      <form className="form-card" onSubmit={submit}>
        <div className="form-section">
          <h2>Target</h2>
          <div className="form-grid">
            <label>Name<input required value={f.name} onChange={edit("name")} /></label>
            <label>Repository URL<input required type="url" value={f.repo} onChange={edit("repo")} /></label>
            <label className="wide">Immutable ref / commit<input required value={f.ref} onChange={edit("ref")} /></label>
            <label className="wide">Scope<textarea required value={f.scope} onChange={edit("scope")} /></label>
          </div>
        </div>

        <div className="form-section">
          <h2>Disclosure window</h2>
          <div className="form-grid">
            <label>Starts<input required type="datetime-local" value={f.start} onChange={edit("start")} /></label>
            <label>Ends<input required type="datetime-local" value={f.end} onChange={edit("end")} /></label>
          </div>
        </div>

        <div className="form-section">
          <h2>Economics</h2>
          <div className="form-grid form-grid--3">
            <label>Researcher bond (GEN)<input required value={f.bond} onChange={edit("bond")} /></label>
            <label>Invalid / out-of-scope slash (bps)<input required type="number" min="0" max="5000" value={f.slash} onChange={edit("slash")} /></label>
            <label>Initial GEN funding<input required value={f.funding} onChange={edit("funding")} /></label>
            <label>LOW payout<input required value={f.low} onChange={edit("low")} /></label>
            <label>MEDIUM payout<input required value={f.medium} onChange={edit("medium")} /></label>
            <label>HIGH payout<input required value={f.high} onChange={edit("high")} /></label>
            <label>CRITICAL payout<input required value={f.critical} onChange={edit("critical")} /></label>
          </div>
        </div>

        <p className="form-note">Exact transfer on signature: {f.funding} GEN. This is paid by the currently connected wallet and cannot be edited after signing.</p>
        {draftTouched ? <p className="form-note form-note--draft">Kept as a draft in this browser — this form is restored after a reload, a rejected signature, or a failed submission, and is cleared only once the program is created.</p> : null}

        <div className="form-actions">
          <button className="connect" disabled={busy||!wallet.address}>
            {busy?"CREATING…":wallet.address?"CREATE AND FUND PROGRAM":"CONNECT WALLET TO CREATE"}
          </button>
        </div>
        <p className="form-message" aria-live="polite">{message}</p>
      {hash?<CopyHash value={hash} label="Creation transaction hash"/>:null}
      </form>
    </main>
  );
}
