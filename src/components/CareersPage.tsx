import { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { Send, CheckCircle, Paperclip, X } from 'lucide-react';
import { FirebaseImage } from './ui/FirebaseImage';
import { normalizeImageUrl } from '../utils/images';
import { useLanguage, useT } from '../i18n';
import LanguageSwitcher from './menu/LanguageSwitcher';

const ROLE_KEYS = [
  'careers.role1',
  'careers.role2',
  'careers.role3',
  'careers.role4',
  'careers.role5',
  'careers.role6',
];

// English values are sent to the backend / included in the notification email,
// so the submitted value stays stable regardless of the UI language.
const ROLE_VALUES: Record<string, string> = {
  'careers.role1': 'Kitchen / Chef',
  'careers.role2': 'Front of House / Waiter',
  'careers.role3': 'Bar Staff / Bartender',
  'careers.role4': 'Delivery Driver',
  'careers.role5': 'Management',
  'careers.role6': 'Other / Open to anything',
};

export default function CareersPage() {
  const { language, setLanguage } = useLanguage();
  const t = useT();
  const [form, setForm] = useState({
    name: '',
    email: '',
    role: '',
    experience: '',
  });
  const [honeypot, setHoneypot] = useState('');
  const [cv, setCv] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg(t('careers.errCvSize'));
      return;
    }
    setErrorMsg('');
    setCv(file);
  };

  const removeFile = () => {
    setCv(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      setErrorMsg(t('careers.errNameEmail'));
      return;
    }
    setErrorMsg('');
    setStatus('submitting');

    try {
      const data = new FormData();
      data.append('name', form.name.trim());
      data.append('email', form.email.trim());
      data.append('role', form.role);
      data.append('experience', form.experience.trim());
      data.append('website', honeypot); // honeypot
      if (cv) data.append('cv', cv);

      const resp = await fetch('/api/careers', { method: 'POST', body: data });
      const json = await resp.json();
      if (!resp.ok || !json.success) {
        setErrorMsg(json.error || t('careers.errGeneric'));
        setStatus('idle');
        return;
      }
      setStatus('done');
    } catch {
      setErrorMsg(t('careers.errConnect'));
      setStatus('idle');
    }
  };

  return (
    <div className="min-h-screen bg-cream">
      {/* Hero */}
      <section className="relative text-white py-32 px-6 overflow-hidden">
        <div className="absolute inset-0">
          <FirebaseImage src={normalizeImageUrl("gs://cajun-life-cafe.firebasestorage.app/assets/careers-hero.webp")} alt="Careers hero" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/55" />
        </div>
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            <div className="flex justify-center mb-6">
              <LanguageSwitcher language={language} setLanguage={setLanguage} />
            </div>
            <span className="inline-block bg-terracotta/20 text-terracotta font-bold text-xs uppercase tracking-widest px-4 py-2 rounded-full mb-6">
              {t('careers.badge')}
            </span>
            <h1 className="text-4xl md:text-6xl font-display font-bold mb-6 leading-tight">
              {t('careers.heroTitle')}
            </h1>
            <p className="text-xl text-white/70 max-w-xl mx-auto leading-relaxed">
              {t('careers.heroSub')}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Why work here */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-display font-bold text-center text-ink mb-12">{t('careers.whyTitle')}</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                emoji: '🍔',
                title: t('careers.why1Title'),
                desc: t('careers.why1Desc'),
              },
              {
                emoji: '🌴',
                title: t('careers.why2Title'),
                desc: t('careers.why2Desc'),
              },
              {
                emoji: '🤝',
                title: t('careers.why3Title'),
                desc: t('careers.why3Desc'),
              },
            ].map(({ emoji, title, desc }) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <div className="w-16 h-16 bg-terracotta/10 rounded-3xl flex items-center justify-center mx-auto mb-4 text-3xl">
                  {emoji}
                </div>
                <h3 className="font-bold text-lg text-ink mb-2">{title}</h3>
                <p className="text-gray-500 leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Application form */}
      <section id="apply" className="py-20 px-6 bg-cream">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-display font-bold text-ink mb-3">{t('careers.applyTitle')}</h2>
            <p className="text-gray-500">{t('careers.applySub')}</p>
          </div>

          {status === 'done' ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-[32px] p-12 shadow-sm border border-gray-100 text-center"
            >
              <div className="w-20 h-20 bg-olive/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="text-olive" size={40} />
              </div>
              <h3 className="text-2xl font-display font-bold text-ink mb-3">{t('careers.doneTitle')}</h3>
              <p className="text-gray-500">
                {t('careers.doneBody').replace('{name}', form.name.split(' ')[0])}
              </p>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white rounded-[32px] p-8 md:p-10 shadow-sm border border-gray-100 space-y-5">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">{t('careers.labelName')} *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder={t('careers.phName')}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">{t('careers.labelEmail')} *</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="you@example.com"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">{t('careers.labelRole')}</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 outline-none transition-all text-gray-700 bg-white"
                >
                  <option value="">{t('careers.selectRole')}</option>
                  {ROLE_KEYS.map((key) => (
                    <option key={key} value={ROLE_VALUES[key]}>{t(key)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                  {t('careers.labelExperience')} <span className="normal-case font-normal text-gray-400">{t('loy.emailOpt')}</span>
                </label>
                <textarea
                  value={form.experience}
                  onChange={(e) => setForm({ ...form, experience: e.target.value })}
                  rows={4}
                  placeholder={t('careers.phExperience')}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 outline-none transition-all resize-none text-sm"
                />
              </div>

              {/* CV upload */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                  {t('careers.labelCv')} <span className="normal-case font-normal text-gray-400">{t('careers.cvHint')}</span>
                </label>
                {cv ? (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-olive/40 bg-olive/5">
                    <Paperclip size={16} className="text-olive shrink-0" />
                    <span className="text-sm text-ink font-medium flex-1 truncate">{cv.name}</span>
                    <button type="button" onClick={removeFile} className="text-gray-400 hover:text-red-500 transition-colors">
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 px-4 py-4 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 hover:border-terracotta hover:text-terracotta transition-all text-sm font-medium"
                  >
                    <Paperclip size={16} />
                    {t('careers.attachCv')}
                  </button>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleFile}
                  className="hidden"
                />
              </div>

              {/* Honeypot */}
              <input type="text" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} className="hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" />

              {errorMsg && <p className="text-red-500 text-sm">{errorMsg}</p>}

              <button
                type="submit"
                disabled={status === 'submitting'}
                className="w-full py-4 bg-terracotta text-white rounded-2xl font-bold text-lg hover:bg-terracotta/90 transition-all flex items-center justify-center gap-2 disabled:opacity-60 shadow-lg"
              >
                {status === 'submitting' ? t('careers.sending') : <><Send size={18} /> {t('careers.submit')}</>}
              </button>

              <p className="text-center text-gray-400 text-xs">
                {t('careers.footerNote')}
              </p>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
