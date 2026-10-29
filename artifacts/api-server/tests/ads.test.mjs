import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';

const zodRequire = createRequire(new URL('../../../lib/api-zod/package.json', import.meta.url));
function load(path, dependencies, environment = {}) {
  const module = { exports: {} };
  const source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, { module, exports: module.exports, URL, Date, Buffer,
    process: { env: environment }, require: name => {
      assert(name in dependencies, `Unexpected dependency ${name}`);
      return dependencies[name];
    } });
  return module.exports;
}
const generated = load('../../../lib/api-zod/src/generated/api.ts', { zod: zodRequire('zod') });
const rules = load('../src/lib/ad-rules.ts', { '@workspace/api-zod': generated });
const placement = { page: 'home', slot: 'top', width: 600, height: 240, offsetX: 0, offsetY: 0 };
const ad = () => ({ title: 'Test creative', format: 'image_link', status: 'active', mediaUrl: 'https://example.com/photo.png',
  code: '', destination: 'https://example.com', cta: 'Learn more', placements: [{ ...placement }],
  customerId: null, startsAt: null, endsAt: null });

test('all five advertised formats validate with their actual required content', () => {
  for (const format of ['image_link', 'video_link', 'code', 'image_code', 'text_link']) {
    const creative = { ...ad(), format, code: '<strong>Ad</strong>' };
    if (['code', 'image_code'].includes(format)) creative.destination = '';
    assert(rules.validateAd(creative).data, format);
  }
});
test('link formats require a real HTTP(S) destination, never script/data URLs', () => {
  for (const destination of ['', 'javascript:alert(1)', 'data:text/html,hi', 'https://user:password@example.com']) {
    assert(rules.validateAd({ ...ad(), destination }).error);
  }
});
test('media formats reject script/data/local paths and code formats need actual code', () => {
  for (const mediaUrl of ['', 'javascript:alert(1)', 'data:image/png;base64,abc', '/etc/passwd']) assert(rules.validateAd({ ...ad(), mediaUrl }).error);
  assert(rules.validateAd({ ...ad(), format: 'code', code: '  ' }).error);
  assert(rules.validateAd({ ...ad(), mediaUrl: '/api/ads/media/12345678-1234-1234-1234-123456789012' }).data);
});
test('blank titles, duplicate placements and invalid geometry are rejected', () => {
  for (const input of [
    { ...ad(), title: ' ' }, { ...ad(), placements: [] },
    { ...ad(), placements: [{ ...placement }, { ...placement }] },
    { ...ad(), placements: [{ ...placement, width: 100000 }] },
    { ...ad(), placements: [{ ...placement, offsetX: -10 }] },
  ]) assert(rules.validateAd(input).error);
});
test('schedules accept valid ISO times and reject inverted or invalid times', () => {
  assert(rules.validateAd({ ...ad(), startsAt: '2030-01-01T10:00:00Z', endsAt: '2030-01-02T10:00:00Z' }).data);
  assert(rules.validateAd({ ...ad(), startsAt: '2030-01-02T10:00:00Z', endsAt: '2030-01-01T10:00:00Z' }).error);
  assert(rules.validateAd({ ...ad(), startsAt: 'not-a-date' }).error);
});
test('statistics periods coerce real HTTP query strings and reject arbitrary ranges', () => {
  for (const days of ['7', '30', '90']) assert.equal(rules.parseStatisticsDays(days).data.days, Number(days));
  assert.equal(rules.parseStatisticsDays(undefined).data.days, 30);
  for (const days of ['0', '1', '-7', '365000', 'abc', ['30']]) assert.equal(rules.parseStatisticsDays(days).success, false);
});
test('uploaded media requires matching magic bytes, not just an image MIME label', () => {
  assert(rules.matchesMagic('image/png', Buffer.from([137,80,78,71,13,10,26,10])));
  assert(rules.matchesMagic('image/jpeg', Buffer.from([255,216,255])));
  assert(rules.matchesMagic('image/gif', Buffer.from('GIF89a')));
  assert(rules.matchesMagic('image/webp', Buffer.from('RIFF0000WEBP')));
  assert(rules.matchesMagic('video/mp4', Buffer.from('0000ftypisom')));
  assert(rules.matchesMagic('video/webm', Buffer.from([26,69,223,163])));
  assert.equal(rules.matchesMagic('image/png', Buffer.from('<html><script>alert(1)</script>')), false);
  assert.equal(rules.matchesMagic('image/svg+xml', Buffer.from('<svg/>')), false);
});
test('event payload cannot supply actor IDs or fabricated counters', () => {
  const input = { kind: 'impression', page: 'home', slot: 'top' };
  assert(generated.RecordAdEventBody.strict().safeParse(input).success);
  assert.equal(generated.RecordAdEventBody.strict().safeParse({ ...input, impressions: 1000, visitor: 'forged' }).success, false);
});

const tracking = load('../src/lib/ad-tracking.ts', {
  'node:crypto': crypto, '@clerk/express': { getAuth: () => ({ userId: null }) },
  '../middlewares/clerkProxyMiddleware': { getClerkProxyHost: req => req.headers.host },
  '@workspace/db': {}, 'drizzle-orm': {},
}, { SESSION_SECRET: 'non-secret-test-fixture-only' });
const req = (cookie = '') => ({ headers: { cookie, host: 'app.example.com' }, secure: true, get: () => undefined });
test('anonymous browser ID is signed, opaque, stable and tamper resistant', () => {
  let cookie;
  const res = { cookie: (name, value, options) => { cookie = `${name}=${value}`; assert(options.httpOnly); assert.equal(options.sameSite, 'lax'); } };
  const first = tracking.visitorId(req(), res);
  const original = cookie;
  assert.equal(tracking.visitorId(req(original), res), first);
  assert.equal(first.length, 64);
  assert.notEqual(tracking.visitorId(req(original.replace(/.$/, char => char === '0' ? '1' : '0')), res), first);
  assert.notEqual(cookie, original);
});
test('cross-origin analytics submissions are rejected', () => {
  assert(tracking.sameOriginEvent(req()));
  assert.equal(tracking.sameOriginEvent({ ...req(), get: key => key === 'origin' ? 'https://foreign.example' : undefined }), false);
});
test('code previews remain in opaque-origin iframes without parent HTML injection', () => {
  const source = readFileSync(new URL('../../athar-students/src/ads/AdCreative.tsx', import.meta.url), 'utf8');
  assert(source.includes('sandbox="allow-scripts"'));
  assert(source.includes("connect-src 'none'"));
  assert(!source.includes('dangerouslySetInnerHTML'));
});
