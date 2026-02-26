import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "http://localhost:3000",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Credentials": "true",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req) {
  const client = await db.connect();

  try {
    const { phone_num } = await req.json();

    if (!phone_num || phone_num.trim() === "") {
      return NextResponse.json(
        { success: false, message: "phone number required" },
        { status: 400 }
      );
    }

    const normalizedPhone = phone_num.trim();

    ///check  num is have in db
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");
    const ticket = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 3 * 60 * 1000);

    await client.query("BEGIN");

    await client.query(
      `
      INSERT INTO phone_otp
      (phone_num, ticket, otp, expires_at, attempt, phone_verify)
      VALUES ($1, $2, $3, $4, 0, false)
      ON CONFLICT (phone_num)
      DO UPDATE SET
        ticket = EXCLUDED.ticket,
        otp = EXCLUDED.otp,
        expires_at = EXCLUDED.expires_at,
        attempt = 0,
        phone_verify = false
      `,
      [normalizedPhone, ticket, hashedOtp, expiresAt]
    );

    await client.query("COMMIT");

    console.log("OTP:", otp);

    const response = NextResponse.json(
      { success: true },
      { status: 200 }
    );

    response.cookies.set("otp_ticket", ticket, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      maxAge: 3 * 60,
      path: "/",
    });

    return response

  } catch (err) {
    await client.query("ROLLBACK");
    return NextResponse.json(
      { success: false, message: "Internal Server Error" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}