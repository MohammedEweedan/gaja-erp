const { chat } = require('./ollamaClient');
const { createAppointment } = require('../functions/appointments');
const { createTicket } = require('../functions/tickets');

// In-memory session store (replace with Redis for production)
const SESSIONS = new Map();
const getSession = (id) => {
  if (!SESSIONS.has(id)) SESSIONS.set(id, {
    intent: null,
    slots: {},
    step: null,
    lang: null,
    fallbackCount: 0,
    profile: {}, // persist name/phone/email across completed flows
    askCounts: {},
    lastAskedKey: null,
  });
  return SESSIONS.get(id);
};

function applyCtx(sessionId, ctx = {}) {
  const s = getSession(sessionId);
  if (ctx && typeof ctx === 'object') {
    if (ctx.lastItemId != null) {
      const n = Number(ctx.lastItemId);
      if (Number.isFinite(n)) s.lastItemId = n;
    }
    if (ctx.lastQuery != null) {
      s.lastQuery = String(ctx.lastQuery || '');
    }
  }
}

function getSessionState(sessionId) {
  const s = getSession(sessionId);
  return {
    lastItemId: s.lastItemId ?? null,
    lastQuery: s.lastQuery ?? null,
  };
}

// -------- Arabic/Libyan helpers --------
function normalizeDigits(str = '') {
  // Arabic-Indic ٠١٢٣٤٥٦٧٨٩ to 0123456789
  const map = {
    '٠': '0','١': '1','٢': '2','٣': '3','٤': '4','٥': '5','٦': '6','٧': '7','٨': '8','٩': '9',
    '٫': '.', '،': ',',
  };
  return String(str).replace(/[٠-٩٫،]/g, (c) => map[c] || c);
}

// Extract explicit datetime like "2025-10-22 16:30" or time-only "16:30" with current/relative date
function extractExplicitDatetime(text = '', fallbackDatePref = null) {
  const t = normalizeDigits(text);
  const m = t.match(/(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2})/);
  if (m) {
    const [_, d, hhmm] = m;
    const [H, M] = hhmm.split(':').map((x) => parseInt(x, 10));
    if (H >= 0 && H <= 23 && M >= 0 && M <= 59) return `${d}T${hhmm}:00`;
  }
  const m2 = t.match(/\b(\d{1,2}:\d{2})\b/);
  if (m2) {
    const hhmm = m2[1];
    const base = new Date();
    const d = new Date(base);
    const add = Number(fallbackDatePref || 0);
    d.setDate(base.getDate() + add);
    const dateISO = d.toISOString().slice(0,10);
    return `${dateISO}T${hhmm}:00`;
  }
  return null;
}

// -------- Conversation helpers --------
function prefillSlotsFromProfile(session) {
  const p = session.profile || {};
  session.slots = session.slots || {};
  if (!session.slots.name && p.name) session.slots.name = p.name;
  if (!session.slots.phone && p.phone) session.slots.phone = p.phone;
  if (!session.slots.email && p.email) session.slots.email = p.email;
}

function askWithGuard(session, replyKey) {
  const now = Date.now();
  session.askCounts = session.askCounts || {};
  const count = (session.askCounts[replyKey] || 0) + 1;
  session.askCounts[replyKey] = count;
  if (session.lastAskedKey === replyKey && count >= 2) {
    // Avoid repeating same question >1 time; propose escalation once and reset
    session.askCounts[replyKey] = 0;
    session.lastAskedKey = null;
    return { reply: tStr(session.lang, 'escalate_ask'), suggestions: getSuggestions(session) };
  }
  session.lastAskedKey = replyKey;
  return { reply: tStr(session.lang, replyKey), suggestions: getSuggestions(session) };
}

function detectArabic(text = '') {
  return /[\u0600-\u06FF]/.test(text);
}

