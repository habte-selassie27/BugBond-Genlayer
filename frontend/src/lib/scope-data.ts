import { ensureContract, readClient } from "@/lib/genlayer";

/* readContract expects its positional args array as a specific encodable union
   that the SDK does not re-export, so derive it from the method signature. */
type ReadArgs = Parameters<ReturnType<typeof readClient>["readContract"]>[0]["args"];
export type Program=Record<string, string|number>; export type Report=Record<string,string|number>;
export type Batch<T>=(rows:T[])=>void;

const PAGE=50;
const CONCURRENCY=8;
const ATTEMPTS=4;
const ATTEMPT_TIMEOUT=15_000;
const TTL=30_000;

// StudioNet answers with 429s at 300 req/min and the public endpoint drops
// requests intermittently, so a single failed read must not surface as a
// dead-end error: retry with backoff, and bound parallelism on big pages.
async function withRetry<T>(run:()=>Promise<T>,attempts=ATTEMPTS):Promise<T>{
 let error:unknown;
 for(let i=0;i<attempts;i++){
  try{return await run();}
  catch(e){error=e;if(i<attempts-1)await new Promise((resolve)=>setTimeout(resolve,400*(2**i)));}
 }
 throw error;
}

// A hung connect otherwise blocks a page for 30s+ before the retry loop even
// sees it; fail the attempt early and let withRetry move on.
function withTimeout<T>(promise:Promise<T>,ms=ATTEMPT_TIMEOUT):Promise<T>{
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error(`Chain read timed out after ${ms}ms.`)),ms);
  promise.then((value)=>{clearTimeout(timer);resolve(value);},(error)=>{clearTimeout(timer);reject(error);});
 });
}
const read=<T>(functionName:string,args:ReadArgs)=>withRetry(()=>withTimeout(readClient().readContract({address:ensureContract(),functionName,args}) as Promise<T>));

/* Every list page used to re-issue the whole N+1 read chain on each mount, and
   a detail page re-read records the list had already fetched. Cache the promise
   (so concurrent callers share one in-flight read) for a short TTL, and drop it
   on any write so a fresh ledger still shows up. */
const store=new Map<string,{promise:Promise<unknown>;at:number}>();
function cached<T>(key:string,load:()=>Promise<T>):Promise<T>{
 const hit=store.get(key);
 if(hit&&Date.now()-hit.at<TTL)return hit.promise as Promise<T>;
 const promise=load().catch((error)=>{if(store.get(key)?.promise===promise)store.delete(key);throw error;});
 store.set(key,{promise,at:Date.now()});
 return promise;
}
export function invalidate(prefix:"program"|"report"){for(const key of [...store.keys()])if(key.startsWith(prefix))store.delete(key);}
export const invalidatePrograms=()=>invalidate("program");
export const invalidateReports=()=>invalidate("report");

async function mapLimit<T,R>(items:T[],limit:number,fn:(item:T)=>Promise<R>):Promise<R[]>{
 const out=new Array<R>(items.length);let cursor=0;
 await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{
  while(cursor<items.length){const index=cursor++;out[index]=await fn(items[index]);}
 }));
 return out;
}

// The contract's list_*_id views are offset/limit paginated, so the UI has to
// walk the cursor instead of reading a single hardcoded [0,50] window. Without
// this, anything past 50 programs or reports was silently dropped.
// The total and the first page are fetched together, and each page is pushed to
// onBatch so a page can render rows while the rest of the chain is still being
// read instead of holding a skeleton for the whole walk.
async function collect<T>(ns:"program"|"report",listFn:string,readFn:string,totalFn:string,onBatch?:Batch<T>):Promise<T[]>{
 const out:T[]=[];
 const totalP=read<number>(totalFn,[]);
 const loadOne=(id:number)=>cached<T>(`${ns}:${id}`,()=>read<T>(readFn,[id]));
 const first=(await read<number[]>(listFn,[0,PAGE]))||[];
 if(first.length){
  out.push(...await mapLimit(first,CONCURRENCY,loadOne));
  onBatch?.([...out]);
 }
 const total=Number(await totalP);
 for(let offset=PAGE;offset<total;offset+=PAGE){
  const ids=(await read<number[]>(listFn,[offset,PAGE]))||[];
  if(!ids.length)break;
  out.push(...await mapLimit(ids,CONCURRENCY,loadOne));
  onBatch?.([...out]);
 }
 return out;
}

export const programs=(onBatch?:Batch<Program>)=>cached("programs",()=>collect<Program>("program","list_program_ids","get_program","program_count",onBatch));
export const reports=(onBatch?:Batch<Report>)=>cached("reports",()=>collect<Report>("report","list_report_ids","get_report","report_count",onBatch));
export const program=(id:string)=>cached(`program:${id}`,()=>read<Program>("get_program",[BigInt(id)]));
export const report=(id:string)=>cached(`report:${id}`,()=>read<Report>("get_report",[BigInt(id)]));

// Disclosures linked to one program: read that program's own id page instead of
// downloading every report on the ledger just to filter them afterwards.
// knownCount comes from the program record and short-circuits the common case:
// list_program_report_ids touches get_or_insert_default, and on StudioNet that
// view never returns for a program with no reports yet.
export function programReports(programId:string,knownCount:number,onBatch?:Batch<Report>):Promise<Report[]>{
 if(!(knownCount>0))return Promise.resolve([]);
 return cached(`report:program:${programId}`,async()=>{
  const out:Report[]=[];
  for(let offset=0;offset<knownCount;offset+=PAGE){
   const ids=(await read<number[]>("list_program_report_ids",[BigInt(programId),offset,PAGE]))||[];
   if(!ids.length)break;
   out.push(...await mapLimit(ids,CONCURRENCY,(id)=>cached<Report>(`report:${id}`,()=>read<Report>("get_report",[id]))));
   onBatch?.([...out]);
   if(ids.length<PAGE)break;
  }
  return out;
 });
}

// The first read of a session pays DNS/TLS (~5s here) on the user's critical
// path. Warm it — and the two list caches — while the app is still idle.
let warmed=false;
export function warmChain(){
 if(warmed)return;
 warmed=true;
 void programs().catch(()=>undefined);
 void reports().catch(()=>undefined);
}
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
