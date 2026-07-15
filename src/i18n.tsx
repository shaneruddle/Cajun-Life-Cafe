/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type Language = "en" | "zh" | "ru" | "th";

const STORAGE_KEY = "cajun_lang";

const detectLanguage = (): Language => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "zh" || saved === "ru" || saved === "th") return saved;
    const nav = (navigator.language || "").toLowerCase();
    if (nav.startsWith("th")) return "th";
    if (nav.startsWith("ru")) return "ru";
    if (nav.startsWith("zh")) return "zh";
  } catch {
    // ignore
  }
  return "en";
};

const LanguageContext = createContext<{ language: Language; setLanguage: (lang: Language) => void }>({
  language: "en",
  setLanguage: () => {},
});

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>(detectLanguage);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // ignore
    }
  };

  return <LanguageContext.Provider value={{ language, setLanguage }}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => useContext(LanguageContext);

type Dict = Record<string, Record<Language, string>>;

const STRINGS: Dict = {
  // Navbar
  "nav.menu": { en: "Menu", zh: "菜单", ru: "Меню", th: "เมนู" },
  "nav.about": { en: "About", zh: "关于", ru: "О нас", th: "เกี่ยวกับเรา" },
  "nav.location": { en: "Location", zh: "位置", ru: "Адрес", th: "ที่ตั้ง" },
  "nav.contact": { en: "Contact", zh: "联系", ru: "Контакты", th: "ติดต่อ" },
  "nav.loyalty": { en: "Loyalty", zh: "会员", ru: "Бонусы", th: "สมาชิก" },

  // Hero
  "hero.tagline": {
    en: "Authentic Louisiana & Thai Soul Food",
    zh: "正宗路易斯安那与泰式灵魂料理",
    ru: "Аутентичная луизианская и тайская кухня",
    th: "อาหารโซลฟู้ดต้นตำรับหลุยเซียน่าและอาหารไทย",
  },
  "hero.viewMenu": { en: "View Menu", zh: "查看菜单", ru: "Меню", th: "ดูเมนู" },
  "hero.visitUs": { en: "Visit Us", zh: "到店用餐", ru: "Как нас найти", th: "แวะมาหาเรา" },

  // About
  "about.subtitle": {
    en: "Where Healthy Tastes Good",
    zh: "健康也可以很美味",
    ru: "Здоровая еда — это вкусно",
    th: "อาหารสุขภาพที่อร่อยจริง",
  },
  "about.p1": {
    en: "Our healthy meals are cooked with fresh and clean ingredients that are infused with the flavors that embody the traditional taste of Cajun and Creole Cuisine that creates a rich bold taste.",
    zh: "我们的健康餐采用新鲜干净的食材烹制，融入传统卡真与克里奥尔料理的风味，口感浓郁醇厚。",
    ru: "Наши блюда готовятся из свежих, чистых продуктов и наполнены вкусами традиционной каджунской и креольской кухни — насыщенными и яркими.",
    th: "อาหารสุขภาพของเราปรุงจากวัตถุดิบสดใหม่และสะอาด ผสานรสชาติต้นตำรับของอาหารเคจันและครีโอล ให้รสจัดจ้านเข้มข้นเป็นเอกลักษณ์",
  },
  "about.p2": {
    en: 'Cajun Food is a robust, rustic food found along the bayous of Louisiana, a combination of Southern cuisines. Cajun Food is not always spicy, BUT IT ALWAYS HAS SPICE. The Cajun "Holy Trinity" of onions, celery and bell pepper contribute to the flavor along with spices like salt, pepper and cayenne.',
    zh: "卡真菜是源自路易斯安那河口地区的乡村美食，融合了美国南方多种烹饪传统。卡真菜不一定辣，但一定有香料。卡真“三位一体”——洋葱、芹菜和甜椒，与盐、黑胡椒和卡宴辣椒共同造就其风味。",
    ru: "Каджунская кухня — это сытная деревенская еда с берегов Луизианы, сочетание южных кулинарных традиций. Она не всегда острая, НО В НЕЙ ВСЕГДА ЕСТЬ СПЕЦИИ. Каджунская «святая троица» — лук, сельдерей и болгарский перец — создаёт вкус вместе с солью, перцем и кайенским перцем.",
    th: "อาหารเคจันเป็นอาหารพื้นบ้านรสจัดจากริมบึงรัฐหลุยเซียน่า ผสมผสานอาหารทางใต้ของอเมริกา อาหารเคจันไม่จำเป็นต้องเผ็ดเสมอไป แต่ต้องมีเครื่องเทศเสมอ “ตรีเอกานุภาพ” ของเคจัน ได้แก่ หอมใหญ่ ขึ้นฉ่ายฝรั่ง และพริกหวาน ให้รสชาติร่วมกับเกลือ พริกไทย และพริกป่น",
  },
  "about.badge": { en: "Authentic & Fresh", zh: "正宗新鲜", ru: "Аутентично и свежо", th: "ต้นตำรับ สดใหม่" },

  // Menu section
  "menu.title": { en: "Our Menu", zh: "我们的菜单", ru: "Наше меню", th: "เมนูของเรา" },
  "menu.subtitle": {
    en: "A curated selection of Louisiana and Thai favorites, prepared with love and tradition.",
    zh: "精选路易斯安那与泰国美食，用心传承传统风味。",
    ru: "Избранные блюда Луизианы и Таиланда, приготовленные с любовью по традиционным рецептам.",
    th: "เมนูคัดสรรจากหลุยเซียน่าและไทย ปรุงด้วยใจตามตำรับดั้งเดิม",
  },
  "menu.empty": {
    en: "No items found in this category.",
    zh: "该分类暂无菜品。",
    ru: "В этой категории пока нет блюд.",
    th: "ไม่พบรายการในหมวดนี้",
  },

  // Custom meals
  "custom.title": { en: "Build Your Own Meal", zh: "自选搭配餐", ru: "Соберите своё блюдо", th: "จัดมื้ออาหารในแบบของคุณ" },
  "custom.subtitle": {
    en: "Choose your favorite ingredients and build a meal that fits your macros perfectly.",
    zh: "挑选喜欢的食材，搭配最适合你营养目标的一餐。",
    ru: "Выберите любимые ингредиенты и соберите блюдо под свои макросы.",
    th: "เลือกวัตถุดิบที่ชอบ จัดมื้ออาหารให้ตรงตามโภชนาการที่ต้องการ",
  },

  // Location
  "loc.title": { en: "Visit Us", zh: "欢迎光临", ru: "Как нас найти", th: "มาหาเราได้ที่" },
  "loc.address": { en: "Address", zh: "地址", ru: "Адрес", th: "ที่อยู่" },
  "loc.phone": { en: "Phone", zh: "电话", ru: "Телефон", th: "โทร" },
  "loc.hours": { en: "Hours", zh: "营业时间", ru: "Часы работы", th: "เวลาเปิด" },
  "loc.hoursValue": {
    en: "Every day: 8:00 AM – 10:00 PM",
    zh: "每天 8:00 – 22:00",
    ru: "Ежедневно: 8:00 – 22:00",
    th: "ทุกวัน: 8:00 – 22:00 น.",
  },

  // Contact
  "contact.title": { en: "Get in Touch", zh: "联系我们", ru: "Свяжитесь с нами", th: "ติดต่อเรา" },
  "contact.subtitle": {
    en: "Questions, bookings, or special requests — drop us a line and we'll get back to you.",
    zh: "如有疑问、订位或特殊需求，请给我们留言，我们会尽快回复。",
    ru: "Вопросы, бронирование или особые пожелания — напишите нам, и мы ответим.",
    th: "มีคำถาม จองโต๊ะ หรือคำขอพิเศษ ส่งข้อความหาเราได้เลย แล้วเราจะรีบติดต่อกลับ",
  },
  "contact.name": { en: "Name", zh: "姓名", ru: "Имя", th: "ชื่อ" },
  "contact.email": { en: "Email", zh: "邮箱", ru: "Эл. почта", th: "อีเมล" },
  "contact.message": { en: "Message", zh: "留言", ru: "Сообщение", th: "ข้อความ" },
  "contact.phName": { en: "Your name", zh: "您的姓名", ru: "Ваше имя", th: "ชื่อของคุณ" },
  "contact.phMessage": { en: "How can we help?", zh: "我们能帮您什么？", ru: "Чем мы можем помочь?", th: "ให้เราช่วยอะไรดี?" },
  "contact.send": { en: "Send Message", zh: "发送留言", ru: "Отправить", th: "ส่งข้อความ" },
  "contact.sending": { en: "Sending…", zh: "发送中…", ru: "Отправка…", th: "กำลังส่ง…" },
  "contact.sentTitle": { en: "Message Sent!", zh: "留言已发送！", ru: "Сообщение отправлено!", th: "ส่งข้อความแล้ว!" },
  "contact.sentBody": {
    en: "Thanks, {name} — we'll get back to you as soon as we can.",
    zh: "谢谢您，{name}！我们会尽快回复您。",
    ru: "Спасибо, {name}! Мы свяжемся с вами как можно скорее.",
    th: "ขอบคุณค่ะ คุณ{name} เราจะติดต่อกลับโดยเร็วที่สุด",
  },
  "contact.errNameMsg": {
    en: "Please tell us your name and a message.",
    zh: "请填写姓名和留言内容。",
    ru: "Пожалуйста, укажите имя и сообщение.",
    th: "กรุณากรอกชื่อและข้อความ",
  },
  "contact.errReach": {
    en: "Please give us an email or phone number so we can reply.",
    zh: "请留下邮箱或电话，方便我们回复您。",
    ru: "Укажите эл. почту или телефон, чтобы мы могли ответить.",
    th: "กรุณาใส่อีเมลหรือเบอร์โทรเพื่อให้เราติดต่อกลับ",
  },
  "contact.errGeneric": {
    en: "Something went wrong. Please try again.",
    zh: "出错了，请重试。",
    ru: "Что-то пошло не так. Попробуйте ещё раз.",
    th: "เกิดข้อผิดพลาด กรุณาลองใหม่",
  },
  "contact.errConnect": {
    en: "Could not connect. Please check your internet and try again.",
    zh: "无法连接，请检查网络后重试。",
    ru: "Нет соединения. Проверьте интернет и попробуйте снова.",
    th: "เชื่อมต่อไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่",
  },

  // Footer
  "footer.blurb": {
    en: "Bringing the authentic heart and soul of Louisiana cooking to your neighbourhood. Join us for a taste of the bayou.",
    zh: "把地道路易斯安那美食的精髓带到您身边，来品尝河口风味吧。",
    ru: "Настоящий дух луизианской кухни в вашем районе. Загляните к нам попробовать вкус байю.",
    th: "นำหัวใจและจิตวิญญาณของอาหารหลุยเซียน่าแท้ ๆ มาสู่ย่านของคุณ มาลิ้มลองรสชาติแห่งบายูกับเรา",
  },
  "footer.quickLinks": { en: "Quick Links", zh: "快捷链接", ru: "Ссылки", th: "ลิงก์ด่วน" },
  "footer.digitalMenu": { en: "Digital Menu", zh: "电子菜单", ru: "Цифровое меню", th: "เมนูดิจิทัล" },
  "footer.ourStory": { en: "Our Story", zh: "关于我们", ru: "О нас", th: "เรื่องราวของเรา" },
  "footer.loyaltyProgram": { en: "Loyalty Program", zh: "会员计划", ru: "Программа лояльности", th: "โปรแกรมสมาชิก" },
  "footer.rights": { en: "All rights reserved.", zh: "版权所有。", ru: "Все права защищены.", th: "สงวนลิขสิทธิ์" },

  // Loyalty page
  "loy.badge": { en: "Loyalty Wallet", zh: "会员钱包", ru: "Кошелёк лояльности", th: "กระเป๋าสมาชิก" },
  "loy.heroTitle1": { en: "Get 10% Extra,", zh: "充值多送10%，", ru: "Получайте +10%", th: "รับเพิ่ม 10%" },
  "loy.heroTitle2": { en: "Every Time You Top Up", zh: "每次充值都有", ru: "при каждом пополнении", th: "ทุกครั้งที่เติมเงิน" },
  "loy.heroSub": {
    en: "Join the Cajun Life Cafe loyalty program. Top up your wallet at the till and we add 10% bonus credit on the spot — top up ฿1,000, spend ฿1,100.",
    zh: "加入 Cajun Life Cafe 会员计划。在柜台充值即时获得10%奖励——充值฿1,000，可消费฿1,100。",
    ru: "Вступайте в программу лояльности Cajun Life Cafe. Пополните кошелёк на кассе и сразу получите бонус 10% — пополнили на ฿1,000, тратите ฿1,100.",
    th: "สมัครสมาชิก Cajun Life Cafe เติมเงินที่เคาน์เตอร์ รับโบนัสเพิ่ม 10% ทันที — เติม ฿1,000 ใช้ได้ ฿1,100",
  },
  "loy.joinFree": { en: "Join Free Today", zh: "今天免费加入", ru: "Присоединиться бесплатно", th: "สมัครฟรีวันนี้" },
  "loy.moneyTitle": { en: "Your Money Goes Further", zh: "让您的钱更超值", ru: "Ваши деньги работают лучше", th: "เงินของคุณคุ้มค่ากว่าเดิม" },
  "loy.moneySub": {
    en: "A 10% bonus on every top-up — not just the first one.",
    zh: "每次充值都送10%，不止首充。",
    ru: "Бонус 10% за каждое пополнение, а не только за первое.",
    th: "โบนัส 10% ทุกครั้งที่เติม ไม่ใช่แค่ครั้งแรก",
  },
  "loy.topUp": { en: "Top up", zh: "充值", ru: "Пополнение", th: "เติมเงิน" },
  "loy.youSpend": { en: "You get to spend", zh: "可消费金额", ru: "Вы получаете", th: "ใช้จ่ายได้" },
  "loy.freeBonus": { en: "+฿{amt} free", zh: "免费+฿{amt}", ru: "+฿{amt} в подарок", th: "+฿{amt} ฟรี" },
  "loy.howTitle": { en: "How It Works", zh: "如何使用", ru: "Как это работает", th: "ใช้งานอย่างไร" },
  "loy.howSub": {
    en: "Three steps. No app, no card, no catch.",
    zh: "三步搞定。无需App、无需会员卡、没有套路。",
    ru: "Три шага. Без приложения, без карты, без подвоха.",
    th: "แค่ 3 ขั้นตอน ไม่ต้องโหลดแอป ไม่ต้องพกบัตร ไม่มีเงื่อนไขซ่อน",
  },
  "loy.step1t": { en: "1. Sign Up", zh: "1. 注册", ru: "1. Зарегистрируйтесь", th: "1. สมัครสมาชิก" },
  "loy.step1x": {
    en: "Fill in the form below — it takes 30 seconds. No app to download, no card to carry.",
    zh: "填写下方表格，只需30秒。无需下载App，无需携带会员卡。",
    ru: "Заполните форму ниже — это займёт 30 секунд. Без приложений и карт.",
    th: "กรอกแบบฟอร์มด้านล่าง ใช้เวลาแค่ 30 วินาที ไม่ต้องโหลดแอป ไม่ต้องพกบัตร",
  },
  "loy.step2t": { en: "2. Top Up at the Till", zh: "2. 柜台充值", ru: "2. Пополните на кассе", th: "2. เติมเงินที่เคาน์เตอร์" },
  "loy.step2x": {
    en: "On your next visit, top up your wallet with any amount and we instantly add a 10% bonus on top.",
    zh: "下次光临时，充值任意金额，立即获得10%奖励。",
    ru: "В следующий визит пополните кошелёк на любую сумму — мы сразу добавим 10% сверху.",
    th: "ครั้งหน้าที่มาร้าน เติมเงินเท่าไหร่ก็ได้ รับโบนัสเพิ่ม 10% ทันที",
  },
  "loy.step3t": { en: "3. Eat & Enjoy", zh: "3. 尽情享用", ru: "3. Ешьте и наслаждайтесь", th: "3. อิ่มอร่อย" },
  "loy.step3x": {
    en: "Pay straight from your wallet balance. Get a LINE message with your new balance after every visit.",
    zh: "直接用钱包余额支付。每次消费后都会收到LINE余额通知。",
    ru: "Платите прямо с баланса кошелька. После каждого визита — сообщение в LINE с новым балансом.",
    th: "จ่ายจากยอดเงินในกระเป๋าได้เลย รับข้อความแจ้งยอดคงเหลือทาง LINE ทุกครั้ง",
  },
  "loy.lineTitle": { en: "Your Balance, Right in LINE", zh: "余额尽在LINE", ru: "Ваш баланс — прямо в LINE", th: "เช็กยอดเงินได้ใน LINE" },
  "loy.lineBody": {
    en: "Connect your LINE account and get an instant message with your new balance after every top-up and every meal. No app to install — it all happens in LINE.",
    zh: "绑定LINE账号，每次充值和消费后即时收到余额消息。无需安装App，一切都在LINE中完成。",
    ru: "Подключите LINE и получайте мгновенные сообщения с балансом после каждого пополнения и оплаты. Ничего устанавливать не нужно — всё в LINE.",
    th: "เชื่อมต่อบัญชี LINE แล้วรับข้อความแจ้งยอดเงินทันทีหลังเติมเงินและทุกมื้อ ไม่ต้องติดตั้งแอปเพิ่ม ทุกอย่างอยู่ใน LINE",
  },
  "loy.joinTitle": { en: "Join in 30 Seconds", zh: "30秒加入", ru: "Регистрация за 30 секунд", th: "สมัครใน 30 วินาที" },
  "loy.joinSub": {
    en: "Sign up now, top up on your next visit, and your 10% bonus is waiting.",
    zh: "现在注册，下次光临充值，10%奖励等着您。",
    ru: "Зарегистрируйтесь сейчас, пополните при следующем визите — бонус 10% уже ждёт.",
    th: "สมัครตอนนี้ เติมเงินครั้งหน้าที่มา โบนัส 10% รอคุณอยู่",
  },
  "loy.firstName": { en: "First Name", zh: "名字", ru: "Имя", th: "ชื่อ" },
  "loy.lastName": { en: "Last Name", zh: "姓氏", ru: "Фамилия", th: "นามสกุล" },
  "loy.mobile": { en: "Mobile Number", zh: "手机号码", ru: "Номер телефона", th: "เบอร์มือถือ" },
  "loy.emailOpt": { en: "(optional)", zh: "（选填）", ru: "(необязательно)", th: "(ไม่บังคับ)" },
  "loy.join": { en: "Join the Loyalty Program", zh: "加入会员计划", ru: "Вступить в программу", th: "สมัครสมาชิก" },
  "loy.signing": { en: "Signing you up…", zh: "注册中…", ru: "Регистрируем…", th: "กำลังสมัคร…" },
  "loy.privacy": {
    en: "We only use your details for your loyalty wallet and balance updates. No spam, ever.",
    zh: "您的信息仅用于会员钱包和余额通知，绝无垃圾信息。",
    ru: "Ваши данные используются только для кошелька и уведомлений о балансе. Никакого спама.",
    th: "เราใช้ข้อมูลของคุณเฉพาะสำหรับกระเป๋าสมาชิกและแจ้งยอดเงินเท่านั้น ไม่มีสแปม",
  },
  "loy.errFill": {
    en: "Please fill in your name and mobile number.",
    zh: "请填写姓名和手机号码。",
    ru: "Заполните имя и номер телефона.",
    th: "กรุณากรอกชื่อและเบอร์มือถือ",
  },
  "loy.existingTitle": { en: "You're already with us!", zh: "您已经是会员了！", ru: "Вы уже с нами!", th: "คุณเป็นสมาชิกอยู่แล้ว!" },
  "loy.welcome": { en: "Welcome, {name}!", zh: "欢迎您，{name}！", ru: "Добро пожаловать, {name}!", th: "ยินดีต้อนรับ คุณ{name}!" },
  "loy.existingBody": {
    en: "We found you in our system. Just visit the cafe and ask our staff about your loyalty wallet.",
    zh: "系统中已有您的信息。到店询问店员即可使用会员钱包。",
    ru: "Мы нашли вас в системе. Просто зайдите в кафе и спросите у персонала о вашем кошельке.",
    th: "เราพบข้อมูลของคุณในระบบแล้ว แวะมาที่ร้านและสอบถามพนักงานเรื่องกระเป๋าสมาชิกได้เลย",
  },
  "loy.doneBody": {
    en: "You're signed up. Connect on LINE to get balance updates, then visit us to make your first top-up and claim your 10% bonus.",
    zh: "注册成功！绑定LINE接收余额通知，然后到店首次充值领取10%奖励。",
    ru: "Вы зарегистрированы. Подключите LINE для уведомлений, затем заходите к нам — пополните кошелёк и получите бонус 10%.",
    th: "สมัครเรียบร้อยแล้ว เชื่อมต่อ LINE เพื่อรับแจ้งยอดเงิน แล้วแวะมาเติมเงินครั้งแรกรับโบนัส 10%",
  },
  "loy.connectLine": { en: "Connect on LINE", zh: "绑定LINE", ru: "Подключить LINE", th: "เชื่อมต่อ LINE" },
  "loy.faqTitle": { en: "Questions & Answers", zh: "常见问题", ru: "Вопросы и ответы", th: "คำถามที่พบบ่อย" },
  "loy.faq1q": { en: "How does the 10% bonus work?", zh: "10%奖励是怎么回事？", ru: "Как работает бонус 10%?", th: "โบนัส 10% ทำงานอย่างไร?" },
  "loy.faq1a": {
    en: "Every time you top up your wallet, we add 10% extra credit on the spot. Top up ฿1,000 and you get ฿1,100 to spend — on every single top-up, not just the first one.",
    zh: "每次充值我们都当场加送10%余额。充฿1,000得฿1,100——每次充值都送，不止首充。",
    ru: "При каждом пополнении мы сразу добавляем 10% кредита. Пополнили на ฿1,000 — получили ฿1,100. И так с каждым пополнением, не только с первым.",
    th: "ทุกครั้งที่เติมเงิน เราเพิ่มเครดิตให้อีก 10% ทันที เติม ฿1,000 ได้ใช้ ฿1,100 — ทุกครั้งที่เติม ไม่ใช่แค่ครั้งแรก",
  },
  "loy.faq2q": { en: "Does my balance expire?", zh: "余额会过期吗？", ru: "Сгорает ли баланс?", th: "ยอดเงินหมดอายุไหม?" },
  "loy.faq2a": {
    en: "No. Your wallet balance never expires — use it whenever you like.",
    zh: "不会。钱包余额永不过期，随时使用。",
    ru: "Нет. Баланс кошелька не сгорает — используйте когда удобно.",
    th: "ไม่หมดอายุ ยอดเงินในกระเป๋าใช้เมื่อไหร่ก็ได้",
  },
  "loy.faq3q": { en: "How do I check my balance?", zh: "如何查询余额？", ru: "Как проверить баланс?", th: "เช็กยอดเงินอย่างไร?" },
  "loy.faq3a": {
    en: "Connect with us on LINE and you'll receive your updated balance automatically after every top-up and payment. You can also ask our staff at the till any time.",
    zh: "绑定我们的LINE，每次充值和消费后自动收到最新余额。也可随时向柜台店员询问。",
    ru: "Подключитесь к нам в LINE — после каждого пополнения и оплаты вы автоматически получите новый баланс. Также можно спросить персонал на кассе.",
    th: "เชื่อมต่อ LINE กับเรา แล้วรับยอดเงินอัปเดตอัตโนมัติหลังเติมเงินและชำระเงินทุกครั้ง หรือสอบถามพนักงานที่เคาน์เตอร์ได้ตลอด",
  },
  "loy.faq4q": { en: "What can I spend it on?", zh: "可以消费什么？", ru: "На что можно тратить?", th: "ใช้จ่ายอะไรได้บ้าง?" },
  "loy.faq4a": {
    en: "Anything on the menu — food, drinks, custom meals. Your wallet works exactly like cash at Cajun Life Cafe.",
    zh: "菜单上的一切——餐点、饮品、自选搭配餐。会员钱包在Cajun Life Cafe等同现金使用。",
    ru: "На всё в меню — еду, напитки, конструктор блюд. Кошелёк работает как наличные в Cajun Life Cafe.",
    th: "ทุกอย่างในเมนู ทั้งอาหาร เครื่องดื่ม และมื้อจัดเอง กระเป๋าสมาชิกใช้แทนเงินสดที่ Cajun Life Cafe ได้เลย",
  },
  "loy.faq5q": { en: "Can I get a refund on my balance?", zh: "余额可以退款吗？", ru: "Можно ли вернуть деньги с баланса?", th: "ขอคืนเงินได้ไหม?" },
  "loy.faq5a": {
    en: "Wallet credit can't be exchanged back to cash, but it never expires, so there's no rush to use it.",
    zh: "钱包余额不能兑换回现金，但永不过期，可以慢慢使用。",
    ru: "Кредит нельзя обменять обратно на наличные, но он не сгорает — спешить некуда.",
    th: "เครดิตในกระเป๋าแลกคืนเป็นเงินสดไม่ได้ แต่ไม่มีวันหมดอายุ จึงไม่ต้องรีบใช้",
  },

  // Activate flow
  "act.linkUnavailable": { en: "Link Unavailable", zh: "链接不可用", ru: "Ссылка недоступна", th: "ลิงก์ใช้งานไม่ได้" },
  "act.invalidLink": { en: "Invalid link", zh: "链接无效", ru: "Недействительная ссылка", th: "ลิงก์ไม่ถูกต้อง" },
  "act.errConnect": {
    en: "Could not connect. Please try again.",
    zh: "无法连接，请重试。",
    ru: "Нет соединения. Попробуйте ещё раз.",
    th: "เชื่อมต่อไม่ได้ กรุณาลองใหม่",
  },
  "act.hi": { en: "Hi {name}!", zh: "你好，{name}！", ru: "Привет, {name}!", th: "สวัสดีคุณ{name}!" },
  "act.body": {
    en: "Link your LINE account to receive wallet notifications from Cajun Life Cafe.",
    zh: "绑定LINE账号，接收Cajun Life Cafe的钱包通知。",
    ru: "Привяжите аккаунт LINE, чтобы получать уведомления о кошельке от Cajun Life Cafe.",
    th: "เชื่อมบัญชี LINE เพื่อรับการแจ้งเตือนกระเป๋าเงินจาก Cajun Life Cafe",
  },
  "act.b1": {
    en: "Get notified when your wallet is topped up",
    zh: "充值到账即时通知",
    ru: "Уведомления о пополнении кошелька",
    th: "รับแจ้งเตือนเมื่อเติมเงินเข้ากระเป๋า",
  },
  "act.b2": {
    en: "See your balance after each payment",
    zh: "每次消费后查看余额",
    ru: "Баланс после каждой оплаты",
    th: "เห็นยอดคงเหลือหลังชำระเงินทุกครั้ง",
  },
  "act.b3": {
    en: "One-time setup — takes 10 seconds",
    zh: "一次设置，只需10秒",
    ru: "Настройка один раз — 10 секунд",
    th: "ตั้งค่าครั้งเดียว ใช้เวลา 10 วินาที",
  },
  "act.link": { en: "Link with LINE", zh: "绑定LINE", ru: "Привязать LINE", th: "เชื่อมต่อกับ LINE" },
  "act.note": {
    en: "Your LINE account will only be used for wallet notifications.",
    zh: "您的LINE账号仅用于钱包通知。",
    ru: "Ваш LINE используется только для уведомлений о кошельке.",
    th: "บัญชี LINE ของคุณจะใช้สำหรับการแจ้งเตือนกระเป๋าเงินเท่านั้น",
  },
  "act.successTitle": { en: "You're all linked!", zh: "绑定成功！", ru: "Всё подключено!", th: "เชื่อมต่อเรียบร้อย!" },
  "act.successBody": {
    en: "Your LINE account is now connected to your Cajun Life Cafe wallet. You'll receive notifications when your balance changes.",
    zh: "您的LINE已绑定Cajun Life Cafe钱包。余额变动时您将收到通知。",
    ru: "Ваш LINE подключён к кошельку Cajun Life Cafe. Вы будете получать уведомления об изменении баланса.",
    th: "บัญชี LINE ของคุณเชื่อมกับกระเป๋าเงิน Cajun Life Cafe แล้ว คุณจะได้รับแจ้งเตือนเมื่อยอดเงินเปลี่ยนแปลง",
  },
  "act.failTitle": { en: "Activation Failed", zh: "激活失败", ru: "Не удалось активировать", th: "เปิดใช้งานไม่สำเร็จ" },
  "act.failNote": {
    en: "Please ask staff to resend your activation link.",
    zh: "请让店员重新发送激活链接。",
    ru: "Попросите персонал отправить ссылку ещё раз.",
    th: "กรุณาแจ้งพนักงานให้ส่งลิงก์เปิดใช้งานใหม่",
  },

  // Careers page
  "nav.careers": { en: "Careers", zh: "招聘", ru: "Карьера", th: "ร่วมงานกับเรา" },
  "careers.badge": { en: "We're Hiring", zh: "招聘中", ru: "Мы нанимаем", th: "เรากำลังรับสมัคร" },
  "careers.heroTitle": { en: "Come work with us.", zh: "加入我们，一起工作。", ru: "Приходите работать с нами.", th: "มาร่วมงานกับเรา" },
  "careers.heroSub": {
    en: "We're always on the lookout for great people. Good energy, love of food, and good vibes are pretty much the only requirements.",
    zh: "我们一直在寻找优秀的人才。积极的态度、对美食的热爱和良好的氛围感，几乎就是我们唯一的要求。",
    ru: "Мы всегда в поиске отличных людей. Позитивная энергия, любовь к еде и хорошее настроение — вот, пожалуй, и все требования.",
    th: "เรามองหาคนเก่งอยู่เสมอ พลังบวก ความรักในอาหาร และบรรยากาศดี ๆ แทบจะเป็นข้อกำหนดเดียวที่เราต้องการ",
  },
  "careers.whyTitle": { en: "Why Cajun Life", zh: "为什么选择 Cajun Life", ru: "Почему Cajun Life", th: "ทำไมต้อง Cajun Life" },
  "careers.why1Title": { en: "Real food, real team", zh: "真材实料，真诚团队", ru: "Настоящая еда, настоящая команда", th: "อาหารจริงใจ ทีมงานจริงใจ" },
  "careers.why1Desc": {
    en: "We cook scratch Cajun food and we take it seriously. You'll work with people who actually care about what comes out of the kitchen.",
    zh: "我们从零开始烹制卡真美食，并且非常重视品质。您将和真正关心厨房出品的人一起共事。",
    ru: "Мы готовим каджунскую еду с нуля и относимся к этому серьёзно. Вы будете работать с людьми, которым действительно небезразлично, что выходит из кухни.",
    th: "เราปรุงอาหารเคจันจากวัตถุดิบสดใหม่และใส่ใจในทุกขั้นตอน คุณจะได้ทำงานร่วมกับทีมที่ใส่ใจในสิ่งที่ออกมาจากครัวจริง ๆ",
  },
  "careers.why2Title": { en: "Pattaya lifestyle", zh: "芭提雅生活方式", ru: "Стиль жизни Паттайи", th: "ไลฟ์สไตล์แบบพัทยา" },
  "careers.why2Desc": {
    en: "Work in one of the most vibrant cities in Thailand. Sun, sea, and a solid paycheck — it could be worse.",
    zh: "在泰国最具活力的城市之一工作。阳光、海滩，还有稳定的薪水——还能有什么不满足的呢。",
    ru: "Работайте в одном из самых ярких городов Таиланда. Солнце, море и стабильная зарплата — могло быть и хуже.",
    th: "ทำงานในเมืองที่มีชีวิตชีวาที่สุดแห่งหนึ่งของไทย แดด ทะเล และเงินเดือนที่มั่นคง — ชีวิตแย่กว่านี้ก็มี",
  },
  "careers.why3Title": { en: "Good vibes only", zh: "只有好氛围", ru: "Только позитив", th: "บรรยากาศดีอย่างเดียว" },
  "careers.why3Desc": {
    en: "Small team, flat structure, no drama. We look after our people and expect the same in return.",
    zh: "小团队，扁平化管理，没有办公室政治。我们照顾好每一位员工，也希望大家彼此关照。",
    ru: "Небольшая команда, простая структура, никакой драмы. Мы заботимся о своих людях и ждём того же в ответ.",
    th: "ทีมเล็ก โครงสร้างไม่ซับซ้อน ไม่มีดราม่า เราดูแลคนของเราอย่างดี และหวังให้ทุกคนดูแลกันเช่นกัน",
  },
  "careers.applyTitle": { en: "Send us your CV", zh: "发送您的简历", ru: "Отправьте нам резюме", th: "ส่งเรซูเม่ของคุณมาหาเรา" },
  "careers.applySub": {
    en: "No specific openings listed — we hire when we find the right person. Drop us your details and we'll be in touch.",
    zh: "目前没有列出具体空缺职位——我们在找到合适的人时才会招聘。请留下您的信息，我们会与您联系。",
    ru: "Конкретных вакансий сейчас нет — мы нанимаем, когда находим подходящего человека. Оставьте свои данные, и мы свяжемся с вами.",
    th: "ตอนนี้ไม่มีตำแหน่งเปิดรับที่ระบุไว้ชัดเจน — เรารับสมัครเมื่อเจอคนที่ใช่ ส่งข้อมูลของคุณมาได้เลย แล้วเราจะติดต่อกลับ",
  },
  "careers.doneTitle": { en: "Got it — thanks!", zh: "已收到，谢谢！", ru: "Получено — спасибо!", th: "ได้รับแล้ว ขอบคุณค่ะ!" },
  "careers.doneBody": {
    en: "We'll take a look and get back to you if there's a good fit. Good luck {name}!",
    zh: "我们会查看您的申请，如果合适会尽快与您联系。祝{name}好运！",
    ru: "Мы рассмотрим вашу заявку и свяжемся с вами, если всё подойдёт. Удачи, {name}!",
    th: "เราจะพิจารณาและติดต่อกลับหากเหมาะสม โชคดีนะคะคุณ{name}!",
  },
  "careers.labelName": { en: "Name", zh: "姓名", ru: "Имя", th: "ชื่อ" },
  "careers.phName": { en: "Your name", zh: "您的姓名", ru: "Ваше имя", th: "ชื่อของคุณ" },
  "careers.labelEmail": { en: "Email", zh: "邮箱", ru: "Эл. почта", th: "อีเมล" },
  "careers.labelRole": { en: "Role interest", zh: "意向职位", ru: "Интересующая должность", th: "ตำแหน่งที่สนใจ" },
  "careers.selectRole": { en: "Select a role…", zh: "请选择职位…", ru: "Выберите должность…", th: "เลือกตำแหน่ง…" },
  "careers.labelExperience": { en: "Experience / cover note", zh: "工作经验 / 求职信", ru: "Опыт / сопроводительное письмо", th: "ประสบการณ์ / จดหมายแนะนำตัว" },
  "careers.phExperience": {
    en: "Tell us a bit about yourself and what you've done…",
    zh: "简单介绍一下您自己和您的工作经历…",
    ru: "Расскажите немного о себе и своём опыте…",
    th: "เล่าเกี่ยวกับตัวคุณและประสบการณ์ที่ผ่านมาสักเล็กน้อย…",
  },
  "careers.labelCv": { en: "CV / Résumé", zh: "简历", ru: "Резюме", th: "เรซูเม่" },
  "careers.cvHint": { en: "(PDF or Word, max 10 MB)", zh: "（PDF 或 Word 格式，最大 10 MB）", ru: "(PDF или Word, макс. 10 МБ)", th: "(PDF หรือ Word ขนาดไม่เกิน 10 MB)" },
  "careers.attachCv": { en: "Attach your CV", zh: "上传您的简历", ru: "Прикрепите резюме", th: "แนบเรซูเม่ของคุณ" },
  "careers.submit": { en: "Send Application", zh: "提交申请", ru: "Отправить заявку", th: "ส่งใบสมัคร" },
  "careers.sending": { en: "Sending…", zh: "发送中…", ru: "Отправка…", th: "กำลังส่ง…" },
  "careers.footerNote": {
    en: "We'll only use your details to consider your application. No spam.",
    zh: "我们仅将您的信息用于审核申请，绝无垃圾信息。",
    ru: "Мы используем ваши данные только для рассмотрения заявки. Никакого спама.",
    th: "เราใช้ข้อมูลของคุณเพื่อพิจารณาใบสมัครเท่านั้น ไม่มีสแปม",
  },
  "careers.errNameEmail": {
    en: "Please enter your name and email.",
    zh: "请填写姓名和邮箱。",
    ru: "Пожалуйста, укажите имя и эл. почту.",
    th: "กรุณากรอกชื่อและอีเมล",
  },
  "careers.errCvSize": {
    en: "CV file must be under 10 MB.",
    zh: "简历文件不能超过 10 MB。",
    ru: "Файл резюме должен быть меньше 10 МБ.",
    th: "ไฟล์เรซูเม่ต้องมีขนาดไม่เกิน 10 MB",
  },
  "careers.errGeneric": {
    en: "Something went wrong. Please try again.",
    zh: "出错了，请重试。",
    ru: "Что-то пошло не так. Попробуйте ещё раз.",
    th: "เกิดข้อผิดพลาด กรุณาลองใหม่",
  },
  "careers.errConnect": {
    en: "Could not connect. Please try again.",
    zh: "无法连接，请重试。",
    ru: "Не удалось подключиться. Попробуйте ещё раз.",
    th: "เชื่อมต่อไม่ได้ กรุณาลองใหม่",
  },
  "careers.role1": { en: "Kitchen / Chef", zh: "厨房 / 厨师", ru: "Кухня / Повар", th: "ครัว / เชฟ" },
  "careers.role2": { en: "Front of House / Waiter", zh: "前厅 / 服务员", ru: "Зал / Официант", th: "หน้าร้าน / พนักงานเสิร์ฟ" },
  "careers.role3": { en: "Bar Staff / Bartender", zh: "吧台 / 调酒师", ru: "Бар / Бармен", th: "บาร์ / บาร์เทนเดอร์" },
  "careers.role4": { en: "Delivery Driver", zh: "外送司机", ru: "Водитель доставки", th: "พนักงานส่งอาหาร" },
  "careers.role5": { en: "Management", zh: "管理岗位", ru: "Менеджмент", th: "ฝ่ายบริหาร" },
  "careers.role6": { en: "Other / Open to anything", zh: "其他 / 均可接受", ru: "Другое / Готов на всё", th: "อื่น ๆ / เปิดรับทุกตำแหน่ง" },
  "careers.openPositions": { en: "Open Positions", zh: "招聘职位", ru: "Открытые вакансии", th: "ตำแหน่งที่เปิดรับ" },
  "careers.openPositionsSub": {
    en: "Here's what we're hiring for right now. Don't see your role? Send us your CV below anyway.",
    zh: "以下是我们目前正在招聘的职位。没看到合适的职位？也欢迎在下方发送您的简历。",
    ru: "Вот кого мы ищем прямо сейчас. Не нашли подходящую роль? Всё равно отправьте нам резюме ниже.",
    th: "นี่คือตำแหน่งที่เรากำลังเปิดรับสมัครอยู่ตอนนี้ ไม่เห็นตำแหน่งที่ใช่? ส่งเรซูเม่มาหาเราด้านล่างได้เลย",
  },
  "careers.applySubWithJobs": {
    en: "Don't see the right role above? Send us your CV anyway — we hire when we find the right person.",
    zh: "上方没有合适的职位？也欢迎发送简历——我们在找到合适的人时就会招聘。",
    ru: "Не нашли подходящую роль выше? Всё равно отправьте резюме — мы нанимаем, когда находим нужного человека.",
    th: "ไม่เห็นตำแหน่งที่ใช่ด้านบน? ส่งเรซูเม่มาได้เลย เรารับสมัครเมื่อเจอคนที่ใช่",
  },
  "careers.applyForRole": { en: "Apply for this role", zh: "申请此职位", ru: "Откликнуться на вакансию", th: "สมัครตำแหน่งนี้" },
  "careers.fullTime": { en: "Full-time", zh: "全职", ru: "Полная занятость", th: "เต็มเวลา" },
  "careers.partTime": { en: "Part-time", zh: "兼职", ru: "Частичная занятость", th: "พาร์ทไทม์" },
};

export const translate = (language: Language, key: string): string =>
  STRINGS[key]?.[language] ?? STRINGS[key]?.en ?? key;

export const useT = () => {
  const { language } = useLanguage();
  return (key: string) => translate(language, key);
};
