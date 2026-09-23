// Per-page <title> / meta description for the public marketing routes.
//
// Single source of truth used in two places:
//  - scripts/prerender-meta.ts bakes these into dist/<route>.html at build
//    time, so crawlers and link previews (Facebook/LINE) see the right head
//    without running JS (served via "cleanUrls" in firebase.json).
//  - src/seo/RouteMeta.tsx applies them on client-side navigation, so GA4
//    page titles and the canonical tag stay correct inside the SPA.
//
// Blog posts (/blog/:slug) are handled per-post on the server (server.ts),
// and /sitemap.xml lists these paths plus every published post.

export const SITE_URL = 'https://cajunlifecafe.com';

export interface PageMeta {
  title: string;
  description: string;
  /** Page language when not English (sets <html lang> and og:locale). */
  lang?: 'th';
  /** hreflang pair: the English and Thai versions of the same page. */
  alternates?: { en: string; th: string };
}

export const PAGE_META: Record<string, PageMeta> = {
  '/': {
    title: 'Cajun Life Cafe | Healthy Cajun & Thai Food, Pratumnak Hill, Pattaya',
    description:
      'Cajun Life Cafe is a healthy-eating restaurant on Pratumnak Hill, Pattaya — home-cooked Cajun and Thai dishes made with fresh ingredients, high protein, no refined sugar, and gluten-free options. Dine in, order meal prep, or get delivery via LINE.',
    alternates: { en: '/', th: '/th' },
  },
  '/th': {
    title: 'อาหารคลีน พัทยา | Cajun Life Cafe ร้านอาหารสุขภาพ เขาพระตำหนัก',
    description:
      'ร้านอาหารคลีนบนเขาพระตำหนัก พัทยา อาหารเคจันและอาหารไทยโฮมเมด โปรตีนสูง ไม่ใช้น้ำตาลขัดขาว มีตัวเลือกปลอดกลูเตน อาหารเช้าทั้งวัน เปิดทุกวัน 8:00–22:00 น. สั่ง Meal Prep ทาง LINE',
    lang: 'th',
    alternates: { en: '/', th: '/th' },
  },
  '/breakfast': {
    title: 'Breakfast in Pattaya, Served All Day | Cajun Life Cafe, Pratumnak Hill',
    description:
      'English, American and healthy high-protein breakfasts on Pratumnak Hill, Pattaya — served all day, 8am to 10pm, every day. From ฿150.',
  },
  '/digital-menu': {
    title: 'Menu & Prices | Cajun Life Cafe, Pratumnak Hill, Pattaya',
    description:
      'The full Cajun Life Cafe menu with prices — gumbo, jambalaya, protein pancakes, breakfasts, Thai dishes and build-your-own bowls. High protein, no refined sugar, gluten-free options.',
  },
  '/meal-prep': {
    title: 'Meal Prep Pattaya | Clean, Macro-Tracked Meals Delivered — Cajun Life Cafe',
    description:
      'Healthy meal prep in Pattaya — clean, macro-tracked meals built to your spec, prepped fresh on Pratumnak Hill and delivered to your door. Order on LINE.',
  },
  '/healthy-eating': {
    title: 'Healthy Food in Pattaya | High Protein, No Refined Sugar — Cajun Life Cafe',
    description:
      'Looking for healthy food in Pattaya? High-protein meals, no refined sugar, gluten-free options and full macros for every build-your-own ingredient at Cajun Life Cafe, Pratumnak Hill.',
    alternates: { en: '/healthy-eating', th: '/th/healthy-eating' },
  },
  '/th/healthy-eating': {
    title: 'อาหารคลีน โปรตีนสูง พัทยา | ไม่ใช้น้ำตาลขัดขาว — Cajun Life Cafe',
    description:
      'อาหารคลีนในพัทยา โปรตีนสูง ไม่ใช้น้ำตาลขัดขาว มีตัวเลือกปลอดกลูเตน พร้อมค่าโภชนาการของวัตถุดิบทุกตัวในเมนู Build Your Own ที่ Cajun Life Cafe เขาพระตำหนัก',
    lang: 'th',
    alternates: { en: '/healthy-eating', th: '/th/healthy-eating' },
  },
  '/loyalty': {
    title: 'Loyalty Wallet — Get 10% Extra on Every Top-Up | Cajun Life Cafe',
    description:
      'Top up your Cajun Life Cafe wallet and get 10% extra every time. Pay like cash for food, drinks and custom meals, with instant balance updates on LINE.',
  },
  '/influencers': {
    title: 'Influencer & Creator Partnerships | Cajun Life Cafe Pattaya',
    description:
      'Food creators in Pattaya: partner with Cajun Life Cafe on Pratumnak Hill and get a higher loyalty bonus that grows with your influence. Apply in 2 minutes.',
  },
  '/feedback': {
    title: 'Share Your Feedback — Win a ฿300 Voucher | Cajun Life Cafe',
    description:
      'Tell us about your visit to Cajun Life Cafe on Pratumnak Hill, Pattaya — every response goes to the owner, and you can enter to win a ฿300 gift voucher.',
  },
  '/careers': {
    title: 'Jobs at Cajun Life Cafe | Restaurant Careers in Pattaya',
    description:
      'We’re hiring. Join the team at Cajun Life Cafe on Pratumnak Hill, Pattaya — kitchen, service and cafe roles. Apply online.',
  },
  '/blog': {
    title: 'Blog — Healthy Eating & Pratumnak Hill Guides | Cajun Life Cafe',
    description:
      'Healthy eating in Pattaya, high-protein breakfast ideas, Pratumnak Hill local guides and Cajun food explained — from the kitchen at Cajun Life Cafe.',
  },
};
