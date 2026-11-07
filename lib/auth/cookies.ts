import { cookies } from "next/headers"
import { AUTH_COOKIE_NAME, AUTH_MAX_AGE_SECONDS } from "@/lib/auth/jwt"

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true as const,
    // Solo HTTPS en producción; en dev local (http) la cookie debe viajar igual.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  }
}

export async function setAuthCookie(token: string): Promise<void> {
  const store = await cookies()
  store.set(AUTH_COOKIE_NAME, token, cookieOptions(AUTH_MAX_AGE_SECONDS))
}

export async function clearAuthCookie(): Promise<void> {
  const store = await cookies()
  store.set(AUTH_COOKIE_NAME, "", cookieOptions(0))
}

export async function getAuthToken(): Promise<string | undefined> {
  const store = await cookies()
  return store.get(AUTH_COOKIE_NAME)?.value
}
