import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRootUser } from "@/lib/server-utils/invite-server-utils";

export async function DELETE(request: NextRequest) {
  try {
    // Verify the requester is the root user
    await requireRootUser();

    const { userId, email } = await request.json();

    if (!userId || !email) {
      return NextResponse.json(
        { error: "User ID and email are required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Delete the user from Supabase Auth
    // This will cascade delete the invite record due to ON DELETE CASCADE
    const { error: deleteUserError } = await supabase.auth.admin.deleteUser(
      userId
    );

    if (deleteUserError) {
      console.error("Error deleting user:", deleteUserError);
      return NextResponse.json(
        { error: "Failed to delete user account" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `User ${email} has been successfully deleted`,
    });
  } catch (error) {
    console.error("Delete user error:", error);

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
