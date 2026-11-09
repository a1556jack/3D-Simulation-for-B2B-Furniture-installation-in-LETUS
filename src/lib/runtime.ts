import type {SearchPlace} from './domain';
export type PortableData={places:SearchPlace[];workerUrl:string;fontUrl:string;mapRoot:string;manifestUrl:string};
declare global{interface Window{__LETUS_PORTABLE__?:PortableData}}
export function portableData():PortableData|undefined{return typeof window==='undefined'?undefined:window.__LETUS_PORTABLE__;}
