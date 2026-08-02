import {
  AuthenticationRequiredError,
  requireAuthenticatedContext,
} from "@/infrastructure/auth/supabase-identity";
import { buildAccountExport } from "@/infrastructure/account/account-lifecycle";

export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "no-store, private",
  "Content-Disposition": `attachment; filename="waypoint-account-export.json"`,
  "X-Content-Type-Options": "nosniff",
};

export async function GET() {
  try {
    const { actor, client } = await requireAuthenticatedContext();
    const exported = await buildAccountExport(client, actor);
    return Response.json(exported, { headers });
  } catch (error) {
    return error instanceof AuthenticationRequiredError
      ? Response.json({ error: "Authentication required." }, { status: 401, headers })
      : Response.json({ error: "Unable to export your account data." }, { status: 500, headers });
  }
}

