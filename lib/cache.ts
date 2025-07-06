import { createClient } from "@/lib/supabase/client";
import { createClient as createServiceRoleClient } from "@supabase/supabase-js";
import type {
  Property,
  EmailTemplate,
  EmailLog,
  CampaignProgress,
  DashboardStats,
  PDFProposal,
} from "@/lib/types";

/**
 * Utility function to generate Supabase bucket URL from environment variables
 * This eliminates the need for NEXT_PUBLIC_SUPABASE_BUCKET_URL
 */
export function getBucketUrl(): string {
  const bucketName = process.env.NEXT_PUBLIC_SUPABASE_BUCKET_NAME;
  if (!bucketName) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_BUCKET_NAME environment variable is not set"
    );
  }

  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!projectUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL environment variable is not set");
  }

  // Extract project ID from URL
  const projectId = projectUrl
    .replace("https://", "")
    .replace(".supabase.co", "");

  return `https://${projectId}.supabase.co/storage/v1/object/public/${bucketName}`;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  userId: string;
}

interface CacheStore {
  properties: CacheEntry<Property[]> | null;
  emailTemplates: CacheEntry<EmailTemplate[]> | null;
  emailLogs: CacheEntry<EmailLog[]> | null;
  campaignProgress: CacheEntry<CampaignProgress | null> | null;
  dashboardStats: CacheEntry<DashboardStats> | null;
  pdfProposals: CacheEntry<PDFProposal[]> | null;
}

class DataCache {
  private cache: CacheStore = {
    properties: null,
    emailTemplates: null,
    emailLogs: null,
    campaignProgress: null,
    dashboardStats: null,
    pdfProposals: null,
  };

  private readonly CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
  private supabase = createClient();

