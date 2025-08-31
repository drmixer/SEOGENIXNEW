export function newRequestId() {
  try {
    // @ts-ignore Deno global
    return crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  }
}

export function ok(data: any, meta?: Record<string, any>) {
  const rid = newRequestId();
  const body: any = { success: true, data, request_id: rid };
  if (meta && typeof meta === 'object') body.meta = meta;
  return body;
}

export function fail(message: string, code?: string, meta?: Record<string, any>) {
  const rid = newRequestId();
  const body: any = { success: false, error: { message }, request_id: rid };
  if (code) body.error.code = code;
  if (meta && typeof meta === 'object') body.meta = meta;
  return body;
}

