export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { connectMongo } from "@/lib/mongo"
import { User } from "@/lib/auth/user"
import { comparePassword } from "@/lib/auth/password"
import { setAuthCookie } from "@/lib/auth/cookies"
import { signAuthToken } from "@/lib/auth/jwt"

// Límite simple en memoria: 10 intentos fallidos por IP cada 10 minutos.
const WINDOW_MS = 10 * 60 * 1000
const MAX_ATTEMPTS = 10
const attempts = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(key: string): boolean {
  const now = Date.now()
  const entry = attempts.get(key)
  if (!entry || entry.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }
  entry.count += 1
  return entry.count > MAX_ATTEMPTS
}

function getClientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  return forwarded?.split(",")[0]?.trim() || "local"
}

export async function POST(request: Request) {
  let body: { username?: unknown; password?: unknown }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 })
  }
  if (
    typeof body.username !== "string" ||
    !body.username.trim() ||
    typeof body.password !== "string" ||
    !body.password
  ) {
    return Response.json(
      { error: "Faltan 'username' y 'password'" },
      { status: 400 }
    )
  }

  if (isRateLimited(getClientKey(request))) {
    return Response.json(
      { error: "Demasiados intentos, prueba más tarde" },
      { status: 429 }
    )
  }

  try {
    await connectMongo()
    const user = await User.findOne({ username: body.username.trim() }).lean()
    // Mensaje genérico: no revela si el usuario existe o no.
    if (!user) {
      return Response.json({ error: "Credenciales inválidas" }, { status: 401 })
    }
    const ok = await comparePassword(body.password, user.passwordHash)
    if (!ok) {
      return Response.json({ error: "Credenciales inválidas" }, { status: 401 })
    }
    const token = await signAuthToken(user.username, user.role)
    await setAuthCookie(token)
    return Response.json({ username: user.username, role: user.role })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error interno"
    const status = message.includes("Falta variable de entorno") ? 503 : 500
    return Response.json({ error: message }, { status })
  }
}
