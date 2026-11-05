/** One instance per mounted Mission generation. No Core, execution or storage authority. */
export type SourceKind = 'scenario' | 'result' | 'evidence';
export type SourceTicket = { epoch:number; lane:SourceKind; revision:number; selection:number };
export function createSourceRequests() {
  let epoch=0, active=true, selection=0;
  const revisions={scenario:0,result:0,evidence:0};
  const ticket=(lane:SourceKind):SourceTicket=>({epoch,lane,revision:revisions[lane],selection});
  const accepts=(t:SourceTicket)=>active&&t.epoch===epoch&&t.revision===revisions[t.lane];
  return {
    activate(){active=true;},
    close(){active=false;epoch++;selection++;},
    begin(lane:SourceKind){revisions[lane]++;selection++;return ticket(lane);},
    untouched(lane:SourceKind){return revisions[lane]===0;},
    accepts,
    beginSelection(lane:SourceKind){selection++;return ticket(lane);},
    acceptsSelection(t:SourceTicket){return accepts(t)&&t.selection===selection;},
  };
}
export async function loadSourceCandidate(
  requests:ReturnType<typeof createSourceRequests>, kind:SourceKind, root:string, name:string,
  resolve:(root:string,name:string)=>Promise<string>, load:(path:string)=>Promise<void>,
  failure:(error:string)=>void,
) {
  const ticket=requests.beginSelection(kind);
  try {
    const path=await resolve(root,name);
    if(requests.acceptsSelection(ticket))await load(path);
  } catch(error) {
    if(requests.acceptsSelection(ticket))failure(String(error));
  }
}

/** Read failure is not semantic invalidity. Caller retains the persistent-local reference. */
export async function readLocalReference<T>(path:string, read:(path:string)=>Promise<{path:string;text:string}>, parse:(path:string,text:string)=>T) {
  let readSucceeded=false;
  try {
    const bytes=await read(path);readSucceeded=true;
    return {manifestPath:bytes.path,descriptor:parse(bytes.path,bytes.text),health:'available' as const,error:null};
  }catch(error) {
    return {manifestPath:path,descriptor:null,health:readSucceeded?'invalid content' as const:'unavailable' as const,error:error instanceof Error?error.message:String(error)};
  }
}
