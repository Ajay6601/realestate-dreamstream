"use client";

import type React from "react";
import { useState } from "react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useRequestStats } from "@/hooks/use-request-stats";
import {
  ImageIcon,
  Trash2,
  Edit2,
  Check,
  X,
  Plus,
  RefreshCw,
  AlertTriangle,
  Clock,
  Zap,
} from "lucide-react";
import { Logo } from "@/components/logo";
import type { ExtractedProperty } from "@/lib/types";

export default function UploadPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [extractedProperties, setExtractedProperties] = useState<
    ExtractedProperty[]
  >([]);
  const [parentAddress, setParentAddress] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");

  const { toast } = useToast();
  const {
    stats,
    loading: statsLoading,
    error: statsError,
    refresh: refreshStats,
  } = useRequestStats();

  // Helper function to format reset time in user's local timezone
  const formatResetTime = (resetTime: string) => {
    const resetDate = new Date(resetTime);
    const now = new Date();
    const timeDiff = resetDate.getTime() - now.getTime();

    // If already past reset time, show "soon"
    if (timeDiff <= 0) {
      return "soon";
    }

    const hours = Math.floor(timeDiff / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));

    // Format local time
    const localResetTime = resetDate.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    // Create countdown text
    let countdown = "";
    if (hours > 0) {
      countdown = `${hours}h ${minutes}m`;
    } else {
      countdown = `${minutes}m`;
    }

    return `${countdown} (${localResetTime})`;
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid File",
        description: "Please select an image file (JPEG or PNG)",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please select an image smaller than 10MB",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Reset previous extraction
    setExtractedProperties([]);
    setParentAddress("");
  };

  const handleExtractNames = async () => {
    if (!selectedFile) {
      toast({
        title: "No Image",
        description: "Please select an image first",
        variant: "destructive",
      });
      return;
    }

    // Check if processing limit is reached (this disables extract functionality too)
    if (stats && !stats.canMakeRequests) {
      toast({
        title: "Processing Limit Reached",
        description: `Property processing limit reached (${
          stats.limit
        } requests). New extractions are disabled until limit resets in ${formatResetTime(
          stats.resetTime
        )}.`,
        variant: "destructive",
      });
      return;
    }

    setIsExtracting(true);
    try {
      const formData = new FormData();
      formData.append("image", selectedFile);

      const response = await fetch("/api/extract-names", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to extract names");
      }

      if (data.names?.length > 0) {
        const properties = data.names.map((name: string, index: number) => ({
          id: `property-${index}`,
          name: name.trim(),
          editable: false,
        }));
        setExtractedProperties(properties);
        toast({
          title: "Success",
          description: `Extracted ${properties.length} property names`,
        });
        refreshStats(); // Refresh stats to show updated usage
      } else {
        toast({
          title: "No Names Found",
          description: "No property names could be extracted from this image",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error extracting names:", error);
      toast({
        title: "Extraction Failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to extract property names",
        variant: "destructive",
      });
    } finally {
      setIsExtracting(false);
    }
  };

  const handleEditProperty = (id: string, currentName: string) => {
    setEditingId(id);
    setEditingValue(currentName);
  };

  const handleSaveEdit = (id: string) => {
    if (editingValue.trim()) {
      setExtractedProperties((prev) =>
        prev.map((property) =>
          property.id === id
            ? { ...property, name: editingValue.trim() }
            : property
        )
      );
    }
    setEditingId(null);
    setEditingValue("");
  };

  const handleCancelEdit = (propertyId?: string) => {
    if (propertyId) {
      const property = extractedProperties.find((p) => p.id === propertyId);
      if (property?.name === "New Property") {
        handleRemoveProperty(propertyId);
        setEditingId(null);
        setEditingValue("");
        return;
      }
    }
    setEditingId(null);
    setEditingValue("");
  };

  const handleRemoveProperty = (id: string) => {
    setExtractedProperties((prev) =>
      prev.filter((property) => property.id !== id)
    );
  };

  const handleAddProperty = () => {
    const newProperty: ExtractedProperty = {
      id: `property-${Date.now()}`,
      name: "New Property",
      editable: false,
    };
    setExtractedProperties((prev) => [...prev, newProperty]);
    handleEditProperty(newProperty.id, newProperty.name);
  };

  const handleProcessProperties = async () => {
    if (extractedProperties.length === 0) {
      toast({
        title: "No Properties",
        description: "Please extract property names first",
        variant: "destructive",
      });
      return;
    }

    if (!parentAddress.trim()) {
      toast({
        title: "Missing Address",
        description: "Please enter a parent address",
        variant: "destructive",
      });
      return;
    }

    // Check if we have enough remaining processing requests for all properties
    const requestsNeeded = extractedProperties.length;
    if (stats && stats.remaining < requestsNeeded) {
      toast({
        title: "Insufficient Processing Requests",
        description: `Processing ${requestsNeeded} properties requires ${requestsNeeded} requests, but you only have ${
          stats.remaining
        } remaining. Limit resets in ${formatResetTime(stats.resetTime)}.`,
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const propertyNames = extractedProperties.map((p) => p.name);

      const response = await fetch("/api/process-properties", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          properties: propertyNames,
          parentAddress: parentAddress.trim(),
          filename: selectedFile?.name || "uploaded-image",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          toast({
            title: "Processing Limit Exceeded",
            description: data.details || "Property processing limit reached",
            variant: "destructive",
          });
          refreshStats(); // Refresh stats to show updated usage
          return;
        }
        throw new Error(data.error || "Failed to start processing");
      }

      toast({
        title: "Processing Started",
        description:
          "Your properties are being processed. You'll receive an email when complete.",
      });

      // Clear the page instead of redirecting
      setSelectedFile(null);
      setImagePreview(null);
      setExtractedProperties([]);
      setParentAddress("");

      // Reset the file input
      const fileInput = document.getElementById(
        "image-upload"
      ) as HTMLInputElement;
      if (fileInput) {
        fileInput.value = "";
      }

      // Refresh stats to show updated usage
      refreshStats();
    } catch (error) {
      console.error("Error processing properties:", error);
      toast({
        title: "Processing Failed",
        description:
          error instanceof Error ? error.message : "Failed to start processing",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="page-canvas p-4 sm:p-6 w-full">
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="text-center sm:text-left">
          <h1 className="text-2xl sm:text-4xl font-medium text-[#1a1814]">
            Upload Property Image
          </h1>
          <p className="mt-2 text-sm sm:text-base text-[#6b6156]">
            Upload an image containing property names to extract and enrich
            contact information
          </p>
        </div>

        {/* Request Usage Statistics */}
        <Card>
          <CardContent className="pt-6">
            {statsLoading ? (
              <div className="flex flex-col items-center justify-center py-6 space-y-4">
                <Logo 
                  size="sm" 
                  variant="colored" 
                  showText={false}
                  clickable={false}
                />
                <div className="flex items-center space-x-2 text-gray-600">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Loading request statistics...</span>
                </div>
              </div>
            ) : statsError ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Failed to load request statistics: {statsError}
                </AlertDescription>
              </Alert>
            ) : stats ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Zap className="h-5 w-5 text-[#c9894a]" />
                    <h3 className="font-semibold text-gray-900">
                      Daily Property Processing Usage
                    </h3>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={refreshStats}
                    className="h-8 w-8 p-0"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Processing Requests Used</span>
                    <span className="font-medium">
                      {stats.used} / {stats.limit}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        stats.remaining <= 100
                          ? "bg-red-500"
                          : stats.remaining <= 300
                          ? "bg-yellow-500"
                          : "bg-green-500"
                      }`}
                      style={{ width: `${(stats.used / stats.limit) * 100}%` }}
                    />
                  </div>

                  <div className="flex justify-between items-center text-xs text-gray-600">
                    <span>Remaining: {stats.remaining}</span>
                    <div className="flex items-center space-x-1">
                      <Clock className="h-3 w-3" />
                      <span>Resets in {formatResetTime(stats.resetTime)}</span>
                    </div>
                  </div>
                </div>

                {stats.remaining <= 100 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      You are running low on property processing requests. Only{" "}
                      {stats.remaining} requests remaining until tomorrow.
                    </AlertDescription>
                  </Alert>
                )}

                {!stats.canMakeRequests && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Property processing limit reached. Upload functionality is
                      disabled until tomorrow.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Image Upload */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center space-x-2 text-lg">
              <ImageIcon className="h-5 w-5" />
              <span>Step 1: Upload Image</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3 space-y-6">
            {/* Compact Upload Section */}
            <div className="drop-well flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl p-4">
              <div className="flex items-center space-x-3 flex-1">
                <div className="p-2 bg-[#1c3a32] rounded-2xl">
                  <ImageIcon className="h-4 w-4 text-[#f6efe4]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    Upload Image
                  </p>
                  <p className="text-xs text-gray-600 truncate">
                    Select image (Up to 10MB)
                  </p>
                </div>
              </div>
              {/* Upload Button */}
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  disabled={isExtracting}
                  className="hidden"
                  id="image-upload"
                />
                <Button
                  asChild
                  className={`inline-flex items-center justify-center px-4 h-10 w-full sm:w-auto text-sm font-medium rounded-full text-white bg-[#1c3a32] hover:bg-[#16362e] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1e4d42] transition-all min-w-[100px] cursor-pointer ${
                    isExtracting ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                  disabled={isExtracting}
                >
                  <label htmlFor="image-upload">
                    <ImageIcon className="mr-1 h-4 w-4" />
                    <span className="hidden sm:inline">Choose File</span>
                    <span className="sm:hidden">Upload</span>
                  </label>
                </Button>
                {/* Extract Names Button - immediately after upload button */}
                <Button
                  onClick={handleExtractNames}
                  disabled={
                    !selectedFile ||
                    isExtracting ||
                    stats?.canMakeRequests === false
                  }
                  className={`inline-flex items-center justify-center px-4 h-10 w-full sm:w-auto text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors min-w-[100px] ${
                    !selectedFile ||
                    isExtracting ||
                    stats?.canMakeRequests === false
                      ? "opacity-50 cursor-not-allowed"
                      : ""
                  }`}
                >
                  {isExtracting ? (
                    <>
                      <RefreshCw className="mr-1 h-4 w-4 animate-spin" />
                      <span className="hidden sm:inline">Extracting...</span>
                      <span className="sm:hidden">...</span>
                    </>
                  ) : (
                    <>
                      <ImageIcon className="mr-1 h-4 w-4" />
                      <span className="hidden sm:inline">Extract Names</span>
                      <span className="sm:hidden">Extract</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
            {/* Image Preview */}
            {imagePreview && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label>Image Preview</Label>
                  {selectedFile && (
                    <span
                      className="max-w-[200px] truncate text-xs text-gray-700 font-medium"
                      title={selectedFile.name}
                    >
                      : {selectedFile.name}
                    </span>
                  )}
                </div>
                <div className="border rounded-lg p-2 sm:p-4 bg-white">
                  <img
                    src={imagePreview}
                    alt="Upload preview"
                    className="w-full h-auto max-h-64 sm:max-h-96 mx-auto rounded shadow-sm object-contain"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Extracted Names */}
        {extractedProperties.length > 0 && (
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <div>
                  <CardTitle className="text-lg">
                    Step 2: Review & Edit Property Names
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Review the extracted property names. You can edit or remove
                    any entries before processing.
                  </CardDescription>
                </div>
                <Button
                  onClick={handleAddProperty}
                  size="sm"
                  variant="outline"
                  className="w-full sm:w-auto"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Property
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Mobile-friendly property list */}
                <div className="max-h-96 overflow-y-auto space-y-3 sm:hidden border rounded-lg p-3">
                  {extractedProperties.map((property, idx) => (
                    <div
                      key={property.id}
                      className="border rounded-lg p-3 bg-gray-50 flex items-start gap-3"
                    >
                      <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded bg-gray-200 text-gray-600 font-semibold text-sm mt-1">
                        {idx + 1}
                      </div>
                      <div className="flex-1 space-y-3">
                        {editingId === property.id ? (
                          <Input
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter")
                                handleSaveEdit(property.id);
                              if (e.key === "Escape")
                                handleCancelEdit(property.id);
                            }}
                            className="w-full"
                            autoFocus
                          />
                        ) : (
                          <div className="font-medium text-gray-900 truncate max-w-[240px]">
                            {property.name}
                          </div>
                        )}
                        <div className="flex gap-2">
                          {editingId === property.id ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSaveEdit(property.id)}
                                className="flex-1"
                              >
                                <Check className="h-4 w-4 mr-1" />
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCancelEdit(property.id)}
                                className="flex-1"
                              >
                                <X className="h-4 w-4 mr-1" />
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  handleEditProperty(property.id, property.name)
                                }
                                className="flex-1"
                              >
                                <Edit2 className="h-4 w-4 mr-1" />
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  handleRemoveProperty(property.id)
                                }
                                className="flex-1"
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Remove
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop table view */}
                <div className="hidden sm:block rounded-md border max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-white z-10">
                      <TableRow>
                        <TableHead className="w-12 text-center">#</TableHead>
                        <TableHead>Property Name</TableHead>
                        <TableHead className="w-32">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {extractedProperties.map((property, idx) => (
                        <TableRow key={property.id}>
                          <TableCell className="text-center font-semibold text-gray-500">
                            {idx + 1}
                          </TableCell>
                          <TableCell>
                            {editingId === property.id ? (
                              <Input
                                value={editingValue}
                                onChange={(e) =>
                                  setEditingValue(e.target.value)
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter")
                                    handleSaveEdit(property.id);
                                  if (e.key === "Escape")
                                    handleCancelEdit(property.id);
                                }}
                                className="w-full"
                                autoFocus
                              />
                            ) : (
                              <span className="font-medium truncate max-w-[720px] block">
                                {property.name}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              {editingId === property.id ? (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleSaveEdit(property.id)}
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      handleCancelEdit(property.id)
                                    }
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      handleEditProperty(
                                        property.id,
                                        property.name
                                      )
                                    }
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      handleRemoveProperty(property.id)
                                    }
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Parent Address Input */}
                <div className="space-y-2 pt-4 border-t border-gray-200">
                  <Label
                    htmlFor="parent-address"
                    className="text-sm font-medium"
                  >
                    Parent Address
                  </Label>
                  <Input
                    id="parent-address"
                    placeholder="e.g., Palm Beach County, Florida"
                    value={parentAddress}
                    onChange={(e) => setParentAddress(e.target.value)}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500">
                    Enter the general location (state, county, city) where these
                    properties are located
                  </p>
                </div>

                {/* Process Button */}
                <Button
                  onClick={handleProcessProperties}
                  disabled={
                    isProcessing ||
                    extractedProperties.length === 0 ||
                    !parentAddress.trim() ||
                    stats?.canMakeRequests === false
                  }
                  className="w-full"
                  size="lg"
                >
                  {isProcessing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Starting Processing...
                    </>
                  ) : (
                    `Process ${extractedProperties.length} Properties`
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
