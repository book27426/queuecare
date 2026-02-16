import { NextResponse } from "next/server";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") || "today";

  const mockData = {
    period,
    est_new_queue_per_hour: 110,
    est_complete_case_per_hour: 102,
    est_avg_operation_time_per_case_minutes: 6.9,
    active_sections: 4,
    active_staff: 12,

    hourly_breakdown: [
      { hour: "08:00", new_queue: 100, completed: 60 },
      { hour: "09:00", new_queue: 180, completed: 120 },
      { hour: "10:00", new_queue: 120, completed: 130 },
      { hour: "11:00", new_queue: 30, completed: 100 },
      { hour: "12:00", new_queue: 0, completed: 20 },
      { hour: "13:00", new_queue: 120, completed: 80 },
      { hour: "14:00", new_queue: 180, completed: 140 },
      { hour: "15:00", new_queue: 160, completed: 120 },
      { hour: "16:00", new_queue: 80, completed: 120 },
      { hour: "17:00", new_queue: 10, completed: 90 },
    ],

    last_updated: new Date().toISOString(),
  };

  return NextResponse.json(mockData);
}
