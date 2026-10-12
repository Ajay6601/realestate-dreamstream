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
import { useToast } from "@/hooks/use-toast";
import {
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  FileText,
  Upload,
  Trash2,
  Info,
  CheckCircle,
  Circle,
  ArrowUp,
  ArrowDown,
  Filter,
  MoreVertical,
  Eye,
} from "lucide-react";
import { Logo } from "@/components/logo";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCachedPdfProposals } from "@/hooks/use-cached-data";
import type { PDFProposal } from "@/lib/types";
import { dataCache } from "@/lib/cache";
import { getBucketUrl } from "@/lib/cache";

const ITEMS_PER_PAGE = 10;

export default function ProposalsPage() {
  // Use cached PDF proposals hook for efficient data management
  // This hook automatically handles loading, caching, and refreshing of PDF data
  const {
    data: pdfProposals,
    loading: pdfProposalsLoading,
    error: pdfProposalsError,
    refresh: refreshPdfProposals,
  } = useCachedPdfProposals({ autoFetch: true, refreshOnMount: false });

  // Local state management for immediate UI updates
  const [localPdfProposals, setLocalPdfProposals] = useState<PDFProposal[]>([]);
  const [isLocalSynced, setIsLocalSynced] = useState(false);
  const [filteredPdfProposals, setFilteredPdfProposals] = useState<
    PDFProposal[]
  >([]);
  const [paginatedItems, setPaginatedItems] = useState<PDFProposal[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [selectedPdfForMetadata, setSelectedPdfForMetadata] =
    useState<PDFProposal | null>(null);
  const [isMetadataDialogOpen, setIsMetadataDialogOpen] = useState(false);
  const [selectedPdfUrl, setSelectedPdfUrl] = useState<string | null>(null);
  const [selectingPdf, setSelectingPdf] = useState(false);
  const [sortBy, setSortBy] = useState<"date" | "size">("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [isMobile, setIsMobile] = useState(false);

  const { toast } = useToast();

  // Check if mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Sync local PDF proposals with cached data when it changes
  useEffect(() => {
    if (pdfProposals.length > 0) {
      setLocalPdfProposals(pdfProposals);
      setIsLocalSynced(true);
    } else if (pdfProposals.length === 0 && !pdfProposalsLoading) {
      // Empty result from cache (not loading)
      setLocalPdfProposals([]);
      setIsLocalSynced(true);
    }
  }, [pdfProposals, pdfProposalsLoading]);

  // Load currently selected PDF URL
  useEffect(() => {
    const loadSelectedPdf = async () => {
      try {
        const currentPdfUrl = await dataCache.getSelectedPdfUrl();
        setSelectedPdfUrl(currentPdfUrl);
      } catch (error) {
        console.error("Failed to load selected PDF:", error);
      }
    };

    loadSelectedPdf();
  }, []);

  // Use local state for immediate UI updates, fallback to cached data
  const displayPdfProposals = isLocalSynced ? localPdfProposals : pdfProposals;

  // Local state management helpers
  const addLocalPdfProposal = (newProposal: PDFProposal) => {
    setLocalPdfProposals((prev) => [newProposal, ...prev]);
  };

  const removeLocalPdfProposal = (fileName: string) => {
    setLocalPdfProposals((prev) =>
      prev.filter((proposal) => proposal.name !== fileName)
    );
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast({
        title: "Invalid File Type",
        description: "Please select a PDF file.",
        variant: "destructive",
      });
      return;
    }

    setUploadingPdf(true);
    try {
      // Upload PDF and get the actual file name (which might be different if duplicate)
      const result = await dataCache.uploadPdfProposal(file);

      // Create new proposal object with actual file name from storage
      const newProposal: PDFProposal = {
        name: result.actualFileName,
        size: file.size,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_accessed_at: new Date().toISOString(),
        publicUrl: `${getBucketUrl()}/${encodeURIComponent(
          result.actualFileName
        )}`,
        metadata: {
          eTag: "",
          mimetype: "application/pdf",
          cacheControl: "3600",
          lastModified: new Date().toISOString(),
          contentLength: file.size,
          httpStatusCode: 200,
        },
      };

      // Add to local state for immediate UI update
      addLocalPdfProposal(newProposal);

      // Show appropriate success message
      const originalName = file.name;
      const uploadedName = result.actualFileName;

      if (originalName !== uploadedName) {
        toast({
          title: "Upload Successful",
          description: `"${originalName}" has been uploaded as "${uploadedName}" (filename was sanitized for compatibility).`,
        });
      } else {
        toast({
          title: "Upload Successful",
          description: `${originalName} has been uploaded successfully.`,
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to upload PDF";

      // Don't log duplicate file errors as console errors since they're expected user behavior
      if (!errorMessage.includes("already exists")) {
        console.error("Upload failed:", error);
      }

      toast({
        title: "Upload Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setUploadingPdf(false);
      // Reset the input
      event.target.value = "";
    }
  };

  const handleDeletePdf = async (fileName: string) => {
    try {
      // Delete from storage first
      await dataCache.deletePdfProposal(fileName);

      // Remove from local state for immediate UI update
      removeLocalPdfProposal(fileName);

      toast({
        title: "Delete Successful",
        description: `${fileName} has been deleted successfully.`,
      });
    } catch (error) {
      console.error("Delete failed:", error);
      toast({
        title: "Delete Failed",
        description:
          error instanceof Error ? error.message : "Failed to delete PDF",
        variant: "destructive",
      });
    }
  };

  const handleRowClick = (pdf: PDFProposal) => {
    if (pdf.publicUrl) {
      window.open(pdf.publicUrl, "_blank");
    } else {
      toast({
        title: "View Failed",
        description: "PDF URL is not available",
        variant: "destructive",
      });
    }
  };

  const handleShowMetadata = (pdf: PDFProposal) => {
    setSelectedPdfForMetadata(pdf);
    setIsMetadataDialogOpen(true);
  };

  const handleSelectPdf = async (pdf: PDFProposal) => {
    if (!pdf.publicUrl) {
      toast({
        title: "Selection Failed",
        description: "PDF URL is not available",
        variant: "destructive",
      });
      return;
    }

    setSelectingPdf(true);
    try {
      await dataCache.updateSelectedPdf(pdf.publicUrl);
      setSelectedPdfUrl(pdf.publicUrl);

      toast({
        title: "PDF Selected",
        description: `${pdf.name} has been selected for campaigns.`,
      });
    } catch (error) {
      console.error("Failed to select PDF:", error);
      toast({
        title: "Selection Failed",
        description:
          error instanceof Error ? error.message : "Failed to select PDF",
        variant: "destructive",
      });
    } finally {
      setSelectingPdf(false);
    }
  };

  const handleDeselectPdf = async () => {
    // Show warning toast instead of allowing deselection
    toast({
      title: "Cannot Deselect PDF",
      description:
        "You cannot deselect the current PDF. Please choose a different PDF instead.",
      variant: "destructive",
    });
  };

  const applyFilters = () => {
    let filteredPdfs = [...displayPdfProposals];

    // Apply search filter to PDFs
    if (searchTerm) {
      filteredPdfs = filteredPdfs.filter((pdf) =>
        pdf.name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply sorting
    filteredPdfs.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case "date":
          const dateA = new Date(a.created_at).getTime();
          const dateB = new Date(b.created_at).getTime();
          comparison = dateA - dateB;
          break;
        case "size":
          comparison = a.size - b.size;
          break;
        default:
          comparison = 0;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    setFilteredPdfProposals(filteredPdfs);
    setCurrentPage(1);
  };

  const applyPagination = () => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const paginated = filteredPdfProposals.slice(startIndex, endIndex);

    setPaginatedItems(paginated);
    setTotalPages(Math.ceil(filteredPdfProposals.length / ITEMS_PER_PAGE));
  };

  const handleRefresh = async () => {
    try {
      // Force refresh by calling cache refresh directly (bypasses cache)
      await refreshPdfProposals();
      // Reset local sync to force reload from cache
      setIsLocalSynced(false);

      // Don't reload selected PDF URL - keep current UI selection state

      toast({
        title: "Data Refreshed",
        description: "PDF proposals list has been updated from database",
      });
    } catch (error) {
      console.error("Refresh error:", error);
      toast({
        title: "Refresh Failed",
        description:
          error instanceof Error ? error.message : "Failed to refresh data",
        variant: "destructive",
      });
    }
  };

  const handleSort = (field: "date" | "size") => {
    if (sortBy === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortDirection("asc");
    }
  };

  useEffect(() => {
    applyFilters();
  }, [searchTerm, displayPdfProposals, sortBy, sortDirection]);

  useEffect(() => {
    applyPagination();
  }, [filteredPdfProposals, currentPage]);

  // Mobile PDF Card Component
  const PdfCard = ({ pdf }: { pdf: PDFProposal }) => {
    const isSelected = selectedPdfUrl === pdf.publicUrl;

    return (
      <Card
        className={`mb-4 cursor-pointer hover:shadow-md transition-shadow ${
          isSelected ? "ring-2 ring-[#1e4d42] bg-[#f3f7f5] border-[#c9ddd6]" : ""
        }`}
        onClick={() => handleRowClick(pdf)}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-start space-x-3 flex-1 min-w-0">
              <FileText className="h-5 w-5 text-red-500 mt-1 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <h3 className="font-medium text-gray-900 truncate text-sm">
                  {pdf.name}
                </h3>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className="text-xs text-gray-500">
                    {(pdf.size / 1024).toFixed(1)} KB
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(pdf.created_at).toLocaleDateString()}
                  </span>
                  {isSelected && (
                    <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                      SELECTED
                    </span>
                  )}
                </div>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => e.stopPropagation()}
                  className="h-8 w-8 p-0 flex-shrink-0"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRowClick(pdf);
                  }}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View PDF
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    handleShowMetadata(pdf);
                  }}
                >
                  <Info className="h-4 w-4 mr-2" />
                  Show Details
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isSelected) {
                      handleDeselectPdf();
                    } else {
                      handleSelectPdf(pdf);
                    }
                  }}
                  disabled={selectingPdf}
                >
                  {selectingPdf ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : isSelected ? (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  ) : (
                    <Circle className="h-4 w-4 mr-2" />
                  )}
                  {isSelected ? "Selected" : "Select for Campaigns"}
                </DropdownMenuItem>
                {!isSelected && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <DropdownMenuItem
                        onSelect={(e) => {
                          e.preventDefault();
                        }}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="sm:max-w-md mx-auto">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete PDF</AlertDialogTitle>
                        <AlertDialogDescription>
                          {`Are you sure you want to delete "${pdf.name}"? This action cannot be undone.`}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePdf(pdf.name);
                          }}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center justify-between">
            <Button
              variant={isSelected ? "default" : "outline"}
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                if (isSelected) {
                  handleDeselectPdf();
                } else {
                  handleSelectPdf(pdf);
                }
              }}
              disabled={selectingPdf}
              className={`${
                isSelected
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "hover:bg-[#f6f0e6]"
              }`}
            >
              {selectingPdf ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : isSelected ? (
                <CheckCircle className="h-4 w-4 mr-2" />
              ) : (
                <Circle className="h-4 w-4 mr-2" />
              )}
              {isSelected ? "Selected" : "Select"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="page-canvas p-3 md:p-6">
      <div className="space-y-6 md:space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
          <div>
            <h1 className="text-2xl md:text-4xl font-medium text-[#1a1814]">
              PDF Proposals
            </h1>
            <p className="mt-1 md:mt-2 text-sm md:text-base text-[#6b6156]">
              Upload, view, and manage your PDF proposal documents. Select one
              PDF to use for email campaigns.
            </p>
          </div>
          <Button
            onClick={handleRefresh}
            variant="outline"
            disabled={pdfProposalsLoading}
            className="hidden sm:flex sm:w-auto"
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${
                pdfProposalsLoading ? "animate-spin" : ""
              }`}
            />
            Refresh
          </Button>
        </div>

        {/* Upload and Search Section */}
        <Card>
          <CardContent className="pt-6 space-y-6">
            {/* Compact Upload Section */}
            <div className="drop-well flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl p-4">
              <div className="flex items-center space-x-3 flex-1">
                <div className="p-2 bg-[#1c3a32] rounded-2xl">
                  <Upload className="h-4 w-4 text-[#f6efe4]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    Upload PDF
                  </p>
                  <p className="text-xs text-gray-600 truncate">
                    Select proposal document
                  </p>
                </div>
              </div>
              <div>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileUpload}
                  disabled={uploadingPdf}
                  className="hidden"
                  id="pdf-upload"
                />
                <label
                  htmlFor="pdf-upload"
                  className={`cursor-pointer inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-full text-white bg-[#1c3a32] hover:bg-[#16362e] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1e4d42] transition-all min-w-[100px] ${
                    uploadingPdf ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  {uploadingPdf ? (
                    <>
                      <RefreshCw className="mr-1 h-4 w-4 animate-spin" />
                      <span className="hidden sm:inline">Uploading...</span>
                      <span className="sm:hidden">...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="mr-1 h-4 w-4" />
                      <span className="hidden sm:inline">Choose File</span>
                      <span className="sm:hidden">Upload</span>
                    </>
                  )}
                </label>
              </div>
            </div>

            {/* Search and Sort Section */}
            <div className="space-y-4 pt-2 border-t border-gray-200">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search PDF files by name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Sort Controls */}
              <div className="flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                  <div className="flex items-center space-x-2">
                    <Filter className="h-4 w-4 text-gray-500" />
                    <Label className="text-sm font-medium text-gray-500">
                      Sort by:
                    </Label>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant={sortBy === "date" ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleSort("date")}
                      className="flex items-center space-x-1 flex-1 sm:flex-initial"
                    >
                      <span>Date</span>
                      {sortBy === "date" &&
                        (sortDirection === "asc" ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : (
                          <ArrowDown className="h-3 w-3" />
                        ))}
                    </Button>
                    <Button
                      variant={sortBy === "size" ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleSort("size")}
                      className="flex items-center space-x-1 flex-1 sm:flex-initial"
                    >
                      <span>Size</span>
                      {sortBy === "size" &&
                        (sortDirection === "asc" ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : (
                          <ArrowDown className="h-3 w-3" />
                        ))}
                    </Button>
                  </div>
                </div>

                {/* Results count */}
                <div className="text-sm text-gray-500 text-center sm:text-right">
                  {filteredPdfProposals.length} PDF
                  {filteredPdfProposals.length !== 1 ? "s" : ""} found
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* PDF List */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg md:text-xl">
              PDF Files ({filteredPdfProposals.length})
            </CardTitle>
            <CardDescription className="text-sm">
              {filteredPdfProposals.length !== displayPdfProposals.length &&
                `Showing ${filteredPdfProposals.length} of ${displayPdfProposals.length} files`}
              {paginatedItems.length > 0 &&
                totalPages > 1 &&
                ` • Page ${currentPage} of ${totalPages}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pdfProposalsError ? (
              <div className="text-center py-8">
                <p className="text-red-500 mb-2">Error loading PDF files:</p>
                <p className="text-sm text-gray-600">{pdfProposalsError}</p>
                <Button
                  onClick={handleRefresh}
                  variant="outline"
                  className="mt-4"
                >
                  Try Again
                </Button>
              </div>
            ) : pdfProposalsLoading ? (
              <div className="flex flex-col items-center justify-center py-8 space-y-6">
                <Logo 
                  size="md" 
                  variant="colored" 
                  showText={false}
                  clickable={false}
                />
                <RefreshCw className="h-8 w-8 animate-spin text-[#1e4d42]" />
                <p className="text-gray-500">Loading PDF files...</p>
              </div>
            ) : paginatedItems.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">
                  No PDF files {searchTerm ? "match your search" : "found"}
                </p>
              </div>
            ) : (
              <>
                {/* Mobile View - Cards */}
                {isMobile ? (
                  <div className="md:hidden">
                    {paginatedItems.map((pdf) => (
                      <PdfCard key={pdf.name} pdf={pdf} />
                    ))}
                  </div>
                ) : (
                  /* Desktop View - Table */
                  <div className="hidden md:block rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Status</TableHead>
                          <TableHead>File Name</TableHead>
                          <TableHead>Size</TableHead>
                          <TableHead>Uploaded</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedItems.map((pdf) => {
                          const isSelected = selectedPdfUrl === pdf.publicUrl;

                          return (
                            <TableRow
                              key={pdf.name}
                              className={`cursor-pointer hover:bg-gray-50 ${
                                isSelected
                                  ? "bg-[#f3f7f5] border-l-4 border-l-[#1e4d42]"
                                  : ""
                              }`}
                              onClick={() => handleRowClick(pdf)}
                            >
                              <TableCell>
                                <div className="flex items-center justify-center">
                                  <Button
                                    variant={isSelected ? "default" : "outline"}
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (isSelected) {
                                        handleDeselectPdf();
                                      } else {
                                        handleSelectPdf(pdf);
                                      }
                                    }}
                                    disabled={selectingPdf}
                                    className={`${
                                      isSelected
                                        ? "bg-green-600 hover:bg-green-700 text-white"
                                        : "hover:bg-[#f6f0e6]"
                                    }`}
                                    title={
                                      isSelected
                                        ? "Cannot deselect - choose a different PDF to switch"
                                        : "Select this PDF for campaigns"
                                    }
                                  >
                                    {selectingPdf ? (
                                      <RefreshCw className="h-4 w-4 animate-spin" />
                                    ) : isSelected ? (
                                      <CheckCircle className="h-4 w-4" />
                                    ) : (
                                      <Circle className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                              </TableCell>
                              <TableCell className="font-medium">
                                <div className="flex items-center space-x-2">
                                  <FileText className="h-4 w-4 text-red-500" />
                                  <span className="truncate max-w-xs">
                                    {pdf.name}
                                  </span>
                                  {isSelected && (
                                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                                      SELECTED
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                {(pdf.size / 1024).toFixed(1)} KB
                              </TableCell>
                              <TableCell>
                                {new Date(pdf.created_at).toLocaleDateString()}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center space-x-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleShowMetadata(pdf);
                                    }}
                                    title="Show Metadata"
                                  >
                                    <Info className="h-4 w-4" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                        }}
                                        disabled={isSelected}
                                        className={`${
                                          isSelected
                                            ? "text-gray-400 cursor-not-allowed opacity-50"
                                            : "text-red-600 hover:text-red-700"
                                        }`}
                                        title={
                                          isSelected
                                            ? "Cannot delete the selected PDF. Please select a different PDF first."
                                            : "Delete PDF"
                                        }
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    {!isSelected && (
                                      <AlertDialogContent className="sm:max-w-md mx-auto">
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>
                                            Delete PDF
                                          </AlertDialogTitle>
                                          <AlertDialogDescription>
                                            {`Are you sure you want to delete "${pdf.name}"? This action cannot be undone.`}
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel onClick={(e) => e.stopPropagation()}>
                                            Cancel
                                          </AlertDialogCancel>
                                          <AlertDialogAction
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDeletePdf(pdf.name);
                                            }}
                                            className="bg-red-600 hover:bg-red-700"
                                          >
                                            Delete
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    )}
                                  </AlertDialog>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
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
                        filteredPdfProposals.length
                      )}{" "}
                      of {filteredPdfProposals.length} results
                    </div>

                    <div className="flex items-center justify-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="flex items-center"
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
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
                                className="w-8 h-8 p-0 text-xs md:text-sm"
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
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Metadata Dialog */}
      <Dialog
        open={isMetadataDialogOpen}
        onOpenChange={setIsMetadataDialogOpen}
      >
        <DialogContent className="max-w-[calc(100vw-2rem)] mx-auto sm:max-w-md [&>button]:flex [&>button]:items-center [&>button]:justify-center [&>button]:w-6 [&>button]:h-6">
          <DialogHeader>
            <DialogTitle>PDF Metadata</DialogTitle>
            <DialogDescription>
              Details about the selected PDF file
            </DialogDescription>
          </DialogHeader>
          {selectedPdfForMetadata && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  File Name
                </label>
                <p className="text-sm text-gray-900 break-all">
                  {selectedPdfForMetadata.name}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Size
                </label>
                <p className="text-sm text-gray-900">
                  {(selectedPdfForMetadata.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Uploaded
                </label>
                <p className="text-sm text-gray-900">
                  {new Date(selectedPdfForMetadata.created_at).toLocaleString()}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Last Modified
                </label>
                <p className="text-sm text-gray-900">
                  {new Date(selectedPdfForMetadata.updated_at).toLocaleString()}
                </p>
              </div>
              {selectedPdfForMetadata.metadata && (
                <>
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      MIME Type
                    </label>
                    <p className="text-sm text-gray-900">
                      {selectedPdfForMetadata.metadata.mimetype}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      Content Length
                    </label>
                    <p className="text-sm text-gray-900">
                      {selectedPdfForMetadata.metadata.contentLength} bytes
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              onClick={() => setIsMetadataDialogOpen(false)}
              className="w-full sm:w-auto"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
