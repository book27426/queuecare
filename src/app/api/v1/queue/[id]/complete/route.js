export async function PUT(req, context) {
  const { id } = await context.params;
  const { staff_id } = await req.json();
  
  await db.query(
    `UPDATE queue
     SET status='completed', end_at=NOW()
     WHERE id=$1 AND status='serving'`,
    [id]
  );

  const detail = "update queue = " + id + " update to complete"
  await db.query(
    `INSERT INTO log (staff_id, action_type, action, target)
    VALUES ($1, $2, $3, $4)`,
    [staff_id, "update", detail, "user"]
  );

  return NextResponse.json({ message: "completed" });
}
