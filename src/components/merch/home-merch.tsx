"use client";
import { ContentImage } from "@/components/ui/content-image";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Product } from "@/lib/merch-products";
import { php } from "@/lib/commerce";

export function HomeMerch({ products }: { products: Product[] }) {
  const rail = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ first: true, last: false });
  useEffect(() => {
    const node = rail.current;
    if (!node) return;
    const observer = new ResizeObserver(() =>
      setPosition({
        first: node.scrollLeft < 2,
        last: node.scrollLeft + node.clientWidth >= node.scrollWidth - 2,
      }),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [products.length]);
  if (!products.length) return null;
  const update = () => {
    const node = rail.current;
    if (node)
      setPosition({
        first: node.scrollLeft < 2,
        last: node.scrollLeft + node.clientWidth >= node.scrollWidth - 2,
      });
  };
  return (
    <section className="home-merch" aria-labelledby="home-merch-title">
      <div className="home-merch__heading">
        <div>
          <h2 id="home-merch-title">Take a little paradise with you.</h2>
          <p>Everyday pieces for your next adventure.</p>
        </div>
        <Link className="p2-button p2-button--quiet" href="/merch/">
          View all merch
        </Link>
      </div>
      <div
        className="home-merch__controls"
        role="group"
        aria-label="Browse merchandise"
      >
        <button
          type="button"
          className="p2-icon"
          aria-label="Previous merchandise"
          disabled={position.first}
          onClick={() =>
            rail.current?.scrollBy({
              left: -rail.current.clientWidth,
              behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
                ? "instant"
                : "smooth",
            })
          }
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="m14 6-6 6 6 6" />
          </svg>
        </button>
        <button
          type="button"
          className="p2-icon"
          aria-label="Next merchandise"
          disabled={position.last}
          onClick={() =>
            rail.current?.scrollBy({
              left: rail.current.clientWidth,
              behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
                ? "instant"
                : "smooth",
            })
          }
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="m10 6 6 6-6 6" />
          </svg>
        </button>
      </div>
      <div
        ref={rail}
        className="home-merch__rail"
        onScroll={update}
        onLoad={update}
        role="region"
        aria-label="Merchandise preview"
        tabIndex={0}
      >
        {products.slice(0, 8).map((p) => (
          <Link
            className="home-merch__item"
            href={`/merch/products/${p.slug}/`}
            key={p.id}
          >
            <ContentImage sizes="(max-width: 640px) 45vw, 240px"
              src={p.displayImage}
              alt={p.imageAlts?.[0] || p.name}
              loading="lazy"
              width={400}
              height={480}
            />
            <div>
              <h3>{p.name}</h3>
              <span>{php(p.priceCentavos ?? Math.round(p.price * 100))}</span>
            </div>
            <p>{p.collection || "Unlock Paradise Collection"}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
