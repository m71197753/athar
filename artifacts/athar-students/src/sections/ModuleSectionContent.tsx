import { BookOpen, Download, ExternalLink, FileText } from "lucide-react";
import {
  getGetPlatformContentQueryKey, useGetPlatformContent,
} from "@workspace/api-client-react";
import type { ModuleKey, SectionBlock } from "@workspace/api-client-react";
import "./module-section-content.css";

export function ModuleSectionContent({ moduleKey }: { moduleKey: ModuleKey }) {
  const query = useGetPlatformContent({
    query: { queryKey: getGetPlatformContentQueryKey(), staleTime: 30_000 },
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
            {block.mediaType === "video" && <video src={block.url} controls preload="metadata"/>}
            {block.mediaType === "file" && <a className="module-managed-file" href={block.url} download><Download size={16}/> فتح الملف</a>}
          </article>
        : <article className="module-managed-text" key={`${index}-${block.title}`} data-testid={`module-managed-text-${moduleKey}-${index}`}>
            <span className="module-managed-text-icon"><FileText size={16}/></span>
            <div><h3>{block.title}</h3><p>{block.body}</p></div>
          </article>)}
    </div>
  </section>;
}
