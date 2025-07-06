"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from "react";
import { dataCache } from "@/lib/cache";

interface AuthContextType {
  user: any;
  isRootUser: boolean;
  isLoading: boolean;
  isAuthInitialized: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [isRootUser, setIsRootUser] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthInitialized, setIsAuthInitialized] = useState(false);
  const mountedRef = useRef(true);
  const initializedRef = useRef(false);

  // Single auth initialization - only runs once globally
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    let unsubscribe: (() => void) | null = null;

    const initAuth = async () => {
      try {
        console.log("🟡 [AUTH CONTEXT] Starting auth initialization");

        // Initialize auth through cache
        await dataCache.initializeAuth();

        console.log("🟡 [AUTH CONTEXT] Auth cache initialized");

        // Get initial state
        const currentUser = dataCache.getCurrentUser();
        const authInitialized = dataCache.getAuthInitialized();

        console.log(
          "🟡 [AUTH CONTEXT] Got auth state - user:",
          !!currentUser,
          "initialized:",
          authInitialized
        );

        if (mountedRef.current) {
          setUser(currentUser);
          setIsAuthInitialized(authInitialized);

          console.log("check for root user");

          // Only check root user status if we have a user
          if (currentUser) {
            console.log(
              "🟡 [AUTH CONTEXT] User exists, checking root status..."
            );
            try {
              const rootUserStatus = await dataCache.getIsRootUser();
              console.log(
                "🟡 [AUTH CONTEXT] Root status result:",
                rootUserStatus
              );
              setIsRootUser(rootUserStatus);
            } catch (error) {
              console.error("❌ [AUTH CONTEXT] Root user check failed:", error);
              setIsRootUser(false);
            }
          } else {
            console.log(
              "🟡 [AUTH CONTEXT] No user, setting root status to false"
            );
            setIsRootUser(false);
          }

          // Set loading to false only after root user check is complete
          setIsLoading(false);
        }

        // Subscribe to cache changes
        unsubscribe = dataCache.addCacheChangeListener(async () => {
          if (mountedRef.current) {
            const updatedUser = dataCache.getCurrentUser();
            const updatedAuthStatus = dataCache.getAuthInitialized();

            setUser(updatedUser);
            setIsAuthInitialized(updatedAuthStatus);

            // Only check root user status if we have a user
            if (updatedUser) {
              try {
                const updatedRootStatus = await dataCache.getIsRootUser();
                setIsRootUser(updatedRootStatus);
              } catch (error) {
                console.error(
                  "❌ [AUTH CONTEXT] Root user check failed in listener:",
                  error
                );
                setIsRootUser(false);
              }
            } else {
              setIsRootUser(false);
            }
          }
        });

        console.log("✅ [AUTH CONTEXT] Auth initialization complete");
      } catch (error) {
        console.error("❌ [AUTH CONTEXT] Auth initialization error:", error);
        if (mountedRef.current) {
          setIsLoading(false);
          setIsAuthInitialized(true);
          setUser(null);
          setIsRootUser(false);
        }
      }
    };

    initAuth();

    return () => {
      console.log("🔴 [AUTH CONTEXT] Cleanup");
      mountedRef.current = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isRootUser, isLoading, isAuthInitialized }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
