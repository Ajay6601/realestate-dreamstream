import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRootUser } from "@/lib/server-utils/invite-server-utils";

export async function GET(request: NextRequest) {
  try {
    // Verify the requester is the root user
    await requireRootUser();

    const supabase = await createClient();

    // Get all invites ordered by creation date (newest first)
    const { data: invites, error } = await supabase
      .from("invites")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching invites:", error);
      return NextResponse.json(
        { error: "Failed to fetch invites" },
        { status: 500 }
      );
    }

    // Enrich invites with user auth data
    const enrichedInvites = await Promise.all(
      (invites || []).map(async (invite) => {
        if (invite.user_id) {
          try {
            // Get user auth metadata
            const { data: userData, error: userError } =
              await supabase.auth.admin.getUserById(invite.user_id);

            if (!userError && userData.user) {
              return {
                ...invite,
                user_last_sign_in_at: userData.user.last_sign_in_at,
              };
            }
          } catch (authError) {
            console.error("Error fetching user auth data:", authError);
          }
        }
        return invite;
      })
    );

    return NextResponse.json({
      success: true,
      invites: enrichedInvites,
    });
  } catch (error) {
    console.error("Get invites error:", error);

    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json(
        { error: "Unauthorized access" },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
