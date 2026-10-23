"use client";
export default function ErrorPage({reset}:{error:Error;reset:()=>void}) {
 return <main className="upd-main" id="upd-main"><div className="upd-container"><div className="upd-auth-card"><h1>Temporarily unavailable</h1><p>We couldn&apos;t load this page. Please try again.</p><button className="upd-btn upd-btn--primary" onClick={reset}>Try again</button></div></div></main>;
}
