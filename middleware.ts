import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/signup",
]);

const ROLE_HOME: Record<string, string> = {
  farmer: "/farmer",
  buyer: "/buyer",
  pds_operator: "/pds-operator",
  admin: "/admin",
};

const PROTECTED_PREFIXES: Record<string, string[]> = {
  "/farmer": ["farmer", "admin"],
  "/buyer": ["buyer", "admin"],
  "/pds-operator": ["pds_operator", "admin"],
  "/admin": ["admin"],
};

function isPublic(path: string) {
  if (PUBLIC_PATHS.has(path)) return true;
  if (path.startsWith("/login")) return true;
  if (path.startsWith("/signup")) return true;
  if (path.startsWith("/auth/callback")) return true;
  return false;
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // Public routes: allow everyone
  if (isPublic(path)) {
    // If logged in and visiting /login or /signup → send to their dashboard
    if (user && (path === "/login" || path.startsWith("/login/") || path === "/signup" || path.startsWith("/signup/"))) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      const role = profile?.role;
      if (role && ROLE_HOME[role]) {
        return NextResponse.redirect(new URL(ROLE_HOME[role], request.url));
      }
    }
    return supabaseResponse;
  }

  // Not logged in → send to role-appropriate login if path hints at role
  if (!user) {
    const target = Object.keys(PROTECTED_PREFIXES).find((prefix) =>
      path.startsWith(prefix)
    );
    const loginUrl = target
      ? `/login/${target.replace("/", "").replace("pds-operator", "pds-operator")}`
      : "/login";
    return NextResponse.redirect(new URL(loginUrl, request.url));
  }

  // Logged in — check role access for protected prefixes
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const userRole = profile?.role;

  if (!userRole) {
    // Profile missing — something broke during signup
    return NextResponse.redirect(new URL("/login", request.url));
  }

  for (const [prefix, allowed] of Object.entries(PROTECTED_PREFIXES)) {
    if (path.startsWith(prefix) && !allowed.includes(userRole)) {
      // Wrong role trying to access — send to their own dashboard
      return NextResponse.redirect(new URL(ROLE_HOME[userRole], request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};