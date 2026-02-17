export async function GET(_, { params }) {
  const { rows } = await db.query(
    `SELECT * FROM users WHERE id=$1 AND is_deleted=false`,
    [params.id]
  );

  if (!rows.length)
    return NextResponse.json({ message: "not found" }, { status: 404 });

  return NextResponse.json(rows[0]);
}

export async function PUT(req, { params }) {
  const { name, phone_num } = await req.json();

  await db.query(
    `UPDATE users SET name=$1, phone_num=$2 WHERE id=$3`,
    [name, phone_num, params.id]
  );

  return NextResponse.json({ message: "updated" });
}

export async function DELETE(_, { params }) {
  await db.query(
    `UPDATE users SET is_deleted=true WHERE id=$1`,
    [params.id]
  );

  return NextResponse.json({ message: "deleted" });
}
