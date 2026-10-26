"use client";
import Link, { useLinkStatus } from "next/link";
function ReturnLabel({ name }: { name: string }) {
  const { pending } = useLinkStatus();
  return (
    <span role="status" aria-live="polite" aria-busy={pending}>
      {pending ? `Opening ${name} categories…` : `← All ${name} categories`}
    </span>
  );
}
export function CategoryReturn({ href, name }: { href: string; name: string }) {
  return (
    <Link
      className="area-navigation__back"
      aria-label={`All ${name} categories`}
      href={href}
      prefetch
      scroll={false}
    >
      <ReturnLabel name={name} />
    </Link>
  );
}