const STRINGS = {
  ar: {
    ask_name: 'الاسم الكريم؟',
    ask_contact: 'من فضلك اعطيني رقم الهاتف أو الإيميل للتواصل',
    ask_datetime: 'امتا تحب يكون الموعد؟ ممكن تقول اليوم/غدوة والساعة مثلاً 2:00',
    ask_location: 'أي فرع أو مكان تفضّل؟',
    ask_notes: 'حاب تضيف ملاحظة قصيرة؟ لو لا، قول لا',
    ask_subject: 'شن موضوع الطلب أو المشكلة باختصار؟',
    ask_message: 'وضحلي المشكلة/الطلب بجملة أو جملتين',
    ask_consent: 'نقدر نتواصل معاك بخصوص الطلب؟ قول نعم أو لا',
    no_slots_today: 'اليوم ما فيش مواعيد فاضية. جرب تاريخ آخر',
    propose_slots: (dateISO, list) => `المواعيد المتاحة في ${dateISO}: ${list}. اختار وقت مناسب`,
    booked: (id, dt, contact) => `تم حجز الموعد ✅\nرقم: ${id}\n${dt}\nتواصل: ${contact}`,
    ticket_done: (id) => `تم تسجيل طلبك ✅\nرقم التذكرة: ${id}\nحنّة بنتواصل معاك قريب`,
    ticket_fail: 'صار خلل أثناء إنشاء التذكرة، جرّب مرة ثانية',
    appt_fail: 'صار خلل أثناء إنشاء الموعد، جرّب مرة ثانية',
    escalate_ask: 'لو تحب نوصلك بمستشار الخدمة أو تحدد زيارة لأحد فروعنا، نقدر نجهز لك طلب تواصل. تبي نرفع طلب؟',
    not_found_item: 'ما لقيتش صنف يطابق الطلب.',
    item_found: (label, price) => `أقرب نتيجة: ${label}\nالسعر: ${price}`,
    generic: 'مرحبتين، شن تبي نعاونك فيه؟',
  },
  en: {
    ask_name: 'What is your name?',
    ask_contact: 'Please share a phone number or email to contact you',
    ask_datetime: 'When do you prefer the appointment? e.g., today/tomorrow at 2:00',
    ask_location: 'Which branch/location do you prefer',
    ask_notes: 'Any short note you want to add? If not, say no',
    ask_subject: 'What is the topic of your request, briefly',
    ask_message: 'Please describe your request in one or two short sentences',
    ask_consent: 'May we contact you regarding this request? Please say yes or no',
    no_slots_today: 'No available times today. Please try another date',
    propose_slots: (dateISO, list) => `Available on ${dateISO}: ${list}. Please pick a time`,
    booked: (id, dt, contact) => `Booked ✅\nRef: ${id}\n${dt}\nContact: ${contact}`,
    ticket_done: (id) => `Ticket created ✅\nID: ${id}\nOur team will contact you shortly`,
    ticket_fail: 'We failed to create a ticket. Please try again',
    appt_fail: 'We failed to schedule your appointment. Please try again',
    escalate_ask: 'I can connect you to our concierge or help you plan a store visit. Would you like me to create a contact request?',
    not_found_item: 'No matching item was found',
    item_found: (label, price) => `Closest match: ${label}\nPrice: ${price}`,
    generic: 'Hi! How can I help?',
  },
};

function tStr(lang, key, ...args) {
  const S = STRINGS[lang || 'ar'] || STRINGS.ar;
  const v = S[key];
  if (typeof v === 'function') return v(...args);
  return v || '';
}

function detectIntent(text = '') {
  const t = normalizeDigits(text).toLowerCase();
  if (/(موعد|حجز|appointment|book|booking|schedule|reschedule|view|viewing)/.test(t)) return 'create_appointment';
  if (/(اتصال|تواصل|callback|support|مشكلة|ticket|شكوى|human|agent|موظف|بشري|نكلم|نكلم حد|حد)/.test(t)) return 'create_ticket';
  if (/(faq|الاسئلة الشائعة|الأسئلة الشائعة)/.test(t)) return 'faq';
  if (/(sales|revenue|turnover|trend|growth|top\s*sellers|by\s*branch|inventory\s*aging|gross\s*margin|performance|البيعات|المبيعات|ايراد|الإيراد|ارباح|الأرباح|تحليل|تحليلات|تقارير)/.test(t)) return 'admin_analytics';
  if (/(سعر|price|تفاصيل|تفصيل|details|specs|specifications|what\s+is|image|images|picture|photo|صور|صورة|صوّر|item|صنف|منتج|ساعة|watch|ذهب|gold|diamond|الماس)/.test(t)) return 'query_item';
  return 'chitchat';
}

function extractPhone(text = '') {
  const t = normalizeDigits(text);
  const m = t.match(/\+?\d[\d\s-]{6,}/);
  return m ? m[0].replace(/\s|-/g, '') : undefined;
}
function extractEmail(text = '') {
  const m = normalizeDigits(text).match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  return m ? m[0] : undefined;
}
function mapTimePhrase(text = '') {
  const t = normalizeDigits(text).toLowerCase();
  if (/\b(الصبح|morning)\b/.test(t)) return '10:00';
  if (/\b(الظهر|noon)\b/.test(t)) return '12:00';
  if (/\b(العصر)\b/.test(t)) return '15:00';
  if (/\b(العشية|المساء|evening)\b/.test(t)) return '16:00';
  if (/\b(بالليل|night)\b/.test(t)) return '19:00';
  return null;
}

function extractDatePref(text = '') {
  const t = normalizeDigits(text).toLowerCase();
  if (/(اليوم|today)/.test(t)) return 0;
  if (/(غدوة|بكرا|tomorrow)/.test(t)) return 1;
  if (/(بعد غدوة)/.test(t)) return 2;
  return null;
}

// -------- Schedule API callers --------
const API_BASE = process.env.API_BASE_URL || 'http://localhost';
const DEFAULT_PS_ID = Number(process.env.DEFAULT_PS_ID || 1);

