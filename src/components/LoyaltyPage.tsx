/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { motion } from "motion/react";
import {
  Wallet,
  Gift,
  MessageCircle,
  UserPlus,
  Store,
  Utensils,
  ChevronDown,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { useT } from "../i18n";

const TOP_UP_EXAMPLES = [
  { topUp: 500, bonus: 50 },
  { topUp: 1000, bonus: 100 },
  { topUp: 2000, bonus: 200 },
];

const STEP_ICONS = [UserPlus, Store, Utensils];

const FaqItem = ({ q, a }: { q: string; a: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 p-6 text-left"
      >
        <span className="font-bold text-ink">{q}</span>
        <ChevronDown
          size={20}
          className={`text-terracotta shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <p className="px-6 pb-6 text-gray-500 leading-relaxed">{a}</p>}
    </div>
  );
};

const SignupForm = () => {
  const [form, setForm] = useState({ firstName: "", lastName: "", mobile: "", email: "" });
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "existing" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [activationUrl, setActivationUrl] = useState("");
  const t = useT();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim() || !form.mobile.trim()) {
      setErrorMsg(t("loy.errFill"));
      return;
    }
    setErrorMsg("");
    setStatus("submitting");
    try {
      const resp = await fetch("/api/loyalty-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, website: honeypot }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        setErrorMsg(data.error || t("contact.errGeneric"));
        setStatus("idle");
        return;
      }
      if (data.existing) {
        setStatus("existing");
      } else {
        setActivationUrl(data.activationUrl || "");
        setStatus("done");
      }
    } catch {
      setErrorMsg(t("contact.errConnect"));
      setStatus("idle");
    }
  };

  if (status === "done" || status === "existing") {
    return (
      <div className="bg-white rounded-3xl p-10 shadow-lg text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 size={32} className="text-green-600" />
        </div>
        <h3 className="text-2xl font-display font-bold text-ink mb-3">
          {status === "existing" ? t("loy.existingTitle") : t("loy.welcome").replace("{name}", form.firstName)}
        </h3>
        <p className="text-gray-500 mb-8 max-w-md mx-auto">
          {status === "existing" ? t("loy.existingBody") : t("loy.doneBody")}
        </p>
        {status === "done" && activationUrl && (
          <a
            href={activationUrl}
            className="inline-flex items-center gap-2 bg-[#06C755] text-white rounded-full px-8 py-3 font-bold hover:opacity-90 transition-all"
          >
            <MessageCircle size={20} /> {t("loy.connectLine")}
          </a>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-8 md:p-10 shadow-lg">
      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-bold text-ink mb-2">{t("loy.firstName")} *</label>
          <input
            type="text"
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 outline-none transition-all"
            placeholder="Jane"
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-ink mb-2">{t("loy.lastName")} *</label>
          <input
            type="text"
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 outline-none transition-all"
            placeholder="Doe"
          />
        </div>
      </div>
      <div className="mb-4">
        <label className="block text-sm font-bold text-ink mb-2">{t("loy.mobile")} *</label>
        <input
          type="tel"
          value={form.mobile}
          onChange={(e) => setForm({ ...form, mobile: e.target.value })}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 outline-none transition-all"
          placeholder="086 123 4567"
        />
      </div>
      <div className="mb-6">
        <label className="block text-sm font-bold text-ink mb-2">{t("contact.email")} <span className="font-normal text-gray-400">{t("loy.emailOpt")}</span></label>
        <input
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 outline-none transition-all"
          placeholder="jane@example.com"
        />
      </div>
      {/* Honeypot — hidden from real users */}
      <input
        type="text"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        className="hidden"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />
      {errorMsg && <p className="text-red-600 text-sm mb-4">{errorMsg}</p>}
      <button
        type="submit"
        disabled={status === "submitting"}
        className="terracotta-button w-full text-lg font-bold flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {status === "submitting" ? (
          <>
            <Loader2 size={20} className="animate-spin" /> {t("loy.signing")}
          </>
        ) : (
          t("loy.join")
        )}
      </button>
      <p className="text-xs text-gray-400 mt-4 text-center">
        {t("loy.privacy")}
      </p>
    </form>
  );
};

export default function LoyaltyPage() {
  const t = useT();

  const steps = [
    { icon: STEP_ICONS[0], title: t("loy.step1t"), text: t("loy.step1x") },
    { icon: STEP_ICONS[1], title: t("loy.step2t"), text: t("loy.step2x") },
    { icon: STEP_ICONS[2], title: t("loy.step3t"), text: t("loy.step3x") },
  ];

  const faqs = [
    { q: t("loy.faq1q"), a: t("loy.faq1a") },
    { q: t("loy.faq2q"), a: t("loy.faq2a") },
    { q: t("loy.faq3q"), a: t("loy.faq3a") },
    { q: t("loy.faq4q"), a: t("loy.faq4a") },
    { q: t("loy.faq5q"), a: t("loy.faq5a") },
  ];

  return (
    <div className="min-h-screen bg-cream">
      {/* Hero */}
      <section className="relative bg-ink pt-40 pb-24 px-6 overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-terracotta/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -left-24 w-96 h-96 bg-olive/30 rounded-full blur-3xl" />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <div className="inline-flex items-center gap-2 bg-terracotta/15 text-terracotta px-5 py-2 rounded-full font-bold text-sm uppercase tracking-wider mb-8">
              <Wallet size={16} /> {t("loy.badge")}
            </div>
            <h1 className="text-4xl md:text-6xl font-display font-bold text-white mb-6">
              {t("loy.heroTitle1")}<br />{t("loy.heroTitle2")}
            </h1>
            <p className="text-lg md:text-xl text-white/70 max-w-2xl mx-auto mb-10">
              {t("loy.heroSub")}
            </p>
            <a href="#join" className="terracotta-button px-10 py-4 text-lg inline-block">
              {t("loy.joinFree")}
            </a>
          </motion.div>
        </div>
      </section>

      {/* Bonus examples */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-ink mb-4">{t("loy.moneyTitle")}</h2>
            <p className="text-gray-500 max-w-xl mx-auto">{t("loy.moneySub")}</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {TOP_UP_EXAMPLES.map(({ topUp, bonus }, i) => (
              <motion.div
                key={topUp}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-white rounded-3xl p-8 text-center shadow-sm hover:shadow-lg transition-shadow"
              >
                <div className="w-14 h-14 bg-terracotta/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Gift size={26} className="text-terracotta" />
                </div>
                <p className="text-gray-400 font-medium mb-1">{t("loy.topUp")}</p>
                <p className="text-3xl font-display font-bold text-ink mb-4">฿{topUp.toLocaleString()}</p>
                <div className="bg-cream rounded-2xl py-4">
                  <p className="text-sm text-gray-500 mb-1">{t("loy.youSpend")}</p>
                  <p className="text-2xl font-bold text-terracotta">฿{(topUp + bonus).toLocaleString()}</p>
                  <p className="text-xs text-green-600 font-bold mt-1">{t("loy.freeBonus").replace("{amt}", bonus.toLocaleString())}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-ink mb-4">{t("loy.howTitle")}</h2>
            <p className="text-gray-500">{t("loy.howSub")}</p>
          </div>
          <div className="grid md:grid-cols-3 gap-10">
            {steps.map(({ icon: Icon, title, text }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center"
              >
                <div className="w-16 h-16 bg-olive/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Icon size={28} className="text-olive" />
                </div>
                <h3 className="text-xl font-display font-bold text-ink mb-3">{title}</h3>
                <p className="text-gray-500 leading-relaxed">{text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* LINE */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto bg-[#06C755] rounded-3xl p-10 md:p-14 text-center text-white relative overflow-hidden">
          <div className="absolute -top-16 -right-16 w-64 h-64 bg-white/10 rounded-full" />
          <MessageCircle size={48} className="mx-auto mb-6" />
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">{t("loy.lineTitle")}</h2>
          <p className="text-white/90 max-w-xl mx-auto mb-2 text-lg">
            {t("loy.lineBody")}
          </p>
        </div>
      </section>

      {/* Signup */}
      <section id="join" className="py-20 px-6 bg-white">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-ink mb-4">{t("loy.joinTitle")}</h2>
            <p className="text-gray-500">{t("loy.joinSub")}</p>
          </div>
          <SignupForm />
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-6">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-display font-bold text-ink mb-10 text-center">{t("loy.faqTitle")}</h2>
          <div className="space-y-4">
            {faqs.map((f) => (
              <FaqItem key={f.q} {...f} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
