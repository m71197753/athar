import { useMemo, useState, type ChangeEvent, type CSSProperties, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetAdminLanguageSettings, useUpdateAdminLanguageSettings, useListAdminLanguageContent,
  useCreateAdminLanguageContent, useUpdateAdminLanguageContent, useImportAdminLanguageContent,
  getGetAdminLanguageSettingsQueryKey, getListAdminLanguageContentQueryKey,
} from '@workspace/api-client-react';
import type {
  LanguageContentItem, LanguageContentItemInput, LanguageContentItemUpdate,
  LanguagePlatformSettingsInput, LanguagePlatformSettings,
  ListAdminLanguageContentParams, LanguageContentImportRowError,
} from '@workspace/api-client-react';
import { Archive, BookOpenText, Check, ChevronLeft, ChevronRight, FileUp, Languages, Pencil, Plus, RotateCcw, Save, Search, X } from 'lucide-react';
import { parseLanguageContentImportFile, type LanguageImportParseResult } from '@workspace/language-content';
import { RequiredMark } from '../components/RequiredMark';
import './LanguageAdminPanel.css';

const languageNames: Record<string, string> = { en: 'الإنجليزية', fr: 'الفرنسية', es: 'الإسبانية', de: 'الألمانية', tr: 'التركية' };
const levels = ['A1', 'A2', 'B1', 'B2'] as const;
const defaultSettings: LanguagePlatformSettings = {
  page: {
    title: 'تعلّم لغة جديدة', subtitle: 'خطوات قصيرة تصنع تقدماً واضحاً.', accentColor: '#4338CA',
    enabledLanguages: ['en'], showConversation: true, showGamification: true, showProgress: true,
    showReviewList: true, showLeague: true, showFreeze: true, showPreferences: true, layoutOrder: 'learning-first',
  },
  game: { maxHearts: 5, heartRegenMinutes: 240, baseXp: 10, accuracyBonusXp: 5, reviewBonusXp: 3, streakGemInterval: 7, freezeCost: 20, maxFreezeCredits: 2, promotionCount: 3, demotionCount: 3 },
};
const blankItem = (): LanguageContentItemInput => ({
  languageCode: 'en', level: 'A1', kind: 'word', category: '', partOfSpeech: '',
  english: '', arabic: '', pronunciationArabic: '', exampleEnglish: '', exampleArabic: '',
  grammarNote: '', difficulty: 1, relatedWordIds: [],
});
const errorMessage = (error: unknown) => {
  const status = typeof error === 'object' && error && 'status' in error ? Number((error as { status: unknown }).status) : 0;
  if (status === 401 || status === 403) return 'ليست لديك صلاحية لتنفيذ هذا الإجراء.';
  if (status === 400 || status === 422) return 'تعذّر حفظ البيانات. راجع الحقول ثم حاول مجدداً.';
  return 'حدث خطأ أثناء تحميل البيانات. أعد المحاولة.';
};
const optional = (value: string) => value.trim() || null;
const importErrorDetails = (error: unknown): { message?: string; rowErrors?: LanguageContentImportRowError[] } => {
  if (!error || typeof error !== 'object' || !('data' in error)) return {};
  const data = (error as { data?: unknown }).data;
  if (!data || typeof data !== 'object') return {};
  const payload = data as { error?: unknown; rowErrors?: unknown };
  return {
    message: typeof payload.error === 'string' ? payload.error : undefined,
    rowErrors: Array.isArray(payload.rowErrors) ? payload.rowErrors as LanguageContentImportRowError[] : undefined,
  };
};

