import { NextResponse, type NextRequest } from "next/server"
import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/lib/auth/jwt"

const PROTECTED_PAGES = ["/upload", "/chat", "/sugerencias"]

function isProtectedPage(pathname: string): boolean {
  if (pathname === "/") return true
  return PROTECTED_PAGES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  )
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value
  const session = await verifyAuthToken(token)

  // APIs protegidas: todo /api/* salvo auth y health.
  if (pathname.startsWith("/api/")) {
    if (pathname.startsWith("/api/auth/") || pathname === "/api/health") {
      return NextResponse.next()
    }
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }
    return NextResponse.next()
  }

  // Páginas protegidas: redirige a /login conservando el destino.
  if (isProtectedPage(pathname) && !session) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("next", pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

// Solo intercepta páginas y APIs protegidas; deja fuera _next/static,
// imágenes, favicon y el resto de assets.
export const config = {
  matcher: [
    "/",
    "/upload/:path*",
    "/chat/:path*",
    "/sugerencias/:path*",
    "/api/:path*",
  ],
}
