export function isSameOrigin(request: Request): boolean {
  // TLS may terminate at the proxy. Trust deployment configuration, never forwarded headers.
  if (process.env.APP_ORIGIN) {
    try {
      const origin = new URL(process.env.APP_ORIGIN);
      if (origin.origin !== process.env.APP_ORIGIN || origin.protocol !== "https:") return false;
      return request.headers.get("origin") === origin.origin;
    } catch { return false; }
  }
  const url = new URL(request.url);
  const host = request.headers.get("host") ?? url.host;
  // Next's internal URL may use localhost even when the incoming Host is 127.0.0.1.
  return request.headers.get("origin") === `${url.protocol}//${host}`;
}
