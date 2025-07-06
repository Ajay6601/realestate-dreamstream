import { createClient as createServerClient } from "@/lib/supabase/server";

/**
 * Server-side utilities for invite management.
 * These functions can only be used in server-side code (API routes, Server Components, etc.)
 * and should NOT be imported into client-side code.
 */

/**
 * Check if the current user is the root user (server-side)
 */
export async function isRootUser(userEmail?: string): Promise<boolean> {
  const rootUserEmail = process.env.ROOT_USER_EMAIL;
  if (!rootUserEmail) {
    console.warn("ROOT_USER_EMAIL environment variable is not set");
    return false;
  }

  if (userEmail) {
    return userEmail === rootUserEmail;
  }

  // If no email provided, get current user
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.email === rootUserEmail;
  } catch (error) {
    console.error("Error checking user authentication:", error);
    return false;
  }
}

/**
 * Require root user access or throw an error (server-side)
 */
export async function requireRootUser(): Promise<boolean> {
  const isRoot = await isRootUser();
  if (!isRoot) {
    throw new Error("Unauthorized: Root user access required");
  }
  return true;
}

/**
 * Generate a secure password with mixed character types
 */
export function generateSecurePassword(length: number = 12): string {
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let result = "";

  // Ensure at least one character from each category
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "0123456789";
  const special = "!@#$%^&*";

  result += lowercase[Math.floor(Math.random() * lowercase.length)];
  result += uppercase[Math.floor(Math.random() * uppercase.length)];
  result += numbers[Math.floor(Math.random() * numbers.length)];
  result += special[Math.floor(Math.random() * special.length)];

  // Fill the rest randomly
  for (let i = 4; i < length; i++) {
    result += charset[Math.floor(Math.random() * charset.length)];
  }

  // Shuffle the result
  return result
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}

/**
 * Check if a user is the root user by their user ID (server-side)
 */
export async function checkRootUserById(userId: string): Promise<boolean> {
  try {
    const supabase = await createServerClient();

    // Get the user by ID
    const { data: userData, error } = await supabase.auth.admin.getUserById(
      userId
    );

    if (error || !userData.user) {
      return false;
    }

    const rootUserEmail = process.env.ROOT_USER_EMAIL;
    return userData.user.email === rootUserEmail;
  } catch (error) {
    console.error("Error checking if user is root:", error);
    return false;
  }
}
