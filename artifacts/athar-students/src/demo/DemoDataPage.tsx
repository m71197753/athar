import { useState } from 'react';
import { Award, BookOpen, BriefcaseBusiness, CheckCircle2, FileText, GraduationCap, RotateCcw, Sparkles, Target, UsersRound } from 'lucide-react';
import './demo-data.css';

const questions = [
  {
    question: 'ما أفضل بداية لإجابة عن تجربة مهنية؟',
    options: ['النتيجة مباشرة دون سياق', 'توضيح الموقف والهدف باختصار', 'ذكر أسماء الفريق فقط', 'الحديث عن موضوع غير مرتبط'],
    answer: 1,
    explanation: 'سياق مختصر وهدف واضح يساعدان المستمع على فهم التجربة قبل تفاصيل دورك.',
  },
  {
    question: 'كيف تعرض مساهمتك في مشروع جماعي؟',
    options: ['أنسب كل العمل لنفسي', 'أذكر دوري وخطواتي بوضوح', 'أتجنب ذكر دوري', 'أذكر النتيجة دون توضيح'],
    answer: 1,
    explanation: 'وضح ما أنجزته أنت، مع الاعتراف بمساهمات بقية الفريق.',
  },
  {
    question: 'ما الذي يجعل نتيجة التجربة أقوى؟',
    options: ['وصف عام مثل «كان المشروع ناجحًا»', 'رقم أو دليل يمكن التحقق منه', 'إضافة تفاصيل لا تتذكرها', 'استخدام كلمات مبالغ فيها'],
    answer: 1,
    explanation: 'الدليل المحدد يجعل النتيجة أوضح، بشرط أن يكون حقيقيًا ويمكن التحقق منه.',
  },
  {
    question: 'ماذا تشرح بعد تحديد هدف التجربة؟',
    options: ['الخطوة التي اتخذتها أنت', 'موضوعًا جديدًا', 'رأي شخص آخر فقط', 'تفاصيل شخصية لا ترتبط بالموقف'],
    answer: 0,
    explanation: 'اشرح الإجراء الذي قمت به والسبب وراء اختيارك له.',
  },
  {
    question: 'كيف تتحدث عن تحدٍّ واجهك؟',
    options: ['أخفيه تمامًا', 'أوضح ما تعلمته وكيف تعاملت معه', 'أحمّل الفريق المسؤولية', 'أذكر المشكلة دون حل'],
    answer: 1,
    explanation: 'التحدي يصبح تجربة مفيدة عندما توضّح استجابتك وما تعلمته.',
  },
  {
    question: 'ما الترتيب الواضح لعرض تجربة قصيرة؟',
    options: ['النتيجة ثم موضوع آخر', 'الموقف، الهدف، الإجراء، النتيجة', 'الأسماء، الآراء، التوقعات', 'المهارات فقط دون مثال'],
    answer: 1,
    explanation: 'هذا الترتيب يربط السياق بما فعلته ثم بما نتج عنه.',
  },
  {
    question: 'أي عبارة تصف مهارة بطريقة أفضل؟',
    options: ['أنا ممتاز في كل شيء', 'استخدمت الجداول لتنظيم بيانات المشروع', 'أحب النجاح دائمًا', 'لدي خبرة كبيرة جدًا'],
    answer: 1,
    explanation: 'اربط المهارة بمثال عملي محدد بدل وصف عام أو مبالغة.',
  },
  {
    question: 'عند الإجابة عن «عرّفنا بنفسك»، ركّز على:',
    options: ['كل تفاصيل حياتك منذ الطفولة', 'دراستك ومهاراتك وما تستهدفه', 'تكرار نص السيرة بالكامل', 'موضوع لا يخص الدور'],
    answer: 1,
    explanation: 'اختر معلومات مهنية موجزة ترتبط بالدور أو الفرصة التي تتقدم لها.',
  },
  {
    question: 'ما أفضل طريقة لذكر مهارة تريد تطويرها؟',
    options: ['أدّعي أنني أتقنها', 'أذكر ما أفعله لتطويرها', 'أتجنب الإجابة', 'ألوم من حولي'],
    answer: 1,
    explanation: 'الصدق مع ذكر خطوة عملية للتطور يعطي إجابة مهنية ومتوازنة.',
  },
  {
    question: 'كيف تختتم إجابة المقابلة؟',
    options: ['أعيد كل التفاصيل', 'أربط النتيجة بما تعلمته أو بالدور', 'أترك الإجابة دون نتيجة', 'أنتقل لموضوع بعيد'],
    answer: 1,
    explanation: 'خاتمة قصيرة تربط أثر التجربة بما ستقدمه في الخطوة التالية.',
  },
];

