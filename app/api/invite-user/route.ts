import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  requireRootUser,
  generateSecurePassword,
} from "@/lib/server-utils/invite-server-utils";
import { sendInviteEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    // Verify the requester is the root user
    await requireRootUser();

    const { email, message } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Check if we have already sent an invitation to this email
    const { data: existingInvite, error: inviteCheckError } = await supabase
      .from("invites")
      .select("id, created_at, user_id")
      .eq("email", email)
      .single();

    // If we found an existing invite, we can't invite the same email again
    if (existingInvite) {
      return NextResponse.json(
        {
          error: "An invitation has already been sent to this email address",
        },
        { status: 409 }
      );
    }

    // Generate secure temporary password
    const temporaryPassword = generateSecurePassword(16);

    // Create user using Supabase Admin API
    const { data: newUser, error: createUserError } =
      await supabase.auth.admin.createUser({
        email,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: {
          invited_by: process.env.ROOT_USER_EMAIL,
          invited_at: new Date().toUTCString(),
        },
      });

    if (createUserError) {
      console.error("Error creating user:", createUserError);

      // Handle specific Supabase auth errors
      if (createUserError.message?.includes("email")) {
        return NextResponse.json(
          { error: "A user with this email already exists in the system" },
          { status: 409 }
        );
      }

      if (createUserError.message?.includes("password")) {
        return NextResponse.json(
          { error: "Password requirements not met" },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: "Failed to create user account. Please try again later." },
        { status: 500 }
      );
    }

    // Create a new invite record with the user_id
    const { error: inviteCreateError } = await supabase.from("invites").insert({
      email,
      invited_by: process.env.ROOT_USER_EMAIL!,
      user_id: newUser.user?.id,
      message: message || null,
      created_at: new Date().toUTCString(),
    });

    if (inviteCreateError) {
      console.error("Error creating invite record:", inviteCreateError);
      // Continue anyway, user was created successfully
    }

    // Send invitation email using the optimized email function
    const emailResult = await sendInviteEmail({
      email,
      temporaryPassword,
      message,
      invitedBy: process.env.ROOT_USER_EMAIL!,
    });

    if (!emailResult.success) {
      console.error("Failed to send invitation email:", emailResult.error);
      return NextResponse.json(
        {
          success: true,
          warning:
            "User created but invitation email failed to send. Please contact the user manually.",
          user: { id: newUser.user?.id, email },
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "User invited successfully",
      user: { id: newUser.user?.id, email },
    });
  } catch (error) {
    console.error("Invite user error:", error);

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
