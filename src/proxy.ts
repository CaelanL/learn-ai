import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { createServerClient } from "@supabase/ssr";

export async function proxy(request: NextRequest) {
  // First, refresh the session (updates cookies)
  const response = await updateSession(request);

  // Public routes that don't require auth
  // Landing page is public — auth happens after user enters a topic (the "hook")
  const publicPaths = ["/login", "/"];
  const isPublic =
    request.nextUrl.pathname === "/" ||
    publicPaths.some(
      (path) => path !== "/" && request.nextUrl.pathname.startsWith(path)
    );

  if (isPublic) return response;

  // Check if user is authenticated
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies
            .getAll()
            .map(({ name, value }) => ({ name, value }));
        },
        setAll() {
          // We already set cookies in updateSession above
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
