import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const options = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const derive = (password: string, salt: Buffer) => new Promise<Buffer>((resolve, reject) => {
  scrypt(password, salt, 64, options, (error, key) => error ? reject(error) : resolve(key));
});
export function validLoginName(value: string) { return /^[a-z0-9][a-z0-9._-]{2,63}$/.test(value); }
export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12 || password.length > 128) throw new Error("Password must contain 12–128 characters.");
  const salt = randomBytes(16);
  return `scrypt-v1$${salt.toString("hex")}$${(await derive(password, salt)).toString("hex")}`;
}
export async function verifyPassword(password: string, encoded: string | undefined): Promise<boolean> {
  const match = /^scrypt-v1\$([a-f0-9]{32})\$([a-f0-9]{128})$/.exec(encoded ?? "");
  // Unknown accounts still perform the same password derivation.
  const key = await derive(password, match ? Buffer.from(match[1], "hex") : Buffer.alloc(16));
  return timingSafeEqual(key, match ? Buffer.from(match[2], "hex") : Buffer.alloc(64)) && !!match;
}