const profiles = [
  {
    name: 'طالبة افتراضية ١',
    subtitle: 'نموذج طالب · نظم المعلومات',
    role: 'المسار المستهدف: تحليل البيانات',
    skills: ['تنظيم البيانات', 'الجداول', 'التواصل'],
    achievement: 'نظّمت بيانات مشروع دراسي وقدّمت ملخصًا بثلاثة مؤشرات واضحة.',
    plan: ['تعلّم أساسيات قواعد البيانات', 'تنفيذ مشروع تطبيقي', 'التدرّب على عرض النتائج'],
    resume: 'نظّمت بيانات مشروع دراسي وحوّلتها إلى ملخص يدعم مناقشة النتائج مع الفريق.',
    tone: 'teal',
  },
  {
    name: 'طالب افتراضي ٢',
    subtitle: 'نموذج خريج · إدارة الأعمال',
    role: 'المسار المستهدف: تنسيق العمليات',
    skills: ['التخطيط', 'التعاون', 'متابعة المهام'],
    achievement: 'نسّق خطة عمل فريق تطوعي وساعد على توزيع المسؤوليات ومتابعتها.',
    plan: ['تحديث السيرة المهنية', 'التقديم على تدريب مناسب', 'طلب جلسة إرشاد'],
    resume: 'نسّق مهام فريق تطوعي، ووحّد متابعة التقدم في خطة أسبوعية مشتركة.',
    tone: 'gold',
  },
  {
    name: 'خريجة افتراضية ٣',
    subtitle: 'نموذج خريجة · الإعلام',
    role: 'المسار المستهدف: إعداد المحتوى',
    skills: ['الكتابة', 'البحث', 'تحرير النصوص'],
    achievement: 'أعدّت سلسلة منشورات توعوية ضمن مشروع جامعي، وراجعت النصوص قبل النشر.',
    plan: ['إعداد نماذج أعمال', 'تطوير مهارات التحرير', 'التواصل مع مرشد مهني'],
    resume: 'أعدّت وراجعت محتوى توعويًا لمشروع جامعي، مع الالتزام بخطة النشر المتفق عليها.',
    tone: 'violet',
  },
];

function DemoBadge() {
  return <span className="demo-badge"><Sparkles size={12}/> بيانات تجريبية</span>;
}

