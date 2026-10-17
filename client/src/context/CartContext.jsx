import { createContext, useContext, useEffect, useMemo, useReducer, useState } from "react";

const CartContext = createContext(null);
const KEY = "dream-yard-bag";
const lineId = (productId, size) => `${productId}:${size}`;

function reducer(state, action) {
  switch (action.type) {
    case "add": {
      const id = lineId(action.item.productId, action.item.size);
      const found = state.find((l) => l.id === id);
      if (found) return state.map((l) => (l.id === id ? { ...l, qty: l.qty + 1 } : l));
      return [...state, { ...action.item, id, qty: 1 }];
    }
    case "qty":
      return state.map((l) => (l.id === action.id ? { ...l, qty: l.qty + action.delta } : l)).filter((l) => l.qty > 0);
    case "remove":
      return state.filter((l) => l.id !== action.id);
    case "clear":
      return [];
    default:
      return state;
  }
}

export function CartProvider({ children }) {
  const [lines, dispatch] = useReducer(reducer, [], () => {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || [];
    } catch {
      return [];
    }
  });
  const [open, setOpen] = useState(false);

  useEffect(() => localStorage.setItem(KEY, JSON.stringify(lines)), [lines]);

  const value = useMemo(
    () => ({
      lines,
      open,
      setOpen,
      count: lines.reduce((n, l) => n + l.qty, 0),
      total: lines.reduce((n, l) => n + l.qty * l.price, 0),
      add: (item) => {
        dispatch({ type: "add", item });
        setOpen(true);
      },
      changeQty: (id, delta) => dispatch({ type: "qty", id, delta }),
      remove: (id) => dispatch({ type: "remove", id }),
      clear: () => dispatch({ type: "clear" }),
    }),
    [lines, open]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
