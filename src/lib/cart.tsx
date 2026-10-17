import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type CartLine = {
  key: string;
  menu_item_id: string;
  name: string;
  unit_price_paise: number;
  options: Record<string, string>;
  quantity: number;
};

type CartState = { cafeId: string | null; lines: CartLine[] };

type CartCtx = CartState & {
  add: (cafeId: string, line: Omit<CartLine, "key">) => void;
  setQty: (key: string, qty: number) => void;
  clear: () => void;
  count: number;
  subtotal: number;
};

const Ctx = createContext<CartCtx | null>(null);
const KEY = "qless-cart-v1";

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CartState>({ cafeId: null, lines: [] });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setState(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(KEY, JSON.stringify(state));
  }, [state, loaded]);

  const add = useCallback((cafeId: string, line: Omit<CartLine, "key">) => {
    const key = `${line.menu_item_id}|${JSON.stringify(line.options)}`;
    setState((s) => {
      const lines = s.cafeId === cafeId ? [...s.lines] : [];
      const existing = lines.find((l) => l.key === key);
      if (existing) existing.quantity = Math.min(10, existing.quantity + line.quantity);
      else lines.push({ ...line, key });
      return { cafeId, lines };
    });
  }, []);

  const setQty = useCallback((key: string, qty: number) => {
    setState((s) => ({
      ...s,
      lines: s.lines
        .map((l) => (l.key === key ? { ...l, quantity: Math.min(10, qty) } : l))
        .filter((l) => l.quantity > 0),
    }));
  }, []);

  const clear = useCallback(() => setState({ cafeId: null, lines: [] }), []);

  const value = useMemo(
    () => ({
      ...state,
      add,
      setQty,
      clear,
      count: state.lines.reduce((n, l) => n + l.quantity, 0),
      subtotal: state.lines.reduce((n, l) => n + l.quantity * l.unit_price_paise, 0),
    }),
    [state, add, setQty, clear],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart outside CartProvider");
  return c;
}
