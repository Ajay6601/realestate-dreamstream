import { createClient } from "@/lib/supabase/server";

// Daily limit configuration - only for process properties
export const DAILY_REQUEST_LIMIT = 1500;

export interface RequestTracker {
  id: number;
  date: string; // YYYY-MM-DD format
  process_properties_requests: number; // This has the limit
  created_at: string;
  updated_at: string;
}

/**
 * Get current date in YYYY-MM-DD format (UTC)
 */
function getCurrentDate(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Get or create today's request tracker entry
 */
export async function getTodaysRequestTracker(): Promise<RequestTracker | null> {
  try {
    const supabase = await createClient();
    const today = getCurrentDate();

    // Try to get existing record for today
    const { data: existingRecord, error: fetchError } = await supabase
      .from("request_tracker")
      .select("*")
      .eq("date", today)
      .single();

    if (existingRecord && !fetchError) {
      return existingRecord;
    }

    // Create new record for today if it doesn't exist
    const { data: newRecord, error: insertError } = await supabase
      .from("request_tracker")
      .insert({
        date: today,
        process_properties_requests: 0,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating today's request tracker:", insertError);
      return null;
    }

    return newRecord;
  } catch (error) {
    console.error("Error getting today's request tracker:", error);
    return null;
  }
}

/**
 * Check if we can process properties (this affects both extract and process functionality)
 */
export async function canProcessProperties(
  requestCount: number = 1
): Promise<boolean> {
  try {
    const tracker = await getTodaysRequestTracker();
    if (!tracker) return false;

    // Only check process_properties_requests against the limit
    return (
      tracker.process_properties_requests + requestCount <= DAILY_REQUEST_LIMIT
    );
  } catch (error) {
    console.error("Error checking process properties limit:", error);
    return false;
  }
}

/**
 * Increment process properties request count (this is what counts against the limit)
 */
export async function incrementProcessPropertiesRequests(
  count: number = 1
): Promise<boolean> {
  try {
    const supabase = await createClient();
    const today = getCurrentDate();

    // Get current values first
    const tracker = await getTodaysRequestTracker();
    if (!tracker) return false;

    const { error } = await supabase
      .from("request_tracker")
      .update({
        process_properties_requests:
          tracker.process_properties_requests + count,
        updated_at: new Date().toISOString(),
      })
      .eq("date", today);

    if (error) {
      console.error("Error incrementing process properties requests:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error incrementing process properties requests:", error);
    return false;
  }
}

/**
 * Get current request statistics
 */
export async function getRequestStats(): Promise<{
  used: number; // process_properties_requests (what counts against limit)
  remaining: number;
  limit: number;
  canMakeRequests: boolean; // Can we process properties?
  resetTime: string; // When the limit resets (next midnight UTC)
} | null> {
  try {
    const tracker = await getTodaysRequestTracker();
    if (!tracker) return null;

    const used = tracker.process_properties_requests; // Only process properties count against limit
    const remaining = Math.max(0, DAILY_REQUEST_LIMIT - used);
    const canMakeRequests = remaining > 0;

    // Calculate reset time (next midnight UTC)
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    const resetTime = tomorrow.toISOString();

    return {
      used,
      remaining,
      limit: DAILY_REQUEST_LIMIT,
      canMakeRequests,
      resetTime,
    };
  } catch (error) {
    console.error("Error getting request stats:", error);
    return null;
  }
}

/**
 * Clean up old request tracker records (keep last 7 days)
 */
export async function cleanupOldRecords(): Promise<void> {
  try {
    const supabase = await createClient();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 7);
    const cutoffDate = thirtyDaysAgo.toISOString().split("T")[0];

    const { error } = await supabase
      .from("request_tracker")
      .delete()
      .lt("date", cutoffDate);

    if (error) {
      console.error("Error cleaning up old request tracker records:", error);
    } else {
      console.log("🧹 Cleaned up old request tracker records");
    }
  } catch (error) {
    console.error("Error during cleanup:", error);
  }
}
