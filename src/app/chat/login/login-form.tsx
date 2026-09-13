"use client";
import { useState } from "react";

export default function CustomerLoginForm() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/chat/session", { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", signal: AbortSignal.timeout(15000), body: JSON.stringify({ loginName: data.get("loginName"), password: data.get("password") }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "登录失败，请重试。");
      form.reset();
      window.location.replace("/chat");
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit}>
    {error && <p className="form-error" role="alert">{error}</p>}
    <label htmlFor="customer-name">账号</label><input id="customer-name" name="loginName" autoComplete="username" maxLength={64} required disabled={busy} />
    <label htmlFor="customer-password">密码</label><input id="customer-password" name="password" type="password" autoComplete="current-password" maxLength={128} required disabled={busy} />
    <button disabled={busy}>{busy ? "登录中…" : "登录"}</button>
  </form>;
}
