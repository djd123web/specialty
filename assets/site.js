/* ================= SETTINGS =================
   PAYMENT_MODE: 'onsite' shows the card form on the join page.
                 'hosted' sends members to the payment link set below for their plan.
   PAYMENT_LINKS: hosted payment page per plan (Stripe, Square, PayPal...).
   FORM_ENDPOINT: form service URL (Formspree, Getform...) that delivers the quote,
                  contact, newsletter, membership and job application forms to email.
*/
const CONFIG = {
  PAYMENT_MODE: 'onsite',
  PAYMENT_LINKS: { kitchen: '', household: '', estate: '' },
  FORM_ENDPOINT: ''
};
const SETUP_FEE = 150, ANNUAL_DISCOUNT = 0.10;
const PLAN_PRICE = { kitchen: 199, household: 349, estate: 649 };
const TOWN_ZONE = {
  'Enterprise': 1, 'Level Plains': 1, 'Clayhatchee': 1,
  'Daleville': 2, 'New Brockton': 2, 'Ozark': 2, 'Elba': 2, 'Hartford': 2,
  'Dothan': 3, 'Troy': 3
};
const ZONE_ADD = { 1: 0, 2: 40, 3: 80 };
const ZONE_DAYS = { 1: [1, 2, 3, 4, 5], 2: [2, 4], 3: [3] };

