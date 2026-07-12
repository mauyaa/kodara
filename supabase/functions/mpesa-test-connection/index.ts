import {
  createClient,
  type SupabaseClient,
} from "npm:@supabase/supabase-js@2.108.2";
import { corsHeaders, json, requiredEnv } from "../_shared/http.ts";

type CredentialRow = {
  shortcode: string;
  consumer_key: string;
  consumer_secret: string;
  passkey: string;
  environment: string;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return json({ error: "authentication_required" }, 401);
    }

    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const publicKey =
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY")?.trim() ||
      requiredEnv("SUPABASE_ANON_KEY");
    const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");

    const callerClient = createClient(supabaseUrl, publicKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authorization } },
    });
    const serviceClient: SupabaseClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const token = authorization.slice("Bearer ".length);
    const {
      data: { user },
      error: userError,
    } = await callerClient.auth.getUser(token);
    if (userError || !user) return json({ error: "invalid_session" }, 401);

    const { data: rows, error: credentialError } = await serviceClient.rpc(
      "get_landlord_mpesa_credentials",
      { target_landlord_id: user.id },
    );
    if (credentialError) {
      console.error("Could not load credentials for test", credentialError);
      return json({ error: "credential_lookup_failed" }, 503);
    }
    const credentials = (rows as CredentialRow[] | null)?.[0];
    if (!credentials) return json({ error: "landlord_mpesa_not_connected" }, 409);

    const darajaBaseUrl =
      credentials.environment === "production"
        ? "https://api.safaricom.co.ke"
        : "https://sandbox.safaricom.co.ke";

    const tokenResponse = await fetch(
      `${darajaBaseUrl}/oauth/v1/generate?grant_type=client_credentials`,
      {
        headers: {
          authorization: `Basic ${btoa(`${credentials.consumer_key}:${credentials.consumer_secret}`)}`,
          accept: "application/json",
        },
        signal: AbortSignal.timeout(10_000),
      },
    );

    if (!tokenResponse.ok) {
      return json({ ok: false, error: "daraja_rejected_credentials" });
    }
    const payload = (await tokenResponse.json()) as { access_token?: string };
    if (!payload.access_token) {
      return json({ ok: false, error: "daraja_rejected_credentials" });
    }

    const { error: markError } = await serviceClient.rpc(
      "mark_landlord_mpesa_verified",
      { target_landlord_id: user.id },
    );
    if (markError) console.error("Could not mark credentials verified", markError);

    return json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    console.error("mpesa-test-connection failed", message);
    return json({ ok: false, error: "connection_test_failed" }, 503);
  }
});
