// src/utils/routeCrypto.ts
export const DYNAMIC_PREFIXES = ["/p/", "/c/", "/s/"] as const;

/** Build /p/<token> from a numeric employee id */
export function buildEncryptedProfilePath(id: number) {
  return `/p/${encodeEmployeeToken(id)}`;
}

/** Build /c/<token> from a numeric client id */
export function buildEncryptedClientPath(id: number) {
  return `/c/${encodeClientToken(id)}`;
}

/** Build /s/<token> from a numeric seller (user) id */
export function buildEncryptedSellerPath(id: number) {
  return `/s/${encodeSellerToken(id)}`;
}

export function encodeClientToken(id: number) {
  const raw = `cli:${id}:gaja`;
  const b64 = btoa(unescape(encodeURIComponent(raw)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function decodeClientToken(token: string): number | null {
  try {
    let b64 = token.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4 !== 0) b64 += "="; // restore padding
    const raw = decodeURIComponent(escape(atob(b64)));
    const m = raw.match(/^cli:(\d+):gaja$/);
    return m ? Number(m[1]) : null;
  } catch {
    return null;
  }
}

export function encodeEmployeeToken(id: number) {
  const raw = `emp:${id}:gaja`;
  const b64 = btoa(unescape(encodeURIComponent(raw)));
  // URL-safe base64 (no padding)
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function decodeEmployeeToken(token: string): number | null {
  try {
    let b64 = token.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4 !== 0) b64 += "="; // restore padding
    const raw = decodeURIComponent(escape(atob(b64)));
    const m = raw.match(/^emp:(\d+):gaja$/);
    return m ? Number(m[1]) : null;
  } catch {
    return null;
  }
}

export function encodeSellerToken(id: number) {
  const raw = `sel:${id}:gaja`;
  const b64 = btoa(unescape(encodeURIComponent(raw)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function decodeSellerToken(token: string): number | null {
  try {
    let b64 = token.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4 !== 0) b64 += "="; // restore padding
    const raw = decodeURIComponent(escape(atob(b64)));
    const m = raw.match(/^sel:(\d+):gaja$/);
    return m ? Number(m[1]) : null;
  } catch {
    return null;
  }
}
