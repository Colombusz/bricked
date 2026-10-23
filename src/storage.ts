export function readText(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
export function readJSON(key: string): unknown {
  try { const text = readText(key); return text === null ? null : JSON.parse(text); } catch { return null; }
}
export function writeJSON(key: string, value: unknown): boolean {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}
export function writeText(key: string, value: string): boolean {
  try { localStorage.setItem(key, value); return true; } catch { return false; }
}
