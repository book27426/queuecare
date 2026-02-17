export async function PUT(_, { params }) {
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

  return NextResponse.json({ message: "transferred" });
}