(function () {
  const LOCALES = { en: 'en-US', es: 'es-US', uk: 'uk-UA' };
  const $ = (id) => document.getElementById(id);
  const urlp = new URLSearchParams(location.search);
  let lang = 'en';
  try { const s = localStorage.getItem('shs-lang'); if (s && I18N[s]) lang = s; } catch (e) {}
  if (I18N[urlp.get('lang')]) lang = urlp.get('lang');
  const state = { plan: 'household', cycle: 'monthly' };
  if (PLAN_PRICE[urlp.get('plan')]) state.plan = urlp.get('plan');

  const t = (k) => (I18N[lang] && I18N[lang][k] !== undefined ? I18N[lang][k] : (I18N.en[k] !== undefined ? I18N.en[k] : k));
  const fill = (s, o) => s.replace(/\{(\w+)\}/g, (m, k) => (o[k] !== undefined ? o[k] : m));
  const money = (n) => new Intl.NumberFormat(LOCALES[lang], { style: 'currency', currency: 'USD', minimumFractionDigits: (n % 1 ? 2 : 0), maximumFractionDigits: 2 }).format(n);
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const digits = (s) => s.replace(/\D/g, '');
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
  const showErr = (id, msg) => { const e = $(id); if (!e) return; e.textContent = msg; e.hidden = !msg; };
  const weekday = (d) => new Intl.DateTimeFormat(LOCALES[lang], { weekday: 'long' }).format(new Date(2024, 0, 7 + d));

  /* ---------- language ---------- */
  function applyText() {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach((n) => {
      const v = t(n.getAttribute('data-i18n'));
      if (n.hasAttribute('data-i18n-html')) n.innerHTML = v; else n.textContent = v;
    });
    document.querySelectorAll('[data-i18n-aria]').forEach((n) => n.setAttribute('aria-label', t(n.getAttribute('data-i18n-aria'))));
    document.querySelectorAll('[data-lbl-key]').forEach((n) => n.setAttribute('data-label', t(n.getAttribute('data-lbl-key'))));
    document.querySelectorAll('#langMenu [data-lang]').forEach((b) => {
      const on = b.dataset.lang === lang;
      b.setAttribute('aria-checked', String(on));
      if (on) { $('langFlag').innerHTML = b.querySelector('.fl').innerHTML; $('langCode').textContent = lang === 'uk' ? 'УК' : lang.toUpperCase(); }
    });
    if ($('joinForm')) renderJoin();
  }

  /* ---------- header: burger menu + language dropdown ---------- */
  const burger = $('burger'), mainNav = $('mainNav'), langBtn = $('langBtn'), langMenu = $('langMenu');
  const desktop = window.matchMedia('(min-width:1160px)');
  function setNav(open) {
    mainNav.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', String(open));
  }
  function setLang(open, focusBtn) {
    langMenu.hidden = !open;
    langBtn.setAttribute('aria-expanded', String(open));
    if (open) { const cur = langMenu.querySelector('[aria-checked="true"]') || langMenu.querySelector('button'); cur.focus(); }
    else if (focusBtn) langBtn.focus();
  }
  burger.addEventListener('click', () => { setLang(false); setNav(!mainNav.classList.contains('open')); });
  mainNav.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setNav(false)));
  langBtn.addEventListener('click', () => { setNav(false); setLang(langMenu.hidden); });
  langBtn.addEventListener('keydown', (e) => { if (e.key === 'ArrowDown') { e.preventDefault(); setNav(false); setLang(true); } });
  langMenu.addEventListener('keydown', (e) => {
    const items = [...langMenu.querySelectorAll('button')]; const i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
    else if (e.key === 'Home') { e.preventDefault(); items[0].focus(); }
    else if (e.key === 'End') { e.preventDefault(); items[items.length - 1].focus(); }
    else if (e.key === 'Tab') { setLang(false); }
  });
  langMenu.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => {
    lang = b.dataset.lang; try { localStorage.setItem('shs-lang', lang); } catch (e) {}
    applyText(); setLang(false, true);
  }));
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!langMenu.hidden) setLang(false, true);
    else if (mainNav.classList.contains('open')) { setNav(false); burger.focus(); }
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.langsel')) setLang(false);
    if (!e.target.closest('.navbar')) setNav(false);
  });
  desktop.addEventListener('change', (e) => { if (e.matches) setNav(false); });

  /* ---------- simple forms ---------- */
  function deliver(kind, data) {
    if (!CONFIG.FORM_ENDPOINT) return new Promise((res) => setTimeout(res, 700));
    return fetch(CONFIG.FORM_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(Object.assign({ form: kind }, data)) })
      .then((r) => { if (!r.ok) throw new Error('send'); });
  }
  function simpleForm(formId, errId, btnId, doneId, fields) {
    const form = $(formId); if (!form) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const vals = {}; fields.forEach((f) => { vals[f[0]] = $(f[1]).value.trim(); });
      if (fields.some((f) => !vals[f[0]])) return showErr(errId, t('eReq'));
      if (vals.email !== undefined && !EMAIL_RE.test(vals.email)) return showErr(errId, t('eEmail'));
      if (vals.phone !== undefined && digits(vals.phone).length < 10) return showErr(errId, t('ePhone'));
      showErr(errId, ''); const btn = $(btnId); btn.disabled = true;
      deliver(formId, vals).then(() => {
        $(doneId).hidden = false; form.hidden = true; fields.forEach((f) => { $(f[1]).value = ''; });
      }).catch(() => { showErr(errId, t('eSend')); }).then(() => { btn.disabled = false; });
    });
  }
  simpleForm('wsForm', 'wsErr', 'wsBtn', 'wsDone', [['business', 'w-biz'], ['type', 'w-type'], ['name', 'w-name'], ['email', 'w-email'], ['phone', 'w-phone'], ['needs', 'w-needs']]);
  simpleForm('ctForm', 'ctErr', 'ctBtn', 'ctDone', [['name', 't-name'], ['email', 't-email'], ['message', 't-msg']]);
  simpleForm('nlForm', 'nlErr', 'nlBtn', 'nlDone', [['email', 'n-email']]);

  /* ---------- careers ---------- */
  if ($('careerForm')) {
    document.querySelectorAll('[data-role]').forEach((b) => b.addEventListener('click', () => { $('a-role').value = b.dataset.role; }));
    const pre = urlp.get('role'); if (pre && [...$('a-role').options].some((o) => o.value === pre)) $('a-role').value = pre;
    $('careerForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = (id) => $(id).value.trim();
      if (!v('a-name') || !v('a-email') || !v('a-phone') || !v('a-role')) return showErr('apErr', t('eReq'));
      if (!EMAIL_RE.test(v('a-email'))) return showErr('apErr', t('eEmail'));
      if (digits(v('a-phone')).length < 10) return showErr('apErr', t('ePhone'));
      const f = $('a-file').files[0];
      if (f && (!/\.(pdf|docx?|rtf)$/i.test(f.name) || f.size > 5 * 1024 * 1024)) return showErr('apErr', t('eFile'));
      showErr('apErr', ''); const btn = $('apBtn'); btn.disabled = true;
      const send = CONFIG.FORM_ENDPOINT
        ? (() => { const fd = new FormData(); fd.append('form', 'career'); fd.append('name', v('a-name')); fd.append('email', v('a-email')); fd.append('phone', v('a-phone')); fd.append('position', v('a-role')); fd.append('message', v('a-msg')); if (f) fd.append('resume', f);
            return fetch(CONFIG.FORM_ENDPOINT, { method: 'POST', headers: { Accept: 'application/json' }, body: fd }).then((r) => { if (!r.ok) throw new Error('send'); }); })()
        : new Promise((res) => setTimeout(res, 900));
      send.then(() => {
        const roleLabel = $('a-role').selectedOptions[0].textContent;
        $('apThanksText').textContent = fill(t('apThanks'), { name: v('a-name').split(' ')[0], role: roleLabel, email: v('a-email') });
        $('apDone').hidden = false; $('careerForm').hidden = true;
        $('apDone').scrollIntoView({ behavior: 'smooth', block: 'center' });
      }).catch(() => showErr('apErr', t('eSend'))).then(() => { btn.disabled = false; });
    });
  }

  /* ---------- membership join ---------- */
  function luhn(num) {
    let sum = 0, alt = false;
    for (let i = num.length - 1; i >= 0; i--) { let d = parseInt(num[i], 10); if (alt) { d *= 2; if (d > 9) d -= 9; } sum += d; alt = !alt; }
    return sum % 10 === 0;
  }
  function cardBrand(n) {
    if (/^4/.test(n)) return 'Visa';
    if (/^(5[1-5]|2(2[2-9][1-9]|2[3-9]\d|[3-6]\d\d|7[01]\d|720))/.test(n)) return 'Mastercard';
    if (/^3[47]/.test(n)) return 'American Express';
    if (/^(6011|65|64[4-9])/.test(n)) return 'Discover';
    return '';
  }
  function pricing() {
    const z = TOWN_ZONE[$('j-town').value] || 0;
    const base = PLAN_PRICE[state.plan]; const add = z ? ZONE_ADD[z] : 0;
    const monthly = base + add; const annual = Math.round(monthly * 12 * (1 - ANNUAL_DISCOUNT));
    const isAnnual = state.cycle === 'annual'; const setup = isAnnual ? 0 : SETUP_FEE;
    return { z, base, add, monthly, annual, isAnnual, setup, due: isAnnual ? annual : monthly + setup };
  }
  function renderJoin() {
    document.querySelectorAll('#planSeg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.plan === state.plan)));
    document.querySelectorAll('#cycleSeg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cycle === state.cycle)));
    // day select depends on the town's zone
    const ds = $('j-day'); const dv = ds.value; ds.textContent = '';
    const d0 = el('option', '', t('selectDay')); d0.value = ''; ds.appendChild(d0);
    const z = TOWN_ZONE[$('j-town').value] || 1;
    ZONE_DAYS[z].forEach((d) => { const o = el('option', '', weekday(d)); o.value = String(d); ds.appendChild(o); });
    ds.value = dv; if (ds.value !== dv) ds.value = '';
    const hosted = CONFIG.PAYMENT_MODE === 'hosted' && !!CONFIG.PAYMENT_LINKS[state.plan];
    $('payCard').hidden = hosted;
    const P = pricing();
    $('joinBtn').textContent = hosted ? t('hostedBtn') : t('startBtn') + ' · ' + money(P.due);
    $('authText').innerHTML = fill(t(P.isAnnual ? 'authAnnual' : 'authMonthly'), { amount: money(P.isAnnual ? P.annual : P.monthly) });
    const planName = t({ kitchen: 'planKitchen', household: 'planHousehold', estate: 'planEstate' }[state.plan]);
    const sb = $('sumBody'); sb.textContent = '';
    const line = (a, b, cls) => { const d = el('div', 'ln' + (cls ? ' ' + cls : '')); d.appendChild(el('span', '', a)); d.appendChild(el('span', '', b)); sb.appendChild(d); };
    line(t('sumPlan'), planName + ' · ' + money(P.base));
    line(t('sumArea'), P.z ? (t('zoneName' + P.z) + (P.add ? ' · +' + money(P.add) : '')) : t('chooseTown'));
    line(P.isAnnual ? t('sumAnnual') : t('sumMonthly'), P.isAnnual ? money(P.monthly) + ' × 12 − 10%' : money(P.monthly));
    line(t('sumSetup'), P.isAnnual ? t('waived') : money(SETUP_FEE));
    line(t('sumDue'), money(P.due), 'tot');
    sb.appendChild(el('div', 'note', fill(t(P.isAnnual ? 'sumRenew' : 'sumThen'), { amount: money(P.isAnnual ? P.annual : P.monthly) })));
  }
  function firstVisit(dayNum) {
    const d = new Date(); d.setDate(d.getDate() + 3);
    while (d.getDay() !== dayNum) d.setDate(d.getDate() + 1);
    return new Intl.DateTimeFormat(LOCALES[lang], { weekday: 'long', month: 'long', day: 'numeric' }).format(d);
  }
  if ($('joinForm')) {
    document.querySelectorAll('#planSeg button').forEach((b) => b.addEventListener('click', () => { state.plan = b.dataset.plan; renderJoin(); }));
    document.querySelectorAll('#cycleSeg button').forEach((b) => b.addEventListener('click', () => { state.cycle = b.dataset.cycle; renderJoin(); }));
    $('j-town').addEventListener('change', renderJoin);
    // live card formatting. Card data stays only in these fields and is cleared after use.
    $('c-num').addEventListener('input', (e) => {
      const raw = digits(e.target.value).slice(0, 19); const b = cardBrand(raw);
      e.target.value = (b === 'American Express' ? raw.replace(/^(\d{4})(\d{0,6})(\d{0,5}).*/, (m, a, c, d) => [a, c, d].filter(Boolean).join(' ')) : raw.replace(/(.{4})/g, '$1 ').trim());
      $('brandOut').textContent = b; $('c-cvc').maxLength = b === 'American Express' ? 4 : 3;
    });
    $('c-exp').addEventListener('input', (e) => { let x = digits(e.target.value).slice(0, 4); if (x.length > 2) x = x.slice(0, 2) + '/' + x.slice(2); e.target.value = x; });
    $('c-cvc').addEventListener('input', (e) => { e.target.value = digits(e.target.value).slice(0, 4); });
    $('c-zip').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/[^\d-]/g, '').slice(0, 10); });

    $('joinForm').addEventListener('submit', (e) => {
      e.preventDefault(); const P = pricing();
      const hosted = CONFIG.PAYMENT_MODE === 'hosted' && !!CONFIG.PAYMENT_LINKS[state.plan];
      if (['j-name', 'j-email', 'j-phone', 'j-street', 'j-town', 'j-day'].some((id) => !$(id).value.trim())) return showErr('joinErr', t('eReq'));
      if (!EMAIL_RE.test($('j-email').value.trim())) return showErr('joinErr', t('eEmail'));
      if (digits($('j-phone').value).length < 10) return showErr('joinErr', t('ePhone'));
      if (!P.z) return showErr('joinErr', t('eArea'));
      let num = '', brand = '';
      if (!hosted) {
        if (!$('c-name').value.trim()) return showErr('joinErr', t('eReq'));
        num = digits($('c-num').value); brand = cardBrand(num);
        const okLen = brand === 'American Express' ? num.length === 15 : (num.length >= 13 && num.length <= 19);
        if (!okLen || !luhn(num)) return showErr('joinErr', t('eCard'));
        const m = /^(\d{2})\/(\d{2})$/.exec($('c-exp').value); const now = new Date();
        if (!m) return showErr('joinErr', t('eExp'));
        const mm = +m[1], yy = 2000 + +m[2];
        if (mm < 1 || mm > 12 || yy < now.getFullYear() || (yy === now.getFullYear() && mm < now.getMonth() + 1)) return showErr('joinErr', t('eExp'));
        if ($('c-cvc').value.length < (brand === 'American Express' ? 4 : 3)) return showErr('joinErr', t('eCvc'));
        if (digits($('c-zip').value).length < 5) return showErr('joinErr', t('eZip'));
      }
      if (!$('j-auth').checked) return showErr('joinErr', t('eAuth'));
      showErr('joinErr', '');
      if (hosted) { window.location.href = CONFIG.PAYMENT_LINKS[state.plan]; return; }

      const btn = $('joinBtn'); btn.disabled = true; btn.textContent = t('processing');
      setTimeout(() => {
        if (num === '4000000000000002') { btn.disabled = false; renderJoin(); return showErr('joinErr', t('eDeclined')); }
        const planName = t({ kitchen: 'planKitchen', household: 'planHousehold', estate: 'planEstate' }[state.plan]);
        $('cfNum').textContent = 'SHS-M-' + String(Math.floor(10000 + Math.random() * 89999));
        $('cfL1').textContent = fill(t('cfL1'), { email: $('j-email').value.trim() });
        $('cfL2').textContent = fill(t('cfL2'), { amount: money(P.due), brand: brand || 'Card', last4: num.slice(-4) });
        $('cfL3').textContent = fill(t('cfL3'), { date: firstVisit(+$('j-day').value) });
        const cl = $('cfLines'); cl.textContent = '';
        const ln = (a, b, strong) => { const d = el('div'); d.style.cssText = 'display:flex;justify-content:space-between;gap:12px;font-size:16px' + (strong ? ';font-weight:700;font-size:20px' : ''); d.appendChild(el('span', '', a)); d.appendChild(el('span', '', b)); cl.appendChild(d); };
        ln(planName, money(P.base)); if (P.add) ln(t('sumArea'), '+' + money(P.add));
        ln(t('sumSetup'), P.isAnnual ? t('waived') : money(SETUP_FEE)); ln(t('sumDue'), money(P.due), true);
        ['c-name', 'c-num', 'c-exp', 'c-cvc', 'c-zip'].forEach((id) => { $(id).value = ''; }); num = '';
        $('joinFlow').hidden = true; $('joinDone').hidden = false; btn.disabled = false;
        $('joinDone').scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 1800);
    });
  }
  applyText();
})();
