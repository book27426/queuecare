export async function PUT(_, { params }) {
  await db.query(
    `UPDATE queue
     SET status='cancel', end_at=NOW()
     WHERE id=$1'`,
    [params.id]
  );

  return NextResponse.json({ message: "cancel" });
}
