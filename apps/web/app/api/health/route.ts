import type { ServiceHealth } from "@support-flow/shared";

export const dynamic = "force-dynamic";

export function GET() {
  const response: ServiceHealth = {
    service: "web",
    status: "ok",
    timestamp: new Date().toISOString()
  };

  return Response.json(response);
}
