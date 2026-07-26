import { getConfiguredServices } from "@/config/env";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    status: "ok",
    services: getConfiguredServices(),
    timestamp: new Date().toISOString(),
  });
}
