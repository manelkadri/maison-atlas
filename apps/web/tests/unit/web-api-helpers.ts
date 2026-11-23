import { vi } from "vitest";

export type FetchCall = { url: string; init: RequestInit; headers: Record<string, string> };

/** Remplace `fetch` par un simulacre qui enregistre les appels et renvoie la réponse du gestionnaire. */
export function stubFetch(handler: (call: FetchCall) => Response | Promise<Response>) {
  const calls: FetchCall[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const call: FetchCall = { url: String(input), init: init ?? {}, headers: { ...((init?.headers as Record<string, string> | undefined) ?? {}) } };
    calls.push(call);
    return handler(call);
  });
  vi.stubGlobal("fetch", fn);
  return { calls, fn };
}

export const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export const noContent = (): Response => new Response(null, { status: 204 });

export const apiError = (status: number, code: string, message: string): Response => json({ error: { code, message } }, status);

/** Corps JSON d'un appel enregistré. */
export function bodyOf(call: FetchCall): unknown {
  return typeof call.init.body === "string" ? (JSON.parse(call.init.body) as unknown) : call.init.body;
}
