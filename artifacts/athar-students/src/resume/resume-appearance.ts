import type { StudentResumeContent } from "@workspace/api-client-react";

export type ResumeAppearance = NonNullable<StudentResumeContent["appearance"]>;
export type ResumeFontFamily = ResumeAppearance["fontFamily"];

export const DEFAULT_RESUME_APPEARANCE: ResumeAppearance = {
  fontFamily: "Arial",
  pageColor: "#FFFFFF",
  textColor: "#303746",
  headingColor: "#1F2937",
  accentColor: "#5147C8",
};

export const RESUME_FONT_STACKS: Record<ResumeFontFamily, string> = {
  Arial: 'Arial, Tahoma, sans-serif',
  Tahoma: 'Tahoma, Arial, sans-serif',
  Verdana: 'Verdana, Tahoma, sans-serif',
  Georgia: 'Georgia, "Times New Roman", serif',
};

export const RESUME_FONT_LABELS: Record<ResumeFontFamily, string> = {
  Arial: "Arial",
  Tahoma: "Tahoma",
  Verdana: "Verdana",
  Georgia: "Georgia",
};

export const RESUME_COLOR_PRESETS: { label: string; appearance: ResumeAppearance }[] = [
  { label: "كلاسيكي", appearance: DEFAULT_RESUME_APPEARANCE },
  {
    label: "أزرق هادئ",
    appearance: { fontFamily: "Arial", pageColor: "#F5F9FC", textColor: "#27384B", headingColor: "#163D62", accentColor: "#2877A8" },
  },
  {
    label: "أخضر هادئ",
    appearance: { fontFamily: "Tahoma", pageColor: "#F5FAF6", textColor: "#293B32", headingColor: "#1E4938", accentColor: "#38856B" },
  },
];

export function withResumeAppearance(content: StudentResumeContent): StudentResumeContent {
  return { ...content, appearance: { ...DEFAULT_RESUME_APPEARANCE, ...content.appearance } };
}

function linearRgb(color: string): [number, number, number] {
  const value = color.replace("#", "");
  const rgb = [0, 2, 4].map(start => Number.parseInt(value.slice(start, start + 2), 16) / 255);
  return rgb.map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4) as [number, number, number];
}

export function colorContrastRatio(first: string, second: string): number {
  const luminance = (color: string) => {
    const [red, green, blue] = linearRgb(color);
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
