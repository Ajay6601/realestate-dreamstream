"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Download,
  RefreshCw,
  Filter,
  Search,
  ChevronLeft,
  ChevronRight,
  Mail,
  Users,
  TrendingUp,
  Calendar,
  MessageSquare,
  Target,
  Clock,
  FileText,
} from "lucide-react";
import { Logo } from "@/components/logo";
import {
  useCachedProperties,
  useCachedEmailLogs,
  useCachedCampaignProgress,
  useCachedEmailTemplates,
} from "@/hooks/use-cached-data";
import type { Property, EmailLog } from "@/lib/types";

const ITEMS_PER_PAGE = 20;
const EMAIL_LOGS_PER_PAGE = 50;

export default function DashboardPage() {
  // Use cached data with optimized loading behavior
  const {
    data: properties,
    loading: propertiesLoading,
    error: propertiesError,
    refresh: refreshProperties,
  } = useCachedProperties({ autoFetch: true, refreshOnMount: false });

  const {
    data: emailLogs,
    loading: emailLogsLoading,
    refresh: refreshEmailLogs,
  } = useCachedEmailLogs({ autoFetch: true, refreshOnMount: false });

  const {
    data: campaignProgress,
    loading: campaignLoading,
    refresh: refreshCampaignProgress,
  } = useCachedCampaignProgress({ autoFetch: true, refreshOnMount: false });

  const { data: emailTemplates, refresh: refreshTemplates } =
    useCachedEmailTemplates({ autoFetch: true, refreshOnMount: false });

  const [currentView, setCurrentView] = useState<"properties" | "logs">(
    "properties"
  );
  const [filteredProperties, setFilteredProperties] = useState<Property[]>([]);
  const [filteredEmailLogs, setFilteredEmailLogs] = useState<EmailLog[]>([]);
  const [paginatedItems, setPaginatedItems] = useState<(Property | EmailLog)[]>(
    []
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedPdfUrl, setSelectedPdfUrl] = useState<string | null>(null);

  const [filters, setFilters] = useState({
    state: "all",
    county: "all",
    city: "all",
    zipCode: "all",
    subscriptionStatus: "all",
    campaignDay: "all",
    replyStatus: "all",
    template: "all",
    emailExists: "all", // New filter for email exists
    createdAtSort: "desc", // Default to newest first for properties
    emailLogSort: "sent_at", // Sort field for email logs
    emailLogSortDirection: "desc", // Sort direction for email logs
  });

  const { toast } = useToast();

  // Handle created_at sort filter change
  const handleCreatedAtSortChange = () => {
    setFilters((prev) => ({
      ...prev,
      createdAtSort: prev.createdAtSort === "desc" ? "asc" : "desc",
    }));
    setCurrentPage(1);
  };

  // Sort properties by created_at
  const sortPropertiesByCreatedAt = (properties: Property[]) => {
    return [...properties].sort((a, b) => {
      const aTime = new Date(a.created_at || 0).getTime();
      const bTime = new Date(b.created_at || 0).getTime();

      return filters.createdAtSort === "desc" ? bTime - aTime : aTime - bTime;
    });
  };

  // Calculate dynamic stats based on filtered data
  const calculateFilteredStats = () => {
    const totalProperties = filteredProperties.length;
    const totalEmailsSent = filteredEmailLogs.length;
    const totalReplies = filteredEmailLogs.filter((log) => log.replied).length;
    const replyRate =
      totalEmailsSent > 0 ? (totalReplies / totalEmailsSent) * 100 : 0;

    return {
      totalProperties,
      totalEmailsSent,
      totalReplies,
      replyRate,
    };
  };

  const isSubscribed = (suspendUntil: string) => {
    const suspendDate = new Date(suspendUntil);
    const currentDate = new Date();
    return suspendDate <= currentDate;
  };

  const applyFilters = () => {
    let filteredProps = [...properties];
    let filteredLogs = [...emailLogs];

    // Apply search filter to properties, and logs
    if (searchTerm) {
      filteredProps = filteredProps.filter(
        (property) =>
          property.property_address
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          property.decision_maker_name
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          property.hoa_or_management_company
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          property.decision_maker_email
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase())
      );

      filteredLogs = filteredLogs.filter(
        (log) =>
          log.properties?.property_address
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          log.properties?.decision_maker_name
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          log.properties?.decision_maker_email
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          log.email_templates?.template_name
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase())
      );
    }

    // Apply location filters
    if (filters.state !== "all") {
      filteredProps = filteredProps.filter(
        (property) =>
          property.state?.toLowerCase() === filters.state.toLowerCase()
      );
      filteredLogs = filteredLogs.filter(
        (log) =>
          log.properties?.state?.toLowerCase() === filters.state.toLowerCase()
      );
    }

    if (filters.county !== "all") {
      filteredProps = filteredProps.filter(
        (property) =>
          property.county?.toLowerCase() === filters.county.toLowerCase()
      );
      filteredLogs = filteredLogs.filter(
        (log) =>
          log.properties?.county?.toLowerCase() === filters.county.toLowerCase()
      );
    }

    if (filters.city !== "all") {
      filteredProps = filteredProps.filter(
        (property) =>
          property.city?.toLowerCase() === filters.city.toLowerCase()
      );
      filteredLogs = filteredLogs.filter(
        (log) =>
          log.properties?.city?.toLowerCase() === filters.city.toLowerCase()
      );
    }

    if (filters.zipCode !== "all") {
      filteredProps = filteredProps.filter(
        (property) => property.zip_code === filters.zipCode
      );
      filteredLogs = filteredLogs.filter(
        (log) => log.properties?.zip_code === filters.zipCode
      );
    }

    // Apply subscription status filter
    if (filters.subscriptionStatus !== "all") {
      filteredProps = filteredProps.filter((property) => {
        if (!property.suspend_until) return false;
        const subscribed = isSubscribed(property.suspend_until);
        return filters.subscriptionStatus === "subscribed"
          ? subscribed
          : !subscribed;
      });
    }

    // Apply email exists filter
    if (filters.emailExists !== "all") {
      filteredProps = filteredProps.filter((property) => {
        const hasEmail =
          property.decision_maker_email &&
          property.decision_maker_email.trim() !== "";
        return filters.emailExists === "exists" ? hasEmail : !hasEmail;
      });
    }

    // Apply email-specific filters
    if (filters.campaignDay !== "all") {
      filteredLogs = filteredLogs.filter(
        (log) => log.campaign_day === parseInt(filters.campaignDay)
      );
    }

    if (filters.replyStatus !== "all") {
      filteredLogs = filteredLogs.filter((log) =>
        filters.replyStatus === "replied" ? log.replied : !log.replied
      );
    }

    if (filters.template !== "all") {
      filteredLogs = filteredLogs.filter(
        (log) => log.template_id === parseInt(filters.template)
      );
    }

    // Apply sorting to properties or email logs
    if (currentView === "properties") {
      filteredProps = sortPropertiesByCreatedAt(filteredProps);
    } else if (currentView === "logs") {
      filteredLogs = sortEmailLogs(filteredLogs);
    }

    setFilteredProperties(filteredProps);
    setFilteredEmailLogs(filteredLogs);
    setCurrentPage(1);
  };

  const applyPagination = () => {
    const currentData =
      currentView === "properties"
        ? filteredProperties
        : currentView === "logs"
        ? filteredEmailLogs
        : [];

    const itemsPerPage =
      currentView === "logs" ? EMAIL_LOGS_PER_PAGE : ITEMS_PER_PAGE;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginated = currentData.slice(startIndex, endIndex);

    setPaginatedItems(paginated);
    setTotalPages(Math.ceil(currentData.length / itemsPerPage));
  };

  // Handle email log sort change
  const handleEmailLogSortChange = (field: "sent_at" | "replied_at") => {
    setFilters((prev) => ({
      ...prev,
      emailLogSort: field,
      emailLogSortDirection:
        prev.emailLogSort === field && prev.emailLogSortDirection === "desc"
          ? "asc"
          : "desc",
    }));
    setCurrentPage(1);
  };

  // Sort email logs by selected field
  const sortEmailLogs = (logs: EmailLog[]) => {
    return [...logs].sort((a, b) => {
      let aValue: Date | null = null;
      let bValue: Date | null = null;

      if (filters.emailLogSort === "sent_at") {
        aValue = new Date(a.sent_at);
        bValue = new Date(b.sent_at);
      } else if (filters.emailLogSort === "replied_at") {
        aValue = a.replied_at ? new Date(a.replied_at) : null;
        bValue = b.replied_at ? new Date(b.replied_at) : null;
      }

      // Handle null values (push to end for desc, beginning for asc)
      if (aValue === null && bValue === null) return 0;
      if (aValue === null)
        return filters.emailLogSortDirection === "desc" ? 1 : -1;
      if (bValue === null)
        return filters.emailLogSortDirection === "desc" ? -1 : 1;

      const aTime = aValue.getTime();
      const bTime = bValue.getTime();

      return filters.emailLogSortDirection === "desc"
        ? bTime - aTime
        : aTime - bTime;
    });
  };

  const clearFilters = () => {
    setSearchTerm("");
    setFilters({
      state: "all",
      county: "all",
      city: "all",
      zipCode: "all",
      subscriptionStatus: "all",
      campaignDay: "all",
      replyStatus: "all",
      template: "all",
      emailExists: "all", // Reset to default
      createdAtSort: "desc", // Reset to default
      emailLogSort: "sent_at", // Reset to default
      emailLogSortDirection: "desc", // Reset to default
    });
    setCurrentPage(1);
  };

  const handleExport = async () => {
    const dataToExport: Property[] | EmailLog[] =
      currentView === "properties" ? filteredProperties : filteredEmailLogs;

    if (dataToExport.length === 0) {
      toast({
        title: "No Data",
        description: `No ${currentView} to export`,
        variant: "destructive",
      });
      return;
    }

    try {
      const filename = `${currentView}_${
        new Date().toISOString().split("T")[0]
      }.xlsx`;

      // Call API to generate Excel file
      const response = await fetch("/api/export-excel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ data: dataToExport, filename }),
      });

      if (!response.ok) throw new Error("Export failed");

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export Successful",
        description: `Exported ${dataToExport.length} ${currentView} to ${filename}`,
      });
    } catch (error) {
      console.error("Export failed:", error);
      toast({
        title: "Export Failed",
        description: `Failed to export ${currentView}. Please try again.`,
        variant: "destructive",
      });
    }
  };

  const handleRefresh = async () => {
    try {
      await Promise.all([
        refreshProperties(),
        refreshEmailLogs(),
        refreshCampaignProgress(),
        refreshTemplates(),
      ]);

      toast({
        title: "Data Refreshed",
        description: "All dashboard data has been updated",
      });
    } catch (error) {
      toast({
        title: "Refresh Failed",
        description:
          error instanceof Error ? error.message : "Failed to refresh data",
        variant: "destructive",
      });
    }
  };

  // Get unique values for filter dropdowns (ensure no nulls)
  const uniqueStates = [
    ...new Set(
      properties
        .map((p) => p.state)
        .filter((state): state is string => Boolean(state))
    ),
  ].sort();
  const uniqueCounties = [
    ...new Set(
      properties
        .map((p) => p.county)
        .filter((county): county is string => Boolean(county))
    ),
  ].sort();
  const uniqueCities = [
    ...new Set(
      properties
        .map((p) => p.city)
        .filter((city): city is string => Boolean(city))
    ),
  ].sort();
  const uniqueZipCodes = [
    ...new Set(
      properties
        .map((p) => p.zip_code)
        .filter((zip): zip is string => Boolean(zip))
    ),
  ].sort();
  const uniqueDays = [
    ...new Set(emailLogs.map((log) => log.campaign_day)),
  ].sort((a, b) => a - b);

  // Get current template for current day using the rotation formula
  const getCurrentDayTemplate = () => {
    if (!campaignProgress || !emailTemplates.length) return null;

    const activeTemplates = emailTemplates.filter((t) => t.is_active);
    if (activeTemplates.length === 0) return null;

    // Calculate which template to use based on current day
    // Formula: ((current_day - 1) % total_templates + 1)
    const currentDay = campaignProgress.current_day;
    const totalTemplates = activeTemplates.length;
    const templateIndex = (currentDay - 1) % totalTemplates;

    // Sort templates by ID to ensure consistent ordering
    const sortedTemplates = activeTemplates.sort((a, b) => a.id - b.id);

    return sortedTemplates[templateIndex] || null;
  };

  const currentTemplate = getCurrentDayTemplate();

  useEffect(() => {
    applyFilters();
  }, [searchTerm, filters, properties, emailLogs]);

  useEffect(() => {
    applyPagination();
  }, [filteredProperties, filteredEmailLogs, currentPage, currentView]);

  // Load selected PDF URL - only once on mount, then listen for changes
  useEffect(() => {
    const loadSelectedPdf = async () => {
      try {
        const { dataCache } = await import("@/lib/cache");
        const currentPdfUrl = await dataCache.getSelectedPdfUrl();
        setSelectedPdfUrl(currentPdfUrl);
      } catch (error) {
        console.error("Failed to load selected PDF:", error);
      }
    };

    loadSelectedPdf();
  }, []); // Empty dependency array - only load once on mount

  // Listen for campaign progress changes to update PDF URL efficiently
  useEffect(() => {
    if (campaignProgress) {
      const newPdfUrl =
        campaignProgress.pdf_url && campaignProgress.pdf_url.trim()
          ? campaignProgress.pdf_url
          : null;

      // Update the PDF URL state
      setSelectedPdfUrl(newPdfUrl);
    }
  }, [campaignProgress?.pdf_url]); // Only depend on the pdf_url property

  // Helper function to extract clean PDF name from URL
  const getPdfDisplayName = (url: string): string => {
    try {
      const filename = url.split("/").pop() || "";
      // Decode URL encoding and clean up the filename
      const cleanName = decodeURIComponent(filename).replace(/^\/+/, "");
      return cleanName || "Selected PDF";
    } catch (error) {
      return "Selected PDF";
    }
  };

  const loading = propertiesLoading || emailLogsLoading || campaignLoading;

  return (
    <div className="page-canvas p-3 md:p-6">
      <div className="space-y-4 md:space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl md:text-4xl font-medium text-[#1a1814]">
              Analytics Dashboard
            </h1>
            <p className="mt-1 md:mt-2 text-sm md:text-base text-[#6b6156]">
              Comprehensive real estate email campaign analytics and management
            </p>
          </div>
          <div className="flex space-x-2 md:space-x-4">
            <Button
              onClick={handleRefresh}
              variant="outline"
              disabled={loading}
              className="hidden md:flex"
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh All
            </Button>
            <Button
              onClick={handleExport}
              disabled={paginatedItems.length === 0}
              size="sm"
              className="md:text-base text-sm"
            >
              <Download className="mr-1 md:mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Export </span>
              {currentView}
            </Button>
          </div>
        </div>

        {/* Campaign Status */}
        <Card>
          <CardHeader className="pb-3 md:pb-6">
            <CardTitle className="flex items-center text-lg md:text-xl">
              <Target className="mr-2 h-4 w-4 md:h-5 md:w-5" />
              Campaign Status
            </CardTitle>
            <CardDescription className="text-sm">
              Current campaign progress and active template
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
              <div className="flex items-center space-x-2 md:space-x-4">
                <div className="p-2 md:p-3 rounded-2xl bg-[#e7f2ec]">
                  <Calendar className="h-4 w-4 md:h-6 md:w-6 text-[#1e4d42]" />
                </div>
                <div>
                  <p className="text-xs md:text-sm font-medium text-gray-500">
                    Current Day
                  </p>
                  <p className="text-lg md:text-2xl font-bold">
                    Day {campaignProgress?.current_day || 1}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 md:space-x-4">
                <div className="p-2 md:p-3 rounded-full bg-green-100">
                  <MessageSquare className="h-4 w-4 md:h-6 md:w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-xs md:text-sm font-medium text-gray-500">
                    Active Template
                  </p>
                  <p className="text-sm md:text-lg font-semibold truncate max-w-[120px] md:max-w-none">
                    {currentTemplate?.template_name || "No active template"}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 md:space-x-4">
                <div className="p-2 md:p-3 rounded-full bg-purple-100">
                  <Clock className="h-4 w-4 md:h-6 md:w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs md:text-sm font-medium text-gray-500">
                    Last Sent
                  </p>
                  <p className="text-sm md:text-lg font-semibold">
                    {campaignProgress?.last_sent_at
                      ? new Date(
                          campaignProgress.last_sent_at
                        ).toLocaleDateString()
                      : "Never"}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 md:space-x-4">
                <div className="p-2 md:p-3 rounded-full bg-orange-100">
                  <FileText className="h-4 w-4 md:h-6 md:w-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-xs md:text-sm font-medium text-gray-500">
                    Selected PDF
                  </p>
                  {selectedPdfUrl ? (
                    <div className="space-y-1">
                      <p
                        className="text-xs md:text-sm font-semibold text-green-700 truncate max-w-[120px] md:max-w-[200px]"
                        title={getPdfDisplayName(selectedPdfUrl)}
                      >
                        {getPdfDisplayName(selectedPdfUrl)}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(selectedPdfUrl, "_blank")}
                        className="text-xs h-5 md:h-6 px-1 md:px-2"
                      >
                        View PDF
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-xs md:text-sm text-gray-500">
                        No PDF selected
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => (window.location.href = "/proposals")}
                        className="text-xs h-5 md:h-6 px-1 md:px-2"
                      >
                        Select PDF
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statistics Overview - Dynamic based on filtered data */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
          <Card className="studio-stat">
            <CardContent className="p-3 md:p-6">
              <div className="flex items-center">
                <div className="rounded-2xl bg-[#e7f2ec] p-2.5">
                <Users className="h-6 w-6 md:h-7 md:w-7 text-[#1e4d42]" />
                </div>
                <div className="ml-2 md:ml-4">
                  <p className="text-xs md:text-sm font-medium text-gray-500">
                    Total Properties
                  </p>
                  <p className="text-lg md:text-2xl font-bold">
                    {calculateFilteredStats().totalProperties.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="studio-stat">
            <CardContent className="p-3 md:p-6">
              <div className="flex items-center">
                <div className="rounded-2xl bg-[#e7f2ec] p-2.5">
                <Mail className="h-6 w-6 md:h-7 md:w-7 text-[#1e4d42]" />
                </div>
                <div className="ml-2 md:ml-4">
                  <p className="text-xs md:text-sm font-medium text-gray-500">
                    Emails Sent
                  </p>
                  <p className="text-lg md:text-2xl font-bold">
                    {calculateFilteredStats().totalEmailsSent.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="studio-stat">
            <CardContent className="p-3 md:p-6">
              <div className="flex items-center">
                <div className="rounded-2xl bg-[#f8efe4] p-2.5">
                <MessageSquare className="h-6 w-6 md:h-7 md:w-7 text-[#8a5a2b]" />
                </div>
                <div className="ml-2 md:ml-4">
                  <p className="text-xs md:text-sm font-medium text-gray-500">
                    Total Replies
                  </p>
                  <p className="text-lg md:text-2xl font-bold">
                    {calculateFilteredStats().totalReplies.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="studio-stat">
            <CardContent className="p-3 md:p-6">
              <div className="flex items-center">
                <div className="rounded-2xl bg-[#f8efe4] p-2.5">
                <TrendingUp className="h-6 w-6 md:h-7 md:w-7 text-[#8a5a2b]" />
                </div>
                <div className="ml-2 md:ml-4">
                  <p className="text-xs md:text-sm font-medium text-gray-500">
                    Reply Rate
                  </p>
                  <p className="text-lg md:text-2xl font-bold">
                    {calculateFilteredStats().replyRate.toFixed(1)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* View Toggle and Filters */}
        <Card>
          <CardHeader className="pb-3 md:pb-6">
            <CardTitle className="flex flex-col md:flex-row items-start md:items-center justify-between space-y-2 md:space-y-0">
              <div className="flex items-center">
                <Filter className="mr-2 h-4 w-4 md:h-5 md:w-5" />
                <span className="text-lg md:text-xl">Data Management</span>
              </div>
              <div className="flex space-x-1 md:space-x-2">
                <Button
                  variant={currentView === "properties" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setCurrentView("properties");
                    // Reset to default sort when switching to properties
                    setFilters((prev) => ({
                      ...prev,
                      createdAtSort: "desc",
                    }));
                  }}
                  className="text-xs md:text-sm"
                >
                  Properties ({filteredProperties.length})
                </Button>
                <Button
                  variant={currentView === "logs" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentView("logs")}
                  className="text-xs md:text-sm"
                >
                  Email Logs ({filteredEmailLogs.length})
                </Button>
              </div>
            </CardTitle>
            <CardDescription className="text-sm">
              Search and filter data across properties and email campaigns
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3 md:space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search properties, names, companies, emails, templates..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 text-sm"
                />
              </div>

              {/* Mobile Filters - Stacked Layout */}
              <div className="md:hidden space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">State:</Label>
                    <Select
                      value={filters.state}
                      onValueChange={(value) =>
                        setFilters({ ...filters, state: value })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {uniqueStates.map((state) => (
                          <SelectItem key={state} value={state}>
                            {state}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">County:</Label>
                    <Select
                      value={filters.county}
                      onValueChange={(value) =>
                        setFilters({ ...filters, county: value })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {uniqueCounties.map((county) => (
                          <SelectItem key={county} value={county}>
                            {county}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">City:</Label>
                    <Select
                      value={filters.city}
                      onValueChange={(value) =>
                        setFilters({ ...filters, city: value })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {uniqueCities.map((city) => (
                          <SelectItem key={city} value={city}>
                            {city}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Zip:</Label>
                    <Select
                      value={filters.zipCode}
                      onValueChange={(value) =>
                        setFilters({ ...filters, zipCode: value })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {uniqueZipCodes.map((zipCode) => (
                          <SelectItem key={zipCode} value={zipCode}>
                            {zipCode}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Property-specific filters - Mobile */}
                {currentView === "properties" && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Email:</Label>
                      <Select
                        value={filters.emailExists}
                        onValueChange={(value) =>
                          setFilters({ ...filters, emailExists: value })
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="All" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="exists">Has Email</SelectItem>
                          <SelectItem value="missing">No Email</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Status:</Label>
                      <Select
                        value={filters.subscriptionStatus}
                        onValueChange={(value) =>
                          setFilters({ ...filters, subscriptionStatus: value })
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="All" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="subscribed">Subscribed</SelectItem>
                          <SelectItem value="unsubscribed">
                            Unsubscribed
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {/* Email-specific filters - Mobile */}
                {currentView === "logs" && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Day:</Label>
                        <Select
                          value={filters.campaignDay}
                          onValueChange={(value) =>
                            setFilters({ ...filters, campaignDay: value })
                          }
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="All" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            {uniqueDays.map((day) => (
                              <SelectItem key={day} value={day.toString()}>
                                {day}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Reply:</Label>
                        <Select
                          value={filters.replyStatus}
                          onValueChange={(value) =>
                            setFilters({ ...filters, replyStatus: value })
                          }
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="All" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="replied">Replied</SelectItem>
                            <SelectItem value="not-replied">
                              No Reply
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Template:</Label>
                      <Select
                        value={filters.template}
                        onValueChange={(value) =>
                          setFilters({ ...filters, template: value })
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="All" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          {emailTemplates.map((template) => (
                            <SelectItem
                              key={template.id}
                              value={template.id.toString()}
                            >
                              {template.template_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </div>

              {/* Desktop Filters - Single Row Layout */}
              <div className="hidden md:flex flex-wrap items-center gap-3">
                {/* Location Filters */}
                <div className="flex items-center space-x-2">
                  <Label className="text-sm whitespace-nowrap">State:</Label>
                  <Select
                    value={filters.state}
                    onValueChange={(value) =>
                      setFilters({ ...filters, state: value })
                    }
                  >
                    <SelectTrigger className="w-28">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {uniqueStates.map((state) => (
                        <SelectItem key={state} value={state}>
                          {state}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2">
                  <Label className="text-sm whitespace-nowrap">County:</Label>
                  <Select
                    value={filters.county}
                    onValueChange={(value) =>
                      setFilters({ ...filters, county: value })
                    }
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {uniqueCounties.map((county) => (
                        <SelectItem key={county} value={county}>
                          {county}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2">
                  <Label className="text-sm whitespace-nowrap">City:</Label>
                  <Select
                    value={filters.city}
                    onValueChange={(value) =>
                      setFilters({ ...filters, city: value })
                    }
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {uniqueCities.map((city) => (
                        <SelectItem key={city} value={city}>
                          {city}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2">
                  <Label className="text-sm whitespace-nowrap">Zip:</Label>
                  <Select
                    value={filters.zipCode}
                    onValueChange={(value) =>
                      setFilters({ ...filters, zipCode: value })
                    }
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {uniqueZipCodes.map((zipCode) => (
                        <SelectItem key={zipCode} value={zipCode}>
                          {zipCode}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Property-specific filters - only show when viewing properties */}
                {currentView === "properties" && (
                  <>
                  <div className="flex items-center space-x-2">
                      <Label className="text-sm whitespace-nowrap">
                        Email:
                      </Label>
                      <Select
                        value={filters.emailExists}
                        onValueChange={(value) =>
                          setFilters({ ...filters, emailExists: value })
                        }
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue placeholder="All" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="exists">Has Email</SelectItem>
                          <SelectItem value="missing">No Email</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Label className="text-sm whitespace-nowrap">
                        Status:
                      </Label>
                    <Select
                      value={filters.subscriptionStatus}
                      onValueChange={(value) =>
                        setFilters({ ...filters, subscriptionStatus: value })
                      }
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="subscribed">Subscribed</SelectItem>
                        <SelectItem value="unsubscribed">
                          Unsubscribed
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  </>
                )}

                {/* Email-specific filters - only show when viewing logs */}
                {currentView === "logs" && (
                  <>
                    <div className="h-6 border-l border-gray-300"></div>
                    <div className="flex items-center space-x-2">
                      <Label className="text-sm whitespace-nowrap">Day:</Label>
                      <Select
                        value={filters.campaignDay}
                        onValueChange={(value) =>
                          setFilters({ ...filters, campaignDay: value })
                        }
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue placeholder="All" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          {uniqueDays.map((day) => (
                            <SelectItem key={day} value={day.toString()}>
                              {day}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Label className="text-sm whitespace-nowrap">
                        Reply:
                      </Label>
                      <Select
                        value={filters.replyStatus}
                        onValueChange={(value) =>
                          setFilters({ ...filters, replyStatus: value })
                        }
                      >
                        <SelectTrigger className="w-28">
                          <SelectValue placeholder="All" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="replied">Replied</SelectItem>
                          <SelectItem value="not-replied">No Reply</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Label className="text-sm whitespace-nowrap">
                        Template:
                      </Label>
                      <Select
                        value={filters.template}
                        onValueChange={(value) =>
                          setFilters({ ...filters, template: value })
                        }
                      >
                        <SelectTrigger className="w-36">
                          <SelectValue placeholder="All" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          {emailTemplates.map((template) => (
                            <SelectItem
                              key={template.id}
                              value={template.id.toString()}
                            >
                              {template.template_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </div>

              {/* Sort controls - show below filters */}
              {currentView === "properties" && (
                <div className="pt-3 md:pt-4 border-t border-gray-200">
                  <div className="flex items-center space-x-2 md:space-x-4">
                    <Label className="text-xs md:text-sm font-medium text-gray-700">
                      Sort by:
                    </Label>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleCreatedAtSortChange}
                      className="bg-black hover:bg-gray-800 text-white flex items-center space-x-1 md:space-x-2 text-xs md:text-sm"
                    >
                      <span>Created</span>
                      <span className="text-xs font-bold">
                        {filters.createdAtSort === "desc" ? "↓" : "↑"}
                      </span>
                    </Button>
                    <Button
                      onClick={clearFilters}
                      variant="outline"
                      size="sm"
                      className="text-xs md:text-sm"
                    >
                      Clear Filters
                    </Button>
                  </div>
                </div>
              )}

              {/* Email logs sort controls */}
              {currentView === "logs" && (
                <div className="pt-3 md:pt-4 border-t border-gray-200">
                  <div className="flex flex-wrap items-center gap-1 md:space-x-1">
                    <Label className="text-xs md:text-sm font-medium text-gray-700">
                      Sort by:
                    </Label>
                    <Button
                      variant={
                        filters.emailLogSort === "sent_at"
                          ? "default"
                          : "outline"
                      }
                      size="sm"
                      onClick={() => handleEmailLogSortChange("sent_at")}
                      className={`flex items-center space-x-1 md:space-x-2 text-xs md:text-sm ${
                        filters.emailLogSort === "sent_at"
                          ? "bg-black hover:bg-gray-800 text-white"
                          : ""
                      }`}
                    >
                      <span>Sent Date</span>
                      {filters.emailLogSort === "sent_at" && (
                        <span className="text-xs font-bold">
                          {filters.emailLogSortDirection === "desc" ? "↓" : "↑"}
                        </span>
                      )}
                    </Button>
                    <Button
                      variant={
                        filters.emailLogSort === "replied_at"
                          ? "default"
                          : "outline"
                      }
                      size="sm"
                      onClick={() => handleEmailLogSortChange("replied_at")}
                      className={`flex items-center space-x-1 md:space-x-2 text-xs md:text-sm ${
                        filters.emailLogSort === "replied_at"
                          ? "bg-black hover:bg-gray-800 text-white"
                          : ""
                      }`}
                    >
                      <span>Reply Date</span>
                      {filters.emailLogSort === "replied_at" && (
                        <span className="text-xs font-bold">
                          {filters.emailLogSortDirection === "desc" ? "↓" : "↑"}
                        </span>
                      )}
                    </Button>
                    <Button
                      onClick={clearFilters}
                      variant="outline"
                      size="sm"
                      className="text-xs md:text-sm"
                    >
                      Clear Filters
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Data Table */}
        <Card>
          <CardHeader className="pb-3 md:pb-6">
            <CardTitle className="text-lg md:text-xl">
              {currentView === "properties" ? "Properties" : "Email Logs"}(
              {currentView === "properties"
                ? filteredProperties.length
                : filteredEmailLogs.length}
              )
            </CardTitle>
            <CardDescription className="text-sm">
              {(currentView === "properties"
                ? filteredProperties.length
                : filteredEmailLogs.length) !==
                (currentView === "properties"
                  ? properties.length
                  : emailLogs.length) &&
                `Showing ${
                  currentView === "properties"
                    ? filteredProperties.length
                    : filteredEmailLogs.length
                } of ${
                  currentView === "properties"
                    ? properties.length
                    : emailLogs.length
                } ${currentView}`}
              {paginatedItems.length > 0 &&
                totalPages > 1 &&
                ` • Page ${currentPage} of ${totalPages}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-8 space-y-6">
                <Logo 
                  size="md" 
                  variant="colored" 
                  showText={false}
                  clickable={false}
                />
                <RefreshCw className="h-8 w-8 animate-spin text-[#1e4d42]" />
                <p className="text-gray-500 text-sm">
                  Loading {currentView}...
                </p>
              </div>
            ) : paginatedItems.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 text-sm">
                  No {currentView}{" "}
                  {searchTerm || Object.values(filters).some((f) => f !== "all")
                    ? "match your filters"
                    : "found"}
                </p>
              </div>
            ) : (
              <>
                {/* Mobile Card View */}
                <div className="md:hidden space-y-3">
                  {currentView === "properties"
                    ? (paginatedItems as Property[]).map((property) => (
                        <Card key={property.id} className="p-3">
                          <div className="space-y-2">
                            <div className="flex justify-between items-start">
                              <h3 className="font-medium text-sm truncate flex-1 mr-2">
                                {property.property_address || "—"}
                              </h3>
                              <Badge
                                variant={
                                  property.suspend_until &&
                                  isSubscribed(property.suspend_until)
                                    ? "default"
                                    : "secondary"
                                }
                                className="text-xs"
                              >
                                {property.suspend_until &&
                                isSubscribed(property.suspend_until)
                                  ? "Subscribed"
                                  : "Unsubscribed"}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                              <div>
                                <span className="font-medium">
                                  HOA/Management:
                                </span>
                                <p className="truncate">
                                  {property.hoa_or_management_company || "—"}
                                </p>
                              </div>
                              <div>
                                <span className="font-medium">
                                  Decision Maker:
                                </span>
                                <p className="truncate">
                                  {property.decision_maker_name || "—"}
                                </p>
                              </div>
                              <div>
                                <span className="font-medium">Email:</span>
                                {property.decision_maker_email &&
                                !property.decision_maker_email.includes(
                                  "noemail"
                                ) ? (
                                  <a
                                    href={`mailto:${property.decision_maker_email}`}
                                    className="text-[#1e4d42] hover:underline truncate block"
                                  >
                                    {property.decision_maker_email}
                                  </a>
                                ) : (
                                  <p>—</p>
                                )}
                              </div>
                              <div>
                                <span className="font-medium">Phone:</span>
                                <p className="truncate">
                                  {property.decision_maker_phone || "—"}
                                </p>
                              </div>
                              <div>
                                <span className="font-medium">Location:</span>
                                <p className="truncate">
                                  {property.city}, {property.state}{" "}
                                  {property.zip_code}
                                </p>
                              </div>
                              <div>
                                <span className="font-medium">Created:</span>
                                <p>
                                  {new Date(
                                    property.created_at
                                  ).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))
                    : (paginatedItems as EmailLog[]).map((log) => (
                        <Card key={log.id} className="p-3">
                          <div className="space-y-2">
                            <div className="flex justify-between items-start">
                              <h3 className="font-medium text-sm truncate flex-1 mr-2">
                                {log.properties?.property_address || "—"}
                              </h3>
                              <Badge
                                variant={log.replied ? "default" : "secondary"}
                                className="text-xs"
                              >
                                {log.replied ? "Replied" : "No Reply"}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                              <div>
                                <span className="font-medium">
                                  Decision Maker:
                                </span>
                                <p className="truncate">
                                  {log.properties?.decision_maker_name || "—"}
                                </p>
                              </div>
                              <div>
                                <span className="font-medium">
                                  Campaign Day:
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  Day {log.campaign_day}
                                </Badge>
                              </div>
                              <div>
                                <span className="font-medium">Email:</span>
                                {log.properties?.decision_maker_email ? (
                                  <a
                                    href={`mailto:${log.properties.decision_maker_email}`}
                                    className="text-[#1e4d42] hover:underline truncate block"
                                  >
                                    {log.properties.decision_maker_email}
                                  </a>
                                ) : (
                                  <p>—</p>
                                )}
                              </div>
                              <div>
                                <span className="font-medium">Template:</span>
                                <p className="truncate">
                                  {log.email_templates?.template_name || "—"}
                                </p>
                              </div>
                              <div>
                                <span className="font-medium">Sent At:</span>
                                <p>
                                  {new Date(log.sent_at).toLocaleDateString()}
                                </p>
                              </div>
                              <div>
                                <span className="font-medium">Replied At:</span>
                                <p>
                                  {log.replied_at
                                    ? new Date(
                                        log.replied_at
                                      ).toLocaleDateString()
                                    : "—"}
                                </p>
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block rounded-md border overflow-x-auto">
                  {currentView === "properties" ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[250px]">
                            Property Address
                          </TableHead>
                          <TableHead className="min-w-[200px]">
                            HOA/Management
                          </TableHead>
                          <TableHead className="min-w-[150px]">
                            Decision Maker
                          </TableHead>
                          <TableHead className="min-w-[200px]">Email</TableHead>
                          <TableHead className="min-w-[120px]">Phone</TableHead>
                          <TableHead className="min-w-[80px]">State</TableHead>
                          <TableHead className="min-w-[120px]">
                            County
                          </TableHead>
                          <TableHead className="min-w-[120px]">City</TableHead>
                          <TableHead className="min-w-[80px]">Zip</TableHead>
                          <TableHead className="min-w-[120px]">
                            Status
                          </TableHead>
                          <TableHead className="min-w-[100px]">
                            Created
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(paginatedItems as Property[]).map((property) => (
                          <TableRow key={property.id}>
                            <TableCell className="font-medium min-w-[250px]">
                              <div className="max-w-[250px] break-words">
                              {property.property_address || "—"}
                              </div>
                            </TableCell>
                            <TableCell className="min-w-[200px]">
                              <div className="max-w-[200px] break-words">
                              {property.hoa_or_management_company || "—"}
                              </div>
                            </TableCell>
                            <TableCell className="min-w-[150px]">
                              <div className="max-w-[150px] break-words">
                              {property.decision_maker_name || "—"}
                              </div>
                            </TableCell>
                            <TableCell className="min-w-[200px]">
                              {property.decision_maker_email &&
                              !property.decision_maker_email.includes(
                                "noemail"
                              ) ? (
                                <a
                                  href={`mailto:${property.decision_maker_email}`}
                                  className="text-[#1e4d42] hover:underline break-words max-w-[200px] block"
                                >
                                  {property.decision_maker_email}
                                </a>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell className="min-w-[120px]">
                              <div className="max-w-[120px] break-words">
                              {property.decision_maker_phone || "—"}
                              </div>
                            </TableCell>
                            <TableCell className="min-w-[80px]">
                              {property.state || "—"}
                            </TableCell>
                            <TableCell className="min-w-[120px]">
                              {property.county || "—"}
                            </TableCell>
                            <TableCell className="min-w-[120px]">
                              {property.city || "—"}
                            </TableCell>
                            <TableCell className="min-w-[80px]">
                              {property.zip_code || "—"}
                            </TableCell>
                            <TableCell className="min-w-[120px]">
                              <Badge
                                variant={
                                  property.suspend_until &&
                                  isSubscribed(property.suspend_until)
                                    ? "default"
                                    : "secondary"
                                }
                              >
                                {property.suspend_until &&
                                isSubscribed(property.suspend_until)
                                  ? "Subscribed"
                                  : "Unsubscribed"}
                              </Badge>
                            </TableCell>
                            <TableCell className="min-w-[100px]">
                              {new Date(
                                property.created_at
                              ).toLocaleDateString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : currentView === "logs" ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[250px]">
                            Property Address
                          </TableHead>
                          <TableHead className="min-w-[150px]">
                            Decision Maker
                          </TableHead>
                          <TableHead className="min-w-[200px]">Email</TableHead>
                          <TableHead className="min-w-[180px]">
                            Template Name
                          </TableHead>
                          <TableHead className="min-w-[120px]">
                            Campaign Day
                          </TableHead>
                          <TableHead className="min-w-[120px]">
                            Sent At
                          </TableHead>
                          <TableHead className="min-w-[120px]">
                            Replied At
                          </TableHead>
                          <TableHead className="min-w-[100px]">
                            Reply Status
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(paginatedItems as EmailLog[]).map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="font-medium min-w-[250px]">
                              <div className="max-w-[250px] break-words">
                              {log.properties?.property_address || "—"}
                              </div>
                            </TableCell>
                            <TableCell className="min-w-[150px]">
                              <div className="max-w-[150px] break-words">
                              {log.properties?.decision_maker_name || "—"}
                              </div>
                            </TableCell>
                            <TableCell className="min-w-[200px]">
                              {log.properties?.decision_maker_email ? (
                                <a
                                  href={`mailto:${log.properties.decision_maker_email}`}
                                  className="text-[#1e4d42] hover:underline break-words max-w-[200px] block"
                                >
                                  {log.properties.decision_maker_email}
                                </a>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell className="min-w-[180px]">
                              <div className="max-w-[180px] break-words">
                              {log.email_templates?.template_name || "—"}
                              </div>
                            </TableCell>
                            <TableCell className="min-w-[120px]">
                              <Badge variant="outline">
                                Day {log.campaign_day}
                              </Badge>
                            </TableCell>
                            <TableCell className="min-w-[120px]">
                              {new Date(log.sent_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="min-w-[120px]">
                              {log.replied_at
                                ? new Date(log.replied_at).toLocaleDateString()
                                : "—"}
                            </TableCell>
                            <TableCell className="min-w-[100px]">
                              <Badge
                                variant={log.replied ? "default" : "secondary"}
                              >
                                {log.replied ? "Replied" : "No Reply"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : null}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex flex-col md:flex-row items-center justify-between mt-4 space-y-2 md:space-y-0">
                    <div className="text-xs md:text-sm text-gray-500">
                      Showing{" "}
                      {(currentPage - 1) *
                        (currentView === "logs"
                          ? EMAIL_LOGS_PER_PAGE
                          : ITEMS_PER_PAGE) +
                        1}{" "}
                      to{" "}
                      {Math.min(
                        currentPage *
                          (currentView === "logs"
                            ? EMAIL_LOGS_PER_PAGE
                            : ITEMS_PER_PAGE),
                        currentView === "properties"
                          ? filteredProperties.length
                          : filteredEmailLogs.length
                      )}{" "}
                      of{" "}
                      {currentView === "properties"
                        ? filteredProperties.length
                        : filteredEmailLogs.length}{" "}
                      results
                    </div>
                    <div className="flex items-center space-x-1 md:space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="text-xs md:text-sm px-2 md:px-3"
                      >
                        <ChevronLeft className="h-3 w-3 md:h-4 md:w-4" />
                        <span className="hidden sm:inline">Previous</span>
                      </Button>

                      <div className="flex items-center space-x-1">
                        {Array.from(
                          { length: Math.min(5, totalPages) },
                          (_, i) => {
                            let pageNum;
                            if (totalPages <= 5) {
                              pageNum = i + 1;
                            } else if (currentPage <= 3) {
                              pageNum = i + 1;
                            } else if (currentPage >= totalPages - 2) {
                              pageNum = totalPages - 4 + i;
                            } else {
                              pageNum = currentPage - 2 + i;
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
                                className="w-6 h-6 md:w-8 md:h-8 p-0 text-xs md:text-sm"
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
                        className="text-xs md:text-sm px-2 md:px-3"
                      >
                        <span className="hidden sm:inline">Next</span>
                        <ChevronRight className="h-3 w-3 md:h-4 md:w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
