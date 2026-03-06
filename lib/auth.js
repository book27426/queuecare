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
    const uid = decoded.uid;

    // 1️⃣ Get staff id
    const { rows: staffRows } = await db.query(
      `
      SELECT id
      FROM staff
      WHERE uid = $1
      AND is_deleted = false
      `,
      [uid]
    );

    if (!staffRows.length) {
      return {
        error: NextResponse.json(
          { message: "Invalid staff account" },
          { status: 401 }
        )
      };
    }

    const staff_id = staffRows[0].id;

    // 2️⃣ Super admin check
    const { rows: superRows } = await db.query(
      `
      SELECT 1
      FROM staff_role
      WHERE staff_id = $1
      AND role = 'super_admin'
      `,
      [staff_id]
    );

    const isSuperAdmin = superRows.length > 0;

    // 3️⃣ If no section required → return basic info
    if (section_id === null) {
      return {
        staff_id,
        isSuperAdmin
      };
    }

    section_id = Number(section_id);

    // 4️⃣ Get role in that section
    const { rows: roleRows } = await db.query(
      `
      SELECT role, counter_id
      FROM staff_role
      WHERE staff_id = $1
      AND section_id = $2
      `,
      [staff_id, section_id]
    );

    if (!roleRows.length && !isSuperAdmin) {
      return {
        error: NextResponse.json(
          { message: "Forbidden: no access to this section" },
          { status: 403 }
        )
      };
    }

    const role = roleRows[0]?.role || null;
    const counter_id = roleRows[0]?.counter_id || null;

    const isAdmin = role === "admin";

    return {
      staff_id,
      role,
      isAdmin,
      isSuperAdmin,
      counter_id
    };

  } catch (err) {
    return {
      error: NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      )
    };
  }
}