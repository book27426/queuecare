import { NextResponse } from "next/server";
import { db } from "@/lib/db";

async function extractToken(req) {
  const authHeader = req.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      error: NextResponse.json(
        { message: "Missing token" },
        { status: 401 }
      )
    };
  }

  return { token: authHeader.split(" ")[1] };
}

export async function verifyUser(req) {
  const tokenData = await extractToken(req);
  if (tokenData.error) return tokenData;

  const { rows } = await db.query(
    `SELECT id FROM "user"
     WHERE token=$1 AND is_deleted=false`,
    [tokenData.token]
  );

  if (rows.length === 0) {
    return {
      error: NextResponse.json(
        { message: "Invalid token" },
        { status: 401 }
      )
    };
  }

  return { user_id: rows[0].id };
}

export async function verifyStaff(req) {
  const tokenData = await extractToken(req);
  if (tokenData.error) return tokenData;

  const { rows } = await db.query(
    `SELECT id FROM staff
     WHERE token=$1 AND is_deleted=false`,
    [tokenData.token]
  );

  if (rows.length === 0) {
    return {
      error: NextResponse.json(
        { message: "Invalid token" },
        { status: 401 }
      )
    };
  }

  return { staff_id: rows[0].id };
}