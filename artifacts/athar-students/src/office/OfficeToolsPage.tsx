import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link as RouterLink } from 'wouter';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Color from '@tiptap/extension-color';
import FontFamily from '@tiptap/extension-font-family';
import { TextStyle } from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import { AlignmentType, Document as WordDocument, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import {
  AlignCenter, AlignLeft, AlignRight, ArrowDownToLine, Bold, Check, ChevronDown,
  Clipboard, FileSpreadsheet, FileText, Heading1, Heading2, Highlighter, Italic,
  List, ListOrdered, LockKeyhole, Plus, RefreshCw, Rows3, Save, Sheet, Trash2,
  Underline as UnderlineIcon, X,
} from 'lucide-react';
import {
  getListStudentOfficeFilesQueryKey, useCreateStudentOfficeFile, useDeleteStudentOfficeFile,
  useListStudentOfficeFiles, useUpdateStudentOfficeFile,
} from '@workspace/api-client-react';
import type { StudentOfficeFile, StudentOfficeFileInput } from '@workspace/api-client-react';
import { NamedColorPicker } from '../components/NamedColorPicker';
import { addressParts, cellAddress, colName, evaluateFormula, type CellStyle } from './spreadsheet-utils';
import './office-tools.css';

type SheetData = { id: string; name: string; rows: number; columns: number; cells: Record<string, CellStyle> };
type WorkbookData = { version: 1; sheets: SheetData[] };
type SaveState = 'idle'|'saving'|'saved'|'error';
type OfficeKind = StudentOfficeFile['kind'];

const FONT_OPTIONS = [
  { label:'IBM Plex Arabic', value:'IBM Plex Sans Arabic' }, { label:'Cairo', value:'Cairo' },
  { label:'Georgia', value:'Georgia' }, { label:'DM Sans', value:'DM Sans' },
];
const FONT_SIZE_OPTIONS = ['12','14','16','18','22','28','32'];
const FontStyleExtension = TextStyle.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fontSize:{
        default:null,
        parseHTML:(element:HTMLElement) => element.style.fontSize || null,
        renderHTML:(attributes:Record<string,unknown>) => attributes.fontSize ? { style:`font-size:${String(attributes.fontSize)}` } : {},
      },
    };
  },
});

const emptyDoc = () => ({ type:'doc', content:[{ type:'paragraph' }] });
function newSheet(): SheetData {
  return { id: `sheet-${Date.now()}`, name:'ورقة ١', rows:12, columns:8, cells:{} };
}
function blankWorkbook(): WorkbookData { return { version:1, sheets:[newSheet()] }; }
function parseWorkbook(content: string): WorkbookData {
  try {
    const value = JSON.parse(content) as WorkbookData;
    if (value?.version === 1 && Array.isArray(value.sheets) && value.sheets.length) return value;
  } catch { /* malformed legacy content is repaired as a blank workbook */ }
  return blankWorkbook();
}
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
  URL.revokeObjectURL(url);
}
function safeFilename(value: string) { return (value.trim() || 'ملف').replace(/[\\/:*?"<>|]/g,'-'); }
function friendlyDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? 'تم إنشاؤه' : new Intl.DateTimeFormat('ar-SA',{ day:'numeric', month:'short' }).format(date);
}
function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'تعذّر إكمال العملية. حاول مرة أخرى.';
}
function colorTextRuns(nodes: unknown[]): TextRun[] {
  return nodes.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const node = item as { type?:string; text?:string; marks?:{type:string;attrs?:Record<string,unknown>}[]; content?:unknown[] };
    if (node.type !== 'text') return [];
    const marks = node.marks ?? [];
    const color = marks.find(mark => mark.type === 'textStyle')?.attrs?.color;
    return [new TextRun({ text:node.text ?? '', bold:marks.some(mark => mark.type === 'bold'), italics:marks.some(mark => mark.type === 'italic'), underline:marks.some(mark => mark.type === 'underline') ? {} : undefined, color:typeof color === 'string' ? color.replace('#','') : undefined })];
  });
}
function docxParagraphs(json: Record<string, unknown>): Paragraph[] {
  const content = Array.isArray(json.content) ? json.content as Record<string, unknown>[] : [];
  return content.map((node) => {
    const children = Array.isArray(node.content) ? node.content : [];
    const type = String(node.type ?? '');
    const align = (node.attrs as { textAlign?:string }|undefined)?.textAlign;
    const alignment = align === 'center' ? AlignmentType.CENTER : align === 'right' ? AlignmentType.RIGHT : align === 'left' ? AlignmentType.LEFT : undefined;
    if (type === 'bulletList' || type === 'orderedList') return new Paragraph({ children:children.flatMap((li:unknown) => {
      const item = li as { content?:{content?:unknown[]}[] };
      return (item.content ?? []).flatMap(paragraph => colorTextRuns((paragraph as {content?:unknown[]}).content ?? []));
    }), bullet:type === 'bulletList' ? { level:0 } : undefined, numbering:type === 'orderedList' ? { reference:'office-numbering', level:0 } : undefined, alignment });
    const heading = (node.attrs as { level?:number }|undefined)?.level;
    return new Paragraph({
      children:colorTextRuns(children),
      heading:type === 'heading' ? heading === 1 ? HeadingLevel.HEADING_1 : heading === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3 : undefined,
      alignment,
    });
  });
}