async function fetchWorkingHours(psId = DEFAULT_PS_ID) {
  const res = await fetch(`${API_BASE}/api/schedule/working-hours?psId=${psId}`);
  if (!res.ok) throw new Error('working-hours failed');
  return res.json();
}
async function fetchAvailability(dateISO, psId = DEFAULT_PS_ID) {
  const res = await fetch(`${API_BASE}/api/schedule/availability?psId=${psId}&date=${encodeURIComponent(dateISO.slice(0,10))}`);
  if (!res.ok) throw new Error('availability failed');
  return res.json();
}

function nextAppointmentQuestion(slots) {
  if (!slots.name) return 'ask_name';
  if (!slots.phone && !slots.email) return 'ask_contact';
  if (!slots.datetime) return 'ask_datetime';
  if (!slots.location) return 'ask_location';
  if (typeof slots.notes === 'undefined') return 'ask_notes';
  return null;
}

function nextTicketQuestion(slots) {
  // Prefer to collect contact first to reduce friction
  if (!slots.phone && !slots.email) return 'ask_contact';
  if (!slots.name) return 'ask_name';
  if (!slots.subject) return 'ask_subject';
  if (!slots.message) return 'ask_message';
  if (typeof slots.consent === 'undefined') return 'ask_consent';
  return null;
}

// -------- Store aliases --------
const STORE_ALIASES = [
  { k: 'Jraba Main', code: 'P2' },
  { k: 'جرابة الرئيسي', code: 'P2' },
  { k: 'الجرابة مول', code: 'P1' },
  { k: 'Jraba Mall', code: 'P1' },
  { k: 'Headquarters', code: 'P0' },
  { k: 'المقر الرئيسي', code: 'P0' },
  { k: 'Ben Ashour', code: 'P3' },
  { k: 'بن عاشور', code: 'P3' },
  { k: 'P4', code: 'P4' },
  { k: 'P4', code: 'P4' },
  { k: 'any', code: null },
  { k: 'أي فرع', code: null },
];
function normalizeStore(input = '') {
  const x = input.toLowerCase();
  for (const { k, code } of STORE_ALIASES) if (x.includes(k)) return code;
  return null;
}

// Branch name mapping by ps id (0..4)
function branchName(ps) {
  const n = Number(ps);
  switch (n) {
    case 0: return 'المقر الرئيسي';
    case 1: return 'الجرابة مول';
    case 2: return 'جرابة الرئيسي';
    case 3: return 'بن عاشور';
    case 4: return 'P4';
    default: return null;
  }
}

function fmtItemDetails(item, lang) {
  const lines = [];
  const name = item?.name || item?.model || item?.sku || 'Item';
  const sku = item?.sku ? `SKU: ${item.sku}` : null;
  const serial = item?.serial ? `Serial: ${item.serial}` : null;
  const price = item?.price_lyd != null ? `${item.price_lyd} LYD` : (lang==='ar'?'غير محدد':'N/A');
  const avail = typeof item?.available === 'boolean' ? (item.available ? (lang==='ar'?'متاح':'Available') : (lang==='ar'?'مباع':'Sold')) : '';
  const loc = branchName(item?.ps);
  if (lang==='ar') {
    lines.push(`الاسم: ${name}`);
    if (sku) lines.push(`الرمز: ${item.sku}`);
    if (serial) lines.push(`الرقم التسلسلي: ${item.serial}`);
    lines.push(`السعر: ${price}`);
    if (loc) lines.push(`الموقع: ${loc}`);
    if (avail) lines.push(`الحالة: ${avail}`);
  } else {
    lines.push(`Name: ${name}`);
    if (sku) lines.push(sku);
    if (serial) lines.push(serial);
    lines.push(`Price: ${price}`);
    if (loc) lines.push(`Location: ${loc}`);
    if (avail) lines.push(`Status: ${avail}`);
  }
  return lines.join('\n');
}

