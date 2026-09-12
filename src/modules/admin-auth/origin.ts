export function isSameOrigin(request: Request): boolean {
  const url = new URL(request.url);
  const host = request.headers.get("host") ?? url.host;
  // Next's internal URL may use localhost even when the incoming Host is 127.0.0.1.
  return request.headers.get("origin") === `${url.protocol}//${host}`;
}
