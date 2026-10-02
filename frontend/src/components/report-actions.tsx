import { useEffect, useMemo, useState } from "react";
import { ensureContract, waitFinalizedSuccessful } from "@/lib/genlayer";
import { useWallet } from "@/components/wallet-provider";
import type { Report } from "@/lib/scope-data";
import { CopyHash } from "@/components/copy-hash";

const SUBMITTED=1, NEEDS_EVIDENCE=2;
const TERMINAL=new Set([3,4,5,6,7,8,9]);

export function ReportActions({item,onRefresh}:{item:Report;onRefresh:()=>Promise<void>}){
 const wallet=useWallet();
 const [url,setUrl]=useState("");
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const [hash,setHash]=useState("");
 const [currentTime,setCurrentTime]=useState(Date.now);
 const status=Number(item.status), reportId=BigInt(String(item.id));
 const researcher=String(item.researcher||"");
 const isResearcher=Boolean(wallet.address)&&wallet.address!.toLowerCase()===researcher.toLowerCase();
 const deadline=useMemo(()=>Date.parse(String(item.evidence_deadline||"")),[item.evidence_deadline]);
 const expired=Number.isFinite(deadline)&&currentTime>=deadline;
 const adjudicateBy=useMemo(()=>Date.parse(String(item.adjudication_deadline||"")),[item.adjudication_deadline]);
 const adjudicationExpired=Number.isFinite(adjudicateBy)&&currentTime>=adjudicateBy;
 const submittedAt=useMemo(()=>Date.parse(String(item.submitted_at||"")),[item.submitted_at]);
 const recallable=Number.isFinite(submittedAt)&&currentTime-submittedAt<3600*1000;

 useEffect(()=>{
  if(!Number.isFinite(deadline))return;
  const target=status===NEEDS_EVIDENCE?deadline:adjudicateBy;
  if(!Number.isFinite(target))return;
  const timer=window.setTimeout(()=>setCurrentTime(Date.now()),Math.max(0,target-Date.now())+50);
  return()=>window.clearTimeout(timer);
 },[deadline,adjudicateBy,status]);

 async function write(functionName:string,args:unknown[]){
  setBusy(true);setMessage("Wallet signature requested…");
  try{
   const client=await wallet.getWriteClient();
   const hash=await client.writeContract({address:ensureContract(),functionName,args:args as never[],value:0n,consensusMaxRotations:3});
   setHash(hash);setMessage(`Transaction submitted: ${hash}. Waiting for finalization and GenVM execution…`);
   await waitFinalizedSuccessful(client as never,hash as never);
   setMessage("Finalized with successful GenVM execution. Refreshing the on-chain report…");
   await onRefresh();
   setMessage("Chain state refreshed.");
  }catch(error){
   setMessage(error instanceof Error?error.message:"Protocol action failed.");
   await onRefresh().catch(()=>undefined);
  }finally{setBusy(false)}
 }

 if(TERMINAL.has(status)) return <section className="protocol-actions"><p className="eyebrow">07 / PROTOCOL ACTIONS</p><h2>LIFECYCLE COMPLETE</h2><p>This report is terminal. No further lifecycle write is available.</p>{hash?<CopyHash value={hash} label="Last transaction hash"/>:null}</section>;
 if(status===SUBMITTED) return <section className="protocol-actions"><p className="eyebrow">07 / PROTOCOL ACTIONS</p><h2>READY FOR CONSENSUS</h2><p>Any connected account may ask GenLayer validators to adjudicate this submitted report.</p><p>Adjudication deadline: {String(item.adjudication_deadline||"Unavailable")}.</p>{adjudicationExpired&&hash?<CopyHash value={hash} label="Last transaction hash"/>:null}<button className="connect" disabled={busy||!wallet.address||adjudicationExpired} onClick={()=>write("adjudicate",[reportId])}>{busy?"ADJUDICATING…":adjudicationExpired?"ADJUDICATION WINDOW CLOSED":wallet.address?"RUN ADJUDICATION":"CONNECT WALLET TO ADJUDICATE"}</button>{adjudicationExpired?<><p>The adjudication window has closed. Any connected account may expire this report and return the full researcher bond.</p><button className="connect" disabled={busy||!wallet.address} onClick={()=>write("expire_submitted",[reportId])}>{busy?"EXPIRING…":wallet.address?"EXPIRE REPORT / RETURN BOND":"CONNECT WALLET TO EXPIRE"}</button></>:isResearcher&&recallable?<><p>You submitted this report and the recall grace window is still open.</p><button className="connect" disabled={busy} onClick={()=>write("withdraw_report",[reportId])}>{busy?"WITHDRAWING…":"WITHDRAW REPORT / RETURN BOND"}</button></>:null}<p className="tx-message" aria-live="polite">{message}</p>{hash?<CopyHash value={hash} label="Last transaction hash"/>:null}</section>;
 if(status===NEEDS_EVIDENCE) return <section className="protocol-actions"><p className="eyebrow">07 / PROTOCOL ACTIONS</p><h2>MORE EVIDENCE REQUESTED</h2><dl><div><dt>Reasoning</dt><dd>{String(item.reasoning||"No reasoning recorded.")}</dd></div><div><dt>Evidence digest</dt><dd>{String(item.evidence_digest||"No digest recorded.")}</dd></div><div><dt>Evidence round</dt><dd>{String(item.evidence_rounds??"0")} of 2</dd></div><div><dt>Fetched evidence digests</dt><dd>{(()=>{try{const d=JSON.parse(String(item.evidence_digests||"{}"));const keys=Object.keys(d).filter(k=>k!=="precedents");const extra=Array.isArray(d.precedents)?d.precedents.length:0;return keys.length?`${keys.length+extra} SHA-256 source digests bound into consensus`: "None recorded";}catch{return "None recorded";}})()}</dd></div><div><dt>Deadline</dt><dd>{String(item.evidence_deadline||"Unavailable")}</dd></div><div><dt>Researcher</dt><dd>{researcher}</dd></div><div><dt>Connected wallet</dt><dd>{wallet.address||"Not connected"}</dd></div><div><dt>Supplementary evidence</dt><dd>{String(item.supplementary_url||"None submitted")}</dd></div></dl>{expired?<><p>The evidence window has closed. The contract permits any connected account to expire this request and return the full researcher bond.</p><button className="connect" disabled={busy||!wallet.address} onClick={()=>write("expire_needs_evidence",[reportId])}>{busy?"EXPIRING…":wallet.address?"EXPIRE REQUEST / RETURN BOND":"CONNECT WALLET TO EXPIRE"}</button></>:isResearcher?<form onSubmit={e=>{e.preventDefault();if(!url.startsWith("https://")){setMessage("Supplementary evidence must use a public HTTPS URL.");return}void write("add_supplementary_evidence",[reportId,url])}}><label>Supplementary public evidence URL<input required type="url" pattern="https://.*" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://…"/></label><button className="connect" disabled={busy}>{busy?"SUBMITTING…":"ADD SUPPLEMENTARY EVIDENCE"}</button></form>:<p>Only the researcher address above may add evidence before the deadline. Connect that wallet to continue.</p>}<p className="tx-message" aria-live="polite">{message}</p></section>;
 return <section className="protocol-actions"><p className="eyebrow">07 / PROTOCOL ACTIONS</p><h2>ACTION UNAVAILABLE</h2><p>The current on-chain status does not expose a lifecycle write.</p>{hash?<CopyHash value={hash} label="Last transaction hash"/>:null}</section>;
}
