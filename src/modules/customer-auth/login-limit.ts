// Single-process MVP. A global cap also bounds work and unknown-account map growth.
export class CustomerLoginLimit {
  private until = 0;
  private total = 0;
  private attempts = new Map<string, number>();
  reserve(name: string, now = Date.now()) {
    if (now >= this.until) { this.until = now + 15 * 60_000; this.total = 0; this.attempts.clear(); }
    const count = this.attempts.get(name) ?? 0;
    if (this.total >= 50 || count >= 5) return Math.ceil((this.until - now) / 1000);
    this.total++;
    this.attempts.set(name, count + 1);
    return 0;
  }
  success(name: string) { this.attempts.delete(name); }
}
export const customerLoginLimit = new CustomerLoginLimit();
