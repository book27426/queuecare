export async function PUT(req, { params }) {
  const { staff_id } = await req.json();

  await db.query(
    `UPDATE queue
     SET status='sented'
     WHERE id=$1`,
    [params.id]
  );

  await db.query(
    `INSERT INTO queue (number,user_id,queue_list_id)
     SELECT number,user_id,$2 FROM queue WHERE id=$1`,
    [params.id, params.queue_list_id]
  );

  const detail = "update queue = " + params.id + " update to transfer "+" create new queue at "+params.queue_list_id
  await db.query(
    `INSERT INTO log (staff_id, action_type, action, target)
    VALUES ($1, $2, $3, $4)`,
    [staff_id, "update", detail, "user"]
  );

  return NextResponse.json({ message: "transferred" });
}
