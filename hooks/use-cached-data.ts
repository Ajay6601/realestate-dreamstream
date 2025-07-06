"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { dataCache } from "@/lib/cache";
import type {
  Property,
  EmailTemplate,
  EmailLog,
  CampaignProgress,
  DashboardStats,
  PDFProposal,
} from "@/lib/types";

interface UseCachedDataOptions {
  autoFetch?: boolean;
  refreshOnMount?: boolean;
}

interface CacheMethodConfig<T> {
  cacheMethod: () => Promise<T>;
  refreshMethod: () => Promise<T>;
  hasValidCacheMethod: () => boolean;
  emptyValue: T;
  errorMessagePrefix: string;
}

// Generic hook to reduce code duplication
function useGenericCachedData<T>(
  config: CacheMethodConfig<T>,
  options: UseCachedDataOptions = {}
) {
  const { autoFetch = true, refreshOnMount = false } = options;
  const {
    cacheMethod,
    refreshMethod,
    hasValidCacheMethod,
    emptyValue,
    errorMessagePrefix,
  } = config;

  const [data, setData] = useState<T>(emptyValue);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialLoad, setInitialLoad] = useState(true);
  const [isAuthInitialized, setIsAuthInitialized] = useState(false);
  const fetchingRef = useRef(false);
  const mountedRef = useRef(true);

  // Debug: Track hook initialization
  useEffect(() => {
    console.log(`🔵 [HOOK MOUNT] ${errorMessagePrefix} hook mounted`);
    return () => {
      console.log(`🔴 [HOOK UNMOUNT] ${errorMessagePrefix} hook unmounted`);
    };
  }, [errorMessagePrefix]);

  // Initialize auth through cache
  useEffect(() => {
    const initAuth = async () => {
      await dataCache.initializeAuth();
      setIsAuthInitialized(true);
    };
    initAuth();
  }, []);

  const fetchData = useCallback(
    async (forceRefresh = false) => {
      // Don't fetch if not authenticated or still initializing
      if (!isAuthInitialized) {
        console.log(
          `🟡 [HOOK] ${errorMessagePrefix} waiting for auth initialization`
        );
        return;
      }

      if (fetchingRef.current) {
        return;
      }

      try {
        fetchingRef.current = true;
        setError(null);

        const hasValidCache = hasValidCacheMethod();

        // Show loading for:
        // 1. Initial load (always show loading on first visit)
        // 2. Force refresh (user clicked refresh)
        // 3. No valid cache and no data
        const shouldShowLoading =
          initialLoad ||
          forceRefresh ||
          (!hasValidCache &&
            JSON.stringify(data) === JSON.stringify(emptyValue));

        if (shouldShowLoading) {
          setLoading(true);
        }

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Request timeout")), 15000)
        );

        const dataPromise = forceRefresh ? refreshMethod() : cacheMethod();
        const result = await Promise.race([dataPromise, timeoutPromise]);

        if (mountedRef.current) {
          setData(result as T);
          setInitialLoad(false);
        }
      } catch (err) {
        if (!mountedRef.current) return;

        const errorMessage =
          err instanceof Error
            ? err.message
            : `Failed to load ${errorMessagePrefix}`;

        // Don't show errors for auth-related issues during sign out
        if (
          errorMessage.includes("Auth session missing") ||
          errorMessage.includes("session not found") ||
          errorMessage.includes("No session")
        ) {
          setData(emptyValue);
          setError(null);
        } else {
          setError(errorMessage);
          if (JSON.stringify(data) === JSON.stringify(emptyValue)) {
            setData(emptyValue);
          }
        }
        setInitialLoad(false);
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
        fetchingRef.current = false;
      }
    },
    [
      isAuthInitialized,
      autoFetch,
      cacheMethod,
      refreshMethod,
      hasValidCacheMethod,
      emptyValue,
      errorMessagePrefix,
    ]
  );

  const refresh = useCallback(async () => {
    return fetchData(true);
  }, [fetchData]);

  useEffect(() => {
    mountedRef.current = true;

    // Only fetch if auth is initialized and we have auto-fetch enabled
    if (autoFetch && isAuthInitialized) {
      fetchData(refreshOnMount);
    }

    return () => {
      mountedRef.current = false;
    };
  }, [autoFetch, refreshOnMount, isAuthInitialized, fetchData]);

  return {
    data,
    loading,
    error,
    initialLoad,
    refetch: fetchData,
    refresh,
    hasData: JSON.stringify(data) !== JSON.stringify(emptyValue),
  };
}

