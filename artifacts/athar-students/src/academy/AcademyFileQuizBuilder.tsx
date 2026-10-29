import { useMemo, useState } from 'react';
import { Download, LoaderCircle, Sparkles, X } from 'lucide-react';
import { useGenerateAcademyFileQuiz } from '@workspace/api-client-react';
import type { AcademyGeneratedFileQuiz, AcademyStudentFile } from '@workspace/api-client-react';

function encodeQuizData(quiz: AcademyGeneratedFileQuiz) {
  return JSON.stringify(quiz).replace(/[<>&\u2028\u2029]/g, character => {
    if (character === '<') return '\\u003c';
    if (character === '>') return '\\u003e';
    if (character === '&') return '\\u0026';
    if (character === '\u2028') return '\\u2028';
    return '\\u2029';
  });
}

function buildQuizHtml(quiz: AcademyGeneratedFileQuiz) {
  const quizJson = encodeQuizData(quiz);
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>اختبار تفاعلي | أثر</title>
<style>
*{box-sizing:border-box}body{margin:0;padding:20px;background:#f3f6f3;color:#203239;font:16px/1.9 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:760px;margin:0 auto}.brand{color:#3b706b;font-size:13px;font-weight:800}.card{margin-top:16px;padding:22px;border:1px solid #dce5df;border-radius:18px;background:#fffefa;box-shadow:0 8px 28px #20323912}
h1{margin:4px 0 6px;font-size:clamp(21px,5vw,30px);line-height:1.5}.muted{color:#607275;font-size:13px}.progress{height:8px;margin:18px 0;background:#e7f0eb;border-radius:99px;overflow:hidden}.progress span{display:block;height:100%;background:#3b706b;transition:width .2s}
.option{display:flex;gap:10px;align-items:flex-start;margin:9px 0;padding:12px;border:1px solid #dce5df;border-radius:12px;cursor:pointer}.option:has(input:checked){border-color:#3b706b;background:#e7f0eb}.option input{margin-top:8px;accent-color:#3b706b}
button{min-height:44px;padding:10px 16px;border:0;border-radius:11px;background:#3b706b;color:white;font:inherit;font-weight:800;cursor:pointer}button:disabled{opacity:.6;cursor:not-allowed}
.feedback{margin:14px 0;padding:13px;border-radius:12px;background:#e7f0eb;font-size:14px}.feedback.bad{background:#f8ece9;color:#8a443b}.score{font-size:22px;font-weight:800;color:#3b706b}
@media(max-width:520px){body{padding:12px}.card{padding:16px}}
</style>
</head>
<body>
<main><div class="brand">أثر · تعلّم يصنع فرقًا</div><section class="card" id="quiz-root" aria-live="polite"></section></main>
<script id="quiz-data" type="application/json">${quizJson}</script>
<script>
(() => {
  const quiz = JSON.parse(document.getElementById("quiz-data").textContent || "{}");
  const root = document.getElementById("quiz-root");
  let index = 0, score = 0, answered = false;
  const make = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  function render() {
    root.replaceChildren();
    if (index >= quiz.questions.length) {
      root.append(make("h1", "انتهى الاختبار"));
      root.append(make("p", quiz.title, "muted"));
      root.append(make("p", "نتيجتك: " + score + " من " + quiz.questions.length, "score"));
      const restart = make("button", "أعد الاختبار");
      restart.type = "button";
      restart.addEventListener("click", () => { index = 0; score = 0; answered = false; render(); });
      root.append(restart);
      return;
    }
    const question = quiz.questions[index];
    root.append(make("p", "السؤال " + (index + 1) + " من " + quiz.questions.length, "muted"));
    root.append(make("h1", quiz.title));
    const progress = make("div", undefined, "progress");
    const fill = document.createElement("span");
    fill.style.width = ((index + 1) / quiz.questions.length * 100) + "%";
    progress.append(fill);
    root.append(progress);
    root.append(make("h2", question.question));
    const options = make("div");
    question.options.forEach((option, optionIndex) => {
      const label = make("label", undefined, "option");
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "answer";
      input.value = String(optionIndex);
      input.disabled = answered;
      label.append(input, make("span", option));
      options.append(label);
    });
    root.append(options);
    const feedback = make("p", undefined, "feedback");
    feedback.hidden = true;
    root.append(feedback);
    const submit = make("button", "تحقق من الإجابة");
    submit.type = "button";
    submit.addEventListener("click", () => {
      if (answered) {
        index += 1;
        answered = false;
        render();
        return;
      }
      const selected = root.querySelector('input[name="answer"]:checked');
      if (!selected) {
        feedback.textContent = "اختر إجابة أولًا.";
        feedback.className = "feedback";
        feedback.hidden = false;
        return;
      }
      answered = true;
      const correct = Number(selected.value) === question.correctIndex;
      if (correct) score += 1;
      root.querySelectorAll('input[name="answer"]').forEach(input => { input.disabled = true; });
      feedback.className = correct ? "feedback" : "feedback bad";
      feedback.textContent = (correct ? "إجابة صحيحة. " : "الإجابة الصحيحة: " + question.options[question.correctIndex] + ". ") + question.explanation;
      feedback.hidden = false;
      submit.textContent = index === quiz.questions.length - 1 ? "عرض النتيجة" : "السؤال التالي";
    });
    root.append(submit);
  }
  render();
})();
</script>
</body>
</html>`;
}

function safeHtmlName(name: string) {
  const stem = name.replace(/\.[^.]+$/, '').replace(/[^\p{L}\p{N}\s_-]/gu, '').trim().slice(0, 60);
  return `${stem || 'اختبار-أثر'}-اختبار.html`;
}

export function AcademyFileQuizBuilder({
  file,
  onClose,
}: {
  file: AcademyStudentFile;
  onClose: () => void;
}) {
  const [questionCount, setQuestionCount] = useState(10);
  const [allowOpenAi, setAllowOpenAi] = useState(false);
  const [quiz, setQuiz] = useState<AcademyGeneratedFileQuiz | null>(null);
  const generate = useGenerateAcademyFileQuiz();
  const html = useMemo(() => quiz ? buildQuizHtml(quiz) : '', [quiz]);

  function createQuiz() {
    if (!allowOpenAi || generate.isPending) return;
    setQuiz(null);
    generate.mutate({
      fileId: file.id,
      data: { questionCount, allowOpenAi: true },
    }, {
      onSuccess: setQuiz,
    });
  }

  function downloadHtml() {
    if (!html) return;
    const blobUrl = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = safeHtmlName(file.originalName);
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  }

  return (
    <section className="ac-panel ac-file-quiz" aria-label={`إنشاء اختبار من ${file.originalName}`}>
      <div className="ac-file-quiz-head">
        <div>
          <span className="ac-kicker">اختبار خاص من ملفك</span>
          <h2>حوّل المادة إلى اختبار تفاعلي</h2>
          <p>عاين الاختبار هنا، ثم نزّله كملف HTML يعمل دون اتصال.</p>
        </div>
        <button className="ac-button" type="button" onClick={onClose} aria-label="إغلاق"><X size={16}/></button>
      </div>

      <div className="ac-file-quiz-controls">
        <label className="ac-field">
          عدد الأسئلة
          <select value={questionCount} onChange={event => setQuestionCount(Number(event.target.value))}>
            {[10, 15, 20].map(count => <option key={count} value={count}>{count} سؤالًا</option>)}
          </select>
        </label>
        <button className="ac-button ac-button-primary" type="button" disabled={!allowOpenAi || generate.isPending} onClick={createQuiz}>
          {generate.isPending ? <><LoaderCircle className="ac-community-spin" size={15}/> جارٍ إعداد الاختبار…</> : <><Sparkles size={15}/> أنشئ الاختبار</>}
        </button>
      </div>

      <label className="ac-privacy ac-file-quiz-consent">
        <input type="checkbox" checked={allowOpenAi} onChange={event => setAllowOpenAi(event.target.checked)}/>
        <span>أوافق على إرسال محتوى هذا الملف فقط إلى OpenAI عبر Replit AI Integrations لإنشاء الأسئلة. قد يستهلك ذلك رصيد Replit. لن يبدأ الإرسال دون موافقتي.</span>
      </label>

      {generate.isError && <p className="ac-file-quiz-error" role="alert">تعذّر إنشاء اختبار موثوق من هذا الملف. جرّب عددًا أقل من الأسئلة أو ملفًا أوضح.</p>}

      {quiz && <div className="ac-file-quiz-result">
        <div className="ac-file-quiz-result-head">
          <div><b>{quiz.title}</b><small>{quiz.questions.length} أسئلة · إجابات مع شرح</small></div>
          <button className="ac-button ac-button-primary" type="button" onClick={downloadHtml}><Download size={15}/> تنزيل HTML</button>
        </div>
        <iframe
          className="ac-file-quiz-preview"
          title={`معاينة الاختبار: ${quiz.title}`}
          sandbox="allow-scripts"
          srcDoc={html}
        />
        <p className="ac-meta"><Download size={13}/> نزّل الملف للاحتفاظ به أو فتحه لاحقًا. لا يُحفظ الاختبار تلقائيًا في حسابك.</p>
      </div>}
    </section>
  );
}
