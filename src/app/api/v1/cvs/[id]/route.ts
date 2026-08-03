import {
  AccountProvisioningRequiredError,
  AuthenticationRequiredError,
  requireAuthenticatedContext,
} from "@/infrastructure/auth/supabase-identity";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const { actor: { userId }, client: supabase } =
      await requireAuthenticatedContext();
    const { data, error } = await supabase
      .from("cv_documents_v2")
      .select("storage_bucket, storage_path")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return Response.json({ error: "CV not found." }, { status: 404 });

    const { error: storageError } = await supabase.storage
      .from(data.storage_bucket)
      .remove([data.storage_path]);
    if (storageError) throw storageError;
    const { error: deleteError } = await supabase
      .from("cv_documents_v2")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (deleteError) throw deleteError;
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return Response.json({ error: "Authentication required." }, { status: 401 });
    }
    if (error instanceof AccountProvisioningRequiredError) {
      return Response.json(
        { error: "Your Waypoint account is still being prepared." },
        { status: 503 },
      );
    }
    console.error("CV v2 delete failed", error);
    return Response.json({ error: "The CV could not be deleted." }, { status: 500 });
  }
}
