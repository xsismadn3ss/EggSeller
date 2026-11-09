export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { getAuthToken } from "@/lib/auth/cookies"
import { verifyAuthToken } from "@/lib/auth/jwt"

export async function GET() {
  const payload = await verifyAuthToken(await getAuthToken())
  if (!payload) {
    return Response.json({ error: "No autorizado" }, { status: 401 })
  }
  return Response.json({ username: payload.username, role: payload.role })
}
