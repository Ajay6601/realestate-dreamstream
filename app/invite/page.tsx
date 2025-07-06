"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  UserPlus,
  Mail,
  Shield,
  Trash2,
  RefreshCw,
  Users,
  Clock,
  CheckCircle,
  Filter,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useInviteController } from "@/hooks/use-invite-controller";
import { Logo } from "@/components/logo";

// Add sorting types
type SortField = "created_at" | "user_last_sign_in_at";
type SortOrder = "asc" | "desc";

const ITEMS_PER_PAGE = 10;

export default function InviteUserPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [currentPage, setCurrentPage] = useState(1);

  const {
    invites,
    isLoading,
    error,
    isSubmitting,
    isAuthorized,
    inviteUser,
    deleteUser,
    refreshInvites,
    stats,
    formatDate,
  } = useInviteController();

  async function handleInviteUser(e: React.FormEvent) {
    e.preventDefault();

    if (!email.trim()) {
      return;
    }

    const success = await inviteUser({
      email: email.trim(),
      message: message.trim() || undefined,
    });

    if (success) {
      setEmail("");
      setMessage("");
    }
  }

  async function handleDeleteUser(userId: string, email: string) {
    await deleteUser(userId, email);
  }

  // Sorting function
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
    setCurrentPage(1); // Reset to first page when sorting
  };

  // Get sorted and paginated invites
  const { sortedInvites, totalPages, paginatedInvites } = useMemo(() => {
    const sorted = [...invites].sort((a, b) => {
      let aValue: string | null | undefined;
      let bValue: string | null | undefined;

      if (sortField === "created_at") {
        aValue = a.created_at;
        bValue = b.created_at;
      } else {
        // user_last_sign_in_at
        aValue = a.user_last_sign_in_at;
        bValue = b.user_last_sign_in_at;
      }

      // Handle null/undefined values - put them at the end
      if (!aValue && !bValue) return 0;
      if (!aValue) return 1;
      if (!bValue) return -1;

      const aTime = new Date(aValue).getTime();
      const bTime = new Date(bValue).getTime();

      return sortOrder === "asc" ? aTime - bTime : bTime - aTime;
    });

    const total = Math.ceil(sorted.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginated = sorted.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    return {
      sortedInvites: sorted,
      totalPages: total,
      paginatedInvites: paginated,
    };
  }, [invites, sortField, sortOrder, currentPage]);

  // Pagination handlers
  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const goToPrevious = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const goToNext = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  };

  if (isAuthorized === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center space-y-6">
          <Logo 
            size="lg" 
            variant="colored" 
            showText={true}
            clickable={false}
          />
          <div className="relative">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#e4d3bc]"></div>
            <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-[#1e4d42] absolute top-0"></div>
          </div>
          <div className="text-center">
            <p className="text-lg font-medium text-gray-700">
              Checking Authorization
            </p>
            <p className="text-sm text-gray-500">
              Verifying your admin privileges...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-canvas p-4 md:p-6 max-w-7xl mx-auto">
      <div className="space-y-6 md:space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0">
          <div>
            <h1 className="text-2xl md:text-4xl font-medium text-[#1a1814]">
              User Invitations
            </h1>
            <p className="mt-2 text-sm md:text-base text-[#6b6156]">
              Send invitations and manage user access to the platform
            </p>
          </div>
          {/* Hide refresh button on mobile */}
          <div className="hidden md:flex space-x-4">
            <Button
              onClick={refreshInvites}
              variant="outline"
              disabled={isLoading}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1">
          <Card className="max-w-md">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center">
                <Users className="h-6 md:h-8 w-6 md:w-8 text-[#1e4d42]" />
                <div className="ml-3 md:ml-4">
                  <p className="text-xl md:text-2xl font-bold text-gray-900">
                    {stats.usersWithAccounts}
                  </p>
                  <p className="text-xs md:text-sm text-gray-600">
                    Total Users
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Tabs defaultValue="invite" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="invite" className="text-sm">
                Send Invite
              </TabsTrigger>
              <TabsTrigger value="manage" className="text-sm">
                Manage Invites
              </TabsTrigger>
            </TabsList>

            {/* Send Invite Tab */}
            <TabsContent value="invite" className="mt-4">
              <Card className="shadow-lg">
                <CardContent className="p-4 md:p-6">
                  <Alert className="mb-4 md:mb-6">
                    <Shield className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      Only administrators can invite new users. The invited user
                      will receive login credentials via email.
                    </AlertDescription>
                  </Alert>

                  <form
                    onSubmit={handleInviteUser}
                    className="space-y-4 md:space-y-6"
                  >
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-medium">
                        Email Address *
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          id="email"
                          type="email"
                          placeholder="user@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="pl-10"
                          required
                          disabled={isSubmitting}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="message" className="text-sm font-medium">
                        Welcome Message (Optional)
                      </Label>
                      <Textarea
                        id="message"
                        placeholder="Add a personal welcome message for the new user..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="min-h-[80px] md:min-h-[100px] resize-none"
                        disabled={isSubmitting}
                      />
                      <p className="text-xs text-gray-500">
                        This message will be included in the invitation email.
                      </p>
                    </div>

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                          Sending Invitation...
                        </>
                      ) : (
                        <>
                          <UserPlus className="h-4 w-4 mr-2" />
                          Send Invitation
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Manage Invites Tab */}
            <TabsContent value="manage" className="mt-4">
              <Card className="shadow-lg">
                <CardHeader className="pb-4">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-3 sm:space-y-0">
                    <div>
                      <CardTitle className="text-lg md:text-xl">
                        Manage Invitations
                      </CardTitle>
                      <CardDescription className="text-sm">
                        View and manage all sent invitations
                      </CardDescription>
                    </div>
                    {/* Desktop refresh button only */}
                    <div className="hidden md:block">
                      <Button
                        onClick={refreshInvites}
                        variant="outline"
                        size="sm"
                        disabled={isLoading}
                      >
                        <RefreshCw
                          className={`mr-2 h-4 w-4 ${
                            isLoading ? "animate-spin" : ""
                          }`}
                        />
                        Refresh
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-4 md:px-6">
                  {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-8 space-y-4">
                      <Logo 
                        size="sm" 
                        variant="colored" 
                        showText={false}
                        clickable={false}
                      />
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1e4d42]"></div>
                    </div>
                  ) : error ? (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  ) : invites.length === 0 ? (
                    <div className="text-center py-8">
                      <Users className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <p className="text-gray-600">No invitations sent yet</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Sort Controls */}
                      {/* Mobile stacked layout */}
                      <div className="flex flex-col space-y-2 md:hidden">
                        <div className="flex items-center space-x-2">
                          <Filter className="h-4 w-4 text-gray-500" />
                          <Label className="text-sm font-medium text-gray-500">
                            Sort by:
                          </Label>
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            variant={
                              sortField === "created_at" ? "default" : "outline"
                            }
                            size="sm"
                            onClick={() => handleSort("created_at")}
                            className="flex items-center justify-center space-x-1 text-xs flex-1 sm:flex-none"
                          >
                            <span>Invited Date</span>
                            {sortField === "created_at" && (
                              <span className="text-xs">
                                {sortOrder === "asc" ? "↑" : "↓"}
                              </span>
                            )}
                          </Button>
                          <Button
                            variant={
                              sortField === "user_last_sign_in_at"
                                ? "default"
                                : "outline"
                            }
                            size="sm"
                            onClick={() => handleSort("user_last_sign_in_at")}
                            className="flex items-center justify-center space-x-1 text-xs flex-1 sm:flex-none"
                          >
                            <span>Last Login</span>
                            {sortField === "user_last_sign_in_at" && (
                              <span className="text-xs">
                                {sortOrder === "asc" ? "↑" : "↓"}
                              </span>
                            )}
                          </Button>
                        </div>
                      </div>
                      {/* Desktop inline layout */}
                      <div className="hidden md:flex items-center space-x-2">
                        <Filter className="h-4 w-4 text-gray-500" />
                        <Label className="text-sm font-medium text-gray-500">
                          Sort by:
                        </Label>
                        <Button
                          variant={
                            sortField === "created_at" ? "default" : "outline"
                          }
                          size="sm"
                          onClick={() => handleSort("created_at")}
                          className="flex items-center justify-center space-x-1 text-xs flex-1 sm:flex-none"
                        >
                          <span>Invited Date</span>
                          {sortField === "created_at" && (
                            <span className="text-xs">
                              {sortOrder === "asc" ? "↑" : "↓"}
                            </span>
                          )}
                        </Button>
                        <Button
                          variant={
                            sortField === "user_last_sign_in_at"
                              ? "default"
                              : "outline"
                          }
                          size="sm"
                          onClick={() => handleSort("user_last_sign_in_at")}
                          className="flex items-center justify-center space-x-1 text-xs flex-1 sm:flex-none"
                        >
                          <span>Last Login</span>
                          {sortField === "user_last_sign_in_at" && (
                            <span className="text-xs">
                              {sortOrder === "asc" ? "↑" : "↓"}
                            </span>
                          )}
                        </Button>
                      </div>

                      {/* Desktop Table View */}
                      <div className="hidden md:block overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Email</TableHead>
                              <TableHead>Invited Date</TableHead>
                              <TableHead>Last Login</TableHead>
                              <TableHead>Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {paginatedInvites.map((invite) => (
                              <TableRow key={invite.id}>
                                <TableCell className="font-medium">
                                  {invite.email}
                                </TableCell>
                                <TableCell>
                                  {formatDate(invite.created_at)}
                                </TableCell>
                                <TableCell>
                                  {invite.user_last_sign_in_at ? (
                                    <div className="text-sm">
                                      {formatDate(invite.user_last_sign_in_at)}
                                    </div>
                                  ) : invite.user_id ? (
                                    <span className="text-gray-400 italic text-sm">
                                      Never logged in
                                    </span>
                                  ) : (
                                    <span className="text-gray-400 italic text-sm">
                                      No account yet
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {invite.user_id && (
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button
                                          variant="destructive"
                                          size="sm"
                                          className="gap-2"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                          Delete User
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>
                                            Delete User Account
                                          </AlertDialogTitle>
                                          <AlertDialogDescription>
                                            Are you sure you want to delete the
                                            user account for{" "}
                                            <strong>{invite.email}</strong>?
                                            This action cannot be undone. The
                                            user will lose access immediately
                                            and all their data will be removed.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>
                                            Cancel
                                          </AlertDialogCancel>
                                          <AlertDialogAction
                                            onClick={() =>
                                              handleDeleteUser(
                                                invite.user_id!,
                                                invite.email
                                              )
                                            }
                                            className="bg-red-600 hover:bg-red-700"
                                          >
                                            Delete User
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Mobile Card View */}
                      <div className="md:hidden space-y-3">
                        {paginatedInvites.map((invite) => (
                          <Card
                            key={invite.id}
                            className="border border-gray-200"
                          >
                            <CardContent className="p-4">
                              <div className="space-y-3">
                                {/* Email */}
                                <div>
                                  <p className="font-medium text-sm">
                                    {invite.email}
                                  </p>
                                </div>

                                {/* Dates */}
                                <div className="grid grid-cols-1 gap-2 text-xs text-gray-600">
                                  <div>
                                    <span className="font-medium">
                                      Invited:{" "}
                                    </span>
                                    {formatDate(invite.created_at)}
                                  </div>
                                  <div>
                                    <span className="font-medium">
                                      Last Login:{" "}
                                    </span>
                                    {invite.user_last_sign_in_at ? (
                                      formatDate(invite.user_last_sign_in_at)
                                    ) : invite.user_id ? (
                                      <span className="italic">
                                        Never logged in
                                      </span>
                                    ) : (
                                      <span className="italic">
                                        No account yet
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Actions */}
                                {invite.user_id && (
                                  <div className="pt-2 border-t border-gray-100">
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button
                                          variant="destructive"
                                          size="sm"
                                          className="w-full gap-2 text-xs"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                          Delete User Account
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent className="mx-4 max-w-lg">
                                        <AlertDialogHeader>
                                          <AlertDialogTitle className="text-lg">
                                            Delete User Account
                                          </AlertDialogTitle>
                                          <AlertDialogDescription className="text-sm">
                                            Are you sure you want to delete the
                                            user account for{" "}
                                            <strong>{invite.email}</strong>?
                                            This action cannot be undone. The
                                            user will lose access immediately
                                            and all their data will be removed.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter className="flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
                                          <AlertDialogCancel className="w-full sm:w-auto">
                                            Cancel
                                          </AlertDialogCancel>
                                          <AlertDialogAction
                                            onClick={() =>
                                              handleDeleteUser(
                                                invite.user_id!,
                                                invite.email
                                              )
                                            }
                                            className="w-full sm:w-auto bg-red-600 hover:bg-red-700"
                                          >
                                            Delete User
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>

                      {/* Pagination */}
                      {totalPages > 1 && (
                        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                          <div className="text-sm text-gray-600">
                            Page {currentPage} of {totalPages} ({invites.length}{" "}
                            total)
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={goToPrevious}
                              disabled={currentPage === 1}
                              className="gap-1"
                            >
                              <ChevronLeft className="h-4 w-4" />
                              Previous
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={goToNext}
                              disabled={currentPage === totalPages}
                              className="gap-1"
                            >
                              Next
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
