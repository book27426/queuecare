export async function PUT(_, { params }) {
  await db.query(
    `UPDATE queue
     SET status='serving', start_at=NOW()
     WHERE id=$1 AND status='waiting'`,
    [params.id]
  );

  return NextResponse.json({ message: "serving" });
}
