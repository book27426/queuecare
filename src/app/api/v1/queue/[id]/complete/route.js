export async function PUT(_, { params }) {
  await db.query(
    `UPDATE queue
     SET status='completed', end_at=NOW()
     WHERE id=$1 AND status='serving'`,
    [params.id]
  );

  return NextResponse.json({ message: "completed" });
}
