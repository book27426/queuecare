import { NextResponse } from "next/server";

export async function GET(req, context) {
  return NextResponse.json({
    params: context?.params ?? null,
  });
}
