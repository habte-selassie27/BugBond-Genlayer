import { ensureContract, readClient } from "@/lib/genlayer";
export type Program=Record<string, string|number>; export type Report=Record<string,string|number>;

const PAGE=50;

// The contract's list_*_id views are offset/limit paginated, so the UI has to
// walk the cursor instead of reading a single hardcoded [0,50] window. Without
// this, anything past 50 programs or reports was silently dropped.
async function collect<T>(listFn:string, readFn:string, totalFn:string):Promise<T[]>{
 const client=readClient(); const out:T[]=[];
 const total=Number(await client.readContract({address:ensureContract(),functionName:totalFn,args:[]}) as number);
 for(let offset=0;offset<total;offset+=PAGE){
  const ids=(await client.readContract({address:ensureContract(),functionName:listFn,args:[offset,PAGE]}) as number[])||[];
  if(!ids.length) break;
  out.push(...await Promise.all(ids.map((id)=>client.readContract({address:ensureContract(),functionName:readFn,args:[id]}) as Promise<T>)));
 }
 return out;
}

export async function programs(){return collect<Program>("list_program_ids","get_program","program_count");}
export async function reports(){return collect<Report>("list_report_ids","get_report","report_count");}
export async function program(id:string){return readClient().readContract({address:ensureContract(),functionName:"get_program",args:[BigInt(id)]}) as Promise<Program>}
export async function report(id:string){return readClient().readContract({address:ensureContract(),functionName:"get_report",args:[BigInt(id)]}) as Promise<Report>}
export const gen=(value: unknown)=>{try{return `${(BigInt(String(value))/1000000000000000000n).toString()} GEN`}catch{return "N/A"}};
export const programStatus=(value:unknown)=>Number(value)===1?"OPEN":Number(value)===2?"PAUSED":"CLOSED";
export const programTone=(value:unknown)=>Number(value)===1?"ok":Number(value)===2?"warn":"";
export const reportStatus=(value:unknown)=>["","UNDER REVIEW","NEEDS EVIDENCE","VALID","DUPLICATE","KNOWN ISSUE","OUT OF SCOPE","EXPLOITABILITY NOT ESTABLISHED","EXPIRED","WITHDRAWN"][Number(value)]||"UNKNOWN";
export const severity=(value:Report)=>String(value.severity||value.claimed_severity||"UNKNOWN").toUpperCase();
export const tone=(value:unknown)=>{
 const n=Number(value);
 if(n===3)return "ok";
 if(n===2||n===5)return "warn";
 if(n===4||n===6||n===7)return "bad";
 return "";
};
export const severityTone=(value:unknown)=>{
 const s=String(value||"").toUpperCase();
 if(s==="CRITICAL")return "bad";
 if(s==="HIGH")return "bad";
 if(s==="MEDIUM")return "warn";
 if(s==="LOW")return "ok";
 return "";
};
export const shortAddr=(value:unknown)=>{const a=String(value||"");return a.length>14?`${a.slice(0,8)}…${a.slice(-4)}`:a};

// Shared ledger helpers: free-text search plus a status facet, used by the
// disclosures and settlements pages.
export const searchText=(item:Program|Report,query:string)=>{
 const q=query.trim().toLowerCase();
 if(!q)return true;
 return ["id","title","synopsis","component","name","repository_url","verdict","researcher","disclosure_url"]
  .some((key)=>String(item[key]??"").toLowerCase().includes(q));
};
export const matchesStatus=(item:Program|Report,status:string)=>!status||String(item.status)===status;
export const statusOptions=(labels:readonly string[])=>labels.map((label,index)=>({label,value:String(index)}));
export const filterItems=<T extends Program|Report>(items:T[],query:string,status:string)=>items.filter((item)=>searchText(item,query)&&matchesStatus(item,status));

// Copies a transaction hash and reports success, so callers can flash a label.
export const copyText=async(value:unknown)=>{
 const text=String(value??"");
 if(!text)return false;
 try{await navigator.clipboard.writeText(text);return true;}
 catch{return false;}
};
