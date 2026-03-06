import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyStaff } from "@/lib/auth";

export async function POST(req) {
  return withTimer(async () => {    
    try {
        // 1️. get section_id from URL
        const { searchParams } = new URL(req.url);
        const section_id = searchParams.get("id");

        if (!section_id) {
        return NextResponse.json(
            { success: false, message: "section id required" },
            { status: 400 }
        );
        }

        // 2️. get body
        const { name } = await req.json();

        if (!name) {
        return NextResponse.json(
            { success: false, message: "counter name required" },
            { status: 400 }
        );
        }

        // 3️. verify staff permission
        const auth = await verifyStaff(req, section_id);

        if (auth.error) return auth.error;

        if (!auth.isAdmin && !auth.isSuperAdmin) {
        return NextResponse.json(
            { success: false, message: "Admin permission required" },
            { status: 403 }
        );
        }

        // 4️. insert counter
        const { rows } = await db.query(
        `
        INSERT INTO counter (name, section_id)
        VALUES ($1, $2)
        RETURNING id, name, section_id
        `,
        [name.trim().toUpperCase(), section_id]
        );

        return NextResponse.json(
        {
            success: true,
            counter: rows[0]
        },
        { status: 201 }
        );

    } catch (err) {

        if (err.code === "23505") {
        return NextResponse.json(
            { success: false, message: "Counter already exists" },
            { status: 409 }
        );
        }

        console.error(err);

        return NextResponse.json(
        { success: false, message: "Server error" },
        { status: 500 }
        );
    }
  }, req, origin);
}

export async function PUT(req) {
  return withTimer(async () => {
    try {
        // 1️⃣ get counter id
        const { searchParams } = new URL(req.url);
        const counter_id = searchParams.get("id");

        if (!counter_id) {
        return NextResponse.json(
            { success: false, message: "counter id required" },
            { status: 400 }
        );
        }

        // 2️⃣ body
        const { name } = await req.json();

        if (!name) {
        return NextResponse.json(
            { success: false, message: "name required" },
            { status: 400 }
        );
        }

        // 3️⃣ get section of counter
        const counter = await db.query(
        `SELECT section_id FROM counter WHERE id = $1`,
        [counter_id]
        );

        if (counter.rowCount === 0) {
        return NextResponse.json(
            { success: false, message: "Counter not found" },
            { status: 404 }
        );
        }

        const section_id = counter.rows[0].section_id;

        // 4️⃣ verify permission
        const auth = await verifyStaff(req, section_id);
        if (auth.error) return auth.error;

        if (!auth.isAdmin && !auth.isSuperAdmin) {
        return NextResponse.json(
            { success: false, message: "Admin permission required" },
            { status: 403 }
        );
        }

        // 5️⃣ update counter
        const { rows } = await db.query(
        `
        UPDATE counter
        SET name = $1
        WHERE id = $2
        RETURNING id, name, section_id
        `,
        [name.trim().toUpperCase(), counter_id]
        );

        return NextResponse.json({
        success: true,
        counter: rows[0]
        });

    } catch (err) {

        if (err.code === "23505") {
        return NextResponse.json(
            { success: false, message: "Counter name already exists" },
            { status: 409 }
        );
        }

        console.error(err);

        return NextResponse.json(
        { success: false, message: "Server error" },
        { status: 500 }
        );
    }
  }, req, origin);
}

export async function DELETE(req) {
  const origin = req.headers.get("origin");
  return withTimer(async () => {
    try {
        const { searchParams } = new URL(req.url);
        const counter_id = searchParams.get("id");

        if (!counter_id) {
        return json(
            { success: false, message: "counter id required" },
            400,
            origin
        );
        }

        // find section_id of counter
        const { rows } = await db.query(
        `SELECT section_id FROM counter WHERE id = $1 AND is_deleted = false`,
        [counter_id]
        );

        if (!rows.length) {
        return json(
            { success: false, message: "counter not found" },
            404,
            origin
        );
        }

        const section_id = rows[0].section_id;

        // verify admin
        const auth = await verifyStaff(req, section_id);
        if (auth.error) return withCors(auth.error, origin);

        if (!auth.isAdmin && !auth.isSuperAdmin) {
        return json(
            { success: false, message: "admin only" },
            403,
            origin
        );
        }

        // soft delete
        await db.query(
        `
        UPDATE counter
        SET is_deleted = true
        WHERE id = $1
        `,
        [counter_id]
        );

        return json(
        { success: true, message: "counter deleted" },
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