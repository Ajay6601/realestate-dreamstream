import { NextRequest, NextResponse } from "next/server";
import { exportToExcel } from "@/lib/excel-export";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { data, filename } = await request.json();

    // Generate Excel file
    const buffer = await exportToExcel(data, filename);

    // Return the file
    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Excel export error:", error);
    return NextResponse.json(
      { error: "Failed to export Excel file" },
      { status: 500 }
    );
  }
}
