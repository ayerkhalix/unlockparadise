import { Icon } from "./icon";

export function FeatureLock({ feature }: { feature: string }) {
  return (
    <section className="member-lock" aria-labelledby="member-lock-title">
      <a className="member-lock__brand" href="/">
        <img
          src="/original/wp-content/uploads/2026/07/upd-mark-white-header-300x300.png"
          width={40}
          height={40}
          alt=""
        />
        Unlock Paradise
      </a>
      <div className="member-lock__symbol" aria-hidden="true">
        <Icon name="Lock" size={92} />
      </div>
      <h1 id="member-lock-title">{feature}</h1>
      <p>
        Upgrade to <strong>Explorer+</strong> to access this feature.
      </p>
      <a className="upd-btn upd-btn--vip" href="/checkout/">
        Upgrade to Explorer+
      </a>
      <a className="member-lock__return" href="/">
        Keep exploring Palawan
      </a>
    </section>
  );
}
