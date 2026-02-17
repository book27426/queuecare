export async function GET(_, { params }) {
  const { rows } = await db.query(
    `SELECT * FROM staff WHERE section_id=$1 AND is_deleted=false`,
    [params.id]
  );

  return NextResponse.json(rows);
}
