import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import admin from "@/lib/firebaseAdmin";

export async function verifyFirebaseToken(req) {
  const authHeader = req.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("No token");
  }

  const token = authHeader.split("Bearer ")[1];

  const decodedToken = await admin.auth().verifyIdToken(token);

  const fullName = decodedToken.name || "";
  const [first_name, ...rest] = fullName.split(" ");
  const last_name = rest.join(" ");
  return {
    uid: decodedToken.uid,
    email: decodedToken.email,
    first_name: first_name,
    last_name: last_name
  };
}

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
     WHERE uid=$1 AND is_deleted=false`,
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
  const user = await verifyFirebaseToken(req);
  const uid = user.uid

  const { rows } = await db.query(
    `SELECT id, role, section_id FROM staff 
     WHERE uid=$1 AND is_deleted=false`,
    [uid]
  );

  if (rows.length === 0) {
    return {
      error: NextResponse.json(
        { message: "Invalid staff account" },
        { status: 401 }
      )
    };
  }

  return { 
    staff_id: rows[0].id, 
    role: rows[0].role,
    section_id: rows[0].section_id
  };
}