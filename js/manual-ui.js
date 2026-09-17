let manualLang = 'ja';

function renderManual() {
  const body = document.getElementById('manual-body');
  if (!body) return;
  body.innerHTML = MANUAL_SECTIONS.map((sec, i) => {
    const title = manualLang === 'ja' ? sec.titleJa : sec.titleEn;
    const html  = manualLang === 'ja' ? sec.bodyJa  : sec.bodyEn;
    return `<div class="manual-sec">
      <div class="manual-sec-num">${String(i + 1).padStart(2, '0')}</div>
      <h2>${title}</h2>
      ${html}
    </div>`;
  }).join('');
  body.scrollTop = 0;
  document.getElementById('manual-lang-ja').classList.toggle('active', manualLang === 'ja');
  document.getElementById('manual-lang-en').classList.toggle('active', manualLang === 'en');
}

function setManualLang(lang) {
  manualLang = lang;
  try { localStorage.setItem('omnitro_manual_lang', lang); } catch(e) {}
  renderManual();
}

function openManual() {
  document.getElementById('settings-overlay').classList.remove('open');
  renderManual();
  document.getElementById('manual-overlay').classList.add('open');
}

function closeManual() {
  document.getElementById('manual-overlay').classList.remove('open');
}

function setupManual() {
  try {
    const saved = localStorage.getItem('omnitro_manual_lang');
    if (saved === 'ja' || saved === 'en') manualLang = saved;
  } catch(e) {}

  const openBtn = document.getElementById('open-manual-btn');
  if (openBtn) openBtn.addEventListener('click', openManual);

  document.getElementById('manual-close-btn').addEventListener('click', closeManual);
  document.getElementById('manual-lang-ja').addEventListener('click', () => setManualLang('ja'));
  document.getElementById('manual-lang-en').addEventListener('click', () => setManualLang('en'));
}

