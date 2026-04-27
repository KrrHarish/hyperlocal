import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface CartItem {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  image_url?: string;
}

interface CartContextType {
  items: CartItem[];
  shopId: string | null;
  shopName: string | null;
  addItem: (item: CartItem, shopId: string, shopName: string) => void;
  removeItem: (productId: string) => void;
  updateQty: (productId: string, qty: number) => void;
  clearCart: () => void;
  total: number;
  itemCount: number;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [shopId, setShopId]     = useState<string | null>(null);
  const [shopName, setShopName] = useState<string | null>(null);

  const addItem = (item: CartItem, sid: string, sname: string) => {
    if (shopId && shopId !== sid) {
      // different shop — reset cart
      setItems([{ ...item, quantity: 1 }]);
      setShopId(sid);
      setShopName(sname);
      return;
    }
    setShopId(sid);
    setShopName(sname);
    setItems(prev => {
      const existing = prev.find(i => i.product_id === item.product_id);
      if (existing) {
        return prev.map(i =>
          i.product_id === item.product_id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const removeItem = (productId: string) => {
    setItems(prev => prev.filter(i => i.product_id !== productId));
  };

  const updateQty = (productId: string, qty: number) => {
    if (qty <= 0) { removeItem(productId); return; }
    setItems(prev =>
      prev.map(i => i.product_id === productId ? { ...i, quantity: qty } : i)
    );
  };

  const clearCart = () => { setItems([]); setShopId(null); setShopName(null); };

  const total     = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const itemCount = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <CartContext.Provider value={{
      items, shopId, shopName, addItem, removeItem, updateQty,
      clearCart, total, itemCount,
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
