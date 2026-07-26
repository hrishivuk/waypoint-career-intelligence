import { SkillReview } from "@/components/knowledge-library";
import { PageContainer, PageHeader } from "@/components/ui";

export default function SkillReviewPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Data management"
        title="Skill assessment history"
        description="Review the skill and competency levels used to build the active Skill Model v2. You can update and reactivate the model when needed."
      />
      <SkillReview />
    </PageContainer>
  );
}
