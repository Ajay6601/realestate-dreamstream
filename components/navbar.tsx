"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { dataCache } from "@/lib/cache";
import { useAuth } from "@/lib/auth-context";
import {
  Upload,
  BarChart3,
  Mail,
  LogOut,
  Menu,
  ChevronLeft,
  ChevronRight,
  FileText,
  UserPlus,
  X,
  Globe,
  Key,
  Eye,
  EyeOff,
} from "lucide-react";
import { Logo, CompactLogo } from "@/components/logo";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";

interface NavbarProps {
  children: React.ReactNode;
}

export function Navbar({ children }: NavbarProps) {
  const { user, isRootUser, isLoading, isAuthInitialized } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const { toast } = useToast();

  // Check if we're on protected routes
  const protectedRoutes = [
    "/dashboard",
    "/upload",
    "/email-templates",
    "/proposals",
    "/invite",
  ];
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  // Initialize sidebar state only
  useEffect(() => {
    const saved = localStorage.getItem("sidebarCollapsed");
    if (saved) {
      setSidebarCollapsed(JSON.parse(saved));
    }
  }, []);

  // Handle sign out and clear cache on auth state changes
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === "SIGNED_OUT") {
        setIsSigningOut(true);
        // Clear cache safely when signing out
        dataCache.clearAllSafe();
        // Force redirect to home page
        window.location.href = "/";
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  // Save sidebar state to localStorage
  useEffect(() => {
    if (!isLoading && typeof window !== "undefined") {
      localStorage.setItem(
        "sidebarCollapsed",
        JSON.stringify(sidebarCollapsed)
      );
    }
  }, [sidebarCollapsed, isLoading]);

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      // Clear cache and invalidate user ID cache before signing out to prevent errors
      dataCache.invalidateUserIdCache();
      dataCache.clearAllSafe();
      await supabase.auth.signOut();

      // Use window.location.replace to clear browser history
      // This prevents users from navigating back to protected pages
      window.location.replace("/");
    } catch (error) {
      setIsSigningOut(false);
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handlePasswordChange = async () => {
    if (!passwordForm.newPassword || !passwordForm.confirmPassword) {
      toast({
        title: "Error",
        description: "Please fill in all fields.",
        variant: "destructive",
      });
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match.",
        variant: "destructive",
      });
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters long.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsChangingPassword(true);
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.newPassword,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Password changed successfully.",
      });

      // Reset form and close dialog
      setPasswordForm({ newPassword: "", confirmPassword: "" });
      setPasswordDialogOpen(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to change password.",
        variant: "destructive",
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
    { href: "/upload", label: "Upload Data", icon: Upload },
    { href: "/email-templates", label: "Email Templates", icon: Mail },
    { href: "/proposals", label: "PDF Proposals", icon: FileText },
  ];

  const getUserInitials = (email: string) => {
    return email?.split("@")[0]?.substring(0, 2)?.toUpperCase() || "U";
  };

  const getUserDisplayName = (email: string) => {
    return email?.split("@")[0] || "User";
  };

  // Get current page title
  const getCurrentPageTitle = () => {
    // Handle special admin routes
    if (pathname === "/invite") return "Invite User";

    // Handle regular nav items
    const navItem = navItems.find((item) => item.href === pathname);
    return navItem?.label || "Dashboard";
  };

  /* 
  // Show loading spinner during initial load, sign out, or when auth not initialized
  if (isLoading || isSigningOut || !isAuthInitialized) {
    return (
      <div className="flex h-screen bg-gray-50 items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-sm text-gray-600">
            {isSigningOut ? "Signing out..." : "Loading..."}
          </p>
        </div>
      </div>
    );
  }
  */

  // For protected routes, only show authenticated layout

  if (isProtectedRoute) {
    // If user is not authenticated on protected route, show loading
    // (middleware should redirect, but this prevents flashing)

    /*
    if (!user) {
      return (
        <div className="flex h-screen bg-gray-50 items-center justify-center">
          <div className="flex flex-col items-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-sm text-gray-600">Loading...</p>
          </div>
        </div>
      );
    }
    */

    // Show authenticated layout for protected routes
    return (
      <div className="flex h-screen bg-[#f4efe6]">
        {/* Desktop Sidebar */}
        <div
          className={`hidden lg:flex lg:flex-col ${
            sidebarCollapsed ? "lg:w-20" : "lg:w-72"
          } transition-all duration-300 ease-in-out`}
        >
          <div className="flex flex-col flex-1 bg-[#13241f] text-[#f6f1e8]">
            {/* Logo Section */}
            <div className="flex items-center justify-between h-[4.25rem] px-4 border-b border-white/10">
              {!sidebarCollapsed ? (
                <Logo 
                  size="md" 
                  variant="light" 
                  showText={true}
                  clickable={true}
                  href="/"
                />
              ) : (
                <CompactLogo 
                  size="md" 
                  variant="light"
                />
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="rounded-full p-1.5 text-[#f6f1e8] hover:bg-white/10 hover:text-white"
              >
                {sidebarCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 py-6 space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? "bg-white/10 text-white shadow-[inset_3px_0_0_0_#d4a574]"
                        : "text-[#d7cfc2] hover:text-white hover:bg-white/5"
                    }`}
                    title={sidebarCollapsed ? item.label : undefined}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    {!sidebarCollapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </nav>

            {/* Admin Section - Only visible to root user */}
            {isRootUser && (
              <>
                <div className="px-4">
                  <hr className="border-white/10" />
                </div>
                <div
                  className={`px-4 py-4 space-y-2 ${
                    sidebarCollapsed ? "flex flex-col items-center" : ""
                  }`}
                >
                  {sidebarCollapsed ? (
                    <div
                      className="flex flex-col items-center"
                      title="Administration"
                    >
                      <div className="mb-2">
                        <span className="text-xs font-medium text-[#d4a574] uppercase tracking-wide">
                          A
                        </span>
                      </div>
                      <Link
                        href="/invite"
                        className={`flex items-center justify-center px-0 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                          pathname === "/invite"
                            ? "bg-[#d4a574]/20 text-[#f3d7b8]"
                            : "text-[#d7cfc2] hover:text-white hover:bg-white/5"
                        }`}
                        title="Invite User"
                      >
                        <UserPlus className="h-5 w-5 flex-shrink-0" />
                      </Link>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs font-medium text-[#d4a574] uppercase tracking-[0.18em] px-3">
                        Administration
                      </p>
                      <Link
                        href="/invite"
                        className={`flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                          pathname === "/invite"
                            ? "bg-[#d4a574]/20 text-[#f3d7b8]"
                            : "text-[#d7cfc2] hover:text-white hover:bg-white/5"
                        }`}
                        title={sidebarCollapsed ? "Invite User" : undefined}
                      >
                        <UserPlus className="h-5 w-5 flex-shrink-0" />
                        <span>Invite User</span>
                      </Link>
                    </>
                  )}
                </div>
              </>
            )}

            {/* Company Information */}
            {!sidebarCollapsed && (
              <div className="px-4 pb-6">
                <div className="rounded-2xl p-4 border border-white/10 bg-white/5">
                  <div className="text-center space-y-2">
                    <h4 className="text-sm font-semibold text-[#f6f1e8]">
                      Total Body Mobile Massage
                    </h4>
                    <p className="text-xs text-[#d4a574] font-medium">
                      Outreach Team
                    </p>
                    <div className="space-y-1">
                      <a
                        href="mailto:tbmmoutreach@gmail.com"
                        className="flex items-center justify-center space-x-2 text-xs text-[#f6f1e8]/80 hover:text-white transition-colors"
                      >
                        <Mail className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">tbmmoutreach@gmail.com</span>
                      </a>
                      <a
                        href="https://www.totalbodymobilemassage.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center space-x-2 text-xs text-[#f6f1e8]/80 hover:text-white transition-colors"
                      >
                        <Globe className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">
                          totalbodymobilemassage.com
                        </span>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Sidebar */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent side="left" className="w-72 p-0 [&>button]:hidden bg-[#13241f] text-[#f6f1e8] border-[#13241f]">
            <SheetHeader className="sr-only">
              <SheetTitle>Navigation Menu</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between h-[4.25rem] px-4 border-b border-white/10">
                <Logo 
                  size="md" 
                  variant="light" 
                  showText={true}
                  clickable={true}
                  href="/"
                />
                <Button
                  onClick={() => setMobileMenuOpen(false)}
                  variant="ghost"
                  size="sm"
                  className="text-[#f6f1e8] hover:bg-white/10 p-1.5 rounded-full"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <nav className="flex-1 px-4 py-6 space-y-2">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-white/10 text-white shadow-[inset_3px_0_0_0_#d4a574]"
                          : "text-[#d7cfc2] hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>

              {/* Admin Section - Mobile */}
              {isRootUser && (
                <>
                  <div className="px-4">
                    <hr className="border-white/10" />
                  </div>
                  <div className="px-4 py-4 space-y-2">
                    <p className="text-xs font-medium text-[#d4a574] uppercase tracking-[0.18em] px-3">
                      Administration
                    </p>
                    <Link
                      href="/invite"
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                        pathname === "/invite"
                          ? "bg-[#d4a574]/20 text-[#f3d7b8]"
                          : "text-[#d7cfc2] hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <UserPlus className="h-5 w-5" />
                      <span>Invite User</span>
                    </Link>
                  </div>
                </>
              )}

              {/* Company Information - Mobile */}
              <div className="px-4 py-2">
                <div className="rounded-2xl border border-white/10 bg-white/5">
                  <div className="p-3 space-y-1">
                    <div className="text-center space-y-0.5">
                      <h4 className="text-sm font-semibold text-[#f6f1e8]">
                        Total Body Mobile Massage
                      </h4>
                      <p className="text-xs text-[#d4a574] font-medium">
                        Outreach Team
                      </p>
                    </div>
                    <a
                      href="mailto:tbmmoutreach@gmail.com"
                      className="flex items-center space-x-1 text-xs text-[#f6f1e8]/80 hover:text-white transition-colors py-1"
                    >
                      <Mail className="h-3 w-3 flex-shrink-0" />
                      <span className="flex-1 min-w-0 truncate">
                        tbmmoutreach@gmail.com
                      </span>
                    </a>
                    <a
                      href="https://www.totalbodymobilemassage.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-1 text-xs text-[#f6f1e8]/80 hover:text-white transition-colors py-1"
                    >
                      <Globe className="h-3 w-3 flex-shrink-0" />
                      <span className="flex-1 min-w-0 truncate">
                        totalbodymobilemassage.com
                      </span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top Bar */}
          <header className="h-16 border-b border-[#e6dccb] bg-[#fbf8f3]/80 backdrop-blur-md">
            <div className="flex items-center justify-between h-full px-6">
              <div className="flex items-center space-x-4">
                <Button
                  variant="ghost"
                  size="sm"
                  className="lg:hidden"
                  onClick={() => setMobileMenuOpen(true)}
                >
                  <Menu className="h-5 w-5" />
                </Button>

                {/* Page title for both mobile and desktop */}
                <h1 className="text-lg md:text-2xl font-medium text-[#1a1814]">
                  {getCurrentPageTitle()}
                </h1>
              </div>

              <div className="flex items-center space-x-4">
                <div className="hidden md:block text-right">
                  <p className="text-sm font-medium text-gray-900">
                    {getUserDisplayName(user?.email || "")}
                  </p>
                  <p className="text-xs text-gray-500">{user?.email || ""}</p>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="relative h-10 w-10 rounded-full border border-[#e4d3bc] bg-white transition-colors hover:border-[#c9894a]"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-[#1c3a32] text-[#f6efe4] font-semibold">
                          {getUserInitials(user?.email || "")}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-64" align="end" forceMount>
                    <div className="flex items-center justify-start gap-2 p-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-[#1c3a32] text-[#f6efe4] font-semibold">
                          {getUserInitials(user?.email || "")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col space-y-1 leading-none">
                        <p className="font-medium text-sm">
                          {getUserDisplayName(user?.email || "")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {user?.email || ""}
                        </p>
                      </div>
                    </div>
                    <DropdownMenuSeparator />

                    <Dialog
                      open={passwordDialogOpen}
                      onOpenChange={setPasswordDialogOpen}
                    >
                      <DialogTrigger asChild>
                        <DropdownMenuItem
                          className="cursor-pointer"
                          onSelect={(e) => {
                            e.preventDefault();
                            setPasswordDialogOpen(true);
                          }}
                        >
                          <Key className="mr-2 h-4 w-4" />
                          <span>Change Password</span>
                        </DropdownMenuItem>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>Change Password</DialogTitle>
                          <DialogDescription>
                            Enter your new password below. Make sure it is at
                            least 6 characters long.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="new-password">New Password</Label>
                            <div className="relative">
                              <Input
                                id="new-password"
                                type={showNewPassword ? "text" : "password"}
                                value={passwordForm.newPassword}
                                onChange={(e) =>
                                  setPasswordForm((prev) => ({
                                    ...prev,
                                    newPassword: e.target.value,
                                  }))
                                }
                                placeholder="Enter new password"
                                className="pr-10"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                onClick={() =>
                                  setShowNewPassword(!showNewPassword)
                                }
                              >
                                {showNewPassword ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="confirm-password">
                              Confirm New Password
                            </Label>
                            <div className="relative">
                              <Input
                                id="confirm-password"
                                type={showConfirmPassword ? "text" : "password"}
                                value={passwordForm.confirmPassword}
                                onChange={(e) =>
                                  setPasswordForm((prev) => ({
                                    ...prev,
                                    confirmPassword: e.target.value,
                                  }))
                                }
                                placeholder="Confirm new password"
                                className="pr-10"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                onClick={() =>
                                  setShowConfirmPassword(!showConfirmPassword)
                                }
                              >
                                {showConfirmPassword ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-end space-x-2">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setPasswordDialogOpen(false);
                              setPasswordForm({
                                newPassword: "",
                                confirmPassword: "",
                              });
                              setShowNewPassword(false);
                              setShowConfirmPassword(false);
                            }}
                            disabled={isChangingPassword}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={handlePasswordChange}
                            disabled={isChangingPassword}
                          >
                            {isChangingPassword
                              ? "Changing..."
                              : "Change Password"}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>

                    <DropdownMenuItem
                      onClick={handleSignOut}
                      className="cursor-pointer text-red-600"
                      disabled={isSigningOut}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>
                        {isSigningOut ? "Signing out..." : "Sign out"}
                      </span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    );
  }

  // For non-protected routes, show public layout only if user is not authenticated
  if (!user) {
    if (pathname === "/login") {
      return <div className="min-h-screen">{children}</div>;
    }

    return (
      <div className="min-h-screen">
        <nav className="sticky top-0 z-40 border-b border-[#e6dccb]/80 bg-[#fbf8f3]/80 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <Logo 
                  size="lg" 
                  variant="colored" 
                  showText={true}
                  clickable={true}
                  href="/"
                />
              </div>
              <div className="flex items-center space-x-4">
                <Link
                  href="/login"
                  className={cn(buttonVariants(), "rounded-full px-5")}
                >
                  Log In
                </Link>
              </div>
            </div>
          </div>
        </nav>
        <main className="flex-1">{children}</main>
      </div>
    );
  }

  // If user is authenticated but on non-protected route, show loading
  // (middleware should redirect them)
  /*
  return (
    <div className="flex h-screen bg-gray-50 items-center justify-center">
      <div className="flex flex-col items-center space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="text-sm text-gray-600">Redirecting...</p>
      </div>
    </div>
  );
  */
}
