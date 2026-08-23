import { useState } from 'react';
import { motion } from 'motion/react';
import { Star, Send, Gift, MessageSquare } from 'lucide-react';

type Category = 'overall' | 'dish' | 'suggestion' | 'complaint';

const CATEGORIES: { value: Category; label: string; emoji: string }[] = [
  { value: 'overall', label: 'Overall Experience', emoji: '⭐' },
  { value: 'dish', label: 'Specific Dish', emoji: '🍽️' },
  { value: 'suggestion', label: 'Suggestion', emoji: '💡' },
  { value: 'complaint', label: 'Complaint', emoji: '🙏' },
];

export default function FeedbackPage() {
  const [category, setCategory] = useState<Category>('overall');
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [dish, setDish] = useState('');
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done'>('idle');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) { setError('Please write something — even a few words help.'); return; }
    if (message.length > 5000) { setError('Message is too long.'); return; }
    setError('');
    setStatus('submitting');
    try {
      const resp = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, rating, dish, message, name, contact, website: honeypot }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        setError(data.error || 'Something went wrong. Please try again.');
        setStatus('idle');
        return;
      }
      setStatus('done');
    } catch {
      setError('Could not connect. Please check your internet and try again.');
      setStatus('idle');
    }
  };

  if (status === 'done') {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[32px] p-12 shadow-lg text-center max-w-md w-full"
        >
          <div className="w-20 h-20 bg-olive/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <MessageSquare size={36} className="text-olive" />
          </div>
          <h2 className="text-3xl font-display font-bold text-ink mb-3">Thank you!</h2>
          <p className="text-gray-500 leading-relaxed mb-6">
            Your feedback means a lot to us. We read every single submission and use it to make Cajun Life Cafe better.
          </p>
          {contact && (
            <div className="bg-cream rounded-2xl p-4 text-sm text-gray-500">
              <Gift size={16} className="inline mr-2 text-terracotta" />
              We have your contact details. If your feedback is selected for the <strong className="text-terracotta">฿300 gift voucher</strong>, we'll be in touch.
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream">
      {/* Hero */}
      <section className="relative bg-ink text-white py-28 px-6 overflow-hidden">
        <div className="absolute inset-0 opacity-5 pointer-events-none">
          <div className="absolute top-10 right-10 w-80 h-80 rounded-full bg-olive" />
          <div className="absolute bottom-0 left-0 w-56 h-56 rounded-full bg-terracotta" />
        </div>
        <div className="max-w-2xl mx-auto text-center relative z-10">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            <span className="inline-block bg-olive/20 text-olive font-bold text-xs uppercase tracking-widest px-4 py-2 rounded-full mb-6">
              Share Your Thoughts
            </span>
            <h1 className="text-4xl md:text-5xl font-display font-bold mb-5 leading-tight">
              Help us do better.
            </h1>
            <p className="text-xl text-white/70 leading-relaxed">
              Anonymous or not — your feedback shapes what we do. Praise, criticism, or a wild idea: we want to hear it all.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Voucher callout */}
      <section className="py-8 px-6 bg-terracotta/5 border-b border-terracotta/10">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <div className="w-12 h-12 bg-terracotta/10 rounded-2xl flex items-center justify-center flex-shrink-0">
            <Gift size={22} className="text-terracotta" />
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">
            <strong className="text-ink">Win a ฿300 gift voucher.</strong> Leave your contact details at the bottom of the form. We award the voucher to feedback that genuinely helps us improve — our call, no obligation on your end.
          </p>
        </div>
      </section>

      {/* Form */}
      <section className="py-16 px-6">
        <div className="max-w-2xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-8">

            {/* Category */}
            <div>
              <label className="block text-sm font-bold text-ink mb-4 uppercase tracking-wider">What's your feedback about?</label>
              <div className="grid grid-cols-2 gap-3">
                {CATEGORIES.map(({ value, label, emoji }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setCategory(value)}
                    className={`p-4 rounded-2xl border-2 text-left transition-all ${
                      category === value
                        ? 'border-olive bg-olive/5 text-ink'
                        : 'border-gray-100 bg-white text-gray-400 hover:border-olive/40 hover:text-ink'
                    }`}
                  >
                    <span className="text-xl mb-1 block">{emoji}</span>
                    <span className="font-bold text-sm">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Star rating — only for overall */}
            {category === 'overall' && (
              <div>
                <label className="block text-sm font-bold text-ink mb-4 uppercase tracking-wider">Overall rating</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoveredRating(star)}
                      onMouseLeave={() => setHoveredRating(0)}
                      className="p-1 transition-transform hover:scale-110"
                    >
                      <Star
                        size={36}
                        className={`transition-colors ${
                          star <= (hoveredRating || rating)
                            ? 'fill-terracotta text-terracotta'
                            : 'text-gray-200 fill-gray-200'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Dish name — only for dish feedback */}
            {category === 'dish' && (
              <div>
                <label className="block text-sm font-bold text-ink mb-3 uppercase tracking-wider">Which dish?</label>
                <input
                  type="text"
                  value={dish}
                  onChange={(e) => setDish(e.target.value)}
                  placeholder="e.g. Shrimp Étouffée, Cajun Bowl..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:border-olive focus:ring-2 focus:ring-olive/20 outline-none transition-all"
                />
              </div>
            )}

            {/* Message */}
            <div>
              <label className="block text-sm font-bold text-ink mb-3 uppercase tracking-wider">
                Your feedback <span className="text-terracotta">*</span>
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                placeholder={
                  category === 'complaint'
                    ? "Tell us what happened. Be as specific as you like — we want to make it right."
                    : category === 'suggestion'
                    ? "What would you love to see at Cajun Life Cafe?"
                    : category === 'dish'
                    ? "What did you think? What worked, what didn\'t?"
                    : "How was your visit? Food, service, atmosphere — anything goes."
                }
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:border-olive focus:ring-2 focus:ring-olive/20 outline-none transition-all resize-y"
              />
              <p className="text-xs text-gray-400 mt-2">{message.length} / 5000 characters</p>
            </div>

            {/* Contact (optional) */}
            <div className="bg-white rounded-[24px] p-6 border border-gray-100">
              <div className="flex items-start gap-3 mb-5">
                <Gift size={18} className="text-terracotta mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-bold text-ink text-sm">Want to be considered for the ฿300 voucher?</p>
                  <p className="text-gray-400 text-xs mt-1">Leave your details below. Completely optional — your feedback is just as valuable without them.</p>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Name (optional)</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-cream focus:border-olive focus:ring-2 focus:ring-olive/20 outline-none transition-all text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Email or LINE (optional)</label>
                  <input
                    type="text"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    placeholder="Email or LINE handle"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-cream focus:border-olive focus:ring-2 focus:ring-olive/20 outline-none transition-all text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Honeypot */}
            <input
              type="text"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              className="hidden"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
            />

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={status === 'submitting'}
              className="terracotta-button w-full text-lg font-bold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {status === 'submitting' ? 'Sending…' : <><Send size={18} /> Send Feedback</>}
            </button>

            <p className="text-center text-xs text-gray-400">
              Anonymous submissions are welcome. We never share your details with third parties.
            </p>
          </form>
        </div>
      </section>
    </div>
  );
}
