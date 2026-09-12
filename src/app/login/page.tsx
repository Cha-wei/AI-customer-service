import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/modules/admin-auth";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (verifyAdminSession((await cookies()).get(ADMIN_SESSION_COOKIE)?.value)) redirect("/");
  const { error } = await searchParams;

  return <main className="login-shell">
    <section className="login-card">
      <p className="eyebrow">AI Customer Service</p>
      <h1>登录客服工作台</h1>
      <p className="login-intro">请输入本地配置的管理密码。</p>
      {error === "invalid" && <p className="form-error" role="alert">密码不正确，请重试。</p>}
      {error === "unconfigured" && <p className="form-error" role="alert">管理入口尚未配置，请联系系统管理员。</p>}
      <form action="/api/admin/session" method="post">
        <label htmlFor="password">管理密码</label>
        <input autoComplete="current-password" id="password" name="password" required type="password" />
        <button type="submit">登录</button>
      </form>
      <p className="security-note">会话仅保存在安全的 HttpOnly Cookie 中。</p>
    </section>
  </main>;
}
