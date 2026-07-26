import {
  handleReviewApiError,
  identityProvider,
  listActiveReview,
} from "./_shared";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const actor = await identityProvider.getActor();
    return Response.json(await listActiveReview.execute(actor.userId));
  } catch (error) {
    return handleReviewApiError(error);
  }
}
