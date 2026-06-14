import { useState } from 'react';
import { motion } from 'motion/react';
import { Send, Instagram, Youtube, CheckCircle } from 'lucide-react';
import { FirebaseImage } from './ui/FirebaseImage';
import { normalizeImageUrl } from '../utils/images';

export default function InfluencerPage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    instagram: '',
    tiktok: '',
    youtube: '',
    facebook: '',
    note: '',
  });
  const [honeypot, setHoneypot] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      setErrorMsg('Please enter your name and email.');
      return;
    }
    if (!form.instagram.trim() && !form.tiktok.trim() && !form.youtube.trim() && !form.facebook.trim()) {
      setErrorMsg('Please link at least one social account.');
      return;
    }
    setErrorMsg('');
    setStatus('submitting');
    try {
      const message = [
        `Name: ${form.name}`,
        `Email: ${form.email}`,
        form.phone ? `Phone: ${form.phone}` : null,
        form.instagram ? `Instagram: ${form.instagram}` : null,
        form.tiktok ? `TikTok: ${form.tiktok}` : null,
        form.youtube ? `YouTube: ${form.youtube}` : null,
        form.facebook ? `Facebook: ${form.facebook}` : null,
        form.note ? `\nNote: ${form.note}` : null,
      ].filter(Boolean).join('\n');

      const resp = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          message: `[INFLUENCER APPLICATION]\n\n${message}`,
          website: honeypot,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        setErrorMsg(data.error || 'Something went wrong. Please try again.');
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
          <FirebaseImage src={normalizeImageUrl("gs://cajun-life-cafe.firebasestorage.app/assets/influencer-hero.webp")} alt="Influencer hero" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/55" />
        </div>
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            <span className="inline-block bg-terracotta/20 text-terracotta font-bold text-xs uppercase tracking-widest px-4 py-2 rounded-full mb-6">
              Influencer Loyalty Program
            </span>
            <h1 className="text-4xl md:text-6xl font-display font-bold mb-6 leading-tight">
              Eat Well.<br />Share the Love.
            </h1>
            <p className="text-xl text-white/70 max-w-xl mx-auto leading-relaxed">
              If you're a creator based in Pattaya or love sharing fitness and food content,
              join our loyalty program and get <span className="text-olive font-bold">up to 25% bonus</span> on
              every top-up — more than double our standard rate.
            </p>
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-display font-bold text-center text-ink mb-12">How it works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Apply below',
                desc: 'Fill in the short form and link your social accounts. No follower minimums, no strict criteria.',
              },
              {
                step: '02',
                title: 'We get back to you',
                desc: "We'll review your application and reply within 48 hours with your personal bonus rate — up to 25%. The more your influence shows, the more we reward it over time.",
              },
              {
                step: '03',
                title: 'Top up & enjoy',
                desc: 'Every time you top up your wallet, you get 20% extra to spend. Come eat, share if you love it.',
              },
            ].map(({ step, title, desc }) => (
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <div className="w-16 h-16 bg-terracotta/10 rounded-3xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-terracotta font-display font-bold text-xl">{step}</span>
                </div>
                <h3 className="font-bold text-lg text-ink mb-2">{title}</h3>
                <p className="text-gray-500 leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section className="py-16 px-6 bg-cream">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-display font-bold text-center text-ink mb-10">Who this is for</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              'Pattaya-based lifestyle creators',
              'Fitness & health influencers',
              'Food bloggers & reviewers',
              'Travel & expat content creators',
              'Gym & wellness community builders',
              'Anyone with an engaged local audience',
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 bg-white p-4 rounded-2xl border border-gray-100">
                <CheckCircle className="text-olive shrink-0" size={18} />
                <span className="text-ink font-medium">{item}</span>
              </div>
            ))}
          </div>
          <p className="text-center text-gray-400 text-sm mt-8 italic">
            No minimum follower count. We care more about genuine engagement and a real love of good food.
          </p>
        </div>
      </section>

      {/* The offer */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-2xl mx-auto">
          <div className="bg-ink rounded-[40px] p-10 text-white text-center">
            <h2 className="text-3xl font-display font-bold mb-4">The deal</h2>
            <p className="text-white/60 mb-8">Standard loyalty members get 10% bonus on every top-up. As an influencer partner you start higher — and your bonus can grow over time as your influence shows.</p>
            <div className="flex items-center justify-center gap-8 mb-8">
              <div>
                <p className="text-gray-500 text-sm font-bold uppercase tracking-widest mb-1">Standard</p>
                <p className="text-4xl font-display font-bold text-white/30">10%</p>
              </div>
              <div className="text-gray-600 text-2xl">→</div>
              <div>
                <p className="text-olive text-sm font-bold uppercase tracking-widest mb-1">Influencer</p>
                <p className="text-6xl font-display font-bold text-olive">25%</p>
                <p className="text-olive/60 text-xs mt-1">up to</p>
              </div>
            </div>
            <p className="text-white/50 text-sm">
              Top up ฿1,000 → get up to ฿1,250 to spend.<br />
              Top up ฿5,000 → get up to ฿6,250 to spend.
            </p>
          </div>
        </div>
      </section>

      {/* Application form */}
      <section id="apply" className="py-20 px-6 bg-cream">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-display font-bold text-ink mb-3">Apply now</h2>
            <p className="text-gray-500">Takes 2 minutes. Apply and we'll get back to you with your personal bonus rate within 48 hours.</p>
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
              <h3 className="text-2xl font-display font-bold text-ink mb-3">Application received!</h3>
              <p className="text-gray-500">
                Thanks {form.name.split(' ')[0]} — we'll review your application and get back to you within 48 hours with your personal bonus rate.
                As your influence grows, so can your bonus.
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
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Phone / LINE</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="Optional"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 outline-none transition-all"
                />
              </div>

              <div className="border-t border-gray-100 pt-5">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Social accounts <span className="normal-case font-normal text-gray-400">(at least one)</span></p>
                <div className="space-y-3">
                  {[
                    { key: 'instagram', label: 'Instagram', placeholder: '@yourhandle or profile URL' },
                    { key: 'tiktok', label: 'TikTok', placeholder: '@yourhandle or profile URL' },
                    { key: 'youtube', label: 'YouTube', placeholder: 'Channel URL' },
                    { key: 'facebook', label: 'Facebook', placeholder: 'Page or profile URL' },
                  ].map(({ key, label, placeholder }) => (
                    <div key={key} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-gray-400 w-20 shrink-0">{label}</span>
                      <input
                        type="text"
                        value={form[key as keyof typeof form]}
                        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                        placeholder={placeholder}
                        className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 outline-none transition-all text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Anything else? <span className="normal-case font-normal text-gray-400">(optional)</span></label>
                <textarea
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  rows={3}
                  placeholder="Tell us a bit about your content or audience..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 outline-none transition-all resize-none text-sm"
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
                {status === 'submitting' ? 'Sending…' : <><Send size={18} /> Submit Application</>}
              </button>

              <p className="text-center text-gray-400 text-xs">
                We'll review and reply within 48 hours. No spam, ever.
              </p>
            </form>
          )}
          <p className="text-center text-gray-400 text-xs mt-6 max-w-lg mx-auto leading-relaxed">
            * Bonus rates are personalised and may be adjusted up or down over time at our discretion based on activity and engagement. We reserve the right to modify or withdraw the influencer bonus at any time.
          </p>
        </div>
      </section>
    </div>
  );
}
