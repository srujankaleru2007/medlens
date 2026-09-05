"use client";
import { authHeaders } from './auth/client';

export async function authorizedFetch(url: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  for (const [key, value] of Object.entries(await authHeaders())) headers.set(key, value);
  const response = await fetch(url, { ...init, headers, cache: 'no-store', signal: init.signal ?? AbortSignal.timeout(90000) });
  if (!response.ok) {
    let message = 'Request failed. Try again.';
    try { const data = await response.json() as { error?: string }; message = data.error || message; } catch { /* Use safe fallback. */ }
    throw new Error(message);
  }
  return response;
}
export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  return (await authorizedFetch(url, init)).json() as Promise<T>;
}
