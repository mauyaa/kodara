import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { persistentRateLimit } from "@/lib/rate-limit";
import { getServerAuthClient } from "@/lib/supabase";

const phoneSchema = z
  .string()
  .regex(/^(?:\+?254|0)?[17]\d{8}$/, "Use a valid Kenyan mobile number");
const requestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("send-otp"),
    phone: phoneSchema,
    fullName: z.string().trim().min(2).max(100).optional(),
  }),
  z.object({
    action: z.literal("verify-otp"),
    phone: phoneSchema,
    otp: z.string().regex(/^\d{6}$/),
  }),
]);

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("254")) return `+${digits}`;
  if (digits.startsWith("0")) return `+254${digits.slice(1)}`;
  return `+254${digits}`;
}

export async function POST(req: NextRequest) {
  const client = getServerAuthClient();
  if (!client)
    return NextResponse.json(
      { error: "Authentication service is not configured" },
      { status: 503 },
    );

  const parsed = requestSchema.safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.issues },
      { status: 400 },
    );

  const phone = normalizePhone(parsed.data.phone);
  const rate = await persistentRateLimit(phone, parsed.data.action);
  if (!rate.allowed)
    return NextResponse.json(
      { error: "Too many attempts. Try again in one minute." },
      { status: 429 },
    );

  if (parsed.data.action === "send-otp") {
    const { error } = await client.auth.signInWithOtp({
      phone,
      options: { data: { full_name: parsed.data.fullName } },
    });
    if (error)
      return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({
      success: true,
      message: "Verification code sent",
    });
  }

  const { data, error } = await client.auth.verifyOtp({
    phone,
    token: parsed.data.otp,
    type: "sms",
  });
  if (error || !data.session)
    return NextResponse.json(
      { error: error?.message ?? "Invalid or expired verification code" },
      { status: 401 },
    );

  return NextResponse.json({
    success: true,
    user: { id: data.user?.id, phone: data.user?.phone },
    session: {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at,
    },
  });
}
