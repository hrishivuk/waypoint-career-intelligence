import {
  handleReviewApiError,
  createReviewServices,
} from "./_shared";
import { requireAuthenticatedContext } from "@/infrastructure/auth/supabase-identity";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { actor, client } = await requireAuthenticatedContext();
    const { listActiveReview } = createReviewServices(client);
    return Response.json(await listActiveReview.execute(actor.userId));
  } catch (error) {
    return handleReviewApiError(error);
  }
}