function SampleQuiz() {
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const question = questions[questionIndex];
  const correct = selected === question.answer;

  function checkAnswer() {
    if (answered || selected === null) return;
    setAnswered(true);
    if (correct) setScore(value => value + 1);
  }

  function nextQuestion() {
    if (questionIndex === questions.length - 1) {
      setFinished(true);
      return;
    }
    setQuestionIndex(value => value + 1);
    setSelected(null);
    setAnswered(false);
  }

  function resetQuiz() {
    setQuestionIndex(0);
    setSelected(null);
    setAnswered(false);
    setScore(0);
    setFinished(false);
  }

  return <section className="demo-card demo-quiz" aria-labelledby="demo-quiz-title">
    <div className="demo-card-title"><span className="demo-icon"><CheckCircle2 size={20}/></span><div><h3 id="demo-quiz-title">اختبر فهمك</h3><p>١٠ أسئلة قصيرة مع تصحيح وشرح فوري.</p></div><DemoBadge/></div>
    {finished ? <div className="demo-result" role="status">
      <span className="demo-result-score">{score.toLocaleString('ar')} / {questions.length.toLocaleString('ar')}</span>
      <p>نتيجة تدريبية فقط؛ لا تُحفظ ولا تدخل في النقاط الحقيقية.</p>
      <button type="button" className="demo-button" onClick={resetQuiz}><RotateCcw size={15}/> أعد الاختبار</button>
    </div> : <>
      <div className="demo-quiz-meta"><span>السؤال { (questionIndex + 1).toLocaleString('ar') } من {questions.length.toLocaleString('ar')}</span><span>النتيجة {score.toLocaleString('ar')}</span></div>
      <div className="demo-progress"><span style={{ width: `${((questionIndex + 1) / questions.length) * 100}%` }}/></div>
      <h4>{question.question}</h4>
      <div className="demo-options" role="group" aria-label="خيارات الإجابة">
        {question.options.map((option, index) => <button
          type="button"
          key={option}
          className={`demo-option${selected === index ? ' is-selected' : ''}${answered && index === question.answer ? ' is-correct' : ''}${answered && selected === index && !correct ? ' is-wrong' : ''}`}
          onClick={() => !answered && setSelected(index)}
          disabled={answered}
        >{option}</button>)}
      </div>
      {answered && <p className={`demo-explanation ${correct ? 'is-correct' : 'is-wrong'}`} role="status">
        <b>{correct ? 'إجابة صحيحة.' : 'الإجابة الصحيحة: ' + question.options[question.answer]}</b> {question.explanation}
      </p>}
      <button type="button" className="demo-button" disabled={selected === null && !answered} onClick={answered ? nextQuestion : checkAnswer}>
        {answered ? questionIndex === questions.length - 1 ? 'اعرض النتيجة' : 'السؤال التالي' : 'تحقق من الإجابة'}
      </button>
    </>}
  </section>;
}

