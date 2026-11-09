import { SignJWT, jwtVerify, type JWTPayload } from "jose"

// Cookie de sesión: nunca accesible desde JS cliente (httpOnly se
// configura al escribirla en lib/auth/cookies.ts).
export const AUTH_COOKIE_NAME = "eggseller_token"

// Duración de la sesión acordada: 12h. Se puede sobreescribir con
// JWT_EXPIRES_IN (formato jose: "12h", "30m", "7d" o segundos).
export const AUTH_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "12h"

// maxAge de la cookie en segundos (siempre 12h = 43200).
export const AUTH_MAX_AGE_SECONDS = 12 * 60 * 60

export interface AuthTokenPayload extends JWTPayload {
  username: string
  role: string
}

function getSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    throw new Error(
      "Falta variable de entorno JWT_SECRET (mínimo 32 caracteres)"
    )
  }
  return new TextEncoder().encode(secret)
}

export async function signAuthToken(
  username: string,
  role: string
): Promise<string> {
  return new SignJWT({ username, role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(AUTH_EXPIRES_IN)
    .sign(getSecretKey())
}

// Retorna null si el token falta, expiró o es inválido. Nunca lanza.
export async function verifyAuthToken(
  token: string | undefined | null
): Promise<AuthTokenPayload | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify<AuthTokenPayload>(
      token,
      getSecretKey(),
      { algorithms: ["HS256"] }
    )
    if (typeof payload.username !== "string" || !payload.username) return null
    if (typeof payload.role !== "string" || !payload.role) return null
    return payload
  } catch {
    return null
  }
}
