import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import admin from "@/lib/firebaseAdmin";
import crypto from "crypto";

export async function verifySession(req) {
  const sessionCookie = req.cookies.get("session")?.value;

  if (!sessionCookie) {
    throw new Error("No session");
  }

  const decoded = await admin
    .auth()
    .verifySessionCookie(sessionCookie, true);

  return decoded;
}

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
  const token = req.cookies.get("user_token")?.value;

  if (!token) {
    return {
      error: NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      )
    };
  }

  // 🔐 Hash token before checking DB
  const hashedToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  const { rows } = await db.query(
    `SELECT ut.user_id
     FROM user_token ut
     JOIN users u ON u.id = ut.user_id
     WHERE ut.token = $1
       AND ut.expires_at > NOW()
       AND u.is_deleted = false`,
    [hashedToken]
  );

  if (!rows.length) {
    return {
      error: NextResponse.json(
        { message: "Invalid session" },
        { status: 401 }
      )
    };
  }

  return { 
    user_id: rows[0].user_id,
    token_hash: hashedToken
  };
}

export async function verifyStaff(req, section_id = null) {
  try {
    const decoded = await verifySession(req);
    
    const { sid: staff_id, sa: isSuperAdmin, rs: roles = {} } = decoded;

    if (!staff_id) {
      return { error: NextResponse.json({ message: "Invalid account" }, { status: 401 }) };
    }

    if (section_id === null) {
      return { staff_id, isSuperAdmin, roles };
    }

    const targetSection = String(section_id);
    const roleCode = roles[targetSection]; 

    if (!roleCode && !isSuperAdmin) {
      return { error: NextResponse.json({ message: "Forbidden" }, { status: 403 }) };
    }

    return {
      staff_id,
      role: roleCode === 'a' ? 'admin' : 'staff',
      isAdmin: roleCode === 'a',
      isSuperAdmin: !!isSuperAdmin,
    };
  } catch (err) {
    return { error: NextResponse.json({ message: "Unauthorized" }, { status: 401 }) };
  }
}