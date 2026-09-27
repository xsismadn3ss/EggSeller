export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getSession } from "@/lib/neo4j";

export async function GET() {
  const session = getSession();
  try {
    await session.run("RETURN 1 AS ok");
    return Response.json({ status: "ok" });
  } catch (e) {
    return Response.json(
      { status: "error", error: e instanceof Error ? e.message : String(e) },
      { status: 503 },
    );
  } finally {
    await session.close();
  }
}
