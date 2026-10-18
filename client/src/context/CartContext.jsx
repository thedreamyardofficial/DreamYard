import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { api } from "../api/client.js";
import { useAuth } from "./AuthContext.jsx";

const CartContext = createContext(null);
const KEY = "dream-yard-bag";
const lineId = (productId, size) => `${productId}:${size}`;

function readGuestCart() {
  try {
    const cart = JSON.parse(window.localStorage.getItem(KEY) || "[]");
    return Array.isArray(cart) ? cart : [];
  } catch {
    return [];
  }
}

function reducer(state, action) {
  switch (action.type) {
    case "add": {
      const id = lineId(action.item.productId, action.item.size);
      const found = state.find((l) => l.id === id);
      if (found) return state.map((l) => (l.id === id ? { ...l, qty: Math.min(10, l.qty + 1) } : l));
      return [...state, { ...action.item, id, qty: 1 }];
    }
    case "qty":
      return state.map((l) => (l.id === action.id ? { ...l, qty: Math.min(10, l.qty + action.delta) } : l)).filter((l) => l.qty > 0);
    case "remove":
      return state.filter((l) => l.id !== action.id);
    case "clear":
      return [];
    case "replace":
      return action.lines;
    default:
      return state;
  }
}

function mergeLines(saved, local) {
  const merged = new Map();
  for (const line of saved) {
    const id = lineId(line.productId, line.size);
    if (!merged.has(id)) merged.set(id, { ...line, id });
  }
  for (const line of local) {
    const id = lineId(line.productId, line.size);
    if (!merged.has(id)) merged.set(id, { ...line, id });
  }
  return [...merged.values()];
}

export function CartProvider({ children }) {
  const { token, user } = useAuth();
  const [readyOwner, setReadyOwner] = useState("");
  const [guestLines, setGuestLines] = useState(readGuestCart);
  const guestLinesRef = useRef(guestLines);
  const [lines, dispatch] = useReducer(reducer, guestLines, (initialLines) => initialLines);
  const [open, setOpen] = useState(false);
  const saveQueue = useRef(Promise.resolve());
  const saveTimer = useRef(null);
  const ownerId = user?._id || "";

  useEffect(() => {
    guestLinesRef.current = guestLines;
    window.localStorage.setItem(KEY, JSON.stringify(guestLines));
  }, [guestLines]);

  useEffect(() => {
    if (!token || !ownerId) {
      setReadyOwner("");
      dispatch({ type: "replace", lines: guestLinesRef.current });
      return undefined;
    }
    let active = true;
    setReadyOwner("");
    api.getCart(token)
      .then(({ cart }) => {
        if (!active) return;
        dispatch({ type: "replace", lines: mergeLines(cart, guestLinesRef.current) });
        setReadyOwner(ownerId);
      })
      .catch(() => {
        if (!active) return;
        dispatch({ type: "replace", lines: guestLinesRef.current });
        setReadyOwner(ownerId);
      });
    return () => { active = false; };
  }, [ownerId, token]);

  const persistCart = (items) => {
    const snapshot = items.map(({ productId, size, qty }) => ({ productId, size, qty }));
    saveQueue.current = saveQueue.current
      .catch(() => {})
      .then(() => api.saveCart(token, snapshot));
    return saveQueue.current;
  };

  useEffect(() => {
    if (!ownerId || readyOwner !== ownerId) return undefined;
    saveTimer.current = window.setTimeout(() => {
      saveTimer.current = null;
      persistCart(lines).catch(() => {});
    }, 350);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    };
  }, [lines, ownerId, readyOwner, token]);

  const flushCart = () => {
    if (!ownerId || readyOwner !== ownerId) return Promise.resolve();
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = null;
    return persistCart(lines);
  };

  const value = useMemo(
    () => ({
      lines,
      open,
      setOpen,
      flushCart,
      count: lines.reduce((n, l) => n + l.qty, 0),
      total: lines.reduce((n, l) => n + l.qty * l.price, 0),
      add: (item) => {
        dispatch({ type: "add", item });
        const id = lineId(item.productId, item.size);
        if (!ownerId || guestLinesRef.current.some((line) => lineId(line.productId, line.size) === id)) {
          setGuestLines((current) => reducer(current, { type: "add", item }));
        }
        setOpen(true);
      },
      changeQty: (id, delta) => {
        dispatch({ type: "qty", id, delta });
        if (!ownerId || guestLinesRef.current.some((line) => line.id === id || lineId(line.productId, line.size) === id)) {
          setGuestLines((current) => reducer(current, { type: "qty", id, delta }));
        }
      },
      remove: (id) => {
        dispatch({ type: "remove", id });
        setGuestLines((current) => reducer(current, { type: "remove", id }));
      },
      clear: () => {
        dispatch({ type: "clear" });
        setGuestLines([]);
      },
    }),
    [lines, open, ownerId, readyOwner, token]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
