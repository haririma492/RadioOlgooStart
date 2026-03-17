// app/admin/hooks/useAdminAuth.ts
"use client";
import { useCallback, useEffect, useState } from "react";
import { useApiJson } from "./useApiJson";

export function useAdminAuth(pushLog: (s: string) => void) {
  const { apiJson } = useApiJson();
  const [token, setToken] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    setToken("");
    setAuthorized(false);
    setAuthError("");
  }, []);

  const verifyToken = useCallback(async () => {
    const t = token.trim();
    setAuthError("");
    if (!t) {
      setAuthorized(false);
      setAuthError("Token is required.");
      pushLog("❌ Missing token");
      return false;
    }
    const out = await apiJson("/api/admin/validate", {
      method: "POST",
      headers: { "x-admin-token": t },
      cache: "no-store",
    });
    const body = out.data;
    const bodyOk = body && typeof body === "object" && body.ok === true && !body.error;
    if (!out.ok || !bodyOk) {
      setAuthorized(false);
      const msg = (body && (body.detail || body.error || body.message)) || `Invalid token (HTTP ${out.status})`;
      setAuthError(String(msg));
      pushLog(`❌ ${msg}`);
      return false;
    }
    setAuthorized(true);
    setAuthError("");
    pushLog("✅ Token accepted");
    return true;
  }, [apiJson, token, pushLog]);

  const logout = useCallback(() => {
    setToken("");
    setAuthorized(false);
    setAuthError("");
    pushLog("Logged out");
  }, [pushLog]);

  return { token, setToken, authorized, authError, verifyToken, logout };
}
