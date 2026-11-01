import test from 'node:test';
import assert from 'node:assert/strict';
import { downloadResumeDocx } from '../src/resume/resume-export.ts';

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
