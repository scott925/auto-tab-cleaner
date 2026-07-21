const t = chrome.i18n.getMessage.bind(chrome.i18n);

// 初始化所有 i18n 文案
document.querySelectorAll('[data-i18n]').forEach(el => {
  el.textContent = t(el.dataset.i18n);
});
document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
  el.placeholder = t(el.dataset.i18nPlaceholder);
});

const statusEl = document.getElementById('status');

function showStatus(msg) {
  statusEl.textContent = msg;
  setTimeout(() => { statusEl.textContent = ''; }, 1500);
}

// ── Auto close toggle ─────────────────────────────────
const autoCloseToggle = document.getElementById('autoClose');

chrome.storage.local.get('autoClose', ({ autoClose = true }) => {
  autoCloseToggle.checked = autoClose;
});

autoCloseToggle.addEventListener('change', () => {
  chrome.storage.local.set({ autoClose: autoCloseToggle.checked });
  showStatus(autoCloseToggle.checked ? t('autoCloseOn') : t('autoCloseOff'));
});

// ── Max tabs ──────────────────────────────────────────
const maxTabsInput = document.getElementById('maxTabs');

chrome.storage.local.get('maxTabs', ({ maxTabs = 20 }) => {
  maxTabsInput.value = maxTabs;
});

maxTabsInput.addEventListener('change', () => {
  const val = Math.max(1, Math.min(200, parseInt(maxTabsInput.value) || 20));
  maxTabsInput.value = val;
  chrome.storage.local.set({ maxTabs: val });
  showStatus(t('saved'));
});

// ── Whitelist ─────────────────────────────────────────
function normalizeDomain(input) {
  const s = input.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  return s;
}

function renderWhitelist(whitelist) {
  const container = document.getElementById('whitelist-items');
  container.innerHTML = '';
  whitelist.forEach(domain => {
    const row = document.createElement('div');
    row.className = 'whitelist-item';
    row.innerHTML = `<span class="domain">${domain}</span><button class="remove" data-domain="${domain}">×</button>`;
    container.appendChild(row);
  });
}

async function loadWhitelist() {
  const { whitelist = [] } = await chrome.storage.local.get('whitelist');
  renderWhitelist(whitelist);
  return whitelist;
}

loadWhitelist();

document.getElementById('addCurrent').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return;
  const domain = normalizeDomain(tab.url);
  if (!domain) return;
  document.getElementById('domainInput').value = domain;
  document.getElementById('addDomain').click();
});

document.getElementById('addDomain').addEventListener('click', async () => {
  const input = document.getElementById('domainInput');
  const domain = normalizeDomain(input.value);
  if (!domain) return;

  const { whitelist = [] } = await chrome.storage.local.get('whitelist');
  if (whitelist.includes(domain)) {
    showStatus(t('alreadyInList'));
    return;
  }
  whitelist.push(domain);
  await chrome.storage.local.set({ whitelist });
  renderWhitelist(whitelist);
  input.value = '';
  showStatus(t('added'));
});

document.getElementById('domainInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('addDomain').click();
});

document.getElementById('whitelist-items').addEventListener('click', async (e) => {
  if (!e.target.classList.contains('remove')) return;
  const domain = e.target.dataset.domain;
  const { whitelist = [] } = await chrome.storage.local.get('whitelist');
  const updated = whitelist.filter(d => d !== domain);
  await chrome.storage.local.set({ whitelist: updated });
  renderWhitelist(updated);
  showStatus(t('removed'));
});

// ── Restore ───────────────────────────────────────────
document.getElementById('restore').addEventListener('click', async () => {
  const { lastClosed = [] } = await chrome.storage.local.get('lastClosed');
  if (lastClosed.length === 0) {
    showStatus(t('nothingToRestore'));
    return;
  }
  for (const url of lastClosed) {
    await chrome.tabs.create({ url });
  }
  await chrome.storage.local.remove('lastClosed');
  window.close();
});
