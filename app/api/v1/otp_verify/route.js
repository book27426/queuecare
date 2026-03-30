import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withTimer } from "@/lib/timer";
import crypto from "crypto";

import { withCors, getCorsHeaders } from "@/lib/cors";

function json(data, status, origin) {
  return withCors(
    NextResponse.json(data, { status }),
    origin
  );
}

export async function OPTIONS(req) {
  const origin = req.headers.get("origin");

  return new Response(null, {
    status: 200,
    headers: getCorsHeaders(origin),
  });
}

export async function POST(req) {
  const origin = req.headers.get("origin");
  return withTimer(async () => {
    try {
      const { phone_num } = await req.json();

      if (!phone_num || phone_num.trim() === "")
        return json({ success: false, message: "phone number required" }, 400, origin);

      const normalizedPhone = phone_num.trim();

      ///check  num is have in db
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");
      const ticket = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 3 * 60 * 1000);

      await db.query(
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

      console.log("OTP:", otp);

      const response = NextResponse.json(
        { success: true , message: otp},
        { status: 200 }
      );

      response.cookies.set("otp_ticket", ticket, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: 3 * 60,
        path: "/",
      });

      return withCors(response, origin);

    } catch (err) {
      return json({ success: false, message: "Internal Server Error" }, 500, origin);
    }
  }, req, origin);
}

export async function GET(req) {
  const origin = req.headers.get("origin");
  return withTimer(async () => {
    try {
      const { searchParams } = new URL(req.url);
      const counter_id = Number(searchParams.get("id"));
      const search = Number(searchParams.get("search"));

      if (!counter_id || Number.isNaN(counter_id)) {
        return json(
          { success: false, message: "valid counter id required" },
          400,
          origin
        );
      }

      const counterCheck = await db.query(
        `SELECT id, name, section_id
        FROM counter
        WHERE id = $1
        AND is_deleted = false`,
        [counter_id]
      );
      
      if (!counterCheck.rowCount) {
        return json(
          { success: false, message: "counter not found" },
          404,
          origin
        );
      }

      const counter = counterCheck.rows[0];

      // 3️⃣ verify permission
      const auth = await verifyStaff(req, counter.section_id);
      if (auth.error) return auth.error;

      if (!auth.isAdmin && !auth.isSuperAdmin && auth.counter_id !== counter_id) {
        return json(
          { success: false, message: "Forbidden: not your counter" },
          403,
          origin
        );
      }

      const calledQueues = await db.query(
        `SELECT id, number, name
        FROM queue
        WHERE section_id = $1
        AND queue_date = CURRENT_DATE
        AND status = 'no_show'
        ORDER BY number`,
        [counter.section_id]
      );

      return json(
        {
          success: true,
          data: {
            called_queues: calledQueues.rows
          }
        },
        200,
        origin
      );

    } catch (err) {
      console.error(err);

      return json(
        { success: false, message: "server error" },
        500,
        origin
      );
    }
  }, req, origin);
}