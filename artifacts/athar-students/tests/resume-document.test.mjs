import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeStudentResumeAts,
  buildStudentResumeText,
  createStudentResumeContent,
  scoreStudentResume,
} from '../src/resume/resume-document.ts';

const blankContent = () => ({
  fullName: '',
  email: '',
  phone: '',
  location: '',
  linkedin: '',
  website: '',
  headline: '',
  summary: '',
  education: [],
  experience: [],
  projects: [],
  courses: [],
  skills: [],
  certifications: [],
  languages: [],
});

test('resume draft starts from real profile, achievement, and completed course data only', () => {
  const content = createStudentResumeContent(
    {
      fullName: 'سارة علي',
      university: 'جامعة القاهرة',
      major: 'تحليل البيانات',
      yearOfStudy: 3,
      headline: 'طالبة تحليل بيانات',
      skills: ['Python'],
    },
    [{
      id: 'achievement-1',
      title: 'لوحة معلومات',
      category: 'project',
      context: 'مشروع جامعي',
      challenge: null,
      action: 'حللت البيانات',
      result: 'أنشأت لوحة معلومات',
      achievedOn: '2026-05-01',
      skills: ['Excel'],
      resumeBullet: null,
      interviewStory: null,
      serviceOffer: null,
      summary: null,
      createdAt: '',
      updatedAt: '',
    }],
    [{
      id: 'course-1',
      kind: 'course',
      title: 'أساسيات التحليل',
      source: 'أثر',
      subject: 'البيانات',
      url: null,
      notes: '',
      skills: ['SQL'],
      status: 'completed',
      studyMinutes: 15,
      createdAt: '',
      updatedAt: '',
    }],
  );

  assert.equal(content.fullName, 'سارة علي');
  assert.equal(content.education[0].organization, 'جامعة القاهرة');
  assert.equal(content.projects[0].description, 'حللت البيانات — أنشأت لوحة معلومات');
  assert.equal(content.courses[0].title, 'أساسيات التحليل');
  assert.deepEqual(content.skills, ['Python', 'Excel', 'SQL']);
  assert.equal(content.email, '');
  assert.equal(content.certifications.length, 0);
});

test('resume readiness score stays within 100 and suggests only missing sections', () => {
  const empty = scoreStudentResume(blankContent());
  assert.equal(empty.score, 0);
  assert.equal(empty.suggestions.length, 8);

  const emptyRows = blankContent();
  emptyRows.experience.push({ title: '', organization: '', description: '' });
  emptyRows.projects.push({ title: '', organization: '', description: '' });
  emptyRows.courses.push({ title: '', organization: '', description: '' });
  emptyRows.certifications.push('');
  emptyRows.languages.push('');
  assert.equal(scoreStudentResume(emptyRows).score, 0);

  const complete = blankContent();
  Object.assign(complete, {
    fullName: 'سارة علي',
    headline: 'محللة بيانات مبتدئة',
    summary: 'أحلل البيانات وأعرض النتائج بوضوح.',
    email: 'sara@example.com',
    education: [{ title: 'تحليل البيانات', organization: 'جامعة القاهرة' }],
    projects: [{ title: 'لوحة بيانات', description: 'مشروع حقيقي' }],
    skills: ['Python', 'Excel', 'SQL'],
    languages: ['العربية'],
  });
  assert.equal(scoreStudentResume(complete).score, 100);
  assert.equal(scoreStudentResume(complete).suggestions.length, 0);
});

test('ATS comparison uses the private resume draft content and target text', () => {
  const content = blankContent();
  content.fullName = 'سارة علي';
  content.headline = 'محللة بيانات';
  content.projects = [{
    title: 'مشروع التقارير',
    organization: '',
    location: '',
    period: '',
    description: 'استخدمت Python و Excel لإعداد التقارير.',
    link: '',
  }];
  const resumeText = buildStudentResumeText(content);
  const result = analyzeStudentResumeAts(content, 'مطلوب محلل بيانات يجيد Python و Excel وإدارة المشاريع');
  assert.match(resumeText, /Python/);
  assert.equal(result.matchedTerms.includes('python'), true);
  assert.equal(result.matchedTerms.includes('excel'), true);
  assert.equal(result.score <= 100, true);
});
