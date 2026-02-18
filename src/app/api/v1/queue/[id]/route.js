export async function GET(_, context) {
  const { id } = await context.params;
  const { rows } = await db.query(
    `SELECT * FROM queue
     WHERE id=$1 AND is_deleted=false`,
    [id]
  );

  if (!rows.length)
    return NextResponse.json({ message: "Not found" }, { status: 404 });

  return NextResponse.json(rows[0]);
}