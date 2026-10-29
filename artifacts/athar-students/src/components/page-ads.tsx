import type { ReactNode } from 'react';
import { useLocation } from 'wouter';
import type { AdPage } from '@workspace/api-client-react';
import { AdSlot } from '../ads/AdSlot';
import './page-ads.css';

function useAdPage(): AdPage | null {
  const [location] = useLocation();
  const page = location.split('?')[0].split('/')[1] || 'home';
  return ['home','dashboard','achievements','learning','academy','roadmap','resume','assistant','profile'].includes(page) ? page as AdPage : null;
}
export function MiddlePageAd() {
  const page = useAdPage();
  return page ? <AdSlot page={page} slot="middle"/> : null;
}
export function PageAdFrame({ children }: { children: ReactNode }) {
  const page = useAdPage();
  if (!page) return <>{children}</>;
  return <>
    <AdSlot key={`${page}-top`} page={page} slot="top"/>
    <div className="site-ad-layout">
      <div className="site-ad-body">{children}</div>
      <div className="site-ad-side"><AdSlot key={`${page}-side`} page={page} slot="side"/></div>
    </div>
    <AdSlot key={`${page}-bottom`} page={page} slot="bottom"/>
    <AdSlot key={`${page}-start`} page={page} slot="floating-start"/>
    <AdSlot key={`${page}-end`} page={page} slot="floating-end"/>
  </>;
}
