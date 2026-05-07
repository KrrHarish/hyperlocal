import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface CartItem {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  image_url?: string;
}

export interface ShopBucket {
  shopId:   string;
  shopName: string;
  items:    CartItem[];
}

interface CartContextType {
  // Multi-shop
  shops:      Record<string, ShopBucket>;  // keyed by shopId
  totalShops: number;
  grandTotal: number;
  itemCount:  number;

  // Per-shop helpers
  addItem:      (item: CartItem, shopId: string, shopName: string) => void;
  removeItem:   (productId: string, shopId: string) => void;
  updateQty:    (productId: string, shopId: string, qty: number) => void;
  clearShop:    (shopId: string) => void;
  clearCart:    () => void;
  getShopItems: (shopId: string) => CartItem[];
  getShopTotal: (shopId: string) => number;

  // Legacy single-shop compat — returns first shop (for existing screens)
  shopId:   string | null;
  shopName: string | null;
  items:    CartItem[];
  total:    number;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [shops, setShops] = useState<Record<string, ShopBucket>>({});

  const addItem = (item: CartItem, shopId: string, shopName: string) => {
    setShops(prev => {
      const bucket = prev[shopId] ?? { shopId, shopName, items: [] };
      const existing = bucket.items.find(i => i.product_id === item.product_id);
      const newItems = existing
        ? bucket.items.map(i => i.product_id === item.product_id ? { ...i, quantity: i.quantity + 1 } : i)
        : [...bucket.items, { ...item, quantity: 1 }];
      return { ...prev, [shopId]: { shopId, shopName, items: newItems } };
    });
  };

  const removeItem = (productId: string, shopId: string) => {
    setShops(prev => {
      const bucket = prev[shopId];
      if (!bucket) return prev;
      const newItems = bucket.items.filter(i => i.product_id !== productId);
      if (!newItems.length) {
        const { [shopId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [shopId]: { ...bucket, items: newItems } };
    });
  };

  const updateQty = (productId: string, shopId: string, qty: number) => {
    if (qty <= 0) { removeItem(productId, shopId); return; }
    setShops(prev => {
      const bucket = prev[shopId];
      if (!bucket) return prev;
      return {
        ...prev,
        [shopId]: {
          ...bucket,
          items: bucket.items.map(i => i.product_id === productId ? { ...i, quantity: qty } : i),
        },
      };
    });
  };

  const clearShop = (shopId: string) => {
    setShops(prev => { const { [shopId]: _, ...rest } = prev; return rest; });
  };

  const clearCart = () => setShops({});

  const getShopItems = (shopId: string) => shops[shopId]?.items ?? [];
  const getShopTotal = (shopId: string) =>
    (shops[shopId]?.items ?? []).reduce((s, i) => s + i.price * i.quantity, 0);

  const totalShops = Object.keys(shops).length;
  const allItems   = Object.values(shops).flatMap(b => b.items);
  const grandTotal = allItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const itemCount  = allItems.reduce((s, i) => s + i.quantity, 0);

  // Legacy compat: expose first shop as the "active" shop
  const firstShop  = Object.values(shops)[0] ?? null;
  const shopId     = firstShop?.shopId   ?? null;
  const shopName   = firstShop?.shopName ?? null;
  const items      = firstShop?.items    ?? [];
  const total      = firstShop ? getShopTotal(firstShop.shopId) : 0;

  return (
    <CartContext.Provider value={{
      shops, totalShops, grandTotal, itemCount,
      addItem, removeItem, updateQty, clearShop, clearCart,
      getShopItems, getShopTotal,
      shopId, shopName, items, total,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be inside CartProvider');
  return ctx;
};
