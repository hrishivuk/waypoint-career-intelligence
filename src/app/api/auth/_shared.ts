import { z } from "zod";

export const emailSchema = z.string().trim().email().max(320);
export const passwordSchema = z.string().min(8).max(200);

export function authError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export function genericAuthFailure() {
  return authError("We couldn't complete that request. Please try again.", 400);
}
