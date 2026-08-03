import { CareerProfileNav } from "@/components/profile/career-profile-nav";
import { PageContainer, PageHeader } from "@/components/ui";

export default function CareerProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Career Profile"
        title="Your career evidence"
        description="Build one reviewed source of career knowledge, then control what Waypoint may use in job decisions and applications."
      />
      <CareerProfileNav />
      {children}
    </PageContainer>
  );
}
