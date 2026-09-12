export function LogoutButton() {
  return <form action="/api/admin/logout" method="post">
    <button className="secondary-button" type="submit">退出</button>
  </form>;
}
