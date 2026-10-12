"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { useToast } from "@/hooks/use-toast";
import { useCachedEmailTemplates } from "@/hooks/use-cached-data";
import { dataCache } from "@/lib/cache";
import {
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  Eye,
  Filter,
  Search,
  Mail,
  ArrowUp,
  ArrowDown,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Logo } from "@/components/logo";
import type { EmailTemplate } from "@/lib/types";

type FilterType = "all" | "active" | "inactive";
type SortField = "created_at" | "updated_at" | "template_name";
type SortOrder = "asc" | "desc";

export default function EmailTemplatesPage() {
  const {
    data: templates,
    loading,
    error,
    refresh: refreshTemplates,
  } = useCachedEmailTemplates();

  const [localTemplates, setLocalTemplates] = useState<EmailTemplate[]>([]);
  const [isLocalSynced, setIsLocalSynced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] =
    useState<EmailTemplate | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(
    null
  );
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(
    null
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [filter, setFilter] = useState<FilterType>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [isMobile, setIsMobile] = useState(false);
  const [formData, setFormData] = useState({
    template_name: "",
    subject: "",
    hook: "",
    body: "",
    signature: "",
    is_active: true,
  });

  const { toast } = useToast();
  const supabase = createClient();

  // Dynamically set items per page based on device
  const ITEMS_PER_PAGE = isMobile ? 10 : 20;

  // Check if mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Sync local templates with cached data when it changes
  useEffect(() => {
    if (templates.length > 0) {
      setLocalTemplates(templates);
      setIsLocalSynced(true);
    } else if (templates.length === 0 && !loading) {
      // Empty result from cache (not loading)
      setLocalTemplates([]);
      setIsLocalSynced(true);
    }
  }, [templates, loading]);

  // Use local state for immediate UI updates, fallback to cached data
  const displayTemplates = isLocalSynced ? localTemplates : templates;

  // Show loading during initial load, cache retrieval, or refresh
  // If we're not synced and have no cached data yet, or if actively loading/refreshing
  const isShowingLoading =
    loading || refreshing || (!isLocalSynced && templates.length === 0);

  // Memoized filtered, sorted, and paginated data
  const filteredAndSortedTemplates = useMemo(() => {
    let filtered = displayTemplates;

    // Apply status filter
    if (filter === "active") {
      filtered = filtered.filter((template) => template.is_active);
    } else if (filter === "inactive") {
      filtered = filtered.filter((template) => !template.is_active);
    }

    // Apply search filter
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (template) =>
          template.template_name.toLowerCase().includes(search) ||
          template.subject?.toLowerCase().includes(search) ||
          template.hook?.toLowerCase().includes(search)
      );
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      const aValue = new Date(a[sortField]).getTime();
      const bValue = new Date(b[sortField]).getTime();

      if (sortOrder === "asc") {
        return aValue - bValue;
      } else {
        return bValue - aValue;
      }
    });

    return sorted;
  }, [displayTemplates, filter, searchTerm, sortField, sortOrder]);

  const paginatedTemplates = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAndSortedTemplates.slice(
      startIndex,
      startIndex + ITEMS_PER_PAGE
    );
  }, [filteredAndSortedTemplates, currentPage]);

  const totalPages = Math.ceil(
    filteredAndSortedTemplates.length / ITEMS_PER_PAGE
  );

  const resetForm = () => {
    setFormData({
      template_name: "",
      subject: "",
      hook: "",
      body: "",
      signature: "",
      is_active: true,
    });
    setEditingTemplate(null);
  };

  const handleOpenDialog = (template?: EmailTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        template_name: template.template_name,
        subject: template.subject || "",
        hook: template.hook || "",
        body: template.body,
        signature: template.signature || "",
        is_active: template.is_active,
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    resetForm();
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await refreshTemplates();
      // Reset local sync to force reload from cache
      setIsLocalSynced(false);
      toast({
        title: "Data Refreshed",
        description: "Email templates have been refreshed successfully",
      });
    } catch (error) {
      toast({
        title: "Refresh Failed",
        description: "Failed to refresh email templates",
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  };

  const updateLocalTemplate = (updatedTemplate: EmailTemplate) => {
    setLocalTemplates((prev) =>
      prev.map((template) =>
        template.id === updatedTemplate.id ? updatedTemplate : template
      )
    );
  };

  const addLocalTemplate = (newTemplate: EmailTemplate) => {
    setLocalTemplates((prev) => [newTemplate, ...prev]);
  };

  const removeLocalTemplate = (templateId: number) => {
    setLocalTemplates((prev) =>
      prev.filter((template) => template.id !== templateId)
    );
  };

  const handleSaveTemplate = async () => {
    try {
      if (!formData.template_name.trim() || !formData.body.trim()) {
        toast({
          title: "Validation Error",
          description: "Template name and body are required",
          variant: "destructive",
        });
        return;
      }

      setSaving(true);

      const templateData = {
        template_name: formData.template_name.trim(),
        subject: formData.subject.trim() || null,
        hook: formData.hook.trim() || null,
        body: formData.body.trim(),
        signature: formData.signature.trim() || null,
        is_active: formData.is_active,
        updated_at: new Date().toISOString(),
      };

      let result;
      if (editingTemplate) {
        // Update existing template
        result = await supabase
          .from("email_templates")
          .update(templateData)
          .eq("id", editingTemplate.id)
          .select();

        if (result.error) {
          throw new Error(result.error.message);
        }

        // Update local state with the actual returned data
        const updatedTemplate = result.data[0] as EmailTemplate;
        updateLocalTemplate(updatedTemplate);

        toast({
          title: "Template Updated",
          description: "Email template has been updated successfully",
        });

        // Update cache directly instead of invalidating (more efficient)
        dataCache.updateEmailTemplateInCache(updatedTemplate);
        // Only invalidate dashboard stats to trigger recalculation
        dataCache.invalidateDashboardStats();
      } else {
        // Create new template
        result = await supabase
          .from("email_templates")
          .insert([
            {
              ...templateData,
              created_at: new Date().toISOString(),
            },
          ])
          .select();

        if (result.error) {
          throw new Error(result.error.message);
        }

        // Add to local state with the actual returned data
        const newTemplate = result.data[0] as EmailTemplate;
        addLocalTemplate(newTemplate);

        toast({
          title: "Template Created",
          description: "Email template has been created successfully",
        });

        // Add to cache directly instead of invalidating (more efficient)
        dataCache.addEmailTemplateToCache(newTemplate);
        // Only invalidate dashboard stats to trigger recalculation
        dataCache.invalidateDashboardStats();
      }

      handleCloseDialog();
    } catch (error) {
      console.error("Error saving template:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to save email template",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (template: EmailTemplate) => {
    setTemplateToDelete(template);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!templateToDelete) return;

    try {
      const { error } = await supabase
        .from("email_templates")
        .delete()
        .eq("id", templateToDelete.id);

      if (error) {
        throw new Error(error.message);
      }

      // Remove from local state
      removeLocalTemplate(templateToDelete.id);

      toast({
        title: "Template Deleted",
        description: "Email template has been deleted successfully",
      });

      // Remove from cache directly instead of invalidating (more efficient)
      dataCache.removeEmailTemplateFromCache(templateToDelete.id);
      // Only invalidate dashboard stats to trigger recalculation
      dataCache.invalidateDashboardStats();

      // Adjust current page if necessary
      const newFilteredCount = filteredAndSortedTemplates.length - 1;
      const newTotalPages = Math.ceil(newFilteredCount / ITEMS_PER_PAGE);
      if (currentPage > newTotalPages && newTotalPages > 0) {
        setCurrentPage(newTotalPages);
      }
    } catch (error) {
      console.error("Error deleting template:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to delete email template",
        variant: "destructive",
      });
    } finally {
      setIsDeleteDialogOpen(false);
      setTemplateToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setIsDeleteDialogOpen(false);
    setTemplateToDelete(null);
  };

  const handleToggleActive = async (
    template: EmailTemplate,
    isActive: boolean
  ) => {
    try {
      // Optimistically update local state first
      const updatedTemplate = {
        ...template,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      };
      updateLocalTemplate(updatedTemplate);

      // Then update database
      const { error } = await supabase
        .from("email_templates")
        .update({
          is_active: isActive,
          updated_at: new Date().toISOString(),
        })
        .eq("id", template.id);

      if (error) {
        // Revert local state on error
        updateLocalTemplate(template);
        throw new Error(error.message);
      }

      toast({
        title: isActive ? "Template Activated" : "Template Deactivated",
        description: `Email template has been ${
          isActive ? "activated" : "deactivated"
        }`,
      });

      // Update cache directly instead of invalidating (more efficient)
      dataCache.updateEmailTemplateInCache(updatedTemplate);
      // Only invalidate dashboard stats to trigger recalculation
      dataCache.invalidateDashboardStats();
    } catch (error) {
      console.error("Error toggling template status:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to update template status",
        variant: "destructive",
      });
    }
  };

  const handlePreview = (template: EmailTemplate) => {
    setPreviewTemplate(template);
    setIsPreviewOpen(true);
  };

  const handleFilterChange = (newFilter: FilterType) => {
    setFilter(newFilter);
    setCurrentPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleSortChange = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
    setCurrentPage(1);
  };

  // Template Card Component for Mobile
  const TemplateCard = ({ template }: { template: EmailTemplate }) => (
    <Card key={template.id} className="mb-4">
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-gray-900 truncate">
                {template.template_name}
              </h3>
              <p className="text-sm text-gray-600 mt-1 truncate">
                {template.subject || "No subject"}
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="ml-2">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handlePreview(template)}>
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleOpenDialog(template)}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleDeleteClick(template)}
                  className="text-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {template.hook && (
            <p className="text-sm text-gray-600 line-clamp-2">
              <span className="font-medium">Hook:</span> {template.hook}
            </p>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Switch
                checked={template.is_active}
                onCheckedChange={(checked) =>
                  handleToggleActive(template, checked)
                }
              />
              <Badge variant={template.is_active ? "default" : "secondary"}>
                {template.is_active ? "Active" : "Inactive"}
              </Badge>
            </div>
            <div className="text-xs text-gray-500">
              {new Date(template.updated_at).toLocaleDateString()}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="page-canvas p-3 md:p-6">
      <div className="space-y-6 md:space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
          <div>
            <h1 className="text-2xl md:text-4xl font-medium text-[#1a1814]">
              Email Templates
            </h1>
            <p className="mt-1 md:mt-2 text-sm md:text-base text-[#6b6156]">
              Create, edit, and manage your email templates. Use status toggles
              to activate or deactivate templates.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <Button
              onClick={handleRefresh}
              variant="outline"
              disabled={refreshing}
              className="hidden sm:flex w-full sm:w-auto"
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
            <Button
              onClick={() => handleOpenDialog()}
              className="w-full sm:w-auto"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Template
            </Button>
          </div>
        </div>

        {/* Search and Filters Section */}
        <Card>
          <CardContent className="space-y-4">
            {/* Search Bar */}
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search by name, subject, or hook..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filter and Sort Controls */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                  <div className="flex items-center space-x-2">
                    <Filter className="h-4 w-4 text-gray-500" />
                    <Label className="text-sm font-medium text-gray-500">
                      Status:
                    </Label>
                  </div>
                  <Select value={filter} onValueChange={handleFilterChange}>
                    <SelectTrigger className="w-full sm:w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="text-sm text-gray-500 text-center sm:text-right">
                  {filteredAndSortedTemplates.length} template
                  {filteredAndSortedTemplates.length !== 1 ? "s" : ""} found
                </div>
              </div>

              {/* Sort Options */}
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                <div className="flex items-center space-x-2">
                  <Label className="text-sm font-medium text-gray-500">
                    Sort by:
                  </Label>
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant={sortField === "created_at" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleSortChange("created_at")}
                    className="flex items-center space-x-1 flex-1 sm:flex-initial"
                  >
                    <span>Created</span>
                    {sortField === "created_at" &&
                      (sortOrder === "asc" ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowDown className="h-3 w-3" />
                      ))}
                  </Button>
                  <Button
                    variant={sortField === "updated_at" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleSortChange("updated_at")}
                    className="flex items-center space-x-1 flex-1 sm:flex-initial"
                  >
                    <span>Updated</span>
                    {sortField === "updated_at" &&
                      (sortOrder === "asc" ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowDown className="h-3 w-3" />
                      ))}
                  </Button>
                  <Button
                    variant={
                      sortField === "template_name" ? "default" : "outline"
                    }
                    size="sm"
                    onClick={() => handleSortChange("template_name")}
                    className="flex items-center space-x-1 flex-1 sm:flex-initial"
                  >
                    <span>Name</span>
                    {sortField === "template_name" &&
                      (sortOrder === "asc" ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowDown className="h-3 w-3" />
                      ))}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Templates List */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg md:text-xl">
              Email Templates ({filteredAndSortedTemplates.length})
            </CardTitle>
            <CardDescription className="text-sm">
              {filteredAndSortedTemplates.length !== templates.length &&
                `Showing ${filteredAndSortedTemplates.length} of ${templates.length} templates`}
              {paginatedTemplates.length > 0 &&
                totalPages > 1 &&
                ` • Page ${currentPage} of ${totalPages}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isShowingLoading ? (
              <div className="flex flex-col items-center justify-center py-8 space-y-6">
                <Logo 
                  size="md" 
                  variant="colored" 
                  showText={false}
                  clickable={false}
                />
                <RefreshCw className="h-8 w-8 animate-spin text-[#1e4d42]" />
                <p className="text-gray-500 text-sm">Loading email templates...</p>
              </div>
            ) : filteredAndSortedTemplates.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">
                  {searchTerm || filter !== "all"
                    ? "No templates match your current filters"
                    : "No email templates found"}
                </p>
                {!searchTerm && filter === "all" && (
                  <Button onClick={() => handleOpenDialog()} className="mt-4">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Your First Template
                  </Button>
                )}
              </div>
            ) : (
              <>
                {/* Mobile View - Cards */}
                {isMobile ? (
                  <div className="md:hidden">
                    {paginatedTemplates.map((template) => (
                      <TemplateCard key={template.id} template={template} />
                    ))}
                  </div>
                ) : (
                  /* Desktop View - Table */
                  <div className="hidden md:block rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Template Name</TableHead>
                          <TableHead>Subject</TableHead>
                          <TableHead>Hook</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead>Updated</TableHead>
                          <TableHead className="w-32">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedTemplates.map((template) => (
                          <TableRow key={template.id}>
                            <TableCell className="font-medium max-w-xs truncate">
                              {template.template_name}
                            </TableCell>
                            <TableCell className="max-w-xs truncate">
                              {template.subject || "—"}
                            </TableCell>
                            <TableCell className="max-w-xs truncate">
                              {template.hook || "—"}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <Switch
                                  checked={template.is_active}
                                  onCheckedChange={(checked) =>
                                    handleToggleActive(template, checked)
                                  }
                                />
                                <Badge
                                  variant={
                                    template.is_active ? "default" : "secondary"
                                  }
                                >
                                  {template.is_active ? "Active" : "Inactive"}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell>
                              {new Date(
                                template.created_at
                              ).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              {new Date(
                                template.updated_at
                              ).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <div className="flex space-x-2">
                                <Button
                                  onClick={() => handlePreview(template)}
                                  size="sm"
                                  variant="outline"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  onClick={() => handleOpenDialog(template)}
                                  size="sm"
                                  variant="outline"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  onClick={() => handleDeleteClick(template)}
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 hover:text-red-700 hover:border-red-300"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-6 gap-4">
                    <div className="text-sm text-gray-500 text-center sm:text-left">
                      Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{" "}
                      {Math.min(
                        currentPage * ITEMS_PER_PAGE,
                        filteredAndSortedTemplates.length
                      )}{" "}
                      of {filteredAndSortedTemplates.length} results
                    </div>

                    <div className="flex items-center justify-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="flex items-center"
                      >
                        <span className="hidden sm:inline">Previous</span>
                        <span className="sm:hidden">Prev</span>
                      </Button>

                      <div className="flex items-center space-x-1">
                        {Array.from(
                          { length: Math.min(isMobile ? 3 : 5, totalPages) },
                          (_, i) => {
                            let pageNum;
                            const maxPages = isMobile ? 3 : 5;
                            if (totalPages <= maxPages) {
                              pageNum = i + 1;
                            } else if (
                              currentPage <=
                              Math.floor(maxPages / 2) + 1
                            ) {
                              pageNum = i + 1;
                            } else if (
                              currentPage >=
                              totalPages - Math.floor(maxPages / 2)
                            ) {
                              pageNum = totalPages - maxPages + 1 + i;
                            } else {
                              pageNum =
                                currentPage - Math.floor(maxPages / 2) + i;
                            }

                            return (
                              <Button
                                key={pageNum}
                                variant={
                                  currentPage === pageNum
                                    ? "default"
                                    : "outline"
                                }
                                size="sm"
                                onClick={() => setCurrentPage(pageNum)}
                                className={`w-8 h-8 p-0 text-xs md:text-sm ${
                                  currentPage === pageNum
                                    ? "font-bold !w-10 !h-8 !min-w-0"
                                    : ""
                                }`}
                              >
                                {pageNum}
                              </Button>
                            );
                          }
                        )}
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="flex items-center"
                      >
                        <span className="hidden sm:inline">Next</span>
                        <span className="sm:hidden">Next</span>
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Template Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent
          className={
            isMobile
              ? "max-w-[calc(100vw-2rem)] mx-auto sm:max-w-md max-h-[90vh] overflow-y-auto [&>button]:flex [&>button]:items-center [&>button]:justify-center [&>button]:w-6 [&>button]:h-6"
              : "max-w-2xl max-h-[90vh] overflow-y-auto"
          }
        >
          <DialogHeader>
            <DialogTitle>
              {editingTemplate
                ? "Edit Email Template"
                : "Create New Email Template"}
            </DialogTitle>
            <DialogDescription>
              {editingTemplate
                ? "Update your email template"
                : "Create a new email template for your campaigns"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="template_name">Template Name *</Label>
              <Input
                id="template_name"
                value={formData.template_name}
                onChange={(e) =>
                  setFormData({ ...formData, template_name: e.target.value })
                }
                placeholder="e.g., Email #1"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="subject">Subject Line</Label>
              <Input
                id="subject"
                value={formData.subject}
                onChange={(e) =>
                  setFormData({ ...formData, subject: e.target.value })
                }
                placeholder="e.g., The Silent Reason 43% of Your Tenants Leave"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="hook">Hook</Label>
              <Textarea
                id="hook"
                value={formData.hook}
                onChange={(e) =>
                  setFormData({ ...formData, hook: e.target.value })
                }
                placeholder="e.g., Your Pool/Gym Won't Stop This Bleeding – But This Will"
                className="mt-1"
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="body">Email Body *</Label>
              <Textarea
                id="body"
                value={formData.body}
                onChange={(e) =>
                  setFormData({ ...formData, body: e.target.value })
                }
                placeholder="Enter your email content here..."
                className="mt-1"
                rows={5}
              />
            </div>

            <div>
              <Label htmlFor="signature">Signature</Label>
              <Textarea
                id="signature"
                value={formData.signature}
                onChange={(e) =>
                  setFormData({ ...formData, signature: e.target.value })
                }
                placeholder={`e.g., Lyndon S.\nTotal Body Mobile Massage – Outreach Team`}
                className="mt-1"
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_active: checked })
                }
              />
              <Label htmlFor="is_active">Active Template</Label>
            </div>
          </div>

          <DialogFooter className="flex flex-col gap-3 sm:flex-row sm:justify-end sm:gap-2 mt-4">
            <Button
              variant="outline"
              onClick={handleCloseDialog}
              disabled={saving}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveTemplate}
              disabled={saving}
              className="w-full sm:w-auto"
            >
              {saving ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  {editingTemplate ? "Updating..." : "Creating..."}
                </>
              ) : editingTemplate ? (
                "Update Template"
              ) : (
                "Create Template"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent
          className={
            isMobile
              ? "max-w-[calc(100vw-2rem)] mx-auto sm:max-w-md max-h-[90vh] overflow-y-auto"
              : "max-w-md"
          }
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Email Template</AlertDialogTitle>
            <AlertDialogDescription>
              {`Are you sure you want to delete the template "${templateToDelete?.template_name}"? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col gap-3 sm:flex-row sm:justify-end sm:gap-2 mt-4">
            <AlertDialogCancel
              onClick={handleDeleteCancel}
              className="w-full sm:w-auto"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="w-full sm:w-auto bg-red-600 hover:bg-red-700"
            >
              Delete Template
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Preview Template Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent
          className={
            isMobile
              ? "max-w-[calc(100vw-2rem)] mx-auto sm:max-w-md max-h-[90vh] overflow-y-auto [&>button]:flex [&>button]:items-center [&>button]:justify-center [&>button]:w-6 [&>button]:h-6"
              : "max-w-2xl max-h-[90vh] overflow-y-auto"
          }
        >
          <DialogHeader>
            <DialogTitle>Email Template Preview</DialogTitle>
            <DialogDescription>
              {`Preview of "${previewTemplate?.template_name}"`}
            </DialogDescription>
          </DialogHeader>
          {previewTemplate && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-gray-700">
                  Subject:
                </Label>
                <div className="mt-1 p-3 bg-gray-50 rounded-md">
                  {previewTemplate.subject || "No subject"}
                </div>
              </div>
              {previewTemplate.hook && (
                <div>
                  <Label className="text-sm font-medium text-gray-700">
                    Hook:
                  </Label>
                  <div className="mt-1 p-3 bg-gray-50 rounded-md">
                    {previewTemplate.hook}
                  </div>
                </div>
              )}
              <div>
                <Label className="text-sm font-medium text-gray-700">
                  Body:
                </Label>
                <div className="mt-1 p-3 bg-gray-50 rounded-md whitespace-pre-wrap">
                  {previewTemplate.body}
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700">
                  Signature:
                </Label>
                <div className="mt-1 p-3 bg-gray-50 rounded-md whitespace-pre-wrap">
                  {previewTemplate.signature || (
                    <span className="text-gray-400">
                      e.g., Lyndon S.
                      <br />
                      Total Body Mobile Massage – Outreach Team
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Badge
                  variant={previewTemplate.is_active ? "default" : "secondary"}
                >
                  {previewTemplate.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>
          )}

          <DialogFooter className="flex flex-col gap-3 sm:flex-row sm:justify-end sm:gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setIsPreviewOpen(false)}
              className="w-full sm:w-auto"
            >
              Close
            </Button>
            <Button
              onClick={() => {
                setIsPreviewOpen(false);
                handleOpenDialog(previewTemplate!);
              }}
              className="w-full sm:w-auto"
            >
              Edit Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
