import { createClient } from "@/lib/supabase/client";

export interface Invite {
  id: string;
  email: string;
  invited_by: string;
  user_id: string | null;
  message: string | null;
  created_at: string;
  // User auth data (when available)
  user_last_sign_in_at?: string | null;
  user_email_confirmed_at?: string | null;
}

export interface InviteUser {
  email: string;
  message?: string;
}

export interface InviteControllerState {
  invites: Invite[];
  isLoading: boolean;
  error: string | null;
  isSubmitting: boolean;
}

export class InviteController {
  // Load all invites sent by the current user
  async loadInvites(): Promise<{ invites: Invite[]; error: string | null }> {
    try {
      const response = await fetch("/api/invites");
      const data = await response.json();

      if (!response.ok) {
        return { invites: [], error: data.error || "Failed to load invites" };
      }

      return { invites: data.invites || [], error: null };
    } catch (error) {
      console.error("Error loading invites:", error);
      return {
        invites: [],
        error: "Network error occurred while loading invites",
      };
    }
  }

  // Send invitation
  async inviteUser(
    inviteData: InviteUser
  ): Promise<{ success: boolean; error?: string; warning?: string }> {
    try {
      const response = await fetch("/api/invite-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(inviteData),
      });

      const data = await response.json();

      if (response.ok) {
        return {
          success: true,
          warning: data.warning,
        };
      } else {
        return {
          success: false,
          error: data.error || "Failed to send invitation",
        };
      }
    } catch (error) {
      console.error("Invitation error:", error);
      return {
        success: false,
        error: "Network error occurred while sending invitation",
      };
    }
  }

  // Delete user account (this will cascade delete the invite record)
  async deleteUser(
    userId: string,
    email: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch("/api/delete-user", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId, email }),
      });

      const data = await response.json();

      if (response.ok) {
        return { success: true };
      } else {
        return {
          success: false,
          error: data.error || "Failed to delete user account",
        };
      }
    } catch (error) {
      console.error("Delete user error:", error);
      return {
        success: false,
        error: "Network error occurred while deleting user",
      };
    }
  }

  // Get invite statistics
  getInviteStats(invites: Invite[]): {
    total: number;
    usersWithAccounts: number;
  } {
    const usersWithAccounts = invites.filter((invite) => invite.user_id).length;
    return {
      total: invites.length,
      usersWithAccounts,
    };
  }

  // Format date for display
  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // Validate email format
  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