// -------- Dynamic suggestions --------
function getSuggestions(session) {
  const lang = session.lang || 'ar';
  const s = [];
  if (!session.intent) {
    if (lang === 'ar') {
      s.push({ label: 'حجز موعد', text: 'نبي نحجز موعد' });
      s.push({ label: 'تواصل مع موظف', text: 'ابي حد يتواصل معاي' });
      s.push({ label: 'الأسئلة الشائعة', text: 'شن هي الأسئلة الشائعة؟' });
    } else {
      s.push({ label: 'Book a viewing', text: 'I want to book an appointment' });
      s.push({ label: 'Talk to human', text: 'I want a human agent' });
      s.push({ label: 'FAQs', text: 'Show me FAQs' });
    }
    return s;
  }
  if (session.intent === 'create_appointment') {
    if (!session.slots.datetime) {
      if (lang === 'ar') s.push({ label: 'افتح التقويم', text: '/open_calendar' });
      else s.push({ label: 'Open calendar', text: '/open_calendar' });
    }
    if (!session.slots.phone && session.profile?.phone) {
      const masked = String(session.profile.phone).slice(-4).padStart(String(session.profile.phone).length, '•');
      s.push({ label: lang==='ar'?`استخدم هاتفي (${masked})`:`Use my phone (${masked})`, text: '/use_phone' });
    }
    if (!session.slots.email && session.profile?.email) {
      const em = session.profile.email;
      s.push({ label: lang==='ar'?`استخدم إيميلي (${em})`:`Use my email (${em})`, text: '/use_email' });
    }
    if (!session.slots.name && session.profile?.name) {
      const nm = session.profile.name;
      s.push({ label: lang==='ar'?`استخدم اسمي (${nm})`:`Use my name (${nm})`, text: '/use_name' });
    }
    if (!session.slots.location) {
      if (lang === 'ar') s.push({ label: 'أي فرع', text: 'أي فرع' }); else s.push({ label: 'Any branch', text: 'any branch' });
    }
    return s;
  }
  if (session.intent === 'create_ticket') {
    if (!session.slots.phone && session.profile?.phone) {
      const masked = String(session.profile.phone).slice(-4).padStart(String(session.profile.phone).length, '•');
      s.push({ label: lang==='ar'?`استخدم هاتفي (${masked})`:`Use my phone (${masked})`, text: '/use_phone' });
    }
    if (!session.slots.email && session.profile?.email) {
      const em = session.profile.email;
      s.push({ label: lang==='ar'?`استخدم إيميلي (${em})`:`Use my email (${em})`, text: '/use_email' });
    }
    if (!session.slots.name && session.profile?.name) {
      const nm = session.profile.name;
      s.push({ label: lang==='ar'?`استخدم اسمي (${nm})`:`Use my name (${nm})`, text: '/use_name' });
    }
    if (!session.slots.subject) {
      if (lang === 'ar') s.push({ label: 'طلب تواصل', text: 'طلب تواصل' }); else s.push({ label: 'Callback', text: 'Callback' });
    }
    return s;
  }
  return s;
}

