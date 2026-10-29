import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '@clerk/react';
import { LoaderCircle, Mic, MicOff, RotateCcw, Send, Volume2 } from 'lucide-react';
import { languageLabels, languageLocales } from '../content/sample-a1';
import type { SupportedLanguageCode } from '../content/sample-a1';

type Turn = { role: 'user' | 'assistant'; text: string };
type RecognitionResult = { results: ArrayLike<ArrayLike<{ transcript: string }>> };
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: RecognitionResult) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type RecognitionConstructor = new () => Recognition;
type VoiceWindow = Window & {
  SpeechRecognition?: RecognitionConstructor;
  webkitSpeechRecognition?: RecognitionConstructor;
};

const levelOptions = ['A1', 'A2', 'B1', 'B2'] as const;
const scenarioOptions = [
  { value: 'introduction', label: 'التعارف والتعريف بالنفس' },
  { value: 'work_interview', label: 'مقابلة عمل' },
  { value: 'travel', label: 'السفر وطلب المساعدة' },
  { value: 'study', label: 'الدراسة والعمل ضمن فريق' },
] as const;

function pcmWavUrl(chunks: string[]): string | null {
  if (!chunks.length) return null;
  try {
    const raw = atob(chunks.join(''));
    const pcm = Uint8Array.from(raw, character => character.charCodeAt(0));
    const length = pcm.length;
    const bytes = new Uint8Array(44 + length);
    const view = new DataView(bytes.buffer);
    const write = (offset: number, value: string) => {
      for (let index = 0; index < value.length; index++) bytes[offset + index] = value.charCodeAt(index);
    };
    write(0, 'RIFF');
    view.setUint32(4, 36 + length, true);
    write(8, 'WAVE');
    write(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, 24_000, true);
    view.setUint32(28, 48_000, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    write(36, 'data');
    view.setUint32(40, length, true);
    bytes.set(pcm, 44);
    return URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
  } catch {
    return null;
  }
}

export function LanguageConversationPanel({ languageCode }: { languageCode: SupportedLanguageCode }) {
  const { getToken } = useAuth();
  const recognitionRef = useRef<Recognition | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [level, setLevel] = useState<(typeof levelOptions)[number]>('A1');
  const [scenario, setScenario] = useState<(typeof scenarioOptions)[number]['value']>('introduction');
  const [consent, setConsent] = useState(false);
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [recognitionNote, setRecognitionNote] = useState('');
  const [error, setError] = useState('');
  const [messages, setMessages] = useState<Turn[]>([]);
  const [audioUrl, setAudioUrl] = useState('');

  useEffect(() => () => {
    recognitionRef.current?.stop();
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
  }, []);

  const startRecognition = () => {
    setError('');
    const browser = window as VoiceWindow;
    const RecognitionApi = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
    if (!RecognitionApi) {
      setRecognitionNote('التعرّف الصوتي غير متاح في هذا المتصفح؛ اكتب إجابتك في الحقل.');
      return;
    }
    recognitionRef.current?.stop();
    const recognition = new RecognitionApi();
    recognition.lang = languageLocales[languageCode];
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = event => {
      const transcript = Array.from(event.results)
        .map(result => result[0]?.transcript ?? '')
        .join(' ')
        .trim();
      if (transcript) {
        setMessage(transcript);
        setRecognitionNote('تم تحويل كلامك إلى نص. راجعه ثم أرسله للمحادثة.');
      }
    };
    recognition.onerror = () => {
      setRecognitionNote('لم أستطع التقاط الكلام. تحقق من إذن الميكروفون أو اكتب إجابتك.');
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    setRecognitionNote('استمع الآن… تكلّم بجملة قصيرة باللغة التي تتعلمها.');
    try {
      recognition.start();
    } catch {
      setListening(false);
      setRecognitionNote('تعذّر بدء الميكروفون. حاول مرة أخرى أو اكتب إجابتك.');
    }
  };

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    const text = message.trim();
    if (!consent) {
      setError('وافق على معالجة النص قبل بدء المحادثة.');
      return;
    }
    if (!text || busy) return;

    setError('');
    setRecognitionNote('');
    setMessage('');
    setBusy(true);
    const history = messages.slice(-6).map(turn => ({ ...turn, text: turn.text.slice(0, 400) }));
    setMessages(previous => [...previous, { role: 'user', text }]);
    const audioChunks: string[] = [];
    let reply = '';
    try {
      const token = await getToken();
      const response = await fetch('/api/languages/voice-conversation', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ languageCode, level, scenario, history, message: text }),
      });
      if (!response.ok || !response.body) {
        throw new Error(response.status === 429 ? 'انتظر قليلًا قبل المحاولة مجددًا.' : 'تعذّر بدء المحادثة. حاول مرة أخرى.');
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamError = '';
      const consumeFrame = (frame: string) => {
        const data = frame.split(/\r?\n/).find(line => line.startsWith('data: '))?.slice(6);
        if (!data) return;
        const part = JSON.parse(data) as { type: string; data?: string };
        if (part.type === 'transcript' && part.data) reply += part.data;
        else if (part.type === 'audio' && part.data) audioChunks.push(part.data);
        else if (part.type === 'error' && part.data) streamError = part.data;
        else if (part.type === 'empty') streamError = 'لم يصل رد صوتي. أعد المحاولة.';
      };
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const frames = buffer.split(/\r?\n\r?\n/);
        buffer = frames.pop() ?? '';
        frames.forEach(consumeFrame);
        if (done) break;
      }
      if (buffer.trim()) consumeFrame(buffer);
      if (streamError) throw new Error(streamError);
      if (!reply.trim()) throw new Error('لم يصل رد واضح. أعد المحاولة.');
      setMessages(previous => [...previous, { role: 'assistant', text: reply.trim() }]);
      const nextAudioUrl = pcmWavUrl(audioChunks);
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = nextAudioUrl;
      setAudioUrl(nextAudioUrl ?? '');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذّر إكمال المحادثة.');
    } finally {
      setBusy(false);
    }
  };

  const resetConversation = () => {
    recognitionRef.current?.stop();
    setMessages([]);
    setMessage('');
    setError('');
    setRecognitionNote('');
    setAudioUrl('');
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = null;
  };

  return (
    <section className="ls-voice-card" aria-labelledby="ls-voice-title">
      <div className="ls-voice-heading">
        <div className="ls-voice-mark"><Volume2 size={19}/></div>
        <div>
          <span className="ls-eyebrow">تدريب تفاعلي</span>
          <h2 id="ls-voice-title">محادثة صوتية قصيرة</h2>
          <p>تحدّث باللغة التي تتعلمها، واستمع إلى رد قصير مع تصحيح لطيف عند الحاجة.</p>
        </div>
        <button className="ls-secondary" type="button" onClick={() => setExpanded(value => !value)}>
          {expanded ? 'إغلاق' : 'ابدأ المحادثة'}
        </button>
      </div>
      {expanded && <div className="ls-voice-body">
        <div className="ls-voice-controls">
          <label>المستوى<select value={level} onChange={event => setLevel(event.target.value as typeof level)}>{levelOptions.map(item => <option key={item}>{item}</option>)}</select></label>
          <label>الموقف<select value={scenario} onChange={event => setScenario(event.target.value as typeof scenario)}>{scenarioOptions.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <span className="ls-voice-language">{languageLabels[languageCode]}</span>
        </div>
        <label className="ls-voice-consent">
          <input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)}/>
          <span>أوافق على إرسال النص الناتج من التعرّف الصوتي للمساعد. قد يستهلك ذلك رصيد استخدام؛ لا نحفظ الصوت أو نص المحادثة.</span>
        </label>
        <div className="ls-voice-chat" aria-live="polite">
          {messages.length === 0 && <p className="ls-voice-empty">اختر الموقف، ثم قل جملة قصيرة باللغة التي تتعلمها.</p>}
          {messages.map((turn, index) => <article key={`${index}-${turn.role}`} className={`ls-voice-turn ls-voice-${turn.role}`}>
            <b>{turn.role === 'user' ? 'إجابتك' : 'أثر'}</b><p dir={turn.role === 'user' ? 'ltr' : 'auto'}>{turn.text}</p>
          </article>)}
          {busy && <p className="ls-voice-wait" role="status"><LoaderCircle size={15}/> يستعد أثر للرد بصوت مسموع…</p>}
        </div>
        {audioUrl && <audio className="ls-voice-audio" controls preload="none" src={audioUrl} aria-label="رد أثر الصوتي"/>}
        <form className="ls-voice-form" onSubmit={sendMessage}>
          <button className="ls-secondary ls-voice-mic" type="button" disabled={busy || listening || !consent} onClick={startRecognition} aria-label={listening ? 'جارٍ الاستماع' : 'تحدث لتعبئة الإجابة'}>
            {listening ? <MicOff size={17}/> : <Mic size={17}/>}<span>{listening ? 'استمع الآن' : 'تحدث'}</span>
          </button>
          <textarea value={message} maxLength={500} rows={2} onChange={event => setMessage(event.target.value)} placeholder={`اكتب أو انطق جملة باللغة ${languageLabels[languageCode]}`} aria-label="إجابتك باللغة التي تتعلمها"/>
          <button className="ls-primary" type="submit" disabled={busy || !consent || !message.trim()}>
            {busy ? <LoaderCircle size={16} className="ls-spin"/> : <Send size={16}/>} إرسال
          </button>
        </form>
        {recognitionNote && <p className="ls-voice-note" role="status">{recognitionNote}</p>}
        {error && <p className="ls-voice-error" role="alert">{error}</p>}
        <div className="ls-voice-foot">
          <small>يحوّل متصفحك الكلام إلى نص؛ قد تختلف الدقة حسب الجهاز. المحادثة مؤقتة ولا تدخل في تقييم النطق.</small>
          {messages.length > 0 && <button type="button" className="ls-voice-reset" onClick={resetConversation}><RotateCcw size={13}/> مسح المحادثة</button>}
        </div>
      </div>}
    </section>
  );
}
