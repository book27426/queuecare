import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyStaff } from "@/lib/auth";
import crypto from "crypto";

export async function PUT(req) {
  const client = await db.connect();

  // try {
    // 2. Verify staff
    const auth = await verifyStaff(req);
    if (auth.error) return auth.error;

    if (!["admin", "super_admin"].includes(auth.role)) {
      return NextResponse.json(
        { success: false, message: "Admin only" },
        { status: 403 }
      );
    }
    
    const staff_id = auth.staff_id;
    // 1️. Get section id
    const { searchParams} = new URL(req.url);
    const sectionId = searchParams.get("id");

    if (!sectionId) {
      return NextResponse.json(
        { success: false, message: "section_id is required" },
        { status: 400 }
      );
    }

    const { rows: adminRows } = await client.query(
      `SELECT section_id
      FROM staff
      WHERE id = $1
        AND is_deleted = false`,
      [staff_id]
    );

    if (!adminRows.length) {
      return NextResponse.json(
        { success: false, message: "admin not found" },
        { status: 404 }
      );
    }

    const adminSectionId = adminRows[0].section_id;

    if (adminSectionId !== sectionId) {
      return NextResponse.json(
        { success: false, message: "you are not admin of this section" },
        { status: 403 }
      );
    }

    // 2. Get request body
    const body = await req.json();
    const expire_minutes = body?.expire_minutes ?? 30;

    if (expire_minutes <= 0) {
      return NextResponse.json(
        { success: false, essage: "expire_minutes must be positive" },
        { status: 400 }
      );
    }

    const expiresAt = new Date(Date.now() + expire_minutes * 60000);
    const inviteCode = crypto.randomBytes(3).toString("hex");

    await client.query("BEGIN");

    const result = await client.query(
      `
      UPDATE section
      SET invite_code = $1,
          code_expires_at = $2
      WHERE id = $3
        AND is_deleted = false
      RETURNING id, invite_code, code_expires_at
      `,
      [inviteCode, expiresAt, sectionId]
    );

    if (!result.rowCount) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { success: false, message: "Section not found" },
        { status: 404 }
      );
    }

    await client.query(
      `INSERT INTO log (staff_id, action_type, action, target)
       VALUES ($1, $2, $3, $4)`,
      [staff_id, "update", `Generate invite_code${inviteCode} section ${sectionId}`, "section"]
    );

    await client.query("COMMIT");

    return NextResponse.json({ success: true, data: {invite_code:inviteCode}}, { status: 201 });

  // } catch (err) {
  //   try {
  //     await client.query("ROLLBACK");
  //   } catch {}

  //   console.error(err);
  //   return NextResponse.json(
  //     { success: false, message: "internal server error" },
  //     { status: 500 }
  //   );
  // } finally {
  //   client.release();
  // }
}