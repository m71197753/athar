import type { ResumeData } from "./resume-ats";
import type { StudentResumeContent, StudentResumeTemplate } from "@workspace/api-client-react";
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
  const professional = ["professional", "modern", "sidebar"].includes(template);
  const color = professional ? teal : ink;
  const paragraph = (text: string, options?: { bold?: boolean; color?: string; size?: number }) => new Paragraph({
    children: [new TextRun({
      text,
      font: "Arial",
      size: options?.size ?? 21,
      bold: options?.bold,
      color: options?.color ?? ink,
      rightToLeft: true,
    })],
    alignment: AlignmentType.RIGHT,
    bidirectional: true,
    spacing: { after: 95 },
  });
  const heading = (text: string) => new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    alignment: AlignmentType.RIGHT,
    bidirectional: true,
    run: { color, bold: true, font: "Arial" },
    spacing: { before: 230, after: 100 },
  });
  const children: ParagraphType[] = [
    paragraph(content.fullName.trim() || "السيرة الذاتية", { bold: true, color, size: 36 }),
  ];
  const contact = [
    content.headline,
    content.email,
    content.phone,
    content.location,
    content.linkedin,
    content.website,
  ].map(value => value.trim()).filter(Boolean);
  if (contact.length) children.push(paragraph(contact.join(" · "), { color: "536377" }));
  if (content.summary.trim()) {
    children.push(heading("الملخص المهني"));
    children.push(paragraph(content.summary.trim()));
  }

  const addEntries = (title: string, entries: StudentResumeContent["education"]) => {
    const populated = entries.filter(entry =>
      [entry.title, entry.organization, entry.description, entry.link].some(value => value.trim()),
    );
    if (!populated.length) return;
    children.push(heading(title));
    for (const entry of populated) {
      if (entry.title.trim()) children.push(paragraph(entry.title.trim(), { bold: true }));
      const meta = [entry.organization, entry.location, entry.period].map(value => value.trim()).filter(Boolean);
      if (meta.length) children.push(paragraph(meta.join(" · "), { color: "536377" }));
      for (const line of entry.description.split(/\r?\n/).map(value => value.trim()).filter(Boolean)) {
        children.push(paragraph(line));
      }
      if (entry.link.trim()) children.push(paragraph(entry.link.trim(), { color: "3B706B" }));
    }
  };

  addEntries("التعليم", content.education);
  addEntries("الخبرات", content.experience);
  addEntries("المشروعات", content.projects);
  addEntries("الدورات", content.courses);
  if (content.skills.some(value => value.trim())) {
    children.push(heading("المهارات"));
    children.push(paragraph(content.skills.map(value => value.trim()).filter(Boolean).join(" · ")));
  }
  if (content.certifications.some(value => value.trim())) {
    children.push(heading("الشهادات"));
    content.certifications.map(value => value.trim()).filter(Boolean).forEach(value => children.push(paragraph(value)));
  }
  if (content.languages.some(value => value.trim())) {
    children.push(heading("اللغات"));
    children.push(paragraph(content.languages.map(value => value.trim()).filter(Boolean).join(" · ")));
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
  const safeTitle = documentTitle.trim().replace(/[\\/:*?"<>|]/g, "-").slice(0, 80);
  link.download = `${safeTitle || "سيرتي-المهنية"}.docx`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