export function DemoDataPage() {
  return <main className="demo-page" dir="rtl">
    <header className="demo-hero">
      <div>
        <span className="demo-kicker">استكشف أثر</span>
        <h1>نماذج تجريبية للمنصة</h1>
        <p>مادة تعليمية، اختبار تفاعلي، وملفات توضح كيف يتحول التعلّم إلى إنجاز وخطة وسيرة مهنية.</p>
      </div>
      <div className="demo-hero-icon"><Sparkles size={28}/></div>
    </header>

    <div className="demo-notice" role="note">
      <DemoBadge/>
      <p>كل الأسماء والإنجازات والخطط هنا خيالية للعرض فقط. لا تمثل مستخدمين حقيقيين، ولا تُنشئ حسابات، ولا تدخل في إحصاءات المنصة أو نقاط الطلاب.</p>
    </div>

    <nav className="demo-jump-links" aria-label="أقسام النماذج التجريبية">
      <a href="#demo-study"><BookOpen size={15}/> المذاكرة</a>
      <a href="#demo-people"><UsersRound size={15}/> نماذج الطلاب</a>
      <a href="#demo-graduates"><BriefcaseBusiness size={15}/> الخريجون</a>
    </nav>

    <section id="demo-study" className="demo-section">
      <div className="demo-section-heading"><div><span className="demo-kicker">نموذج تعليمي</span><h2>المذاكرة</h2></div><DemoBadge/></div>
      <article className="demo-card demo-lesson">
        <div className="demo-card-title"><span className="demo-icon"><BookOpen size={20}/></span><div><h3>التواصل المهني في مقابلة العمل</h3><p>محاضرة مقروءة · ٦ دقائق · مادة تجريبية</p></div><DemoBadge/></div>
        <div className="demo-lesson-copy">
          <p>الإجابة الواضحة عن تجربة سابقة تساعد المحاور على فهم طريقة تفكيرك ومساهمتك. اختر مثالًا حقيقيًا يرتبط بالسؤال، ثم اشرح السياق والهدف بإيجاز.</p>
          <h4>رتّب إجابتك بهذه الخطوات</h4>
          <ol>
            <li><b>الموقف:</b> ما السياق الذي بدأت منه التجربة؟</li>
            <li><b>الهدف:</b> ما المهمة أو النتيجة التي كنت تسعى إليها؟</li>
            <li><b>الإجراء:</b> ما الخطوات التي اتخذتها أنت؟</li>
            <li><b>النتيجة:</b> ما الذي تحقق، وما الدليل عليه؟</li>
          </ol>
          <p>اذكر دورك بدقة، ولا تنسب عمل الفريق كله لنفسك. وإذا واجهت صعوبة، وضّح كيف تعاملت معها وما الذي تعلمته.</p>
          <div className="demo-attachment"><FileText size={17}/><span><b>ملخص المحاضرة</b><small>ملف توضيحي تجريبي · لا يحتوي على مستند قابل للتنزيل</small></span></div>
        </div>
      </article>
      <SampleQuiz/>
    </section>

    <section id="demo-people" className="demo-section">
      <div className="demo-section-heading"><div><span className="demo-kicker">ملفات للعرض فقط</span><h2>نماذج طلاب وخريجين</h2><p>كل نموذج مستقل عن حسابات الدخول وسجلات الطلاب الحقيقية.</p></div><DemoBadge/></div>
      <div className="demo-profile-grid">
        {profiles.map((profile, index) => <article className={`demo-card demo-profile tone-${profile.tone}`} key={profile.name}>
          <div className="demo-profile-head"><span className="demo-avatar">{(index + 1).toLocaleString('ar')}</span><div><h3>{profile.name}</h3><p>{profile.subtitle}</p></div><DemoBadge/></div>
          <p className="demo-target"><Target size={15}/>{profile.role}</p>
          <div className="demo-subsection"><h4><Award size={15}/> إنجاز موثق — نموذج</h4><p>{profile.achievement}</p></div>
          <div className="demo-subsection"><h4><Sparkles size={15}/> مهارات مكتسبة</h4><div className="demo-tags">{profile.skills.map(skill => <span key={skill}>{skill}</span>)}</div></div>
          <div className="demo-subsection"><h4><FileText size={15}/> صياغة للسيرة</h4><blockquote>{profile.resume}</blockquote></div>
          <div className="demo-subsection"><h4><Target size={15}/> خطة مهنية</h4><ol className="demo-plan">{profile.plan.map((step, stepIndex) => <li key={step}><span>{(stepIndex + 1).toLocaleString('ar')}</span>{step}</li>)}</ol></div>
          <div className="demo-profile-footer"><span>نقاط افتراضية</span><b>{(240 - index * 55).toLocaleString('ar')}</b><small>للعرض فقط</small></div>
        </article>)}
      </div>
    </section>

    <section id="demo-graduates" className="demo-section">
      <div className="demo-section-heading"><div><span className="demo-kicker">مساحة الخريجين</span><h2>أمثلة على الخدمات</h2></div><DemoBadge/></div>
      <div className="demo-graduate-grid">
        <article className="demo-card demo-graduate-card"><span className="demo-icon"><BriefcaseBusiness size={20}/></span><DemoBadge/><h3>فرصة تدريب افتراضية</h3><p>تدريب تمهيدي في تنسيق العمليات، مع مهام أسبوعية ومراجعة للسيرة.</p><small>نموذج توضيحي، ليس إعلانًا أو فرصة متاحة للتقديم.</small></article>
        <article className="demo-card demo-graduate-card"><span className="demo-icon"><GraduationCap size={20}/></span><DemoBadge/><h3>جلسة إرشاد مهنية</h3><p>مثال لجلسة تساعد الخريج على اختيار هدف واقعي وترتيب خطوات الوصول إليه.</p><small>نموذج توضيحي، وليس موعدًا محجوزًا.</small></article>
        <article className="demo-card demo-graduate-card"><span className="demo-icon"><UsersRound size={20}/></span><DemoBadge/><h3>مجتمع تواصل</h3><p>مساحة لمشاركة الخبرات والأسئلة المهنية بين الخريجين.</p><small>الأعضاء الظاهرون في هذه الصفحة افتراضيون.</small></article>
      </div>
    </section>

    <footer className="demo-footer">
      <CheckCircle2 size={16}/>
      <span>هذه الصفحة لا تحفظ إجابات الاختبار أو بيانات النماذج في حسابك.</span>
    </footer>
  </main>;
}
