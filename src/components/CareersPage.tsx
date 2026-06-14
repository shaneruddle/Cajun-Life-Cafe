import { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { Send, CheckCircle, Paperclip, X } from 'lucide-react';
import { FirebaseImage } from './ui/FirebaseImage';
import { normalizeImageUrl } from '../utils/images';

const ROLES = [
  'Kitchen / Chef',
  'Front of House / Waiter',
  'Bar Staff / Bartender',
  'Delivery Driver',
  'Management',
  'Other / Open to anything',
];

export default function CareersPage() {
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
      setErrorMsg('CV file must be under 10 MB.');
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
      setErrorMsg('Please enter your name and email.');
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
        setErrorMsg(json.error || 'Something went wrong. Please try again.');
        setStatus('idle');
        return;
      }
      setStatus('done');
    } catch {
      setErrorMsg('Could not connect. Please try again.');
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
            <span className="inline-block bg-terracotta/20 text-terracotta font-bold text-xs uppercase tracking-widest px-4 py-2 rounded-full mb-6">
              We're Hiring
            </span>
            <h1 className="text-4xl md:text-6xl font-display font-bold mb-6 leading-tight">
              Come work<br />with us.
            </h1>
            <p className="text-xl text-white/70 max-w-xl mx-auto leading-relaxed">
              We're always on the lookout for great people. Good energy, love of food, and good vibes are pretty much the only requirements.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Why work here */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-display font-bold text-center text-ink mb-12">Why Cajun Life</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                emoji: '🍔',
                title: 'Real food, real team',
                desc: "We cook scratch Cajun food and we take it seriously. You'll work with people who actually care about what comes out of the kitchen.",
              },
              {
                emoji: '🌴',
                title: 'Pattaya lifestyle',
                desc: 'Work in one of the most vibrant cities in Thailand. Sun, sea, and a solid paycheck — it could be worse.',
              },
              {
                emoji: '🤝',
                title: 'Good vibes only',
                desc: "Small team, flat structure, no drama. We look after our people and expect the same in return.",
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
            <h2 className="text-3xl font-display font-bold text-ink mb-3">Send us your CV</h2>
            <p className="text-gray-500">No specific openings listed — we hire when we find the right person. Drop us your details and we'll be in touch.</p>
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
              <h3 className="text-2xl font-display font-bold text-ink mb-3">Got it — thanks!</h3>
              <p className="text-gray-500">
                We'll take a look and get back to you if there's a good fit. Good luck {form.name.split(' ')[0]}!
              </p>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white rounded-[32px] p-8 md:p-10 shadow-sm border border-gray-100 space-y-5">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Your name"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Email *</label>
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
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Role interest</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 outline-none transition-all text-gray-700 bg-white"
                >
                  <option value="">Select a role…</option>
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Experience / cover note <span className="normal-case font-normal text-gray-400">(optional)</span></label>
                <textarea
                  value={form.experience}
                  onChange={(e) => setForm({ ...form, experience: e.target.value })}
                  rows={4}
                  placeholder="Tell us a bit about yourself and what you've done…"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 outline-none transition-all resize-none text-sm"
                />
              </div>

              {/* CV upload */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">CV / Résumé <span className="normal-case font-normal text-gray-400">(PDF or Word, max 10 MB)</span></label>
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
                    Attach your CV
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
                {status === 'submitting' ? 'Sending…' : <><Send size={18} /> Send Application</>}
              </button>

              <p className="text-center text-gray-400 text-xs">
                We'll only use your details to consider your application. No spam.
              </p>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
