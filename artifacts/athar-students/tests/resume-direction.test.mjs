import test from "node:test";
import assert from "node:assert/strict";
import {
  getResumeDirectionFromText,
  getStudentResumeDirection,
} from "../src/resume/resume-direction.ts";

const emptyContent = {
  fullName: "",
  email: "",
  phone: "",
  location: "",
  linkedin: "",
  website: "",
  headline: "",
  summary: "",
  education: [],
  experience: [],
  projects: [],
  courses: [],
  skills: [],
  certifications: [],
  languages: [],
};

test("Arabic resume content uses right-to-left direction", () => {
  assert.equal(getStudentResumeDirection({
    ...emptyContent,
    fullName: "محمد الإمام",
    headline: "محلل بيانات",
    summary: "أحلل البيانات وأجهز التقارير.",
    skills: ["Excel", "تحليل البيانات"],
  }), "rtl");
});

test("English resume content uses left-to-right direction despite an Arabic name", () => {
  assert.equal(getStudentResumeDirection({
    ...emptyContent,
    fullName: "محمد الإمام",
    headline: "Junior Data Analyst",
    summary: "Analyze datasets and communicate findings through clear reports.",
    experience: [{
      title: "Reporting Assistant",
      organization: "North Office",
      location: "Cairo",
      period: "2025–2026",
      description: "Prepared monthly reports and validated source data.",
      link: "https://example.com",
    }],
    skills: ["Excel", "SQL", "Data visualization"],
  }), "ltr");
});

test("direction detection ignores numbers and defaults to Arabic for empty text", () => {
  assert.equal(getResumeDirectionFromText(["2026", "+20 100 000 0000"]), "rtl");
  assert.equal(getResumeDirectionFromText([]), "rtl");
  assert.equal(getResumeDirectionFromText(["abc", "مدد"]), "rtl");
});
