const DEFAULT_MAX_TABS = 20;

function matchesWhitelist(url, whitelist) {
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    return whitelist.some(domain => host === domain || host.endsWith('.' + domain));
  } catch {
    return false;
  }
}

async function cleanup() {
  const { maxTabs = DEFAULT_MAX_TABS, whitelist = [], autoClose = true } = await chrome.storage.local.get(['maxTabs', 'whitelist', 'autoClose']);
  const tabs = await chrome.tabs.query({});

  await updateBadge(tabs.length);

  if (!autoClose || tabs.length <= maxTabs) return;

  const closeable = tabs
    .filter(t => !t.active && !t.pinned && !t.audible && t.id != null && !matchesWhitelist(t.url, whitelist))
    .sort((a, b) => (a.lastAccessed ?? 0) - (b.lastAccessed ?? 0));

  const toClose = closeable.slice(0, tabs.length - maxTabs);
  if (toClose.length === 0) return;

  await chrome.storage.local.set({
    lastClosed: toClose.map(t => t.url).filter(Boolean)
  });

  await chrome.tabs.remove(toClose.map(t => t.id));
  await updateBadge(tabs.length - toClose.length);
}

async function updateBadge(count) {
  const { maxTabs = DEFAULT_MAX_TABS } = await chrome.storage.local.get('maxTabs');
  const third = maxTabs / 3;
  let color;
  if (count > maxTabs)        color = '#e53935'; // 超限：红
  else if (count > third * 2) color = '#fb8c00'; // 接近上限：橙
  else if (count > third)     color = '#f9a825'; // 适中：黄
  else                        color = '#43a047'; // 安全：绿

  chrome.action.setBadgeText({ text: String(count) });
  chrome.action.setBadgeBackgroundColor({ color });
  chrome.action.setBadgeTextColor({ color: '#ffffff' });
}

// alarm 只在安装/更新时创建一次，避免 SW 唤醒时反复重置计时器
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('cleanup', { periodInMinutes: 5 });
});

// SW 每次唤醒时主动刷新 badge，避免系统挂起后 badge 消失
chrome.tabs.query({}).then(tabs => updateBadge(tabs.length));

chrome.tabs.onCreated.addListener(() => cleanup());

chrome.tabs.onRemoved.addListener(async () => {
  const tabs = await chrome.tabs.query({});
  await updateBadge(tabs.length);
});

chrome.alarms.onAlarm.addListener(({ name }) => {
  if (name === 'cleanup') cleanup();
});
