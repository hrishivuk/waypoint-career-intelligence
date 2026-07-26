import { FixedPrototypeIdentityProvider } from "@/infrastructure/auth/fixed-prototype-identity";
import { analyzeJobDescription } from "@/infrastructure/job-analysis/analyze-job-description";

export async function POST(request: Request) {
  try {
    const actor = await new FixedPrototypeIdentityProvider().getActor();
    const body = (await request.json()) as {
      description?: unknown;
      force?: unknown;
      reparse?: unknown;
    };
    if (typeof body.description !== "string") {
      return Response.json(
        { error: { message: "A job description is required." } },
        { status: 400 },
      );
    }
    return Response.json(
      await analyzeJobDescription(actor.userId, body.description, {
        force: body.force === true,
        reparse: body.reparse === true,
      }),
    );
  } catch (error) {
    console.error("Job analysis failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return Response.json(
      {
        error: {
          message:
            error instanceof Error
              ? error.message
              : "The job could not be analysed.",
        },
      },
      { status: 500 },
    );
  }
}
