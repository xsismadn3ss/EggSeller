export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { clearAuthCookie } from "@/lib/auth/cookies"

export async function POST() {
  await clearAuthCookie()
  return Response.json({ ok: true })
}