export default function OfficeToolsPage() {
  const queryClient = useQueryClient();
  const filesQuery = useListStudentOfficeFiles({ query:{ queryKey:getListStudentOfficeFilesQueryKey() } });
  const createFile = useCreateStudentOfficeFile();
  const updateFile = useUpdateStudentOfficeFile();
  const deleteFile = useDeleteStudentOfficeFile();
  const [activeId,setActiveId] = useState<string|null>(null);
  const [title,setTitle] = useState('');
  const [content,setContent] = useState('');
  const [saveState,setSaveState] = useState<SaveState>('idle');
  const [selectedCell,setSelectedCell] = useState('A1');
  const [cellDraft,setCellDraft] = useState('');
  const [activeSheetId,setActiveSheetId] = useState('');
  const [operationError,setOperationError] = useState('');
  const activeIdRef = useRef<string|null>(null);
  const titleRef = useRef(title);
  const contentRef = useRef(content);
  const savedRef = useRef({ fileId:'', title:'', content:'' });
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const timerRef = useRef<ReturnType<typeof setTimeout>|null>(null);
  const files = (filesQuery.data ?? []) as StudentOfficeFile[];
  const activeFile = files.find(file => file.id === activeId) ?? null;
  const currentKind: OfficeKind | null = activeFile?.kind ?? null;
  const workbook = useMemo(() => currentKind === 'spreadsheet' ? parseWorkbook(content) : null, [content,currentKind]);
  const activeSheet = workbook?.sheets.find(sheet => sheet.id === activeSheetId) ?? workbook?.sheets[0] ?? null;
  const selectedValue = activeSheet?.cells[selectedCell]?.value ?? '';

  useEffect(() => { titleRef.current = title; },[title]);
  useEffect(() => { contentRef.current = content; },[content]);
  useEffect(() => {
    if (!workbook?.sheets.length) return;
    if (!workbook.sheets.some(sheet => sheet.id === activeSheetId)) setActiveSheetId(workbook.sheets[0].id);
  },[workbook,activeSheetId]);
  useEffect(() => { setCellDraft(selectedValue); },[selectedValue,activeId,activeSheetId,selectedCell]);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); },[]);

  const flushSave = useCallback(async (
    id = activeIdRef.current,
    snapshot = { title:titleRef.current.trim() || 'مستند جديد', content:contentRef.current },
  ) => {
    if (!id) return;
    const task = saveQueueRef.current.then(async () => {
      if (savedRef.current.fileId === id && snapshot.title === savedRef.current.title && snapshot.content === savedRef.current.content) {
        return false;
      }
      if (activeIdRef.current === id) { setSaveState('saving'); setOperationError(''); }
      try {
        const updated = await updateFile.mutateAsync({ id, data:snapshot });
        queryClient.setQueryData<StudentOfficeFile[]>(getListStudentOfficeFilesQueryKey(), old => {
          const current = old ?? [];
          return current.some(file => file.id === id)
            ? current.map(file => file.id === id ? updated as StudentOfficeFile : file)
            : [updated as StudentOfficeFile, ...current];
        });
        if (savedRef.current.fileId === id) savedRef.current = { fileId:id, ...snapshot };
        if (activeIdRef.current === id) setSaveState('saved');
        return true;
      } catch (error) {
        if (activeIdRef.current === id) { setSaveState('error'); setOperationError(errorMessage(error)); }
        return false;
      }
    });
    saveQueueRef.current = task.then(() => undefined, () => undefined);
    const saved = await task;
    if (saved && activeIdRef.current === id
      && ((titleRef.current.trim() || 'مستند جديد') !== snapshot.title || contentRef.current !== snapshot.content)) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => { void flushRef.current(id); }, 250);
    }
  },[queryClient,updateFile]);
  const flushRef = useRef(flushSave);
  flushRef.current = flushSave;
  useEffect(() => {
    if (!activeId || !activeFile) return;
    if (savedRef.current.fileId === activeId && title.trim() === savedRef.current.title && content === savedRef.current.content) return;
    setSaveState('idle');
    if (timerRef.current) clearTimeout(timerRef.current);
    const snapshot = { title:title.trim() || 'مستند جديد', content };
    timerRef.current = setTimeout(() => { void flushRef.current(activeId, snapshot); },750);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  },[activeId,activeFile,title,content]);

  const openFile = (file: StudentOfficeFile) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const previousId = activeIdRef.current;
    if (previousId && (savedRef.current.fileId !== previousId
      || savedRef.current.title !== (titleRef.current.trim() || 'مستند جديد')
      || savedRef.current.content !== contentRef.current)) {
      void flushRef.current(previousId, {
        title:titleRef.current.trim() || 'مستند جديد',
        content:contentRef.current,
      });
    }
    activeIdRef.current = file.id;
    setActiveId(file.id); setTitle(file.title); setContent(file.content);
    titleRef.current = file.title; contentRef.current = file.content;
    savedRef.current = { fileId:file.id, title:file.title, content:file.content };
    setSaveState('saved'); setOperationError('');
    const parsed = file.kind === 'spreadsheet' ? parseWorkbook(file.content) : null;
    if (parsed) setActiveSheetId(parsed.sheets[0].id);
    setSelectedCell('A1');
  };
  const create = async (kind: OfficeKind) => {
    setOperationError('');
    const initial = kind === 'document' ? JSON.stringify(emptyDoc()) : JSON.stringify(blankWorkbook());
    const input: StudentOfficeFileInput = { title:kind === 'document' ? 'مستند بدون عنوان' : 'جدول بيانات جديد', kind, content:initial };
    try {
      const file = await createFile.mutateAsync({ data:input });
      await queryClient.invalidateQueries({ queryKey:getListStudentOfficeFilesQueryKey() });
      openFile(file as StudentOfficeFile);
    } catch (error) { setOperationError(errorMessage(error)); }
  };
  const removeFile = async (file: StudentOfficeFile) => {
    if (!window.confirm(`هل تريد حذف «${file.title}» نهائياً؟`)) return;
    const removingActiveFile = activeIdRef.current === file.id;
    if (removingActiveFile && timerRef.current) clearTimeout(timerRef.current);
    try {
      await deleteFile.mutateAsync({ id:file.id });
      queryClient.setQueryData<StudentOfficeFile[]>(getListStudentOfficeFilesQueryKey(), old => (old ?? []).filter(item => item.id !== file.id));
      if (removingActiveFile) {
        activeIdRef.current=null; setActiveId(null); setTitle(''); setContent(''); setSaveState('idle');
        titleRef.current=''; contentRef.current=''; savedRef.current={ fileId:'', title:'', content:'' };
      }
    } catch (error) { setOperationError(errorMessage(error)); }
  };
  const setContentValue = (value:string) => { setContent(value); contentRef.current=value; };
  const editor = useEditor({
    extensions:[
      StarterKit, FontStyleExtension, Color, FontFamily, Underline, Highlight.configure({ multicolor:true }),
      TextAlign.configure({ types:['heading','paragraph'] }),
      Link.configure({ openOnClick:false, autolink:true }),
      Table.configure({ resizable:true }), TableRow, TableHeader, TableCell,
    ],
    content:emptyDoc(),
    onUpdate:({ editor:instance }) => { setContentValue(JSON.stringify(instance.getJSON())); },
    editorProps:{ attributes:{ dir:'rtl', 'aria-label':'محرر المستند', 'data-testid':'office-document-editor' } },
  });
  useEffect(() => {
    if (!editor || !activeFile || activeFile.kind !== 'document') return;
    try { editor.commands.setContent(JSON.parse(content || '{}')); }
    catch { editor.commands.setContent(emptyDoc()); }
  },[editor,activeId]);

  const setWorkbook = (next:WorkbookData) => setContentValue(JSON.stringify(next));
  const changeCell = (value:string) => {
    if (!workbook || !activeSheet) return;
    const nextSheet = { ...activeSheet, cells:{ ...activeSheet.cells, [selectedCell]:{ ...activeSheet.cells[selectedCell], value } } };
    setWorkbook({ ...workbook, sheets:workbook.sheets.map(sheet => sheet.id === activeSheet.id ? nextSheet : sheet) });
  };
  const changeCellAt = (address:string,value:string) => {
    if (!workbook || !activeSheet) return;
    const nextSheet = { ...activeSheet, cells:{ ...activeSheet.cells, [address]:{ ...activeSheet.cells[address], value } } };
    setWorkbook({ ...workbook, sheets:workbook.sheets.map(sheet => sheet.id === activeSheet.id ? nextSheet : sheet) });
    if (selectedCell === address) setCellDraft(value);
  };
  const updateSelectedCell = (patch:Partial<CellStyle>) => {
    if (!workbook || !activeSheet) return;
    const current = activeSheet.cells[selectedCell] ?? { value:'' };
    const nextSheet = { ...activeSheet, cells:{ ...activeSheet.cells, [selectedCell]:{ ...current, ...patch } } };
    setWorkbook({ ...workbook, sheets:workbook.sheets.map(sheet => sheet.id === activeSheet.id ? nextSheet : sheet) });
  };
  const addRows = () => { if (workbook && activeSheet) setWorkbook({ ...workbook, sheets:workbook.sheets.map(sheet => sheet.id === activeSheet.id ? { ...sheet, rows:Math.min(100,sheet.rows+5) } : sheet) }); };
  const addColumns = () => { if (workbook && activeSheet) setWorkbook({ ...workbook, sheets:workbook.sheets.map(sheet => sheet.id === activeSheet.id ? { ...sheet, columns:Math.min(26,sheet.columns+2) } : sheet) }); };

  const exportDocument = async () => {
    try {
      const json = JSON.parse(content || '{}') as Record<string,unknown>;
      const document = new WordDocument({ sections:[{ properties:{}, children:docxParagraphs(json) }], numbering:{ config:[{ reference:'office-numbering', levels:[{ level:0, format:'decimal', text:'%1.', alignment:AlignmentType.START, style:{ paragraph:{ indent:{ left:720, hanging:260 } } } }] }] } });
      downloadBlob(await Packer.toBlob(document),`${safeFilename(title)}.docx`);
    } catch (error) { setOperationError(`تعذّر تصدير المستند: ${errorMessage(error)}`); }
  };
  const exportWorkbook = async () => {
    if (!workbook) return;
    try {
      const { default: ExcelJS } = await import('exceljs');
      const book = new ExcelJS.Workbook();
      for (const sheet of workbook.sheets) {
        const ws = book.addWorksheet(sheet.name.slice(0,31));
        ws.columns = Array.from({length:sheet.columns},(_,index) => ({ header:colName(index), key:colName(index), width:16 }));
        for (let row=0; row<sheet.rows; row++) for (let col=0; col<sheet.columns; col++) {
          const address = cellAddress(row,col); const data = sheet.cells[address];
          if (!data) continue;
          const cell = ws.getCell(row+1,col+1);
          if (data.value.startsWith('=')) cell.value = { formula:data.value.slice(1) };
          else if (data.value.trim() && Number.isFinite(Number(data.value))) cell.value = Number(data.value);
          else cell.value = data.value;
          if (data.bold) cell.font = { bold:true };
          if (data.textColor) cell.font = { ...cell.font, color:{ argb:`FF${data.textColor.replace('#','')}` } };
          if (data.backgroundColor) cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:`FF${data.backgroundColor.replace('#','')}` } };
          if (data.textAlign) cell.alignment = { horizontal:data.textAlign };
        }
      }
      const bytes = await book.xlsx.writeBuffer();
      downloadBlob(new Blob([bytes],{ type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),`${safeFilename(title)}.xlsx`);
    } catch (error) { setOperationError(`تعذّر تصدير جدول البيانات: ${errorMessage(error)}`); }
  };

  const activeCell = activeSheet?.cells[selectedCell] ?? { value:'' };
  const displayedSave = saveState === 'saving' ? 'جارٍ الحفظ' : saveState === 'saved' ? 'تم الحفظ' : saveState === 'error' ? 'لم يُحفظ' : 'تُحفظ التعديلات تلقائياً';
  const selectCell = (address:string) => { setSelectedCell(address); setCellDraft(activeSheet?.cells[address]?.value ?? ''); };
  const setColorOnDocument = (color:string) => { editor?.chain().focus().setColor(color).run(); };
  const applyCellColor = (color:string, field:'textColor'|'backgroundColor') => { updateSelectedCell({ [field]:color }); };
  const buildSpreadsheetValue = (address:string) => {
    if (!activeSheet) return '';
    const raw = activeSheet.cells[address]?.value ?? '';
    return raw.startsWith('=') ? evaluateFormula(raw,activeSheet.cells) : raw;
  };
  const renderToolbar = () => <div className="office-toolbar" aria-label="أدوات التنسيق" data-testid="office-format-toolbar">
    <button type="button" className={`office-tool-button ${(currentKind==='document'?editor?.isActive('bold'):activeCell.bold)?'is-active':''}`} title="عريض" aria-label="عريض" onClick={() => currentKind==='document'?editor?.chain().focus().toggleBold().run():updateSelectedCell({bold:!activeCell.bold})} data-testid="button-format-bold"><Bold size={15}/></button>
    <button type="button" className={`office-tool-button ${editor?.isActive('italic')?'is-active':''}`} title="مائل" aria-label="مائل" onClick={() => editor?.chain().focus().toggleItalic().run()} data-testid="button-format-italic"><Italic size={15}/></button>
    <button type="button" className={`office-tool-button ${editor?.isActive('underline')?'is-active':''}`} title="تحته خط" aria-label="تحته خط" onClick={() => editor?.chain().focus().toggleUnderline().run()} data-testid="button-format-underline"><UnderlineIcon size={15}/></button>
    <span className="office-tool-divider"/>
    <select aria-label="نمط العنوان" value={editor?.isActive('heading',{level:1})?'h1':editor?.isActive('heading',{level:2})?'h2':'p'} onChange={event => {
      const value=event.target.value;
      if (value==='h1') editor?.chain().focus().toggleHeading({level:1}).run();
      else if (value==='h2') editor?.chain().focus().toggleHeading({level:2}).run();
      else editor?.chain().focus().setParagraph().run();
    }} data-testid="select-heading-style"><option value="p">نص عادي</option><option value="h1">عنوان رئيسي</option><option value="h2">عنوان فرعي</option></select>
    <button type="button" className="office-tool-button" title="قائمة نقطية" aria-label="قائمة نقطية" onClick={() => editor?.chain().focus().toggleBulletList().run()} data-testid="button-format-bullets"><List size={15}/></button>
    <button type="button" className="office-tool-button" title="قائمة مرقمة" aria-label="قائمة مرقمة" onClick={() => editor?.chain().focus().toggleOrderedList().run()} data-testid="button-format-numbered"><ListOrdered size={15}/></button>
    <span className="office-tool-divider"/>
    <button type="button" className="office-tool-button" title="محاذاة لليمين" aria-label="محاذاة لليمين" onClick={() => currentKind==='document'?editor?.chain().focus().setTextAlign('right').run():updateSelectedCell({textAlign:'right'})} data-testid="button-align-right"><AlignRight size={15}/></button>
    <button type="button" className="office-tool-button" title="توسيط" aria-label="توسيط" onClick={() => currentKind==='document'?editor?.chain().focus().setTextAlign('center').run():updateSelectedCell({textAlign:'center'})} data-testid="button-align-center"><AlignCenter size={15}/></button>
    <button type="button" className="office-tool-button" title="محاذاة لليسار" aria-label="محاذاة لليسار" onClick={() => currentKind==='document'?editor?.chain().focus().setTextAlign('left').run():updateSelectedCell({textAlign:'left'})} data-testid="button-align-left"><AlignLeft size={15}/></button>
    {currentKind==='document' && <select aria-label="نوع الخط" defaultValue="IBM Plex Sans Arabic" onChange={event => editor?.chain().focus().setFontFamily(event.target.value).run()} data-testid="select-font-family">
      {FONT_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>}
    {currentKind==='document' && <select aria-label="حجم الخط" defaultValue="14" onChange={event => editor?.chain().focus().setMark('textStyle',{fontSize:`${event.target.value}px`}).run()} data-testid="select-font-size">
      {FONT_SIZE_OPTIONS.map(size => <option key={size} value={size}>{size}</option>)}
    </select>}
    {currentKind==='document' ? <div className="office-swatch-set" role="group" aria-label="ألوان النص">
      <NamedColorPicker label="لون النص" value={editor?.getAttributes('textStyle').color ?? '#27384B'} onChange={setColorOnDocument} testId="office-text-color"/>
      <NamedColorPicker label="لون التمييز" value={editor?.getAttributes('highlight').color ?? '#FFF3A6'} onChange={color => editor?.chain().focus().toggleHighlight({color}).run()} testId="office-highlight-color"/>
      <button type="button" className={`office-tool-button ${editor?.isActive('highlight')?'is-active':''}`} title="إزالة التمييز" aria-label="إزالة التمييز" onClick={() => editor?.chain().focus().unsetHighlight().run()} data-testid="button-format-highlight"><Highlighter size={15}/></button>
    </div> : <div className="office-swatch-set" role="group" aria-label="ألوان الخلية">
      <NamedColorPicker label="لون النص" value={activeCell.textColor ?? '#1F2937'} onChange={color => applyCellColor(color,'textColor')} testId="office-cell-text-color"/>
      <NamedColorPicker label="لون التعبئة" value={activeCell.backgroundColor ?? '#FFFFFF'} onChange={color => applyCellColor(color,'backgroundColor')} testId="office-cell-fill-color"/>
    </div>}
  </div>;

  return <main className="office-workspace" dir="rtl" data-testid="office-workspace">
    <header className="office-head">
      <div><span className="office-overline"><i/> مساحة أدوات الطالب</span><h1>مساحة الكتابة والجداول</h1><p>اكتب فكرة، رتّب خطة، أو احسبها ببساطة.</p></div>
      <div className="office-private"><LockKeyhole size={15}/> ملفاتك خاصة بك</div>
    </header>
    {operationError && <div className="office-state-card office-error" role="alert" data-testid="office-operation-error">{operationError}</div>}
    <div className="office-layout">
      <aside className="office-library" aria-label="ملفاتي">
        <div className="office-library-head">
          <div className="office-library-title"><h2>ملفاتي</h2><span>{files.length}</span></div>
          <p>مساحة خاصة للكتابة والتنظيم</p>
          <div className="office-create-actions">
            <button type="button" className="office-btn office-btn-primary" onClick={() => void create('document')} disabled={createFile.isPending} data-testid="button-create-document"><FileText size={15}/> مستند جديد</button>
            <button type="button" className="office-btn" onClick={() => void create('spreadsheet')} disabled={createFile.isPending} data-testid="button-create-spreadsheet"><FileSpreadsheet size={15}/> جدول جديد</button>
          </div>
        </div>
        {filesQuery.isLoading ? <div className="office-file-list" aria-label="جارٍ تحميل الملفات" data-testid="office-files-loading"><div className="office-skeleton"/><div className="office-skeleton"/><div className="office-skeleton"/></div>
          : filesQuery.isError ? <div className="office-state-card office-error" role="alert" data-testid="office-files-error">تعذّر تحميل ملفاتك.<br/><button className="office-btn" type="button" onClick={() => void filesQuery.refetch()} data-testid="button-retry-files"><RefreshCw size={13}/> حاول مجدداً</button></div>
          : files.length ? <div className="office-file-list" data-testid="office-files-list">{files.map(file => <div key={file.id} className={`office-file ${activeId===file.id?'office-file-active':''}`} data-testid={`office-file-${file.id}`}>
            <button type="button" className="office-file-open" onClick={() => openFile(file)} aria-current={activeId===file.id?'page':undefined} data-testid={`button-open-file-${file.id}`}>
              <span className={`office-file-icon ${file.kind==='spreadsheet'?'sheet':''}`}>{file.kind==='spreadsheet'?<Sheet size={17}/>:<FileText size={17}/>}</span>
              <span className="office-file-copy"><b>{file.title}</b><small>{file.kind==='document'?'مستند':'جدول بيانات'} · {friendlyDate(file.updatedAt)}</small></span>
            </button>
            <button type="button" className="office-delete" aria-label={`حذف ${file.title}`} title="حذف الملف" onClick={() => void removeFile(file)} data-testid={`button-delete-file-${file.id}`}><Trash2 size={14}/></button>
          </div>)}</div>
          : <div className="office-empty-library" data-testid="office-files-empty"><FileText size={20}/>لم تحفظ أي ملفات بعد.<br/>ابدأ بمستند أو جدول جديد.</div>}
        <div className="office-resume-card">
          <b>تجهّز لسيرتك؟</b>
          <p>ابدأ بقالب بسيط من عمود واحد، ملائم لسهولة القراءة الآلية. لا يضمن اجتياز أي نظام فرز.</p>
          <div className="office-ats-info">
            <RouterLink href="/resume-templates" className="office-ats-link" data-testid="link-ats-resume-builder">قالب سيرة ATS أحادي العمود <ArrowDownToLine size={13}/></RouterLink>
            <small>تنسيق واضح يساعد أنظمة الفرز على قراءة السيرة؛ لا يضمن اجتياز كل نظام.</small>
          </div>
        </div>
      </aside>
      <section className="office-workbench" aria-label="محرر الملفات">
        {activeFile ? <>
          <div className="office-editor-top">
            <div className="office-title-wrap">
              <input className="office-title-input" aria-label="اسم الملف" value={title} maxLength={120} onChange={event => { setTitle(event.target.value); titleRef.current=event.target.value; }} data-testid="input-office-title"/>
              <span className={`office-save-state ${saveState}`} role="status" aria-live="polite" data-testid="office-save-status">{saveState==='saved'?<Check size={12}/>:saveState==='saving'?<Save size={12}/>:saveState==='error'?<X size={12}/>:null}{displayedSave}</span>
            </div>
            <div className="office-editor-actions">
              <button type="button" className="office-btn" onClick={() => currentKind==='document'?void exportDocument():void exportWorkbook()} data-testid="button-export-office-file"><ArrowDownToLine size={15}/><span>تصدير {currentKind==='document'?'.docx':'.xlsx'}</span></button>
              {saveState==='error' && <button type="button" className="office-icon-button" title="إعادة المحاولة" aria-label="إعادة حفظ التغييرات" onClick={() => void flushSave()} data-testid="button-retry-save"><RefreshCw size={15}/></button>}
            </div>
          </div>
          {renderToolbar()}
          {currentKind==='document' ? <div className="office-editor-canvas" data-testid="office-document-canvas"><div className="office-page"><EditorContent editor={editor}/></div></div>
            : <div className="office-grid-shell" data-testid="office-spreadsheet-canvas">
              <div className="office-formula-bar"><span className="office-cell-ref" data-testid="text-selected-cell">{selectedCell}</span><span className="office-formula-mark">fx</span><input className="office-cell-input" value={cellDraft} aria-label={`قيمة الخلية ${selectedCell}`} onChange={event => setCellDraft(event.target.value)} onBlur={() => changeCell(cellDraft)} onKeyDown={event => { if (event.key==='Enter') { changeCell(cellDraft); const parts=addressParts(selectedCell); if(parts) selectCell(cellAddress(parts.row+1,parts.col)); } }} data-testid="input-cell-value"/></div>
              <div className="office-grid-scroll"><table className="office-sheet" aria-label="جدول البيانات"><thead><tr><th className="row-heading"/>{Array.from({length:activeSheet?.columns ?? 0},(_,col)=><th key={col}>{colName(col)}</th>)}</tr></thead>
                <tbody>{Array.from({length:activeSheet?.rows ?? 0},(_,row)=><tr key={row}><th className="row-heading">{row+1}</th>{Array.from({length:activeSheet?.columns ?? 0},(_,col)=>{
                  const address=cellAddress(row,col); const cell=activeSheet?.cells[address] ?? {value:''}; const selected=selectedCell===address;
                  return <td key={col} className={selected?'selected':''} style={{backgroundColor:cell.backgroundColor,color:cell.textColor,fontWeight:cell.bold?'700':undefined,fontStyle:cell.italic?'italic':undefined,textAlign:cell.textAlign}} onClick={() => selectCell(address)} data-testid={`cell-${address}`}>
                    <input value={selected?cellDraft:buildSpreadsheetValue(address)} aria-label={`الخلية ${address}`} onFocus={() => selectCell(address)} onChange={event => changeCellAt(address,event.target.value)} onBlur={() => { if(selected) changeCell(cellDraft); }} onKeyDown={event => { if(event.key==='Enter'){ if(selected) changeCell(cellDraft); const p=addressParts(address); if(p) selectCell(cellAddress(p.row+1,p.col)); } }} data-testid={`input-cell-${address}`}/>
                  </td>;
                })}</tr>)}</tbody></table></div>
              <div className="office-sheet-tabs"><span className="office-sheet-tab">{activeSheet?.name ?? 'ورقة ١'}</span><button type="button" className="office-icon-button" aria-label="إضافة صفوف" title="إضافة ٥ صفوف" onClick={addRows} disabled={!activeSheet || activeSheet.rows >= 100} data-testid="button-add-rows"><Rows3 size={15}/></button><button type="button" className="office-icon-button" aria-label="إضافة أعمدة" title="إضافة عمودين" onClick={addColumns} disabled={!activeSheet || activeSheet.columns >= 26} data-testid="button-add-columns"><Plus size={15}/></button><span className="office-sheet-note">الصيغ تبدأ بعلامة =، مثل =SUM(A1:A4)</span></div>
            </div>}
          <footer className="office-status"><span className="status-ok"><LockKeyhole size={12}/> يُحفظ هذا الملف في مساحتك الخاصة</span><span>{currentKind==='spreadsheet'?'يمكن استخدام مراجع الخلايا والعمليات الحسابية الأساسية':'اكتب بحرية؛ التغييرات تحفظ تلقائياً'}</span></footer>
        </> : <div className="office-first-state" data-testid="office-editor-empty"><div className="office-first-state-inner"><span className="office-first-art"><Clipboard size={29}/></span><h2>مساحة تبدأ من فكرتك</h2><p>أنشئ مستنداً للملاحظات والواجبات، أو جدولاً لترتيب الأرقام والخطط. ملفاتك تبقى خاصة بك.</p><div className="office-create-actions"><button type="button" className="office-btn office-btn-primary" onClick={() => void create('document')} disabled={createFile.isPending} data-testid="button-empty-create-document"><FileText size={15}/> اكتب مستنداً</button><button type="button" className="office-btn" onClick={() => void create('spreadsheet')} disabled={createFile.isPending} data-testid="button-empty-create-spreadsheet"><FileSpreadsheet size={15}/> أنشئ جدولاً</button></div></div></div>}
      </section>
    </div>
  </main>;
}