export default function LanguageAdminPanel() {
  const queryClient = useQueryClient();
  const settingsQuery = useGetAdminLanguageSettings({ query: { queryKey: getGetAdminLanguageSettingsQueryKey(), refetchOnWindowFocus: false } });
  const saveSettings = useUpdateAdminLanguageSettings();
  const createItem = useCreateAdminLanguageContent();
  const updateItem = useUpdateAdminLanguageContent();
  const importContent = useImportAdminLanguageContent();
  const [settingsDraft, setSettingsDraft] = useState<LanguagePlatformSettings | null>(null);
  const [settingsNotice, setSettingsNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [language, setLanguage] = useState<ListAdminLanguageContentParams['languageCode']>('en');
  const [level, setLevel] = useState<ListAdminLanguageContentParams['level']>('A1');
  const [page, setPage] = useState(1);
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [editing, setEditing] = useState<LanguageContentItem | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [itemDraft, setItemDraft] = useState<LanguageContentItemInput>(blankItem());
  const [formNotice, setFormNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [importFileName, setImportFileName] = useState('');
  const [importPreview, setImportPreview] = useState<LanguageImportParseResult | null>(null);
  const [activateImportedItems, setActivateImportedItems] = useState(false);
  const [importNotice, setImportNotice] = useState<{
    ok: boolean;
    text: string;
    rowErrors?: LanguageContentImportRowError[];
  } | null>(null);

  const settings = settingsQuery.data ?? defaultSettings;
  const currentSettings = settingsDraft ?? settings;
  const settingsDirty = !!settingsQuery.data && JSON.stringify(settingsDraft ?? settingsQuery.data) !== JSON.stringify(settingsQuery.data);
  const params = useMemo<ListAdminLanguageContentParams>(() => ({
    languageCode: language, level, page, pageSize: 12, search: search || undefined, includeArchived,
  }), [language, level, page, search, includeArchived]);
  const contentQuery = useListAdminLanguageContent(params, { query: { queryKey: getListAdminLanguageContentQueryKey(params), refetchOnWindowFocus: false } });
  const content = contentQuery.data;
  const patchPage = <K extends keyof LanguagePlatformSettings['page']>(key: K, value: LanguagePlatformSettings['page'][K]) => {
    setSettingsNotice(null);
    setSettingsDraft(previous => ({ ...(previous ?? settings), page: { ...(previous ?? settings).page, [key]: value } }));
  };
  const patchGame = <K extends keyof LanguagePlatformSettings['game']>(key: K, value: LanguagePlatformSettings['game'][K]) => {
    setSettingsNotice(null);
    setSettingsDraft(previous => ({ ...(previous ?? settings), game: { ...(previous ?? settings).game, [key]: value } }));
  };
  const persistSettings = (event: FormEvent) => {
    event.preventDefault();
    const draft = currentSettings;
    if (draft.page.title.trim().length < 2 || draft.page.title.length > 80 || draft.page.subtitle.trim().length < 2 || draft.page.subtitle.length > 240 ||
      !/^#[0-9A-Fa-f]{6}$/.test(draft.page.accentColor) || draft.page.enabledLanguages.length < 1) {
      setSettingsNotice({ ok: false, text: 'أكمل العنوان والوصف واختر لغة واحدة على الأقل.' });
      return;
    }
    const data: LanguagePlatformSettingsInput = draft;
    saveSettings.mutate({ data }, {
      onSuccess: () => {
        setSettingsDraft(draft);
        setSettingsNotice({ ok: true, text: 'تم حفظ إعدادات صفحة اللغات.' });
        void queryClient.invalidateQueries({ queryKey: getGetAdminLanguageSettingsQueryKey() });
      },
      onError: error => setSettingsNotice({ ok: false, text: errorMessage(error) }),
    });
  };
  const startCreate = () => {
    setEditing(null);
    setItemDraft({ ...blankItem(), languageCode: language, level });
    setFormNotice(null);
    setEditorOpen(true);
  };
  const startEdit = (item: LanguageContentItem) => {
    setEditing(item);
    setEditorOpen(true);
    setItemDraft({
      languageCode: item.languageCode, level: item.level, kind: item.kind, category: item.category,
      partOfSpeech: item.partOfSpeech ?? '', english: item.english, arabic: item.arabic,
      pronunciationArabic: item.pronunciationArabic ?? '', exampleEnglish: item.exampleEnglish ?? '',
      exampleArabic: item.exampleArabic ?? '', grammarNote: item.grammarNote ?? '', difficulty: item.difficulty,
      relatedWordIds: item.relatedWordIds,
    });
    setFormNotice(null);
  };
  const saveContentItem = (event: FormEvent) => {
    event.preventDefault();
    if (!itemDraft.category.trim() || itemDraft.category.length > 80 || !itemDraft.english.trim() || itemDraft.english.length > 300 ||
      !itemDraft.arabic.trim() || itemDraft.arabic.length > 300 || itemDraft.difficulty < 1 || itemDraft.difficulty > 10 ||
      (itemDraft.relatedWordIds?.length ?? 0) > 30) {
      setFormNotice({ ok: false, text: 'تحقق من الحقول المطلوبة والحدود الموضحة.' });
      return;
    }
    const body: LanguageContentItemInput = {
      ...itemDraft, category: itemDraft.category.trim(), english: itemDraft.english.trim(), arabic: itemDraft.arabic.trim(),
      partOfSpeech: optional(itemDraft.partOfSpeech ?? ''), pronunciationArabic: optional(itemDraft.pronunciationArabic ?? ''),
      exampleEnglish: optional(itemDraft.exampleEnglish ?? ''), exampleArabic: optional(itemDraft.exampleArabic ?? ''),
      grammarNote: optional(itemDraft.grammarNote ?? ''), relatedWordIds: (itemDraft.relatedWordIds ?? []).filter(Boolean),
    };
    const done = () => {
      setFormNotice({ ok: true, text: editing ? 'تم تحديث العنصر.' : 'تمت إضافة العنصر.' });
      setEditing(null);
      setEditorOpen(false);
      setItemDraft(blankItem());
      void queryClient.invalidateQueries({ queryKey: getListAdminLanguageContentQueryKey() });
    };
    if (editing) {
      const update: LanguageContentItemUpdate = body;
      updateItem.mutate({ id: editing.id, data: update }, { onSuccess: done, onError: error => setFormNotice({ ok: false, text: errorMessage(error) }) });
    } else {
      createItem.mutate({ data: body }, { onSuccess: done, onError: error => setFormNotice({ ok: false, text: errorMessage(error) }) });
    }
  };
  const setActive = (item: LanguageContentItem, active: boolean) => {
    updateItem.mutate({ id: item.id, data: { active } }, {
      onSuccess: () => {
        setFormNotice({ ok: true, text: active ? 'تمت إعادة تفعيل العنصر.' : 'تمت أرشفة العنصر.' });
        void queryClient.invalidateQueries({ queryKey: getListAdminLanguageContentQueryKey() });
      },
      onError: error => setFormNotice({ ok: false, text: errorMessage(error) }),
    });
  };
  const readImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    setImportFileName(file.name);
    setImportNotice(null);
    if (file.size > 400 * 1024) {
      setImportPreview({ items: [], errors: [{ row: 1, message: 'حجم الملف يتجاوز 400 كيلوبايت.' }] });
      return;
    }
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension !== 'csv' && extension !== 'json') {
      setImportPreview({ items: [], errors: [{ row: 1, message: 'اختر ملفًا بامتداد CSV أو JSON.' }] });
      return;
    }
    try {
      setImportPreview(parseLanguageContentImportFile(await file.text(), extension));
    } catch {
      setImportPreview({ items: [], errors: [{ row: 1, message: 'تعذّر قراءة الملف.' }] });
    }
  };
  const submitImport = () => {
    if (!importPreview || importPreview.items.length === 0 || importPreview.errors.length > 0) return;
    const firstItem = importPreview.items[0];
    importContent.mutate({
      data: { items: importPreview.items, activateAfterImport: activateImportedItems },
    }, {
      onSuccess: result => {
        const stateMessage = result.inactive > 0
          ? `حُفظ ${result.inactive.toLocaleString('ar')} للمراجعة ولم يظهر للطلاب.`
          : `تم تفعيل ${result.activated.toLocaleString('ar')} للطلاب.`;
        setImportNotice({ ok: true, text: `تم استيراد ${result.imported.toLocaleString('ar')} عنصر. ${stateMessage}` });
        setImportPreview(null);
        setImportFileName('');
        setIncludeArchived(!activateImportedItems);
        setLanguage(firstItem.languageCode);
        setLevel(firstItem.level);
        setSearch('');
        setSearchDraft('');
        setPage(1);
        void queryClient.invalidateQueries({ queryKey: getListAdminLanguageContentQueryKey() });
      },
      onError: error => {
        const details = importErrorDetails(error);
        setImportNotice({
          ok: false,
          text: details.message ?? 'تعذّر الاستيراد. لم يتم حفظ أي عنصر؛ راجع الصفوف وحاول مجددًا.',
          rowErrors: details.rowErrors,
        });
      },
    });
  };
  const changeFilter = (callback: () => void) => { callback(); setPage(1); };

  return <section className="lang-admin" dir="rtl" aria-labelledby="lang-admin-title">
    <header className="lang-admin-hero">
      <div className="lang-admin-hero-icon"><Languages size={22}/></div>
      <div className="lang-admin-hero-copy">
        <span className="lang-admin-kicker">إعدادات التعلّم</span>
        <h2 id="lang-admin-title">إدارة اللغات</h2>
        <p>تحكم في تجربة الممارسة ومكتبة المحتوى، واجعل التقدم واضحاً للطلاب.</p>
      </div>
      <div className="lang-admin-hero-stat"><strong>{content?.total?.toLocaleString('ar') ?? '—'}</strong><span>عنصر في النتائج</span></div>
    </header>

    <form className="lang-admin-settings" onSubmit={persistSettings}>
      <div className="lang-admin-section-heading">
        <div><span className="lang-admin-overline">01 / الواجهة</span><h3>إعدادات صفحة اللغات</h3></div>
        <span className="lang-admin-caption">تغييراتك تظهر للطلاب بعد الحفظ</span>
      </div>
      {settingsQuery.isLoading ? <div className="lang-admin-skeleton"><i/><i/><i/></div> : settingsQuery.isError ?
        <div className="lang-admin-alert is-error" role="alert"><span>{errorMessage(settingsQuery.error)}</span><button type="button" onClick={() => settingsQuery.refetch()}>إعادة المحاولة</button></div> :
        <div className="lang-admin-settings-grid">
          <div className="lang-admin-copy-fields">
            <label className="lang-admin-field"><span>عنوان الصفحة <RequiredMark/></span><input value={currentSettings.page.title} minLength={2} maxLength={80} required onChange={e => patchPage('title', e.target.value)}/></label>
            <label className="lang-admin-field"><span>وصف قصير <RequiredMark/></span><textarea value={currentSettings.page.subtitle} minLength={2} maxLength={240} required rows={2} onChange={e => patchPage('subtitle', e.target.value)}/></label>
            <div className="lang-admin-language-picker">
              <span className="lang-admin-field-title">اللغات المتاحة</span>
              <div className="lang-admin-language-options">{Object.entries(languageNames).map(([code, name]) => {
                const checked = currentSettings.page.enabledLanguages.includes(code as typeof currentSettings.page.enabledLanguages[number]);
                return <label key={code} className={checked ? 'is-selected' : ''}><input type="checkbox" checked={checked} onChange={e => {
                  const values = new Set(currentSettings.page.enabledLanguages);
                  e.target.checked ? values.add(code as typeof currentSettings.page.enabledLanguages[number]) : values.delete(code as typeof currentSettings.page.enabledLanguages[number]);
                  patchPage('enabledLanguages', [...values]);
                }}/><b dir="ltr">{code.toUpperCase()}</b><span>{name}</span></label>;
              })}</div>
            </div>
          </div>
          <aside className="lang-admin-preview" style={{ '--lang-accent': currentSettings.page.accentColor } as CSSProperties}>
            <div className="lang-admin-preview-top"><span className="lang-admin-preview-dot"/><span>معاينة الصفحة</span></div>
            <h4>{currentSettings.page.title}</h4><p>{currentSettings.page.subtitle}</p>
            <div className="lang-admin-preview-progress"><span style={{ width: '62%' }}/></div>
            <small>خطوة جديدة، وتقدم يتراكم</small>
            <label className="lang-admin-color"><span>لون الإبراز</span><input type="color" value={currentSettings.page.accentColor} onChange={e => patchPage('accentColor', e.target.value.toUpperCase())}/><code dir="ltr">{currentSettings.page.accentColor}</code></label>
          </aside>
          <div className="lang-admin-feature-settings">
            <div className="lang-admin-inline-heading"><div><b>ما يظهر في الصفحة</b><small>اختر العناصر التي يحتاجها الطالب</small></div></div>
            <div className="lang-admin-feature-list">{([
              ['showConversation', 'المحادثة', 'تدريب قصير على التحدث'],
              ['showGamification', 'المكافآت', 'نقاط ومكافآت الممارسة'],
              ['showProgress', 'التقدم', 'ملخص الإنجاز والتعلّم'],
              ['showReviewList', 'قائمة المراجعة', 'عناصر للعودة إليها'],
              ['showLeague', 'المنافسة الودية', 'ترتيب أسبوعي للمشاركين'],
              ['showFreeze', 'حماية التتابع', 'رصيد لحماية أيام الممارسة'],
              ['showPreferences', 'التفضيلات', 'إعدادات تجربة التعلّم'],
            ] as const).map(([key, title, description]) => <label key={key} className="lang-admin-feature">
              <span><b>{title}</b><small>{description}</small></span>
              <input type="checkbox" checked={currentSettings.page[key]} onChange={e => patchPage(key, e.target.checked)}/>
            </label>)}</div>
            <fieldset className="lang-admin-layout-field"><legend>ترتيب الصفحة</legend>
              <label className={currentSettings.page.layoutOrder === 'learning-first' ? 'is-selected' : ''}><input type="radio" checked={currentSettings.page.layoutOrder === 'learning-first'} onChange={() => patchPage('layoutOrder', 'learning-first')}/> التعلّم أولاً</label>
              <label className={currentSettings.page.layoutOrder === 'game-first' ? 'is-selected' : ''}><input type="radio" checked={currentSettings.page.layoutOrder === 'game-first'} onChange={() => patchPage('layoutOrder', 'game-first')}/> المكافآت أولاً</label>
            </fieldset>
          </div>
          <div className="lang-admin-rules">
            <div className="lang-admin-inline-heading"><div><b>قواعد المكافآت والتتابع</b><small>قيم محددة لضبط إيقاع الممارسة</small></div></div>
            <div className="lang-admin-rule-grid">{([
              ['maxHearts', 'القلوب القصوى', 3, 10],
              ['heartRegenMinutes', 'استعادة القلب بالدقائق', 30, 1440],
              ['baseXp', 'نقاط الإجابة الأساسية', 0, 100],
              ['accuracyBonusXp', 'مكافأة الدقة', 0, 100],
              ['reviewBonusXp', 'مكافأة المراجعة', 0, 100],
              ['streakGemInterval', 'فاصل جوهرة التتابع', 1, 30],
              ['freezeCost', 'تكلفة الحماية', 0, 100],
              ['maxFreezeCredits', 'أقصى رصيد حماية', 0, 10],
              ['promotionCount', 'عدد المتقدمين', 1, 14],
              ['demotionCount', 'عدد المتراجعين', 1, 14],
            ] as const).map(([key, label, min, max]) => <label key={key} className="lang-admin-field"><span>{label}</span>
              <input type="number" min={min} max={max} step={1} value={currentSettings.game[key]} onChange={e => patchGame(key, Math.min(max, Math.max(min, Number(e.target.value) || min)))}/>
            </label>)}</div>
          </div>
          <div className="lang-admin-save-row">
            {settingsNotice && <span className={settingsNotice.ok ? 'lang-admin-success' : 'lang-admin-error'} role={settingsNotice.ok ? 'status' : 'alert'}>{settingsNotice.ok && <Check size={15}/>} {settingsNotice.text}</span>}
            <button className="button button-primary" type="submit" disabled={!settingsDirty || saveSettings.isPending}><Save size={15}/>{saveSettings.isPending ? 'جارٍ الحفظ…' : 'حفظ الإعدادات'}</button>
          </div>
        </div>}
    </form>

    <section className="lang-admin-curriculum" aria-labelledby="lang-curriculum-heading">
      <div className="lang-admin-section-heading">
        <div><span className="lang-admin-overline">02 / المكتبة</span><h3 id="lang-curriculum-heading">محتوى المنهج</h3></div>
        <button type="button" className="button button-primary" onClick={startCreate}><Plus size={16}/> إضافة عنصر</button>
      </div>
      <p className="lang-admin-section-note">أضف كلمات وجملاً عربية مع أمثلة ونطق، ثم راجعها حسب اللغة والمستوى.</p>
      <div className="lang-admin-import" aria-labelledby="lang-import-heading">
        <div className="lang-admin-import-heading">
          <div>
            <h4 id="lang-import-heading">استيراد محتوى من ملف</h4>
            <p>CSV أو JSON، بحد أقصى 250 عنصرًا و400 كيلوبايت. راجع الترجمة قبل إتاحتها للطلاب.</p>
          </div>
          <label className="button button-outline button-compact lang-admin-import-upload">
            <FileUp size={15}/><span>اختيار ملف</span>
            <input className="lang-admin-file-input" type="file" accept=".csv,.json,text/csv,application/json" onChange={readImportFile}/>
          </label>
        </div>
        {importFileName && <div className="lang-admin-import-filename" dir="ltr">{importFileName}</div>}
        {importNotice && <div className={`lang-admin-alert ${importNotice.ok ? 'is-success' : 'is-error'}`} role={importNotice.ok ? 'status' : 'alert'}>
          <span>{importNotice.text}</span>
          {importNotice.rowErrors && importNotice.rowErrors.length > 0 && <ul className="lang-admin-import-errors">
            {importNotice.rowErrors.slice(0, 8).map((issue, index) => <li key={`${issue.row}-${index}`}>الصف {issue.row}: {issue.message}</li>)}
            {importNotice.rowErrors.length > 8 && <li>وأخطاء أخرى: {importNotice.rowErrors.length - 8}</li>}
          </ul>}
        </div>}
        {importPreview && <div className="lang-admin-import-preview">
          <div className="lang-admin-import-summary" role="status">
            <b>{importPreview.items.length.toLocaleString('ar')} عنصر جاهز للمعاينة</b>
            <span>{importPreview.errors.length.toLocaleString('ar')} أخطاء</span>
          </div>
          {importPreview.errors.length > 0 && <ul className="lang-admin-import-errors" role="alert">
            {importPreview.errors.slice(0, 8).map((issue, index) => <li key={`${issue.row}-${index}`}>الصف {issue.row}: {issue.message}</li>)}
            {importPreview.errors.length > 8 && <li>وأخطاء أخرى: {importPreview.errors.length - 8}</li>}
          </ul>}
          {importPreview.items.length > 0 && <div className="lang-admin-import-samples">
            {importPreview.items.slice(0, 4).map((item, index) => <div className="lang-admin-import-sample" key={`${item.sourceId ?? item.english}-${index}`}>
              <span>{languageNames[item.languageCode]} · {item.level} · {item.kind === 'word' ? 'كلمة' : 'جملة'}</span>
              <b dir="ltr">{item.english}</b><span>{item.arabic}</span>
            </div>)}
            {importPreview.items.length > 4 && <small>وتوجد { (importPreview.items.length - 4).toLocaleString('ar') } عناصر أخرى.</small>}
          </div>}
          <div className="lang-admin-import-actions">
            <label className="lang-admin-import-activate">
              <input type="checkbox" checked={activateImportedItems} onChange={event => setActivateImportedItems(event.target.checked)}/>
              <span><b>إتاحة العناصر للطلاب فورًا</b><small>بدون تحديد هذا الخيار، تُحفظ العناصر غير مفعّلة للمراجعة.</small></span>
            </label>
            <button type="button" className="button button-primary" disabled={importPreview.items.length === 0 || importPreview.errors.length > 0 || importContent.isPending} onClick={submitImport}>
              <FileUp size={15}/>{importContent.isPending ? 'جارٍ الاستيراد…' : 'استيراد العناصر'}
            </button>
          </div>
        </div>}
      </div>
      <div className="lang-admin-content-toolbar">
        <label className="lang-admin-filter"><span>اللغة</span><select value={language} onChange={e => changeFilter(() => setLanguage(e.target.value as typeof language))}>{Object.entries(languageNames).map(([code, name]) => <option value={code} key={code}>{name}</option>)}</select></label>
        <label className="lang-admin-filter"><span>المستوى</span><select value={level} onChange={e => changeFilter(() => setLevel(e.target.value as typeof level))}>{levels.map(value => <option key={value}>{value}</option>)}</select></label>
        <form className="lang-admin-search" onSubmit={e => { e.preventDefault(); changeFilter(() => setSearch(searchDraft.trim().slice(0, 100))); }}><Search size={16}/><input aria-label="ابحث في المحتوى" placeholder="ابحث بالإنجليزية أو العربية…" maxLength={100} value={searchDraft} onChange={e => setSearchDraft(e.target.value)}/><button type="submit">بحث</button></form>
        <label className="lang-admin-archive-filter"><input type="checkbox" checked={includeArchived} onChange={e => changeFilter(() => setIncludeArchived(e.target.checked))}/> عرض المؤرشف</label>
      </div>

      {formNotice && <div className={`lang-admin-alert ${formNotice.ok ? 'is-success' : 'is-error'}`} role={formNotice.ok ? 'status' : 'alert'}><span>{formNotice.text}</span><button type="button" aria-label="إخفاء الرسالة" onClick={() => setFormNotice(null)}><X size={15}/></button></div>}
      {editorOpen && <ContentEditor item={itemDraft} setItem={setItemDraft} isEditing={!!editing} pending={createItem.isPending || updateItem.isPending} onSubmit={saveContentItem} onCancel={() => { setEditing(null); setEditorOpen(false); setItemDraft(blankItem()); }}/>}
      {contentQuery.isLoading ? <div className="lang-admin-skeleton"><i/><i/><i/></div> : contentQuery.isError ?
        <div className="lang-admin-alert is-error" role="alert"><span>{errorMessage(contentQuery.error)}</span><button type="button" onClick={() => contentQuery.refetch()}>إعادة المحاولة</button></div> :
        content && content.items.length === 0 ? <div className="lang-admin-empty"><BookOpenText size={24}/><b>{search ? 'لا توجد نتائج مطابقة' : 'المكتبة جاهزة لعنصرها الأول'}</b><p>{search ? 'جرّب عبارة أخرى أو غيّر مستوى التعلّم.' : 'ابدأ بإضافة كلمة أو جملة لتظهر هنا.'}</p>{!search && <button type="button" className="button button-outline button-compact" onClick={startCreate}><Plus size={14}/> إضافة عنصر</button>}</div> :
        <div className="lang-admin-content-list">{content?.items.map(item => <article className={`lang-admin-content-card ${item.active ? '' : 'is-archived'}`} key={item.id}>
          <div className="lang-admin-item-top"><div className="lang-admin-item-tags"><span className="lang-admin-level">{item.level}</span><span>{languageNames[item.languageCode]}</span><span>{item.kind === 'word' ? 'كلمة' : 'جملة'}</span>{!item.active && <span className="lang-admin-archived-badge">مؤرشف</span>}</div><span className="lang-admin-item-difficulty">الصعوبة {item.difficulty}/10</span></div>
          <div className="lang-admin-word-pair"><div><span dir="ltr">{item.english}</span><small>{item.category}{item.partOfSpeech ? ` · ${item.partOfSpeech}` : ''}</small></div><i>↔</i><div className="lang-admin-arabic"><span>{item.arabic}</span><small>{item.pronunciationArabic || 'لا يوجد نطق مسجل'}</small></div></div>
          {(item.exampleEnglish || item.exampleArabic) && <div className="lang-admin-example"><span dir="ltr">{item.exampleEnglish || '—'}</span><span>{item.exampleArabic || '—'}</span></div>}
          <div className="lang-admin-card-actions"><button type="button" className="button button-outline button-compact" onClick={() => startEdit(item)}><Pencil size={14}/> تعديل</button>
            {item.active ? <button type="button" className="button button-outline button-compact lang-admin-archive-action" disabled={updateItem.isPending} onClick={() => setActive(item, false)}><Archive size={14}/> أرشفة</button> : <button type="button" className="button button-outline button-compact" disabled={updateItem.isPending} onClick={() => setActive(item, true)}><RotateCcw size={14}/> إعادة تفعيل</button>}</div>
        </article>)}</div>}
      {content && content.total > content.pageSize && <nav className="lang-admin-pager" aria-label="صفحات المحتوى">
        <button type="button" className="button button-outline button-compact" disabled={page <= 1} onClick={() => setPage(value => Math.max(1, value - 1))}><ChevronRight size={15}/> السابق</button>
        <span>صفحة {page.toLocaleString('ar')} من {Math.ceil(content.total / content.pageSize).toLocaleString('ar')}</span>
        <button type="button" className="button button-outline button-compact" disabled={page >= Math.ceil(content.total / content.pageSize)} onClick={() => setPage(value => value + 1)}>التالي <ChevronLeft size={15}/></button>
      </nav>}
    </section>
  </section>;
}

