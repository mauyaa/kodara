export const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers":
    "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

export function json(
  body: unknown,
  status = 200,
  headers: HeadersInit = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });
}

export async function readJson(
  request: Request,
  maximumBytes = 32_768,
): Promise<unknown> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > maximumBytes) {
    throw new Error("request_too_large");
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > maximumBytes) {
    throw new Error("request_too_large");
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("invalid_json");
  }
}

export function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`missing_environment_variable:${name}`);
  return value;
}

