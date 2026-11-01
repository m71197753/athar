import type { ResumeData } from "./resume-ats";
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
