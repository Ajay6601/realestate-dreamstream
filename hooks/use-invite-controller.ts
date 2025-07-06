import { useState, useEffect, useCallback, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  InviteController,
  type InviteUser,
  type InviteControllerState,
} from "@/lib/controllers/invite-controller";

export function useInviteController() {
  const [state, setState] = useState<InviteControllerState>({
    invites: [],
    isLoading: true,
    error: null,
    isSubmitting: false,
  });

  const [hasInitialLoad, setHasInitialLoad] = useState(false);
  const {
    user,
    isRootUser,
    isAuthInitialized,
    isLoading: authLoading,
  } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  // Create controller instance only once
  const controller = useMemo(() => new InviteController(), []);

  // Check authorization using the auth context
  const checkAuthorization = useCallback(() => {
    if (!isAuthInitialized) return; // Wait for auth to initialize
  }, [user, isRootUser, isAuthInitialized, router, toast]);

  // Send invitation
  const inviteUser = useCallback(
    async (inviteData: InviteUser) => {
      // Validate email
      if (!controller.isValidEmail(inviteData.email)) {
        toast({
          title: "Invalid Email",
          description: "Please enter a valid email address.",
          variant: "destructive",
        });
        return false;
      }

      setState((prev) => ({ ...prev, isSubmitting: true }));

      const result = await controller.inviteUser(inviteData);

      setState((prev) => ({ ...prev, isSubmitting: false }));

      if (result.success) {
        toast({
          title: "Invitation Sent!",
          description: `Successfully invited ${inviteData.email}. They will receive login credentials via email.`,
        });

        if (result.warning) {
          toast({
            title: "Warning",
            description: result.warning,
            variant: "destructive",
          });
        }

        // Reload invites to show the new one
        await refreshData();
        return true;
      } else {
        toast({
          title: "Invitation Failed",
          description: result.error || "Failed to send invitation.",
          variant: "destructive",
        });
        return false;
      }
    },
    [user, isRootUser, controller, toast]
  );

  // Refresh data helper
  const refreshData = useCallback(async () => {
    if (!user || !isRootUser) return;

    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    const { invites, error } = await controller.loadInvites();
    setState((prev) => ({
      ...prev,
      invites: invites || [],
      error,
      isLoading: false,
    }));

    if (error) {
      toast({
        title: "Error",
        description: error,
        variant: "destructive",
      });
    }
  }, [user, isRootUser, controller, toast]);

  // Delete user account
  const deleteUser = useCallback(
    async (userId: string, email: string) => {
      const result = await controller.deleteUser(userId, email);

      if (result.success) {
        toast({
          title: "User Deleted",
          description: `Successfully deleted user account for ${email}.`,
        });

        // Reload invites to reflect the deletion
        await refreshData();
        return true;
      } else {
        toast({
          title: "Delete Failed",
          description: result.error || "Failed to delete user account.",
          variant: "destructive",
        });
        return false;
      }
    },
    [user, isRootUser, controller, toast]
  );

  // Get invite statistics - use useMemo for performance
  const stats = useMemo(() => {
    return controller.getInviteStats(state.invites);
  }, [controller, state.invites]);

  // Initialize - run when auth is initialized
  useEffect(() => {
    checkAuthorization();
  }, [checkAuthorization]);

  // Load invites when authorized - only run once when all conditions are met
  useEffect(() => {
    if (
      user &&
      isRootUser &&
      isAuthInitialized &&
      !authLoading &&
      !hasInitialLoad
    ) {
      console.log("🔵 [INVITE CONTROLLER] Loading invites for the first time");
      setHasInitialLoad(true);
      refreshData();
    }
  }, [
    user,
    isRootUser,
    isAuthInitialized,
    authLoading,
    hasInitialLoad,
    refreshData,
  ]);

  // Set page title
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = "Invite User - Real Estate Outreach";
    }
  }, []);

  return {
    // State
    ...state,
    isAuthorized:
      user && isRootUser && !authLoading ? true : authLoading ? null : false,

    // Actions
    inviteUser,
    deleteUser,
    refreshInvites: refreshData,

    // Computed
    stats,

    // Utilities
    formatDate: controller.formatDate,
  };
}
