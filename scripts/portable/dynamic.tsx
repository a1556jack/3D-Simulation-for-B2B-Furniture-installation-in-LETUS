import React,{lazy,Suspense,type ComponentType} from 'react';
export default function dynamic<P extends object>(loader:()=>Promise<{default:ComponentType<P>}>,options:{loading?:()=>React.ReactNode}){const Component=lazy(loader);return function PortableDynamic(props:P){return <Suspense fallback={options.loading?.()}><Component {...props}/></Suspense>;};}
