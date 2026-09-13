import CustomerLoginForm from "./login-form";

export default function CustomerLoginPage() {
  return <main className="login-shell"><section className="login-card">
    <p className="eyebrow">Customer Support</p><h1>客户登录</h1>
    <p className="login-intro">登录后查询订单、申请退款和查看处理进度。</p>
    <CustomerLoginForm />
    <p className="muted">账号由客服开通。忘记密码或无法登录时，请联系人工客服。</p>
  </section></main>;
}