export function useCachedProperties(options: UseCachedDataOptions = {}) {
  const config = useMemo(
    () => ({
      cacheMethod: () => dataCache.getProperties(),
      refreshMethod: () => dataCache.refreshProperties(),
      hasValidCacheMethod: () => dataCache.hasValidPropertiesCache(),
      emptyValue: [],
      errorMessagePrefix: "properties",
    }),
    []
  );

  return useGenericCachedData<Property[]>(config, options);
}

export function useCachedEmailTemplates(options: UseCachedDataOptions = {}) {
  const config = useMemo(
    () => ({
      cacheMethod: () => dataCache.getEmailTemplates(),
      refreshMethod: () => dataCache.refreshEmailTemplates(),
      hasValidCacheMethod: () => dataCache.hasValidEmailTemplatesCache(),
      emptyValue: [],
      errorMessagePrefix: "email templates",
    }),
    []
  );

  return useGenericCachedData<EmailTemplate[]>(config, options);
}

export function useCachedEmailLogs(options: UseCachedDataOptions = {}) {
  const config = useMemo(
    () => ({
      cacheMethod: () => dataCache.getEmailLogs(),
      refreshMethod: () => dataCache.refreshEmailLogs(),
      hasValidCacheMethod: () => dataCache.hasValidEmailLogsCache(),
      emptyValue: [],
      errorMessagePrefix: "email logs",
    }),
    []
  );

  return useGenericCachedData<EmailLog[]>(config, options);
}

export function useCachedCampaignProgress(options: UseCachedDataOptions = {}) {
  const config = useMemo(
    () => ({
      cacheMethod: () => dataCache.getCampaignProgress(),
      refreshMethod: () => dataCache.refreshCampaignProgress(),
      hasValidCacheMethod: () => dataCache.hasValidCampaignProgressCache(),
      emptyValue: null,
      errorMessagePrefix: "campaign progress",
    }),
    []
  );

  return useGenericCachedData<CampaignProgress | null>(config, options);
}

export function useCachedDashboardStats(options: UseCachedDataOptions = {}) {
  const emptyStats = useMemo(
    () => ({
      totalProperties: 0,
      totalEmailsSent: 0,
      totalReplies: 0,
      replyRate: 0,
      currentWeek: 1,
      activeTemplates: 0,
    }),
    []
  );

  const config = useMemo(
    () => ({
      cacheMethod: () => dataCache.getDashboardStats(),
      refreshMethod: () => dataCache.refreshDashboardStats(),
      hasValidCacheMethod: () => dataCache.hasValidDashboardStatsCache(),
      emptyValue: emptyStats,
      errorMessagePrefix: "dashboard stats",
    }),
    [emptyStats]
  );

  return useGenericCachedData<DashboardStats>(config, options);
}

// Hook for PDF proposals
export function useCachedPdfProposals(options: UseCachedDataOptions = {}) {
  const config = useMemo<CacheMethodConfig<PDFProposal[]>>(
    () => ({
      cacheMethod: () => dataCache.getPdfProposals(),
      refreshMethod: () => dataCache.refreshPdfProposals(),
      hasValidCacheMethod: () => dataCache.hasValidPdfProposalsCache(),
      emptyValue: [],
      errorMessagePrefix: "PDF proposals",
    }),
    []
  );

  return useGenericCachedData<PDFProposal[]>(config, options);
}
