import { type NextRequest, NextResponse } from "next/server";
import { getRequestStats, cleanupOldRecords } from "@/lib/request-tracker";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    // Check if user is authenticated
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get current request statistics
    const stats = await getRequestStats();

    if (!stats) {
      return NextResponse.json(
        { error: "Failed to get request statistics" },
        { status: 500 }
      );
    }

    // Clean up old records periodically (only run occasionally)
    if (Math.random() < 0.1) {
      // 10% chance to run cleanup
      cleanupOldRecords().catch(console.error);
    }

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error in request-stats API:", error);
    return NextResponse.json(
      { error: "Failed to get request statistics" },
      { status: 500 }
    );
  }
}
