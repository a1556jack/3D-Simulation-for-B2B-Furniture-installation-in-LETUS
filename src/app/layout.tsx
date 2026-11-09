import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata={title:'LETUS | 반입 현장 3D',icons:{icon:`${process.env.NEXT_PUBLIC_BASE_PATH||''}/favicon.svg`},description:'실제 공개 지도 기반의 지역 3D 건물 탐색과 가구 반입 사전 확인'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ko"><body>{children}</body></html>;}
