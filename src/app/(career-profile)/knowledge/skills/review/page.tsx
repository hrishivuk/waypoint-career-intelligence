import { SkillReview } from "@/components/knowledge-library";
import { CareerProfileSectionHeader } from "@/components/profile/career-profile-section-header";

export default function SkillReviewPage() {
  return (
    <>
      <CareerProfileSectionHeader
        title="Skill assessment history"
        description="Review the skill and competency levels used to build the active Skill Model v2. You can update and reactivate the model when needed."
      />
      <SkillReview />
    </>
  );
}
