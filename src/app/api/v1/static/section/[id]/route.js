import { NextResponse } from "next/server";

export async function GET(req, { params }) {
  const sectionId = Number(params.section_id);
  const section_name = idk
  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") || "today";

  const mockData = {
    section_id: sectionId,
    section_name :section_name,
    period,
    est_new_queue_per_hour: 28,
    est_complete_case_per_hour: 24,
    est_avg_operation_time_per_case_minutes: 7.4,

    hourly_breakdown: [
      { hour: "08:00", new_queue: 12, completed: 10 },
      { hour: "09:00", new_queue: 35, completed: 30 },
      { hour: "10:00", new_queue: 22, completed: 20 },
      { hour: "11:00", new_queue: 18, completed: 16 },
      { hour: "12:00", new_queue: 0, completed: 11 },
      { hour: "13:00", new_queue: 22, completed: 20 },
      { hour: "14:00", new_queue: 24, completed: 22 },
      { hour: "15:00", new_queue: 18, completed: 16 },
      { hour: "16:00", new_queue: 12, completed: 14 },
      { hour: "17:00", new_queue: 4, completed:  8},
    ],

    last_updated: new Date().toISOString(),
  };

  return NextResponse.json(mockData);
}
