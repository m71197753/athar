import test from 'node:test';
import assert from 'node:assert/strict';
import { downloadResumeDocx, downloadStudentResumeDocx } from '../src/resume/resume-export.ts';

test('Word export creates a downloadable DOCX archive locally', async () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  let generatedBlob;
  let clickCount = 0;
  const link = { href: '', download: '', click: () => { clickCount += 1; } };

  URL.createObjectURL = blob => {
    generatedBlob = blob;
    return 'blob:resume-test';
  };
  URL.revokeObjectURL = () => {};
  globalThis.document = { createElement: tag => {
    assert.equal(tag, 'a');
    return link;
  } };
  globalThis.window = { setTimeout: () => 0 };

  try {
    await downloadResumeDocx({
      profile: { fullName: 'سارة علي', headline: 'طالبة تحليل بيانات', skills: ['Python'] },
      achievements: [{ title: 'مشروع لوحة معلومات', result: 'أنشأت لوحة معلومات.' }],
      courses: [{ title: 'أساسيات التحليل' }],
    }, 'professional');
  } finally {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
  }

  assert.equal(clickCount, 1);
  assert.equal(link.download, 'سيرتي-المهنية.docx');
  assert.ok(generatedBlob.size > 1000);
  const bytes = new Uint8Array(await generatedBlob.arrayBuffer());
  assert.deepEqual(Array.from(bytes.slice(0, 2)), [0x50, 0x4b]);
});

test('saved CV export creates a separate named DOCX with the selected template', async () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  let generatedBlob;
  let clickCount = 0;
  const link = { href: '', download: '', click: () => { clickCount += 1; } };

  URL.createObjectURL = blob => {
    generatedBlob = blob;
    return 'blob:student-resume-test';
  };
  URL.revokeObjectURL = () => {};
  globalThis.document = { createElement: tag => {
    assert.equal(tag, 'a');
    return link;
  } };
  globalThis.window = { setTimeout: () => 0 };

  try {
    await downloadStudentResumeDocx({
      fullName: 'سارة علي',
      email: 'sara@example.com',
      phone: '',
      location: 'القاهرة',
      linkedin: '',
      website: '',
      headline: 'محللة بيانات مبتدئة',
      summary: 'أحلل البيانات وأعرض النتائج بوضوح.',
      education: [{ title: 'تحليل البيانات', organization: 'جامعة القاهرة', location: '', period: '2026', description: '', link: '' }],
      experience: [],
      projects: [{ title: 'لوحة بيانات', organization: '', location: '', period: '', description: 'استخدمت Python و Excel.', link: '' }],
      courses: [],
      skills: ['Python', 'Excel'],
      certifications: [],
      languages: ['العربية'],
    }, 'professional', 'محللة بيانات');
  } finally {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
  }

  assert.equal(clickCount, 1);
  assert.equal(link.download, 'محللة بيانات.docx');
  assert.ok(generatedBlob.size > 1000);
  const bytes = new Uint8Array(await generatedBlob.arrayBuffer());
  assert.deepEqual(Array.from(bytes.slice(0, 2)), [0x50, 0x4b]);
});
