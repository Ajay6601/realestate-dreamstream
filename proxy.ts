import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  try {
    // Refresh session if expired
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    const pathname = request.nextUrl.pathname;

    // Define protected routes
    const protectedRoutes = [
      "/dashboard",
      "/upload",
      "/email-templates",
      "/proposals",
    ];
    const authRoutes = ["/login", "/"];
    const inviteRoutes = ["/invite"]; // Only accessible to root user

    const isProtectedRoute = protectedRoutes.some((route) =>
      pathname.startsWith(route)
    );
    const isAuthRoute = authRoutes.includes(pathname);
    const isInviteRoute = inviteRoutes.some((route) =>
      pathname.startsWith(route)
    );

    // If there's an auth error or no user, and trying to access protected routes
    if ((error || !user) && (isProtectedRoute || isInviteRoute)) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    // Check if user is trying to access invite routes
    if (user && !error && isInviteRoute) {
      const rootUserEmail = process.env.ROOT_USER_EMAIL;
      if (!rootUserEmail || user.email !== rootUserEmail) {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
      }
    }

    // If user is authenticated and trying to access auth routes, redirect to dashboard
    if (user && !error && isAuthRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }

    // For all other cases, let the request continue
    return supabaseResponse;
  } catch (error) {
    // If there's an unexpected error, let the request continue
    // Client-side auth will handle the user state
    console.error("Proxy auth error:", error);
    return supabaseResponse;
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