// Heuristic: detect if a text is likely just a name (Arabic/English letters and spaces only)
function isLikelyName(text = '') {
  const t = (text || '').trim();
  if (!t || t.length < 2 || t.length > 60) return false;
  if (t.startsWith('/')) return false;
  if (/[0-9@#:\\/]/.test(t)) return false;
  // Allow Arabic or Latin letters, spaces, and apostrophes/hyphens
  return /^[A-Za-z\u0600-\u06FF'\-\s]+$/.test(t);
}

async function handleText(text, sessionId, channel = 'web') {
  const session = getSession(sessionId);
  // Language selection commands
  const low = String(text || '').toLowerCase();
  if (low.includes('/lang ar')) {
    session.lang = 'ar';
    session.fallbackCount = 0;
    // If in the middle of a flow, return the next pending question in Arabic
    if (session.intent === 'create_appointment') {
      const q = nextAppointmentQuestion(session.slots);
      if (q) return { reply: tStr('ar', q) };
    }
    if (session.intent === 'create_ticket') {
      const q = nextTicketQuestion(session.slots);
      if (q) return { reply: tStr('ar', q) };
    }
    return { reply: STRINGS.ar.generic, suggestions: getSuggestions(session) };
  }
  if (low.includes('/lang en')) {
    session.lang = 'en';
    session.fallbackCount = 0;
    // If in the middle of a flow, return the next pending question in English
    if (session.intent === 'create_appointment') {
      const q = nextAppointmentQuestion(session.slots);
      if (q) return { reply: tStr('en', q) };
    }
    if (session.intent === 'create_ticket') {
      const q = nextTicketQuestion(session.slots);
      if (q) return { reply: tStr('en', q) };
    }
    return { reply: STRINGS.en.generic, suggestions: getSuggestions(session) };
  }

  // Detect or default language, and switch if user changes language mid-convo
  const detected = detectArabic(text) ? 'ar' : 'en';
  if (!session.lang) session.lang = detected;
  else if (detected !== session.lang) session.lang = detected;
  // If new or user changed topic, set intent. Allow switching to chitchat if stuck.
  const inferred = detectIntent(text);
  const stuck = session.lastAskedKey && (session.askCounts?.[session.lastAskedKey] || 0) >= 2;
  if (!session.intent || inferred !== 'chitchat' || stuck) session.intent = inferred;

  // Prefill from profile to reduce repeats across intents
  prefillSlotsFromProfile(session);

  // Quick slot set commands
  if (low.includes('/use_phone') && session.profile?.phone) {
    session.slots.phone = session.profile.phone;
    const q = session.intent === 'create_appointment' ? nextAppointmentQuestion(session.slots) : (session.intent === 'create_ticket' ? nextTicketQuestion(session.slots) : null);
    if (q) return askWithGuard(session, q);
  }
  if (low.includes('/use_email') && session.profile?.email) {
    session.slots.email = session.profile.email;
    const q = session.intent === 'create_appointment' ? nextAppointmentQuestion(session.slots) : (session.intent === 'create_ticket' ? nextTicketQuestion(session.slots) : null);
    if (q) return askWithGuard(session, q);
  }
  if (low.includes('/use_name') && session.profile?.name) {
    session.slots.name = session.profile.name;
    const q = session.intent === 'create_appointment' ? nextAppointmentQuestion(session.slots) : (session.intent === 'create_ticket' ? nextTicketQuestion(session.slots) : null);
    if (q) return askWithGuard(session, q);
  }

  // Common lightweight extraction
  const p = extractPhone(text);
  const e = extractEmail(text);
  const phraseTime = mapTimePhrase(text);
  const datePref = extractDatePref(text);

  // Update slots based on conversation
  if (/^(اسمي|انا|اسمي:)/i.test(text) || /name is/i.test(text) || /^i am\s+/i.test(low) || /^i'm\s+/i.test(low) || /^(this is|call me)\s+/i.test(low)) {
    session.slots.name = text.replace(/^(اسمي|انا|اسمي:)/i, '').trim();
  }
  // If bot is asking for name and user typed a plain name, accept it
  const pendingQForTicket = nextTicketQuestion(session.slots);
  const pendingQForAppt = nextAppointmentQuestion(session.slots);
  const expectingName = pendingQForTicket === 'ask_name' || pendingQForAppt === 'ask_name';
  if (expectingName && isLikelyName(text)) {
    session.slots.name = text.trim();
  }
  // If expecting subject/message, accept user's sentence directly
  if (pendingQForTicket === 'ask_subject' && text && !low.startsWith('/')) {
    const clean = text.trim();
    if (clean.length >= 3) session.slots.subject = clean.slice(0, 200);
  }
  if (pendingQForTicket === 'ask_message' && text && !low.startsWith('/')) {
    const clean = text.trim();
    if (clean.length >= 3) session.slots.message = clean.slice(0, 500);
  }
  if (p) session.slots.phone = p;
  if (e) session.slots.email = e;
  // Explicit datetime like 2025-10-22 16:30 or time-only 16:30
  const explicitDT = extractExplicitDatetime(text, session.slots.datePref);
  if (explicitDT) session.slots.datetime = explicitDT;
  if (datePref !== null) session.slots.datePref = datePref;
  if (phraseTime) session.slots.phraseTime = phraseTime;
  // Try store normalization if user mentioned a branch
  const storeCode = normalizeStore(text);
  if (storeCode !== null) session.slots.location = storeCode || session.slots.location;
  if (/^لا\b/i.test(text)) {
    session.slots.notes = session.slots.notes ?? '';
    session.slots.consent = typeof session.slots.consent === 'undefined' ? false : session.slots.consent;
  }
  if (/^(نعم|ايه|ايوه|ايوة|ايوا|اوكي|موافق|yes|yeah|yep|ok|okay)\b/i.test(text)) session.slots.consent = true;

  // Intent handling
  if (session.intent === 'create_appointment') {
    // If missing any fields, ask next question
    let q = nextAppointmentQuestion(session.slots);
    if (q) {
      // Special case: if datetime missing but we have date/time preferences, propose slots
      if (!session.slots.datetime && (session.slots.datePref !== undefined || session.slots.phraseTime)) {
        try {
          const base = new Date();
          const d = new Date(base);
          const add = Number(session.slots.datePref || 0);
          d.setDate(base.getDate() + add);
          const dateISO = d.toISOString().slice(0,10);
          const avail = await fetchAvailability(dateISO);
          let candidates = avail.slots || [];
          if (session.slots.phraseTime) {
            // Try to find a slot at phrase time
            const target = `${dateISO}T${session.slots.phraseTime}:00`;
            const exact = candidates.find((s) => s.startsWith(target.slice(0,16)));
            if (exact) session.slots.datetime = exact;
          }
          if (!session.slots.datetime) {
            // Propose top 3 nearest in selected language
            const top = candidates.slice(0,3).map((s) => s.slice(11,16)).join(session.lang === 'ar' ? '، ' : ', ');
            if (top) return { reply: tStr(session.lang, 'propose_slots', dateISO, top), suggestions: getSuggestions(session) };
          }
        } catch {}
      }
      return askWithGuard(session, q);
    }

    // All fields ready: ensure datetime aligns to an available slot
    try {
      const dateISO = String(session.slots.datetime).slice(0,10);
      const avail = await fetchAvailability(dateISO);
      const ok = (avail.slots || []).includes(session.slots.datetime);
      const finalDT = ok ? session.slots.datetime : (avail.slots || [])[0];
      if (!finalDT) return { reply: tStr(session.lang, 'no_slots_today'), suggestions: getSuggestions(session) };
      const payload = {
        customer: { name: session.slots.name, phone: session.slots.phone, email: session.slots.email },
        datetime: finalDT,
        location: session.slots.location || 'Main Branch',
        notes: session.slots.notes || '',
        channel,
      };
      const created = await createAppointment(payload);
      // Persist profile (name/phone/email) and lang, reset flow state
      const keep = { profile: session.profile || {}, lang: session.lang };
      if (payload.customer?.name) keep.profile.name = payload.customer.name;
      if (payload.customer?.phone) keep.profile.phone = payload.customer.phone;
      if (payload.customer?.email) keep.profile.email = payload.customer.email;
      SESSIONS.set(sessionId, { intent: null, slots: {}, step: null, fallbackCount: 0, askCounts: {}, lastAskedKey: null, ...keep });
      return { reply: tStr(session.lang, 'booked', created.id, finalDT.replace('T',' '), (payload.customer.phone || payload.customer.email || 'غير محدد')), suggestions: getSuggestions({}) };
    } catch (e2) {
      return { reply: tStr(session.lang, 'appt_fail'), suggestions: getSuggestions(session) };
    }
  }

  if (session.intent === 'create_ticket') {
    const q = nextTicketQuestion(session.slots);
    if (q) return askWithGuard(session, q);
    const payload = {
      subject: session.slots.subject || 'طلب تواصل',
      customer: { name: session.slots.name, phone: session.slots.phone, email: session.slots.email },
      message: session.slots.message || '—',
      channel,
      consent: !!session.slots.consent,
    };
    try {
      const created = await createTicket(payload);
      const keep = { profile: session.profile || {}, lang: session.lang };
      if (payload.customer?.name) keep.profile.name = payload.customer.name;
      if (payload.customer?.phone) keep.profile.phone = payload.customer.phone;
      if (payload.customer?.email) keep.profile.email = payload.customer.email;
      SESSIONS.set(sessionId, { intent: null, slots: {}, step: null, fallbackCount: 0, askCounts: {}, lastAskedKey: null, ...keep });
      return { reply: tStr(session.lang, 'ticket_done', created.id), suggestions: getSuggestions({}) };
    } catch (e2) {
      return { reply: tStr(session.lang, 'ticket_fail'), suggestions: getSuggestions(session) };
    }
  }

  // Admin analytics (employee-only)
  if (session.intent === 'admin_analytics') {
    const isEmp = channel === 'web-emp';
    if (!isEmp) {
      const rep = session.lang === 'ar'
        ? 'التقارير والتحليلات للإدارة متاحة فقط عبر القناة الداخلية.'
        : 'Executive analytics are available on the internal channel only.';
      return { reply: rep, suggestions: getSuggestions(session) };
    }
    try {
      const now = new Date();
      const to = now.toISOString().slice(0,10);
      const fromDate = new Date(now); fromDate.setDate(now.getDate() - 30);
      const from = fromDate.toISOString().slice(0,10);
      const [s1, s2, s3] = await Promise.all([
        fetch(`${API_BASE}/api/analytics/sales/summary?from=${from}&to=${to}`),
        fetch(`${API_BASE}/api/analytics/sales/top-items?from=${from}&to=${to}&limit=5`),
        fetch(`${API_BASE}/api/analytics/sales/by-branch?from=${from}&to=${to}`),
      ]);
      const j1 = s1.ok ? await s1.json() : {};
      const j2 = s2.ok ? await s2.json() : {};
      const j3 = s3.ok ? await s3.json() : {};
      const total = j1?.total ?? 0;
      const mom = j1?.mom ?? null;
      const yoy = j1?.yoy ?? null;
      const top = Array.isArray(j2?.items) ? j2.items : [];
      const byBranch = Array.isArray(j3?.branches) ? j3.branches : [];

      const bullet = (txt) => `- ${txt}`;
      let lines = [];
      if (session.lang === 'ar') {
        lines.push('ملخص الإدارة — آخر 30 يومًا:');
        lines.push(bullet(`إجمالي المبيعات: ${Number(total).toLocaleString('en-US')} LYD`));
        if (mom != null) lines.push(bullet(`التغير عن الشهر السابق: ${mom > 0 ? '+' : ''}${(mom*100).toFixed(1)}%`));
        if (yoy != null) lines.push(bullet(`التغير السنوي: ${yoy > 0 ? '+' : ''}${(yoy*100).toFixed(1)}%`));
        if (byBranch.length) {
          const seg = byBranch.slice(0,4).map(x => `${x.branch}: ${Number(x.total).toLocaleString('en-US')} LYD`).join(' | ');
          lines.push(bullet(`حسب الفروع: ${seg}`));
        }
        if (top.length) {
          const seg = top.map((x,i)=> `${i+1}) ${x.label} — ${Number(x.total).toLocaleString('en-US')} LYD`).join('\n');
          lines.push('الأكثر مبيعًا:');
          lines.push(seg);
        }
        lines.push('توصيات تنفيذية:');
        lines.push(bullet('ركز العروض على الصنفين الأعلى مبيعًا مع حزمة خدمة ما بعد البيع.'));
        lines.push(bullet('راجع أداء فرع منخفض الأداء وابحث عن أسباب (توافر، تسعير، تدريب).'));
        lines.push(bullet('أطلق حملة بسيطة على واتساب للعملاء المترددين خلال 14 يومًا.'));
      } else {
        lines.push('Executive summary — last 30 days:');
        lines.push(bullet(`Total sales: ${Number(total).toLocaleString('en-US')} LYD`));
        if (mom != null) lines.push(bullet(`MoM change: ${mom > 0 ? '+' : ''}${(mom*100).toFixed(1)}%`));
        if (yoy != null) lines.push(bullet(`YoY change: ${yoy > 0 ? '+' : ''}${(yoy*100).toFixed(1)}%`));
        if (byBranch.length) {
          const seg = byBranch.slice(0,4).map(x => `${x.branch}: ${Number(x.total).toLocaleString('en-US')} LYD`).join(' | ');
          lines.push(bullet(`By branch: ${seg}`));
        }
        if (top.length) {
          const seg = top.map((x,i)=> `${i+1}) ${x.label} — ${Number(x.total).toLocaleString('en-US')} LYD`).join('\n');
          lines.push('Top sellers:');
          lines.push(seg);
        }
        lines.push('Recommended actions:');
        lines.push(bullet('Double down on the top 2 SKUs with a bundled after‑sale service.'));
        lines.push(bullet('Investigate underperforming branch (stocking, pricing, training).'));
        lines.push(bullet('Run a WhatsApp re‑engagement campaign for dormant leads within 14 days.'));
      }
      return { reply: lines.join('\n'), suggestions: getSuggestions(session) };
    } catch (e) {
      const rep = session.lang === 'ar' ? 'تعذر تحميل التقارير الآن.' : 'Unable to load analytics right now.';
      return { reply: rep, suggestions: getSuggestions(session) };
    }
  }

  // Item queries — allow on all channels; restrict images to employees
  const isEmp = channel === 'web-emp';
  if (session.intent === 'query_item') {
    try {
      const raw = normalizeDigits(text).trim();
      const t = raw.toLowerCase();
      let type = '';
      if (/(ساعة|watch|watches)/.test(t)) type = 'watch';
      else if (/(diamond|الماس)/.test(t)) type = 'diamond';
      else if (/(gold|ذهب)/.test(t)) type = 'gold';
      // Detect follow-ups
      const askImages = /(picture|image|photo|صور|صورة)/.test(t);
      const askWhere = /(where|stored|branch|ps|وين|فين|مكان|فرع)/.test(t);
      const askDetails = /(details|تفاصيل|what is|ما هو|شن هو|شنها)/.test(t);
      const m = raw.match(/\b\d{3,}\b/);
      const idCandidate = m ? Number(m[0]) : (session.lastItemId || null);

      const askImagesAllowed = askImages && isEmp; // images only for employees
      if ((askImagesAllowed || askWhere || askDetails) && idCandidate) {
        try {
          const detRes = await fetch(`${API_BASE}/api/items/${idCandidate}`);
          if (detRes.ok) {
            const det = await detRes.json();
            const item = det?.item || null;
            if (item) {
              session.lastItemId = item.id;
              if (askImagesAllowed) {
                let imgs = Array.isArray(item.images) ? item.images : [];
                if (!imgs.length) {
                  try {
                    const imgRes = await fetch(`${API_BASE}/api/items/images?wpId=${item.id}`);
                    if (imgRes.ok) {
                      const d3 = await imgRes.json();
                      imgs = Array.isArray(d3?.urls) ? d3.urls : [];
                    }
                  } catch {}
                }
                if (imgs.length) {
                  const rep = session.lang==='ar' ? 'هذه بعض الصور للصنف' : 'Here are some images of the item';
                  return { reply: rep, images: imgs, suggestions: getSuggestions(session) };
                }
                const rep = session.lang==='ar' ? 'ما فيش صور متاحة لهذا الصنف.' : 'No images available for this item.';
                return { reply: rep, suggestions: getSuggestions(session) };
              }
              if (askWhere) {
                const loc = branchName(item.ps, session.lang);
                const rep = loc ? (session.lang==='ar'?`الصنف موجود في فرع ${loc}`:`The item is at ${loc} branch`) : (session.lang==='ar'?'الموقع غير محدد':'Location not specified');
                return { reply: rep, suggestions: getSuggestions(session) };
              }
              // details
              const rep = fmtItemDetails(item, session.lang);
              return { reply: rep, suggestions: getSuggestions(session) };
            }
          }
        } catch (e) {
          console.error(e);
        }
        // If we reached here, try to re-run the last search and fetch details again
        if (session.lastQuery) {
            try {
              const url2 = `${API_BASE}/api/items/search?q=${encodeURIComponent(session.lastQuery)}${type?`&type=${encodeURIComponent(type)}`:''}`;
              const r2 = await fetch(url2);
              if (r2.ok) {
                const d2 = await r2.json();
                const arr = d2?.items || [];
                if (arr.length) {
                  session.lastItemId = arr[0].id;
                  const detRes2 = await fetch(`${API_BASE}/api/items/${arr[0].id}`);
                  if (detRes2.ok) {
                    const det2 = await detRes2.json();
                    const item2 = det2?.item || null;
                    if (item2) {
                      if (askImagesAllowed) {
                        let imgs = Array.isArray(item2.images) ? item2.images : [];
                        if (!imgs.length) {
                          try {
                            const imgRes = await fetch(`${API_BASE}/api/items/images?wpId=${item2.id}`);
                            if (imgRes.ok) {
                              const d3 = await imgRes.json();
                              imgs = Array.isArray(d3?.urls) ? d3.urls : [];
                            }
                          } catch {}
                        }
                        if (imgs.length) {
                          const rep = session.lang==='ar' ? 'هذه بعض الصور للصنف' : 'Here are some images of the item';
                          return { reply: rep, images: imgs, suggestions: getSuggestions(session) };
                        }
                        const rep = session.lang==='ar' ? 'ما فيش صور متاحة لهذا الصنف.' : 'No images available for this item.';
                        return { reply: rep, suggestions: getSuggestions(session) };
                      }
                      if (askWhere) {
                        const loc = branchName(item2.ps, session.lang);
                        const rep = loc ? (session.lang==='ar'?`الصنف موجود في فرع ${loc}`:`The item is at ${loc} branch`) : (session.lang==='ar'?'الموقع غير محدد':'Location not specified');
                        return { reply: rep, suggestions: getSuggestions(session) };
                      }
                      const rep = fmtItemDetails(item2, session.lang);
                      return { reply: rep, suggestions: getSuggestions(session) };
                    }
                  }
                }
              }
            } catch {}
          }
        }

        // Extract a likely code (3+ digits) if present to improve matches
        const qParam = m ? m[0] : raw;
        const url = `${API_BASE}/api/items/search?q=${encodeURIComponent(qParam)}${type?`&type=${encodeURIComponent(type)}`:''}`;
        session.lastQuery = qParam;
        const res = await fetch(url);
        const data = await res.json();
        const items = data?.items || [];
        if (!items.length) return { reply: tStr(session.lang, 'not_found_item'), suggestions: getSuggestions(session) };
        const first = items[0];
        session.lastItemId = first.id;
        session.lastItemSnap = first;
        // Try to improve price by fetching details if missing/zero
        let priceVal = first?.price_lyd;
        if (!(priceVal > 0)) {
          try {
            const detX = await fetch(`${API_BASE}/api/items/${first.id}`);
            if (detX.ok) {
              const dj = await detX.json();
              const p2 = dj?.item?.price_lyd;
              if (p2 != null) priceVal = p2;
            }
          } catch {}
        }
        // Render a compact summary
        const label = first?.name || first?.sku || 'صنف';
        const price = (priceVal != null) ? `${priceVal} LYD` : 'غير محدد';
        return { reply: tStr(session.lang, 'item_found', label, price), suggestions: getSuggestions(session) };
      } catch {
        return { reply: session.lang === 'ar' ? 'تعذر البحث على الأصناف حالياً.' : 'Item search is temporarily unavailable.', suggestions: getSuggestions(session) };
      }
    }

  if (session.intent === 'faq') {
    const ar = `بعض الأسئلة الشائعة:
- المواعيد: كيف نحجز موعد؟
- الأسعار: كيف نعرف السعر؟
- الفروع: وين أقرب فرع؟
شن تبي تعرف بالضبط؟`;
    const en = `Some common FAQs:
- Appointments: How to book?
- Prices: How to check price?
- Branches: Where is the nearest branch?
What would you like to know specifically?`;
    return { reply: session.lang === 'ar' ? ar : en, suggestions: getSuggestions(session) };
  }

  // Chit-chat: send to LLM for helpful, short Libyan reply
  const sys = { role: 'system', content: session.lang === 'ar'
    ? 'تجاوب باللهجة الليبية أو العربية الفصحى حسب كلام المستخدم، باختصار وبأسلوب ودود، ولو لزم نقاط. لو الطلب غير واضح، اسأل سؤال واحد محدد.'
    : 'Reply in natural, friendly English. Be concise, use bullets if needed. If unclear, ask one focused follow-up.'
  };
  const user = { role: 'user', content: text };
  try {
    const llm = await chat([sys, user]);
    const rep = llm?.message?.content || tStr(session.lang, 'generic');
    // Fallback management: if reply equals generic multiple times, escalate to human
    if (!rep || rep === tStr(session.lang, 'generic')) {
      session.fallbackCount = (session.fallbackCount || 0) + 1;
      if (session.fallbackCount >= 2) {
        session.intent = 'create_ticket';
        return { reply: tStr(session.lang, 'escalate_ask'), suggestions: getSuggestions(session) };
      }
    } else {
      session.fallbackCount = 0;
    }
    return { reply: rep, suggestions: getSuggestions(session) };
  } catch {
    return { reply: tStr(session.lang, 'generic'), suggestions: getSuggestions(session) };
  }
}

module.exports = { handleText, applyCtx, getSessionState };
