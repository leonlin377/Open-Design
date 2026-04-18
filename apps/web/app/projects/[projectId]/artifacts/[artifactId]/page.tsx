import { redirect } from "next/navigation";

type ArtifactRouteProps = {
  params: Promise<{
    projectId: string;
    artifactId: string;
  }>;
};

export default async function ArtifactRoutePage({ params }: ArtifactRouteProps) {
  const { projectId, artifactId } = await params;

  redirect(`/studio/${projectId}/${artifactId}`);
}
