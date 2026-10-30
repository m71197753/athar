import { useGetSectionMediaProgress } from "@workspace/api-client-react";
import { TrackedSectionMedia } from "../sections/TrackedSectionMedia";

export function AcademyVideoPlayer({ scope, id, url, title }: {
  scope: string; id: string; url: string; title: string;
}) {
  const progress = useGetSectionMediaProgress(scope);
  return <div className="ac-video-player">
    <TrackedSectionMedia
      sectionSlug={scope}
      contextKey="section"
      mediaAssetId={id}
      mediaType="video"
      url={url}
      title={title}
      progressReady={progress.isSuccess}
      progressError={progress.isError}
      onRetryProgress={() => void progress.refetch()}
      savedProgress={progress.data?.find(row => row.mediaAssetId === id && row.contextKey === "section")}
    />
  </div>;
}