  // Service role client for storage operations (bypasses RLS)
  private storageClient = createServiceRoleClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY!
  );

  // Helper function to generate bucket URL from project URL and bucket name
  private getBucketUrl(): string {
    return getBucketUrl();
  }

  // Auth state for hooks and UI - no user caching, only root user status caching
  private isAuthInitialized = false;
  private authInitPromise: Promise<void> | null = null;
  private currentUser: any = null;
  private currentUserIdCache: string | null = null; // Short-term cache to prevent API spam
  private userIdLastFetch: number = 0;
  private readonly USER_ID_FETCH_THROTTLE = 1000; // 1 second throttle
  private isRootUser = false;
  private rootUserCacheTimestamp = 0;
  private readonly ROOT_USER_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  // Cache change listeners for React hooks
  private cacheChangeListeners: Array<() => void> = [];

  // Throttle mechanism for PDF URL fetching
  private pdfUrlCache: string | null = null;
  private pdfUrlLastFetch: number = 0;
  private readonly PDF_URL_FETCH_THROTTLE = 5000; // 5 seconds throttle

  constructor() {
    // Cache system initialized silently
  }

  // Cache change notification methods
  addCacheChangeListener(listener: () => void): () => void {
    this.cacheChangeListeners.push(listener);
    // Return unsubscribe function
    return () => {
      const index = this.cacheChangeListeners.indexOf(listener);
      if (index > -1) {
        this.cacheChangeListeners.splice(index, 1);
      }
    };
  }

  private notifyCacheChange(): void {
    this.cacheChangeListeners.forEach((listener) => {
      try {
        listener();
      } catch (error) {
        console.error("Error in cache change listener:", error);
      }
    });
  }

  private isExpired(entry: CacheEntry<any> | null): boolean {
    if (!entry) return true;
    return Date.now() - entry.timestamp > this.CACHE_DURATION;
  }

  private isSameUser(entry: CacheEntry<any> | null): boolean {
    // Simple check - just ensure entry has a userId
    // User validation happens at fetch time in ensureUserContext
    return entry !== null && entry.userId !== null && entry.userId !== "";
  }

  // Unified cache validation helper to reduce redundant code
  private isValidCache<T>(entry: CacheEntry<T> | null): boolean {
    return entry !== null && !this.isExpired(entry) && this.isSameUser(entry);
  }

  // Generic data fetcher to reduce redundant code patterns
  private async fetchWithCache<T>(
    cacheKey: keyof CacheStore,
    fetchingFlag: string,
    fetcher: () => Promise<T>,
    emptyValue: T
  ): Promise<T> {
    try {
      // Always ensure user context first - this validates user exists
      const userId = await this.ensureUserContext();
      if (!userId) {
        console.log(`🔐 [CACHE] No authenticated user for ${cacheKey}`);
        return emptyValue;
      }

      const entry = this.cache[cacheKey] as CacheEntry<T> | null;

      // Check if cache exists, is valid, and belongs to current user
      if (entry && this.isValidCache(entry) && entry.userId === userId) {
        const ageMinutes = Math.round((Date.now() - entry.timestamp) / 60000);
        console.log(
          `🟢 [CACHE HIT] ${cacheKey} (user: ${userId.substring(
            0,
            8
          )}..., ${ageMinutes}min old)`
        );
        return entry.data;
      }

      // Log cache miss reason with timing info
      if (!entry) {
        console.log(`🔄 [CACHE MISS] ${cacheKey} - no entry`);
      } else if (this.isExpired(entry)) {
        const ageMinutes = Math.round((Date.now() - entry.timestamp) / 60000);
        console.log(
          `⏰ [CACHE EXPIRED] ${cacheKey} (${ageMinutes}min old, limit: ${Math.round(
            this.CACHE_DURATION / 60000
          )}min)`
        );
      } else if (entry.userId !== userId) {
        console.log(`👤 [CACHE USER MISMATCH] ${cacheKey}`);
      }

      // Prevent concurrent fetches
      const fetchingKey = `fetching${fetchingFlag}` as keyof this;
      if (this[fetchingKey] as boolean) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return this.fetchWithCache(cacheKey, fetchingFlag, fetcher, emptyValue);
      }

      (this[fetchingKey] as any) = true;
      console.log(
        `🔄 [DATABASE FETCH] ${cacheKey} (user: ${userId.substring(0, 8)}...)`
      );

      try {
        const data = await fetcher();

        // Cache the result with current user ID
        (this.cache[cacheKey] as any) = {
          data,
          timestamp: Date.now(),
          userId,
        };

        console.log(
          `✅ [DATABASE SUCCESS] ${cacheKey} cached (user: ${userId.substring(
            0,
            8
          )}...)`
        );
        return data;
      } finally {
        (this[fetchingKey] as any) = false;
      }
    } catch (error) {
      console.error(`Error in fetch${fetchingFlag}:`, error);
      const entry = this.cache[cacheKey] as CacheEntry<T> | null;
      return entry?.data || emptyValue;
    }
  }

  async getCurrentUserId(): Promise<string | null> {
    try {
      // Prevent API spam with short throttle - only for performance, not security
      const now = Date.now();
      if (
        this.currentUserIdCache !== null &&
        now - this.userIdLastFetch < this.USER_ID_FETCH_THROTTLE
      ) {
        return this.currentUserIdCache;
      }

      // Always get fresh user ID from Supabase
      const {
        data: { session },
        error: sessionError,
      } = await this.supabase.auth.getSession();

      if (sessionError || !session) {
        this.currentUserIdCache = null;
        this.userIdLastFetch = now;
        return null;
      }

      const {
        data: { user },
        error,
      } = await this.supabase.auth.getUser();

      if (error || !user) {
        this.currentUserIdCache = null;
        this.userIdLastFetch = now;
        return null;
      }

      // Cache for throttle duration only
      this.currentUserIdCache = user.id;
      this.userIdLastFetch = now;
      return user.id;
    } catch (error) {
      // Silently handle auth errors during sign out
      this.currentUserIdCache = null;
      this.userIdLastFetch = Date.now();
      return null;
    }
  }

  private async ensureUserContext(): Promise<string | null> {
    // Simply get current user ID fresh - no caching
    return await this.getCurrentUserId();
  }

  // Force refresh user ID (useful after login/logout)
  invalidateUserIdCache(): void {
    this.currentUserIdCache = null;
    this.userIdLastFetch = 0;
    console.log("🔄 [USER ID CACHE] Invalidated user ID cache");
  }

  async getProperties(): Promise<Property[]> {
    return this.fetchWithCache(
      "properties",
      "Properties",
      async () => {
        const { data, error } = await this.supabase
          .from("properties")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) {
          throw new Error(error.message);
        }

        return data || [];
      },
      []
    );
  }

  async getEmailTemplates(): Promise<EmailTemplate[]> {
    return this.fetchWithCache(
      "emailTemplates",
      "EmailTemplates",
      async () => {
        const { data, error } = await this.supabase
          .from("email_templates")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error fetching email templates:", error);
          throw new Error(error.message);
        }

        return data || [];
      },
      []
    );
  }

  async getEmailLogs(): Promise<EmailLog[]> {
    return this.fetchWithCache(
      "emailLogs",
      "EmailLogs",
      async () => {
        const { data, error } = await this.supabase
          .from("email_logs")
          .select(
            `
            *,
            properties(
              id,
              property_address,
              decision_maker_name,
              decision_maker_email,
              state,
              city,
              county,
              zip_code
            ),
            email_templates(
              id,
              template_name
            )
          `
          )
          .order("sent_at", { ascending: false });

        if (error) {
          console.error("Error fetching email logs:", error);
          throw new Error(error.message);
        }

        return data || [];
      },
      []
    );
  }

  async getCampaignProgress(): Promise<CampaignProgress | null> {
    return this.fetchWithCache(
      "campaignProgress",
      "CampaignProgress",
      async () => {
        const { data, error } = await this.supabase
          .from("campaign_progress")
          .select("*")
          .order("id", { ascending: false })
          .limit(1);

        if (error) {
          console.error("Error fetching campaign progress:", error);
          throw new Error(error.message);
        }

        return data ? data[0] : null;
      },
      null
    );
  }

  async getDashboardStats(): Promise<DashboardStats> {
    return this.fetchWithCache(
      "dashboardStats",
      "DashboardStats",
      async () => {
        // Try to use cached data first to avoid duplicate requests
        // Get cached user ID once (already cached from fetchWithCache call)
        let properties: Property[] = [];
        let emailLogs: EmailLog[] = [];
        let campaignProgress: CampaignProgress | null = null;
        let emailTemplates: EmailTemplate[] = [];

        // Use cached data if available and valid
        const propertiesEntry = this.cache.properties;
        const emailLogsEntry = this.cache.emailLogs;
        const campaignProgressEntry = this.cache.campaignProgress;
        const emailTemplatesEntry = this.cache.emailTemplates;

        const needsProperties = !this.isValidCache(propertiesEntry);
        const needsEmailLogs = !this.isValidCache(emailLogsEntry);
        const needsCampaignProgress = !this.isValidCache(campaignProgressEntry);
        const needsEmailTemplates = !this.isValidCache(emailTemplatesEntry);

        // Use cached data when available
        if (!needsProperties) {
          properties = propertiesEntry!.data;
          console.log(`🟢 [DASHBOARD] Using cached properties`);
        }
        if (!needsEmailLogs) {
          emailLogs = emailLogsEntry!.data;
          console.log(`🟢 [DASHBOARD] Using cached emailLogs`);
        }
        if (!needsCampaignProgress) {
          campaignProgress = campaignProgressEntry!.data;
          console.log(`🟢 [DASHBOARD] Using cached campaignProgress`);
        }
        if (!needsEmailTemplates) {
          emailTemplates = emailTemplatesEntry!.data;
          console.log(`🟢 [DASHBOARD] Using cached emailTemplates`);
        }

        // Fetch missing data only (optimized queries for stats)
        if (needsProperties) {
          console.log(`🔄 [DASHBOARD] Fetching properties data`);
          const { data: propertiesData, error: propertiesError } =
            await this.supabase
              .from("properties")
              .select("id")
              .order("created_at", { ascending: false });

          if (!propertiesError && propertiesData) {
            properties = propertiesData as any[]; // Only need count
          }
        }

        if (needsEmailLogs) {
          console.log(`🔄 [DASHBOARD] Fetching emailLogs data`);
          const { data: emailLogsData, error: emailLogsError } =
            await this.supabase
              .from("email_logs")
              .select("id, campaign_day, replied, sent_at, replied_at");

          if (!emailLogsError && emailLogsData) {
            emailLogs = emailLogsData as EmailLog[];
          }
        }

        if (needsCampaignProgress) {
          console.log(`🔄 [DASHBOARD] Fetching campaignProgress data`);
          const { data: campaignProgressData, error: campaignProgressError } =
            await this.supabase
              .from("campaign_progress")
              .select("*")
              .order("id", { ascending: false })
              .limit(1);

          if (!campaignProgressError) {
            campaignProgress =
              campaignProgressData && campaignProgressData.length > 0
                ? campaignProgressData[0]
                : null;
          }
        }

        if (needsEmailTemplates) {
          console.log(`🔄 [DASHBOARD] Fetching emailTemplates data`);
          const { data: emailTemplatesData, error: emailTemplatesError } =
            await this.supabase.from("email_templates").select("id, is_active");

          if (!emailTemplatesError && emailTemplatesData) {
            emailTemplates = emailTemplatesData as EmailTemplate[];
          }
        }

        // Calculate stats from the data (cached or fresh)
        const totalProperties = properties.length;
        const totalEmailsSent = emailLogs.length;
        const totalReplies = emailLogs.filter((log) => log.replied).length;
        const replyRate =
          totalEmailsSent > 0 ? (totalReplies / totalEmailsSent) * 100 : 0;
        const currentWeek = campaignProgress?.current_day || 1;
        const activeTemplates = emailTemplates.filter(
          (t) => t.is_active
        ).length;

        console.log(
          `📊 [DASHBOARD STATS] Calculated: ${totalProperties} properties, ${totalEmailsSent} emails, ${totalReplies} replies`
        );

        return {
          totalProperties,
          totalEmailsSent,
          totalReplies,
          replyRate,
          currentWeek,
          activeTemplates,
        };
      },
      {
        totalProperties: 0,
        totalEmailsSent: 0,
        totalReplies: 0,
        replyRate: 0,
        currentWeek: 1,
        activeTemplates: 0,
      }
    );
  }

  async getPdfProposals(): Promise<PDFProposal[]> {
    return this.fetchWithCache(
      "pdfProposals",
      "PdfProposals",
      () => this.fetchPdfProposalsFromStorage(),
      []
    );
  }

  private async fetchPdfProposalsFromStorage(): Promise<PDFProposal[]> {
    const bucketName = process.env.NEXT_PUBLIC_SUPABASE_BUCKET_NAME;
    if (!bucketName) {
      throw new Error(
        "NEXT_PUBLIC_SUPABASE_BUCKET_NAME environment variable is not set"
      );
    }

    const bucketBaseUrl = this.getBucketUrl();

    const { data: files, error } = await this.storageClient.storage
      .from(bucketName)
      .list("", {
        limit: 100,
        offset: 0,
        sortBy: { column: "created_at", order: "desc" },
      });

    if (error) {
      throw new Error(`Failed to fetch PDF proposals: ${error.message}`);
    }

    if (!files || files.length === 0) {
      return [];
    }

    // Filter for PDF files only
    const pdfFiles = files.filter(
      (file) =>
        file.name.toLowerCase().endsWith(".pdf") ||
        (file.metadata?.mimetype && file.metadata.mimetype.includes("pdf"))
    );

    // Map files to PDFProposal format
    const proposals = pdfFiles.map((file) => {
      const publicUrl = bucketBaseUrl
        ? `${bucketBaseUrl}/${encodeURIComponent(file.name)}`
        : undefined;

      return {
        name: file.name,
        size: file.metadata?.size || 0,
        created_at: file.created_at || new Date().toISOString(),
        updated_at: file.updated_at || new Date().toISOString(),
        last_accessed_at: file.last_accessed_at || new Date().toISOString(),
        publicUrl,
        metadata: file.metadata
          ? {
              eTag: file.metadata.eTag || "",
              mimetype: file.metadata.mimetype || "application/pdf",
              cacheControl: file.metadata.cacheControl || "",
              lastModified: file.metadata.lastModified || "",
              contentLength:
                file.metadata.contentLength || file.metadata.size || 0,
              httpStatusCode: file.metadata.httpStatusCode || 200,
            }
          : null,
      };
    });

    return proposals;
  }

  // Campaign Progress PDF Selection methods
  async updateSelectedPdf(pdfUrl: string): Promise<void> {
    const userId = await this.ensureUserContext();
    if (!userId) {
      throw new Error("User not authenticated");
    }

    // Use default PDF URL from schema if pdfUrl is empty/null
    const finalPdfUrl = pdfUrl && pdfUrl.trim();

    // Check if we have cached campaign progress first, otherwise fetch
    let campaignProgress = null;
    const cachedEntry = this.cache.campaignProgress;
    if (
      cachedEntry &&
      this.isValidCache(cachedEntry) &&
      cachedEntry.userId === userId
    ) {
      campaignProgress = cachedEntry.data;
      console.log(`🟢 [UPDATE PDF] Using cached campaignProgress`);
    } else {
      console.log(`🔄 [UPDATE PDF] Fetching fresh campaignProgress`);
      campaignProgress = await this.getCampaignProgress();
    }

    if (campaignProgress) {
      // Update existing record
      const { error } = await this.supabase
        .from("campaign_progress")
        .update({
          pdf_url: finalPdfUrl,
        })
        .eq("id", campaignProgress.id);

      if (error) {
        throw new Error(`Failed to update selected PDF: ${error.message}`);
      }

      // Update cache
      const updatedProgress = {
        ...campaignProgress,
        pdf_url: finalPdfUrl,
      };

      this.cache.campaignProgress = {
        data: updatedProgress,
        timestamp: Date.now(),
        userId,
      };
      // Note: Don't invalidate dashboard stats here - PDF URL change doesn't affect stats
      // this.invalidateDashboardStats(); // Removed to prevent unnecessary cache invalidation

      // Clear PDF URL throttle cache since the URL has changed
      this.pdfUrlCache = null;
      this.pdfUrlLastFetch = 0;

      // Notify React hooks about the change
      this.notifyCacheChange();
    }
  }

  // Get currently selected PDF URL
  async getSelectedPdfUrl(): Promise<string | null> {
    const userId = await this.ensureUserContext();
    if (!userId) {
      return null;
    }

    // Throttle rapid successive calls
    const now = Date.now();
    if (
      this.pdfUrlCache !== null &&
      now - this.pdfUrlLastFetch < this.PDF_URL_FETCH_THROTTLE
    ) {
      console.log(`🚀 [GET PDF URL] Using throttled cache`);
      return this.pdfUrlCache;
    }

    // Check if we have cached campaign progress first, otherwise fetch
    let campaignProgress = null;
    const cachedEntry = this.cache.campaignProgress;
    if (
      cachedEntry &&
      this.isValidCache(cachedEntry) &&
      cachedEntry.userId === userId
    ) {
      campaignProgress = cachedEntry.data;
      console.log(`🟢 [GET PDF URL] Using cached campaignProgress`);
    } else {
      console.log(`🔄 [GET PDF URL] Fetching fresh campaignProgress`);
      campaignProgress = await this.getCampaignProgress();
    }

    const pdfUrl = campaignProgress?.pdf_url || null;
    // Return null for empty string or default URLs
    const finalUrl = pdfUrl && pdfUrl.trim() ? pdfUrl : null;

    // Update throttle cache
    this.pdfUrlCache = finalUrl;
    this.pdfUrlLastFetch = now;

    return finalUrl;
  }

  // Get currently selected PDF URL from cache only (no database fetch)
  getCachedSelectedPdfUrl(): string | null {
    const cachedEntry = this.cache.campaignProgress;
    if (cachedEntry && this.isValidCache(cachedEntry)) {
      const pdfUrl = cachedEntry.data?.pdf_url || null;
      // Return null for empty string or default URLs
      return pdfUrl && pdfUrl.trim() ? pdfUrl : null;
    }
    return null;
  }

  // Helper function to sanitize filename for Supabase Storage
  private sanitizeFileName(filename: string): string {
    // Remove file extension temporarily
    const lastDotIndex = filename.lastIndexOf(".");
    const nameWithoutExt =
      lastDotIndex > 0 ? filename.substring(0, lastDotIndex) : filename;
    const extension = lastDotIndex > 0 ? filename.substring(lastDotIndex) : "";

    // Remove or replace invalid characters
    // Supabase Storage allows: letters, numbers, hyphens, underscores, periods, and forward slashes
    const sanitized = nameWithoutExt
      .replace(/[^\w\s\-_.]/g, "") // Remove emojis and special characters, keep spaces
      .replace(/\s+/g, "_") // Replace spaces with underscores
      .replace(/_{2,}/g, "_") // Replace multiple underscores with single
      .replace(/^_+|_+$/g, "") // Remove leading/trailing underscores
      .trim();

    // Ensure we have a valid filename
    const finalName = sanitized || "untitled";

    return `${finalName}${extension}`;
  }

  // PDF Proposals management methods
  async uploadPdfProposal(
    file: File
  ): Promise<{ path: string; actualFileName: string }> {
    // Ensure user context is available (this will handle authentication)
    const userId = await this.ensureUserContext();
    if (!userId) {
      throw new Error("User not authenticated");
    }

    const bucketName = process.env.NEXT_PUBLIC_SUPABASE_BUCKET_NAME;
    if (!bucketName) {
      throw new Error(
        "NEXT_PUBLIC_SUPABASE_BUCKET_NAME environment variable is not set"
      );
    }

    // Sanitize the filename to remove emojis and invalid characters
    const fileName = this.sanitizeFileName(file.name);

    // First check if file already exists
    const { data: existingFiles, error: listError } =
      await this.storageClient.storage.from(bucketName).list("", {
        limit: 1000,
        offset: 0,
      });

    if (listError) {
      throw new Error(`Failed to check existing files: ${listError.message}`);
    }

    // Check if a file with the same name already exists
    const fileExists = existingFiles?.some((file) => file.name === fileName);
    if (fileExists) {
      throw new Error(
        `A file named "${fileName}" already exists. Please delete the existing file first or choose a different name.`
      );
    }

    const { data, error } = await this.storageClient.storage
      .from(bucketName)
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      throw new Error(`Failed to upload PDF: ${error.message}`);
    }

    // Get the actual file name from the upload response
    const actualFileName = data.path;

    // Add to cache instead of invalidating for better performance
    console.log(`➕ [CACHE ADD] Adding PDF to cache: ${actualFileName}`);
    this.addPdfProposalToCache(actualFileName, file.size);

    return { path: data.path, actualFileName };
  }

  async deletePdfProposal(fileName: string): Promise<void> {
    // Ensure user context is available (this will handle authentication)
    const userId = await this.ensureUserContext();
    if (!userId) {
      throw new Error("User not authenticated");
    }

    const bucketName = process.env.NEXT_PUBLIC_SUPABASE_BUCKET_NAME;
    if (!bucketName) {
      throw new Error(
        "NEXT_PUBLIC_SUPABASE_BUCKET_NAME environment variable is not set"
      );
    }

    // First check if the file exists
    const { data: fileList, error: listError } =
      await this.storageClient.storage.from(bucketName).list("", {
        limit: 1000,
        offset: 0,
      });

    if (listError) {
      throw new Error(`Failed to list files: ${listError.message}`);
    }

    // Find the exact file name (handles cases where Supabase renamed the file)
    const actualFile = fileList?.find(
      (file) =>
        file.name === fileName ||
        (file.name.startsWith(fileName.replace(".pdf", "")) &&
          file.name.endsWith(".pdf"))
    );

    if (!actualFile) {
      throw new Error(`File not found: ${fileName}`);
    }

    const actualFileName = actualFile.name;

    const { error } = await this.storageClient.storage
      .from(bucketName)
      .remove([actualFileName]);

    if (error) {
      throw new Error(`Failed to delete PDF: ${error.message}`);
    }

    // Remove from cache instead of invalidating for better performance
    console.log(`🗑️ [CACHE REMOVE] Removing PDF from cache: ${actualFileName}`);
    this.removePdfProposalFromCache(actualFileName);
  }

  // View PDF method - returns the public URL for viewing
  async viewPdfProposal(fileName: string): Promise<string> {
    const bucketBaseUrl = this.getBucketUrl();
    const publicUrl = `${bucketBaseUrl}/${encodeURIComponent(fileName)}`;
    return publicUrl;
  }

  // Auth initialization for hooks
  async initializeAuth(): Promise<void> {
    if (this.isAuthInitialized) {
      return;
    }

    if (this.authInitPromise) {
      return this.authInitPromise;
    }

    this.authInitPromise = this.doAuthInitialization();
    return this.authInitPromise;
  }

  private async doAuthInitialization(): Promise<void> {
    try {
      // Get current user ID and details
      const userId = await this.getCurrentUserId();

      if (userId) {
        // Get full user details
        const {
          data: { user },
          error,
        } = await this.supabase.auth.getUser();
        if (!error && user) {
          this.currentUser = user;

          // Check root user status
          await this.updateRootUserStatus();
        }
      }

      this.isAuthInitialized = true;
    } catch (error) {
      console.error("❌ [CACHE AUTH] Auth initialization error:", error);
      this.isAuthInitialized = true; // Mark as initialized even on error
    }
  }

  private async updateRootUserStatus(): Promise<void> {
    const now = Date.now();

    // Check if root user status is still valid
    if (
      now - this.rootUserCacheTimestamp < this.ROOT_USER_CACHE_DURATION &&
      this.isRootUser !== undefined
    ) {
      return;
    }

    try {
      const response = await fetch("/api/check-root-user");
      const data = await response.json();
      this.isRootUser = data.isRootUser;
      this.rootUserCacheTimestamp = now;
    } catch (error) {
      console.error("Failed to check root user status:", error);
      this.isRootUser = false;
    }
  }

  // Check if auth is initialized
  getAuthInitialized(): boolean {
    return this.isAuthInitialized;
  }

  // Get current user state (returns true if user exists)
  async hasUser(): Promise<boolean> {
    const userId = await this.getCurrentUserId();
    return userId !== null;
  }

  // Get current user object
  getCurrentUser(): any {
    return this.currentUser;
  }
  // Get root user status
  async getIsRootUser(): Promise<boolean> {
    // First ensure we have a current user
    const userId = await this.getCurrentUserId();
    console.log("[getIsRootUser] userId:", userId);
    if (!userId) {
      return false;
    }

    const now = Date.now();
    if (now - this.rootUserCacheTimestamp < this.ROOT_USER_CACHE_DURATION) {
      return this.isRootUser;
    }

    await this.updateRootUserStatus();
    console.log("[getIsRootUser] isRootUser:", this.isRootUser.valueOf());
    return this.isRootUser;
  }

  // Update cache directly instead of invalidating (more efficient)
  updateEmailTemplateInCache(updatedTemplate: EmailTemplate): void {
    try {
      const entry = this.cache.emailTemplates;
      if (entry && !this.isExpired(entry) && this.isSameUser(entry)) {
        console.log(
          `🔄 [CACHE UPDATE] Email template updated: ${updatedTemplate.id}`
        );
        const updatedData = entry.data.map((template) =>
          template.id === updatedTemplate.id ? updatedTemplate : template
        );
        this.cache.emailTemplates = {
          ...entry,
          data: updatedData,
          timestamp: Date.now(),
        };
      }
    } catch (error) {
      console.error("Error updating email template in cache:", error);
    }
  }

  addEmailTemplateToCache(newTemplate: EmailTemplate): void {
    try {
      const entry = this.cache.emailTemplates;
      if (entry && !this.isExpired(entry) && this.isSameUser(entry)) {
        console.log(`➕ [CACHE ADD] Email template added: ${newTemplate.id}`);
        const updatedData = [newTemplate, ...entry.data];
        this.cache.emailTemplates = {
          ...entry,
          data: updatedData,
          timestamp: Date.now(),
        };
      }
    } catch (error) {
      console.error("Error adding email template to cache:", error);
    }
  }

  removeEmailTemplateFromCache(templateId: number): void {
    try {
      const entry = this.cache.emailTemplates;
      if (entry && !this.isExpired(entry) && this.isSameUser(entry)) {
        console.log(`🗑️ [CACHE REMOVE] Email template removed: ${templateId}`);
        const updatedData = entry.data.filter(
          (template) => template.id !== templateId
        );
        this.cache.emailTemplates = {
          ...entry,
          data: updatedData,
          timestamp: Date.now(),
        };
      }
    } catch (error) {
      console.error("Error removing email template from cache:", error);
    }
  }

  // Private invalidate methods used only internally by refresh methods
  private invalidateProperties(): void {
    this.cache.properties = null;
  }

  private invalidateEmailTemplates(): void {
    this.cache.emailTemplates = null;
  }

  private invalidateEmailLogs(): void {
    this.cache.emailLogs = null;
  }

  private invalidateCampaignProgress(): void {
    this.cache.campaignProgress = null;
  }

  public invalidateDashboardStats(): void {
    this.cache.dashboardStats = null;
  }

  private invalidatePdfProposals(): void {
    this.cache.pdfProposals = null;
  }

  // Clear all cache (e.g., on logout)
  clearAll(): void {
    this.cache = {
      properties: null,
      emailTemplates: null,
      emailLogs: null,
      campaignProgress: null,
      dashboardStats: null,
      pdfProposals: null,
    };
    // Reset auth state - clear user ID throttle cache
    this.isAuthInitialized = false;
    this.authInitPromise = null;
    this.currentUser = null;
    this.currentUserIdCache = null;
    this.userIdLastFetch = 0;
    this.isRootUser = false;
    this.rootUserCacheTimestamp = 0;
    // Reset PDF URL throttle cache
    this.pdfUrlCache = null;
    this.pdfUrlLastFetch = 0;
    this.notifyCacheChange();
  }

  // Force refresh data (publicly accessible)
  async refreshProperties(): Promise<Property[]> {
    this.invalidateProperties();
    return await this.getProperties();
  }

  async refreshEmailTemplates(): Promise<EmailTemplate[]> {
    this.invalidateEmailTemplates();
    return await this.getEmailTemplates();
  }

  async refreshEmailLogs(): Promise<EmailLog[]> {
    this.invalidateEmailLogs();
    return await this.getEmailLogs();
  }

  async refreshCampaignProgress(): Promise<CampaignProgress | null> {
    this.invalidateCampaignProgress();
    return await this.getCampaignProgress();
  }

  async refreshDashboardStats(): Promise<DashboardStats> {
    this.invalidateDashboardStats();
    return await this.getDashboardStats();
  }

  async refreshPdfProposals(): Promise<PDFProposal[]> {
    // Invalidate cache completely
    this.invalidatePdfProposals();
    // Force fresh fetch from storage and update cache
    const result = await this.getPdfProposals();
    // Notify React hooks about cache change
    this.notifyCacheChange();
    return result;
  }

  // Cache validation methods (used by hooks)
  hasValidPropertiesCache(): boolean {
    return this.isValidCache(this.cache.properties);
  }

  hasValidEmailTemplatesCache(): boolean {
    return this.isValidCache(this.cache.emailTemplates);
  }

  hasValidEmailLogsCache(): boolean {
    return this.isValidCache(this.cache.emailLogs);
  }

  hasValidCampaignProgressCache(): boolean {
    return this.isValidCache(this.cache.campaignProgress);
  }

  hasValidDashboardStatsCache(): boolean {
    return this.isValidCache(this.cache.dashboardStats);
  }

  hasValidPdfProposalsCache(): boolean {
    return this.isValidCache(this.cache.pdfProposals);
  }

  // Safe clear method that doesn't throw errors
  clearAllSafe(): void {
    try {
      this.clearAll();
    } catch (error) {
      // Silently handle clear errors during sign out
      this.cache = {
        properties: null,
        emailTemplates: null,
        emailLogs: null,
        campaignProgress: null,
        dashboardStats: null,
        pdfProposals: null,
      };
      // Reset auth state safely - clear user ID throttle cache
      this.isAuthInitialized = false;
      this.authInitPromise = null;
      this.currentUser = null;
      this.currentUserIdCache = null;
      this.userIdLastFetch = 0;
      this.isRootUser = false;
      this.rootUserCacheTimestamp = 0;
    }
  }

  // PDF Cache management methods for better performance
  addPdfProposalToCache(fileName: string, fileSize: number): void {
    try {
      const entry = this.cache.pdfProposals;
      if (entry && !this.isExpired(entry) && this.isSameUser(entry)) {
        console.log(
          `🔄 [PDF CACHE ADD] Valid cache found, adding PDF proposal`
        );

        const bucketBaseUrl = this.getBucketUrl();

        const newProposal: PDFProposal = {
          name: fileName,
          size: fileSize,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_accessed_at: new Date().toISOString(),
          publicUrl: `${bucketBaseUrl}/${encodeURIComponent(fileName)}`,
          metadata: {
            eTag: "",
            mimetype: "application/pdf",
            cacheControl: "3600",
            lastModified: new Date().toISOString(),
            contentLength: fileSize,
            httpStatusCode: 200,
          },
        };

        const updatedData = [newProposal, ...entry.data];
        this.cache.pdfProposals = {
          ...entry,
          data: updatedData,
          timestamp: Date.now(),
        };

        // Notify React hooks about cache change
        this.notifyCacheChange();
      }
    } catch (error) {
      console.error("Error adding PDF proposal to cache:", error);
    }
  }

  removePdfProposalFromCache(fileName: string): void {
    try {
      const entry = this.cache.pdfProposals;
      if (entry && !this.isExpired(entry) && this.isSameUser(entry)) {
        const updatedData = entry.data.filter(
          (proposal) => proposal.name !== fileName
        );

        this.cache.pdfProposals = {
          ...entry,
          data: updatedData,
          timestamp: Date.now(),
        };

        // Notify React hooks about cache change
        this.notifyCacheChange();
      }
    } catch (error) {
      console.error("Error removing PDF proposal from cache:", error);
    }
  }

  // Debug method to check cache status
  debugCacheStatus(): void {
    const now = Date.now();
    console.log("🔍 [CACHE DEBUG] Current cache status:");

    Object.entries(this.cache).forEach(([key, entry]) => {
      if (entry) {
        const age = now - entry.timestamp;
        const ageMinutes = Math.round(age / 60000);
        const expired = age > this.CACHE_DURATION;
        console.log(
          `  ${key}: ${
            expired ? "⏰ EXPIRED" : "🟢 VALID"
          } (${ageMinutes}min old)`
        );
      } else {
        console.log(`  ${key}: ❌ NULL`);
      }
    });
  }
}

export const dataCache = new DataCache();

// Expose debug methods globally for development
if (typeof window !== "undefined") {
  (window as any).debugCache = () => dataCache.debugCacheStatus();
}
