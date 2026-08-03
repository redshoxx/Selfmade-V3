const listeners=new Set();
export const store={state:null,tab:'start',cloud:{enabled:false},session:null,sync:{online:navigator.onLine,realtime:'disconnected',lastSuccess:'',pending:0,failed:0,conflicts:0},ui:{dialogOpen:false,dirty:false,updateReady:false}};
export function setStore(patch){Object.assign(store,patch);listeners.forEach(fn=>fn(store))}
export function setState(state){store.state=state;store.sync.conflicts=state?.conflicts?.length||0;listeners.forEach(fn=>fn(store))}
export function subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn)}
