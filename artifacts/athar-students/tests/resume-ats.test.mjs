import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeAtsMatch, buildResumeText } from '../src/resume/resume-ats.ts';

const sample = {
  profile: {
    fullName: 'سارة علي',
    headline: 'طالبة تحليل بيانات',
    university: 'جامعة القاهرة',
    major: 'تحليل البيانات',
    yearOfStudy: 3,
    skills: ['Python', 'تحليل البيانات', 'Excel'],
  },
  achievements: [{
    title: 'مشروع لوحة معلومات',
    context: 'تحليل بيانات',
    result: 'إنشاء لوحة بيانات للمشروع',
    resumeBullet: 'حللت البيانات وأنشأت لوحة معلومات باستخدام Python وExcel.',
    skills: ['Python', 'Excel'],
    achievedOn: '2026-05-01',
  }],
  courses: [{ title: 'أساسيات تحليل البيانات', subject: 'تحليل البيانات', source: 'أثر' }],
};

test('resume text uses only supplied profile, skills, achievements and completed courses', () => {
  const text = buildResumeText(sample);
  assert.match(text, /Python/);
  assert.match(text, /لوحة معلومات/);
  assert.match(text, /أساسيات تحليل البيانات/);
  assert.doesNotMatch(text, /سارة علي/);
});

test('ATS match normalizes Arabic and reports matching and missing job terms', () => {
  const result = analyzeAtsMatch(sample, 'مطلوب محلل بيانات يجيد Python و Excel والتقارير وإدارة المشاريع');
  assert.equal(result.score > 0, true);
  assert.equal(result.matchedTerms.includes('python'), true);
  assert.equal(result.matchedTerms.includes('excel'), true);
  assert.equal(result.missingTerms.includes('المشاريع'), true);
  assert.equal(result.score <= 100, true);
  assert.equal(result.matchedTermCount, result.matchedTerms.length);
  assert.equal(result.missingTermCount, result.missingTerms.length);
});

test('ATS score keeps accurate totals while limiting rendered term lists', () => {
  const description = Array.from({ length: 28 }, (_, index) => `keyword${index}`).join(' ');
  const result = analyzeAtsMatch(sample, description);
  assert.equal(result.totalTerms, 28);
  assert.equal(result.missingTermCount, 28);
  assert.equal(result.missingTerms.length, 20);
});

test('empty job description produces no score and gives a useful prompt', () => {
  const result = analyzeAtsMatch(sample, 'في عن على');
  assert.equal(result.totalTerms, 0);
  assert.equal(result.score, 0);
  assert.equal(result.suggestions.some(item => item.includes('أدخل وصف الوظيفة')), true);
});

test('missing profile content produces truthful suggestions without inventing achievements', () => {
  const result = analyzeAtsMatch({ profile: null, achievements: [], courses: [] }, 'مدير مشروع');
  assert.equal(result.suggestions.some(item => item.includes('مشروعًا أو تدريبًا')), true);
  assert.equal(result.suggestions.some(item => item.includes('أضف مهاراتك')), true);
  assert.equal(result.suggestions.some(item => item.includes('حققته')), false);
});
