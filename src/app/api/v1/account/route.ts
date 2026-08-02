import { z } from "zod";

import { deleteAccountData } from "@/infrastructure/account/account-lifecycle";
import {
  AuthenticationRequiredError,
  requireAuthenticatedContext,
} from "@/infrastructure/auth/supabase-identity";
import { getSupabaseServerClient } from "@/infrastructure/persistence/supabase-server";

export const dynamic = "force-dynamic";

const requestSchema = z.object({ confirmation: z.literal("DELETE MY ACCOUNT") }).strict();
const headers = { "Cache-Control": "no-store, private" };

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Cross-origin request rejected." }, { status: 403, headers });
  }
  try {
    const body = requestSchema.safeParse(await readJson(request));
    if (!body.success) {
      return Response.json(
        { error: 'Type "DELETE MY ACCOUNT" to confirm account deletion.' },
        { status: 400, headers },
      );
    }
    const { actor } = await requireAuthenticatedContext();
    await deleteAccountData(getSupabaseServerClient(), actor);
    return new Response(null, { status: 204, headers });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return Response.json({ error: "Authentication required." }, { status: 401, headers });
    }
    return Response.json(
      { error: "Unable to delete your account. Your request can be safely retried." },
      { status: 500, headers },
    );
  }
}

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
