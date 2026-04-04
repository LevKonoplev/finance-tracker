import { initAddScreen, showAddScreen, onSave } from './ui-add.js';
import { initHistoryScreen, showHistoryScreen } from './ui-history.js';
import { initAnalyticsScreen, showAnalyticsScreen } from './ui-analytics.js';
import { initSettingsScreen, showSettingsScreen } from './ui-settings.js';
import { initSync, fullSync, pushExpense, onStatusChange, isConfigured } from './github-sync.js';

// ==================== РОУТЕР ====================

const SCREENS = {
  add: { title: 'Новый расход', show: showAddScreen },
  history: { title: 'История', show: showHistoryScreen },
  analytics: { title: 'Аналитика', show: showAnalyticsScreen },
  settings: { title: 'Настройки', show: showSettingsScreen },
};

let currentScreen = 'add';

function navigate(screen) {
  if (!SCREENS[screen]) screen = 'add';
  currentScreen = screen;

  // Скрыть все экраны (используем .active class, не hidden)
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(`screen-${screen}`).classList.add('active');

  // Обновить заголовок
  document.getElementById('header-title').textContent = SCREENS[screen].title;

  // Обновить табы
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.screen === screen);
  });

  // Вызвать show для экрана
  SCREENS[screen].show();

  // Обновить hash
  history.replaceState(null, '', `#${screen}`);
}

// ==================== TOAST ====================

let toastTimer = null;

export function showToast(message, duration = 2000) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}

// ==================== МОДАЛКА ====================

export function showModal(text) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('modal-overlay');
    const modalText = document.getElementById('modal-text');
    const cancelBtn = document.getElementById('modal-cancel');
    const confirmBtn = document.getElementById('modal-confirm');

    modalText.textContent = text;
    overlay.classList.add('open');

    function cleanup() {
      overlay.classList.remove('open');
      cancelBtn.removeEventListener('click', onCancel);
      confirmBtn.removeEventListener('click', onConfirm);
    }

    function onCancel() { cleanup(); resolve(false); }
    function onConfirm() { cleanup(); resolve(true); }

    cancelBtn.addEventListener('click', onCancel);
    confirmBtn.addEventListener('click', onConfirm);
  });
}

// ==================== SYNC INDICATOR ====================

function updateSyncDot(status) {
  const dot = document.getElementById('sync-indicator');
  dot.className = 'sync-indicator';
  switch (status) {
    case 'syncing': dot.classList.add('sync-indicator--syncing'); break;
    case 'success': dot.classList.add('sync-indicator--synced'); break;
    case 'error': dot.classList.add('sync-indicator--error'); break;
    default: break;
  }
}

// ==================== SERVICE WORKER ====================

async function registerSW() {
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js');
      reg.addEventListener('updatefound', () => {
        const newSW = reg.installing;
        newSW.addEventListener('statechange', () => {
          if (newSW.state === 'activated') {
            showToast('Приложение обновлено!');
          }
        });
      });
    } catch (e) {
      console.error('SW registration failed:', e);
    }
  }
}

// ==================== INIT ====================

async function init() {
  // Service Worker
  registerSW();

  // Инициализация модулей
  initAddScreen();
  initHistoryScreen();
  initAnalyticsScreen();
  initSettingsScreen();

  // GitHub Sync
  await initSync();
  onStatusChange(updateSyncDot);

  // Связь: при сохранении расхода → push в GitHub
  onSave((expense) => {
    if (isConfigured()) {
      pushExpense(expense).catch(console.error);
    }
  });

  // Начальная синхронизация
  if (isConfigured()) {
    fullSync().catch(console.error);
  }

  // Навигация по табам
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.screen));
  });

  // Начальный экран
  const hash = location.hash.slice(1);
  navigate(hash || 'add');
}

// Старт
init().catch(console.error);
