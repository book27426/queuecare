import { NextResponse } from "next/server";

export async function GET(req, context) {
  const { queue_list_id } = await context.params;
  const section_id = 10
  const section_name = "General Service";

  // Mock assumptions
  const currentWaiting = 8;
  const avgOperationTime = 7; // minutes

  const estimatedWaitTime = currentWaiting * avgOperationTime;

  const mockData = {
    queue_list_id: queue_list_id,
    section_id: section_id,
    section_name: section_name,
    current_waiting_queue: currentWaiting,
    avg_operation_time_minutes: avgOperationTime,

    est_waiting_time_minutes: estimatedWaitTime,

    formula:
      "estimated_wait_time = current_waiting_queue × avg_operation_time",

    last_updated: new Date().toISOString(),
  };

  return NextResponse.json(mockData);
}
