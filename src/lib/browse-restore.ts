declare global {
  interface Window {
    __updBrowseRestoreTimer?: number;
  }
}

export function finishBrowseRestore() {
  document.documentElement.removeAttribute("data-browse-restoring");
  document.documentElement.style.removeProperty("--browse-reserve");
  window.clearTimeout(window.__updBrowseRestoreTimer);
  delete window.__updBrowseRestoreTimer;
}
export function holdBrowseRestore(height?: number) {
  document.documentElement.dataset.browseRestoring = "true";
  if (height && Number.isFinite(height))
    document.documentElement.style.setProperty(
      "--browse-reserve",
      `${Math.min(height, 200000)}px`,
    );
  window.__updBrowseRestoreTimer ??= window.setTimeout(
    finishBrowseRestore,
    8000,
  );
}

/** Parser-time fallback for a full document reload, before any top-of-list content paints. */
export function browseRestoreBootstrap(scope: string) {
  return `(()=>{try{
    const u=location.pathname+location.search+location.hash;
    let p=history.state?.updBrowsePosition;
    if(p?.url!==u)p=JSON.parse(sessionStorage.getItem('upd:browse-position:'+u)||'null');
    if(!p||p.url!==u||p.scope!==${JSON.stringify(scope).replaceAll("<", "\\u003c")}||!Number.isFinite(p.y)||p.y<1)return;
    const n=performance.getEntriesByType('navigation')[0];
    const r=document.referrer?new URL(document.referrer):null;
    if(n?.type!=='back_forward'&&sessionStorage.getItem('upd:restore-browse')!==u&&!(r?.origin===location.origin&&r.pathname.startsWith('/place/')))return;
    document.documentElement.dataset.browseRestoring='true';
    if(Number.isFinite(p.height))document.documentElement.style.setProperty('--browse-reserve',Math.min(p.height,200000)+'px');
    window.__updBrowseRestoreTimer=setTimeout(()=>{document.documentElement.removeAttribute('data-browse-restoring');document.documentElement.style.removeProperty('--browse-reserve');delete window.__updBrowseRestoreTimer},8000);
  }catch{}})();`;
}
