// Single-process MVP: shared password gets a shared budget, independent of spoofable IP headers.
export class LoginLimit {
  private attempts = 0;
  private until = 0;

  reserve(now = Date.now()): number {
    if (now >= this.until) { this.attempts = 0; this.until = now + 15 * 60_000; }
    if (this.attempts >= 5) return Math.ceil((this.until - now) / 1000);
    this.attempts++;
    return 0;
  }

  reset(): void { this.attempts = 0; this.until = 0; }
}

export const loginLimit = new LoginLimit();
