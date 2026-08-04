// import type { Metadata } from "next";

// import { PageContainer, PageHeader } from "@/components/ui";
// import { CvWorkspace } from "@/components/cv-v2/cv-workspace";

// export const metadata: Metadata = {
//   title: "CV workspace",
//   description: "Manage job-specific CV documents separately from career knowledge.",
// };

// export default function CvWorkspacePage() {
//   return (
//     <PageContainer>
//       <PageHeader
//         eyebrow="CV workspace"
//         title="Your role-specific CV library"
//         description="Store each CV as a separate application document. Waypoint reads only what each CV visibly contains, while your Master Profile remains the independent source of truth about you."
//       />
//       <CvWorkspace />
//     </PageContainer>
//   );
// }

import type { Metadata } from "next";

import { CvWorkspace } from "@/components/cv-v2/cv-workspace";
import { PageContainer, PageHeader } from "@/components/ui";
import { requireAuthenticatedContext } from "@/infrastructure/auth/supabase-identity";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "CVs",
  description:
    "Upload, review and manage role-specific CVs for job applications.",
};

export default async function CvsPage() {
  await requireAuthenticatedContext();

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Application documents"
        title="CV library"
        description="Keep role-specific CVs separate, review their parsed content and choose the right starting document for each application."
      />

      <CvWorkspace />
    </PageContainer>
  );
}
