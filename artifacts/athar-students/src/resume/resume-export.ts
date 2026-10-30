import type { ResumeData } from "./resume-ats";
import type { StudentResumeContent, StudentResumeTemplate } from "@workspace/api-client-react";
import { DEFAULT_RESUME_APPEARANCE } from "./resume-appearance";
import { getResumeTextSegments } from "./resume-inline-formatting";
import type { Paragraph as ParagraphType } from "docx";

const ink = "203239";
const teal = "3B706B";

export async function downloadResumeDocx(data: ResumeData, template: "ats" | "professional") {
  const { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } = await import("docx");
  const heading = (text: string, professional: boolean) => new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    alignment: AlignmentType.RIGHT,
    bidirectional: true,
    thematicBreak: false,
    run: { color: professional ? teal : ink, bold: true, font: "Arial" },
    spacing: { before: 240, after: 100 },
  });
  const paragraph = (text: string, options?: { bold?: boolean; italic?: boolean; color?: string }) => new Paragraph({
    children: [new TextRun({
      text,
      font: "Arial",
      size: 22,
      bold: options?.bold,
      italics: options?.italic,
      color: options?.color ?? ink,
      rightToLeft: true,
    })],
    alignment: AlignmentType.RIGHT,
    bidirectional: true,
    spacing: { after: 90 },
  });

  const professional = template === "professional";
  const profile = data.profile;
  const children: ParagraphType[] = [
    new Paragraph({
      children: [new TextRun({
        text: profile?.fullName?.trim() || "السيرة الذاتية",
        bold: true,
        size: 36,
        font: "Arial",
        color: professional ? teal : ink,
        rightToLeft: true,
      })],
      alignment: AlignmentType.RIGHT,
      bidirectional: true,
      spacing: { after: 120 },
    }),
  ];

  const identity = [
    profile?.headline,
    [profile?.university, profile?.major, profile?.yearOfStudy ? `السنة ${profile.yearOfStudy}` : null]
      .filter(Boolean).join(" · "),
  ].filter((value): value is string => Boolean(value?.trim()));
  identity.forEach(value => children.push(paragraph(value, { color: "536377" })));

  const skills = [...new Set([
    ...(profile?.skills ?? []),
    ...data.achievements.flatMap(item => item.skills ?? []),
    ...data.courses.flatMap(item => item.skills ?? []),
  ])];
  if (skills.length) {
    children.push(heading("المهارات", professional));
    children.push(paragraph(skills.join(" · ")));
  }

  if (data.achievements.length) {
    children.push(heading("الخبرات والإنجازات", professional));
    data.achievements.forEach(item => {
      children.push(paragraph(item.title, { bold: true }));
      const context = [item.context, item.achievedOn].filter(Boolean).join(" · ");
      if (context) children.push(paragraph(context, { color: "536377" }));
      const evidence = item.resumeBullet?.trim() || item.result?.trim();
      if (evidence) children.push(paragraph(evidence));
    });
  }

  if (data.courses.length) {
    children.push(heading("التعلّم والدورات", professional));
    data.courses.forEach(item => {
      children.push(paragraph(item.title, { bold: true }));
      const details = [item.subject, item.source].filter(Boolean).join(" · ");
      if (details) children.push(paragraph(details, { color: "536377" }));
      if (item.studyMinutes) children.push(paragraph(`وقت التعلّم المسجل داخل أثر: ${item.studyMinutes.toLocaleString("ar")} دقيقة`, { color: "536377" }));
    });
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 720, right: 900, bottom: 720, left: 900 },
        },
      },
      children,
    }],
  });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "سيرتي-المهنية.docx";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadStudentResumeDocx(
  content: StudentResumeContent,
  template: StudentResumeTemplate,
  documentTitle: string,
) {
  const { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } = await import("docx");
  const appearance = { ...DEFAULT_RESUME_APPEARANCE, ...content.appearance };
  const headingColor = appearance.headingColor.replace("#", "").toUpperCase();
  const bodyColor = appearance.textColor.replace("#", "").toUpperCase();
  const accentColor = appearance.accentColor.replace("#", "").toUpperCase();
  const pageColor = appearance.pageColor.replace("#", "").toUpperCase();
  const inlineStyles = content.inlineStyles ?? [];
  const rightToLeft = template !== "ats" || /[\u0600-\u06ff]/.test(JSON.stringify(content));
  const alignment = rightToLeft ? AlignmentType.RIGHT : AlignmentType.LEFT;
  const headingLabel = (arabic: string, english: string) => template === "ats" ? `${english} | ${arabic}` : arabic;
  type ParagraphOptions = { bold?: boolean; color?: string; size?: number };
  type TextPart = { text: string; field?: string };
  const runsFor = (text: string, field = "", options?: ParagraphOptions) =>
    getResumeTextSegments(text, field, inlineStyles).map(segment => new TextRun({
      text: segment.text,
      font: appearance.fontFamily,
      size: segment.style.fontSize ? segment.style.fontSize * 2 : options?.size ?? (appearance.fontSize ?? 11) * 2,
      bold: segment.style.bold ?? options?.bold,
      italics: segment.style.italic,
      underline: segment.style.underline ? { type: "single" } : undefined,
      color: (segment.style.color ?? options?.color ?? bodyColor).replace("#", "").toUpperCase(),
      rightToLeft,
    }));
  const makeParagraph = (children: TextPart[], options?: ParagraphOptions) => new Paragraph({
    children: children.flatMap(part => runsFor(part.text, part.field, options)),
    alignment,
    bidirectional: rightToLeft,
    spacing: { after: 95 },
  });
  const paragraph = (text: string, options?: ParagraphOptions, field?: string) =>
    makeParagraph([{ text, field }], options);
  const paragraphParts = (parts: TextPart[]) => makeParagraph(parts);
  const heading = (text: string) => new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    alignment,
    bidirectional: rightToLeft,
    run: { color: headingColor, bold: true, font: appearance.fontFamily, size: ((appearance.fontSize ?? 11) + 2) * 2 },
    spacing: { before: 230, after: 100 },
  });
  const children: ParagraphType[] = [
    paragraph(content.fullName.trim() || "السيرة الذاتية", { bold: true, color: headingColor, size: 36 }, "fullName"),
  ];
  const contact = [
    { field: "headline", text: content.headline },
    { field: "email", text: content.email },
    { field: "phone", text: content.phone },
    { field: "location", text: content.location },
    { field: "linkedin", text: content.linkedin },
    { field: "website", text: content.website },
  ].filter(part => part.text.trim());
  if (contact.length) children.push(paragraphParts(contact.flatMap((part, index) =>
    index > 0 ? [{ text: " · " }, part] : [part],
  )));
  if (content.summary.trim()) {
    children.push(heading(headingLabel("الملخص المهني", "PROFESSIONAL SUMMARY")));
    children.push(paragraph(content.summary, undefined, "summary"));
  }

  const addEntries = (
    title: string,
    section: "education" | "experience" | "projects" | "courses",
    entries: StudentResumeContent["education"],
  ) => {
    const populated = entries.map((entry, sourceIndex) => ({ entry, sourceIndex })).filter(({ entry }) =>
      [entry.title, entry.organization, entry.description, entry.link].some(value => value.trim()),
    );
    if (!populated.length) return;
    children.push(heading(title));
    for (const { entry, sourceIndex } of populated) {
      const field = `${section}.${sourceIndex}`;
      if (entry.title.trim()) children.push(paragraph(entry.title, { bold: true }, `${field}.title`));
      const meta = [
        { text: entry.organization, field: `${field}.organization` },
        { text: entry.location, field: `${field}.location` },
        { text: entry.period, field: `${field}.period` },
      ].filter(part => part.text.trim());
      if (meta.length) children.push(paragraphParts(meta.flatMap((part, index) =>
        index > 0 ? [{ text: " · " }, part] : [part],
      )));
      if (entry.description.trim()) children.push(paragraph(entry.description, undefined, `${field}.description`));
      if (entry.link.trim()) children.push(paragraph(entry.link, { color: accentColor }, `${field}.link`));
    }
  };

  if (template === "ats") {
    addEntries(headingLabel("الخبرات", "WORK EXPERIENCE"), "experience", content.experience);
    addEntries(headingLabel("التعليم", "EDUCATION"), "education", content.education);
  } else {
    addEntries("التعليم", "education", content.education);
    addEntries("الخبرات", "experience", content.experience);
  }
  addEntries(headingLabel("المشروعات", "PROJECTS"), "projects", content.projects);
  addEntries(headingLabel("الدورات", "COURSES"), "courses", content.courses);
  if (content.skills.some(value => value.trim())) {
    children.push(heading(headingLabel("المهارات", "SKILLS")));
    children.push(paragraphParts(content.skills.flatMap((value, index) =>
      value.trim() ? [...(index > 0 ? [{ text: " · " }] : []), { text: value, field: `skills.${index}` }] : [],
    )));
  }
  if (content.certifications.some(value => value.trim())) {
    children.push(heading(headingLabel("الشهادات", "CERTIFICATIONS")));
    content.certifications.forEach((value, index) => {
      if (value.trim()) children.push(paragraph(value, undefined, `certifications.${index}`));
    });
  }
  if (content.languages.some(value => value.trim())) {
    children.push(heading(headingLabel("اللغات", "LANGUAGES")));
    children.push(paragraphParts(content.languages.flatMap((value, index) =>
      value.trim() ? [...(index > 0 ? [{ text: " · " }] : []), { text: value, field: `languages.${index}` }] : [],
    )));
  }

  const doc = new Document({
    background: { color: pageColor },
    sections: [{
      properties: {
        page: {
          margin: { top: 720, right: 900, bottom: 720, left: 900 },
        },
      },
      children,
    }],
  });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const safeTitle = documentTitle.trim().replace(/[\\/:*?"<>|]/g, "-").slice(0, 80);
  link.download = `${safeTitle || "سيرتي-المهنية"}.docx`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
