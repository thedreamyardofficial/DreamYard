import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../api/client.js";

const AuthContext = createContext(null);
const TOKEN_KEY = "dream-yard-customer-token";

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => window.localStorage.getItem(TOKEN_KEY) || "");
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");

  useEffect(() => {
    if (!token) {
      setUser(null);
      setLoading(false);
      return undefined;
    }
    let active = true;
    setLoading(true);
    api.me(token)
      .then(({ user: currentUser }) => {
        if (active) setUser(currentUser);
      })
      .catch(() => {
        if (!active) return;
        window.localStorage.removeItem(TOKEN_KEY);
        setToken("");
        setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [token]);

  const authenticate = async (method, credentials) => {
    const result = await method(credentials);
    window.localStorage.setItem(TOKEN_KEY, result.token);
    setToken(result.token);
    setUser(result.user);
    setAuthOpen(false);
    return result.user;
  };

  const signIn = (credentials) => authenticate(api.login, credentials);
  const register = (credentials) => authenticate(api.register, credentials);
  const googleSignIn = (credential) => authenticate(api.googleLogin, credential);

  const signOut = () => {
    window.localStorage.removeItem(TOKEN_KEY);
    setToken("");
    setUser(null);
  };

  const openAuth = (mode = "login") => {
    setAuthMode(mode);
    setAuthOpen(true);
  };

  const closeAuth = () => setAuthOpen(false);

  const addAddress = async (address) => {
    const { user: updatedUser } = await api.addAddress(token, address);
    setUser(updatedUser);
    return updatedUser;
  };

  const removeAddress = async (addressId) => {
    const { user: updatedUser } = await api.removeAddress(token, addressId);
    setUser(updatedUser);
    return updatedUser;
  };

  const value = useMemo(() => ({
    token,
    user,
    loading,
    authOpen,
    authMode,
    signIn,
    register,
    googleSignIn,
    signOut,
    openAuth,
    closeAuth,
    addAddress,
    removeAddress,
  }), [token, user, loading, authOpen, authMode]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);