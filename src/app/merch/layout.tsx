import { CartProvider, FloatingCart, MerchNav } from "@/components/merch/cart";
import { catalog } from "@/lib/repositories/commerce";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CartProvider products={await catalog()}>
      <main id="upd-main" className="upd-main">
        <div className="p2-shell p2-merch">
          <MerchNav />
          {children}
        </div>
        <FloatingCart />
      </main>
    </CartProvider>
  );
}
