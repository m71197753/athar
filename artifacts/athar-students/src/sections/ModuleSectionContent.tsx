import { BookOpen, ExternalLink, FileText } from "lucide-react";
import {
  getGetPlatformContentQueryKey, getGetSectionMediaProgressQueryKey,
  useGetPlatformContent, useGetSectionMediaProgress,
} from "@workspace/api-client-react";
import type { ModuleKey, SectionBlock } from "@workspace/api-client-react";
import { TrackedSectionMedia } from "./TrackedSectionMedia";
import "./module-section-content.css";

const sectionMediaId = (url: string) => /^\/api\/platform\/section-media\/([a-f0-9-]{36})$/i.exec(url)?.[1];

export function ModuleSectionContent({ moduleKey }: { moduleKey: ModuleKey }) {
  const query = useGetPlatformContent({
    query: { queryKey: getGetPlatformContentQueryKey(), staleTime: 30_000 },
  });
  const progressQuery = useGetSectionMediaProgress(moduleKey, {
    query: { queryKey: getGetSectionMediaProgressQueryKey(moduleKey), staleTime: 30_000 },
  });
  if (query.isLoading) return null;
  if (query.isError) return <div className="module-managed-error" role="alert">
    <span>تعذّر تحميل المحتوى الإضافي لهذا القسم.</span>
    <button type="button" onClick={() => query.refetch()} data-testid={`button-retry-module-content-${moduleKey}`}>إعادة المحاولة</button>
  </div>;

  const setting = query.data?.moduleSettings.find(item => item.key === moduleKey);
  const blocks: SectionBlock[] = setting?.blocks ?? [];
  if (!blocks.length) return null;

  return <section className="module-managed-content" aria-labelledby={`module-managed-title-${moduleKey}`} data-testid={`module-managed-content-${moduleKey}`} dir="rtl">
    <header className="module-managed-head">
      <span className="module-managed-icon"><BookOpen size={17}/></span>
      <div><span>إضافة من إدارة أثر</span><h2 id={`module-managed-title-${moduleKey}`}>محتوى القسم</h2></div>
    </header>
    <div className="module-managed-blocks">
      {blocks.map((block, index) => block.type === "link"
        ? <a className="module-managed-link" key={`${index}-${block.title}`} href={block.url} target="_blank" rel="noopener noreferrer" data-testid={`module-managed-link-${moduleKey}-${index}`}>
            <span className="module-managed-link-icon"><ExternalLink size={16}/></span>
            <span className="module-managed-copy"><b>{block.title}</b>{block.body && <span>{block.body}</span>}</span>
            <ExternalLink className="module-managed-open" size={15}/>
          </a>
        : block.type === "media" ? <article className="module-managed-media" key={`${index}-${block.title}`} data-testid={`module-managed-media-${moduleKey}-${index}`}>
            <h3>{block.title}</h3>{block.body && <p>{block.body}</p>}
            {block.mediaType === "image" && <img src={block.url} alt={block.title} loading="lazy"/>}
            {sectionMediaId(block.url) && (block.mediaType === "audio" || block.mediaType === "video" || block.mediaType === "file")
              ? <TrackedSectionMedia
                  sectionSlug={moduleKey}
                  contextKey="section"
                  mediaAssetId={sectionMediaId(block.url)!}
                  mediaType={block.mediaType}
                  url={block.url}
                  title={block.title}
                  savedProgress={progressQuery.data?.find(row => row.contextKey === "section" && row.mediaAssetId === sectionMediaId(block.url))}
                />
              : block.mediaType === "video" ? <video src={block.url} controls playsInline preload="metadata"/>
                : block.mediaType === "audio" ? <audio src={block.url} controls preload="metadata"/>
                  : block.mediaType === "file" ? <div className="tracked-section-document"><iframe src={`${block.url}?preview=1`} title={`معاينة ${block.title}`} loading="lazy"/><a href={block.url} download>تنزيل الملف</a></div>
                    : null}
          </article>
        : <article className="module-managed-text" key={`${index}-${block.title}`} data-testid={`module-managed-text-${moduleKey}-${index}`}>
            <span className="module-managed-text-icon"><FileText size={16}/></span>
            <div><h3>{block.title}</h3><p>{block.body}</p></div>
          </article>)}
    </div>
  </section>;
}
