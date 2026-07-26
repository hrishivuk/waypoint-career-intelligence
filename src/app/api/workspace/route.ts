import { cookies } from "next/headers";
import { z } from "zod";

import { WORKSPACE_COOKIE } from "@/domain/workspace";

const requestSchema = z.object({
  mode: z.enum(["personal", "demo"]).nullable(),
}).strict();

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Unknown workspace mode." }, { status: 400 });
  }
  if (parsed.data.mode === "personal" && process.env.NODE_ENV === "production") {
    return Response.json(
      { error: "Personal sign-in is not available until authentication is configured." },
      { status: 403 },
    );
  }

  const store = await cookies();
  if (parsed.data.mode === null) {
    store.delete(WORKSPACE_COOKIE);
  } else {
    store.set(WORKSPACE_COOKIE, parsed.data.mode, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      priority: "high",
    });
  }
  return Response.json({ mode: parsed.data.mode });
}