function ContentEditor({ item, setItem, isEditing, pending, onSubmit, onCancel }: {
  item: LanguageContentItemInput;
  setItem: (item: LanguageContentItemInput) => void;
  isEditing: boolean;
  pending: boolean;
  onSubmit: (event: FormEvent) => void;
  onCancel: () => void;
}) {
  const update = <K extends keyof LanguageContentItemInput>(key: K, value: LanguageContentItemInput[K]) => setItem({ ...item, [key]: value });
  const field = (key: keyof LanguageContentItemInput, label: string, maxLength: number, required = false, dir?: string) => <label className="lang-admin-field" key={key}>
    <span>{label}{required && <RequiredMark/>}</span><input dir={dir} required={required} maxLength={maxLength} value={String(item[key] ?? '')} onChange={e => update(key, e.target.value as never)}/>
  </label>;
  return <form className="lang-admin-editor" onSubmit={onSubmit}>
    <div className="lang-admin-editor-heading"><div><span className="lang-admin-overline">{isEditing ? 'تحديث المحتوى' : 'عنصر جديد'}</span><h4>{isEditing ? 'تعديل عنصر المنهج' : 'إضافة إلى المكتبة'}</h4></div><button type="button" className="lang-admin-close" aria-label="إغلاق المحرر" onClick={onCancel}><X size={18}/></button></div>
    <div className="lang-admin-editor-grid">
      <label className="lang-admin-field"><span>اللغة</span><select value={item.languageCode} onChange={e => update('languageCode', e.target.value as LanguageContentItemInput['languageCode'])}>{Object.entries(languageNames).map(([code, name]) => <option value={code} key={code}>{name}</option>)}</select></label>
      <label className="lang-admin-field"><span>المستوى</span><select value={item.level} onChange={e => update('level', e.target.value as LanguageContentItemInput['level'])}>{levels.map(value => <option key={value}>{value}</option>)}</select></label>
      <label className="lang-admin-field"><span>النوع</span><select value={item.kind} onChange={e => update('kind', e.target.value as LanguageContentItemInput['kind'])}><option value="word">كلمة</option><option value="sentence">جملة</option></select></label>
      {field('category', 'التصنيف', 80, true)}
      {field('partOfSpeech', 'نوع الكلمة (اختياري)', 40)}
      {field('english', 'النص باللغة المستهدفة', 300, true, 'ltr')}
      {field('arabic', 'المعنى بالعربية', 300, true)}
      {field('pronunciationArabic', 'النطق بالعربية', 200)}
      {field('exampleEnglish', 'مثال باللغة المستهدفة', 500, false, 'ltr')}
      {field('exampleArabic', 'ترجمة المثال', 500)}
      <label className="lang-admin-field"><span>ملاحظة نحوية</span><textarea maxLength={600} rows={2} value={item.grammarNote ?? ''} onChange={e => update('grammarNote', e.target.value)}/></label>
      <label className="lang-admin-field"><span>معرّفات كلمات مرتبطة</span><input maxLength={3629} dir="ltr" value={(item.relatedWordIds ?? []).join(', ')} placeholder="افصل بين المعرّفات بفاصلة" onChange={e => update('relatedWordIds', e.target.value.split(',').map(value => value.trim()).filter(Boolean).slice(0, 30))}/><small>حتى 30 معرّفاً، بحد أقصى 120 حرفاً لكل معرّف.</small></label>
      <label className="lang-admin-field"><span>درجة الصعوبة <b>{item.difficulty}/10</b></span><input type="range" min={1} max={10} value={item.difficulty} onChange={e => update('difficulty', Number(e.target.value))}/></label>
    </div>
    <div className="lang-admin-editor-actions"><button type="button" className="button button-outline button-compact" onClick={onCancel}>إلغاء</button><button type="submit" className="button button-primary" disabled={pending}><Check size={15}/>{pending ? 'جارٍ الحفظ…' : isEditing ? 'حفظ التعديل' : 'إضافة العنصر'}</button></div>
  </form>;
}
