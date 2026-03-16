import { NextResponse } from "next/server";
import { withTimer } from "@/lib/timer";
import { verifyStaff, verifyUser } from "@/lib/auth";
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

export async function GET(req) {
  const origin = req.headers.get("origin");
  
  return withTimer(async () => {
    try {
      // 1. First, check if they are Staff
      const staffAuth = await verifyStaff(req);
      if (!staffAuth.error) {
        return json({ 
          authenticated: true, 
          role: 'staff',
          id: staffAuth.staff_id,
        }, 200, origin);
      }

      const userAuth = await verifyUser(req); 
      if (!userAuth.error) {
        return json({ 
          authenticated: true, 
          role: 'user',
          id: userAuth.user_id,
        }, 200, origin);
      }

      return json({ authenticated: false, role: 'guest' }, 200, origin);
    } catch (err) {
        console.error("Auth check failed:", err);
        return json({ authenticated: false, role: 'guest' }, 200, origin);
    }
  }, req, origin);
}