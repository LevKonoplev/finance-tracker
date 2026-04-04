/**
 * github-sync.js — Синхронизация расходов с GitHub (приватный репозиторий).
 *
 * Хранит expenses.json в корне репозитория. Работает через GitHub Contents API.
 * При отсутствии интернета или невалидном токене — молча переходит в состояние
 * 'error' и не бросает исключений, чтобы приложение работало офлайн.
 */

import { getSetting } from './db.js';
import {
  importExpenses,
  getUnsyncedExpenses,
  markSynced,
} from './db.js';

// ==================== КОНФИГУРАЦИЯ ====================

let token = null;
let repo = null; // формат: "username/repo-name"
let status = 'idle';
let statusCallbacks = [];

const FILE_PATH = 'expenses.json';
const API_BASE = 'https://api.github.com';

// ==================== УТИЛИТЫ BASE64 (Unicode-safe) ====================

/**
 * Кодирует UTF-8 строку в Base64.
 * Стандартный btoa не поддерживает символы за пределами Latin1,
 * поэтому сначала кодируем в URI-компоненты, затем в base64.
 */
function utf8ToBase64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

/**
 * Декодирует Base64 обратно в UTF-8 строку.
 */
function base64ToUtf8(b64) {
  return decodeURIComponent(escape(atob(b64)));
}

// ==================== УПРАВЛЕНИЕ СТАТУСОМ ====================

/**
 * Обновляет текущий статус и уведомляет все зарегистрированные колбэки.
 * @param {'idle'|'syncing'|'error'|'success'} newStatus
 */
function setStatus(newStatus) {
  status = newStatus;
  for (const cb of statusCallbacks) {
    try {
      cb(status);
    } catch (e) {
      console.warn('[github-sync] Ошибка в колбэке статуса:', e);
    }
  }
}

/**
 * Возвращает текущий статус синхронизации.
 * @returns {'idle'|'syncing'|'error'|'success'}
 */
export function getSyncStatus() {
  return status;
}

/**
 * Регистрирует колбэк, вызываемый при каждом изменении статуса.
 * @param {function} callback — функция, принимающая новый статус
 */
export function onStatusChange(callback) {
  if (typeof callback === 'function') {
    statusCallbacks.push(callback);
  }
}

// ==================== ИНИЦИАЛИЗАЦИЯ ====================

/**
 * Загружает токен и репозиторий из IndexedDB (хранилище settings).
 * Вызывать перед любой операцией синхронизации.
 */
export async function initSync() {
  try {
    token = await getSetting('githubToken');
    repo = await getSetting('githubRepo');
  } catch (e) {
    console.warn('[github-sync] Не удалось загрузить настройки:', e);
  }
}

/**
 * Проверяет, настроена ли синхронизация (есть токен и репозиторий).
 * @returns {boolean}
 */
export function isConfigured() {
  return Boolean(token && repo);
}

// ==================== GITHUB API ====================

/**
 * GET-запрос к GitHub Contents API.
 * @param {string} path — путь к файлу в репозитории
 * @returns {{ content: any|null, sha: string|null }}
 */
async function githubGet(path) {
  const url = `${API_BASE}/repos/${repo}/contents/${path}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
    },
  });

  // Файл ещё не существует — это нормально при первой синхронизации
  if (response.status === 404) {
    return { content: null, sha: null };
  }

  if (!response.ok) {
    throw new Error(`GitHub GET ${path}: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  // Контент приходит в Base64 (с возможными переносами строк)
  const raw = data.content.replace(/\n/g, '');
  const decoded = base64ToUtf8(raw);
  const content = JSON.parse(decoded);

  return { content, sha: data.sha };
}

/**
 * PUT-запрос к GitHub Contents API (создание или обновление файла).
 * @param {string} path — путь к файлу
 * @param {any} content — данные для записи (будут сериализованы в JSON)
 * @param {string|null} sha — SHA существующего файла (null при создании)
 * @param {string} message — commit message
 */
async function githubPut(path, content, sha, message) {
  const url = `${API_BASE}/repos/${repo}/contents/${path}`;

  const body = {
    message,
    content: utf8ToBase64(JSON.stringify(content, null, 2)),
  };

  // SHA обязателен при обновлении, при создании его не передаём
  if (sha) {
    body.sha = sha;
  }

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`GitHub PUT ${path}: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// ==================== ОПЕРАЦИИ СИНХРОНИЗАЦИИ ====================

/**
 * Отправляет один расход на GitHub.
 * Добавляет его в expenses.json (создаёт файл, если его нет).
 * Не дублирует — если расход с таким id уже есть, пропускает.
 *
 * @param {object} expense — объект расхода с обязательным полем id
 */
export async function pushExpense(expense) {
  if (!isConfigured()) return;

  try {
    setStatus('syncing');

    // Получаем текущий файл
    const { content, sha } = await githubGet(FILE_PATH);
    const expenses = Array.isArray(content) ? content : [];

    // Проверяем дубликат
    const exists = expenses.some(e => e.id === expense.id);
    if (exists) {
      setStatus('success');
      return;
    }

    // Добавляем и сохраняем
    expenses.push(expense);
    await githubPut(FILE_PATH, expenses, sha, `Добавлен расход: ${expense.category || 'без категории'}`);

    setStatus('success');
  } catch (e) {
    console.error('[github-sync] pushExpense ошибка:', e);
    setStatus('error');
    // Не бросаем — приложение должно работать офлайн
  }
}

/**
 * Загружает все расходы с GitHub.
 * @returns {Array} — массив объектов расходов (пустой, если файл не найден)
 */
export async function pullExpenses() {
  if (!isConfigured()) return [];

  try {
    setStatus('syncing');

    const { content } = await githubGet(FILE_PATH);
    const expenses = Array.isArray(content) ? content : [];

    setStatus('success');
    return expenses;
  } catch (e) {
    console.error('[github-sync] pullExpenses ошибка:', e);
    setStatus('error');
    return [];
  }
}

/**
 * Полная двусторонняя синхронизация:
 * 1. Загружает расходы с GitHub и импортирует новые в IndexedDB
 * 2. Собирает неотправленные расходы из IndexedDB и пушит на GitHub
 * 3. Помечает все локальные расходы как синхронизированные
 *
 * @returns {{ pulled: number, pushed: number }} — количество загруженных и отправленных
 */
export async function fullSync() {
  if (!isConfigured()) return { pulled: 0, pushed: 0 };

  try {
    setStatus('syncing');

    // Шаг 1: скачать и импортировать
    const { content: remoteExpenses, sha: remoteSha } = await githubGet(FILE_PATH);
    const remote = Array.isArray(remoteExpenses) ? remoteExpenses : [];

    const pulled = await importExpenses(remote);

    // Шаг 2: собрать неотправленные
    const unsynced = await getUnsyncedExpenses();
    let pushed = 0;

    if (unsynced.length > 0) {
      // Мержим: берём актуальный remote + добавляем те, которых там нет
      const remoteIds = new Set(remote.map(e => e.id));
      const toAdd = unsynced.filter(e => !remoteIds.has(e.id));

      if (toAdd.length > 0) {
        const merged = [...remote, ...toAdd];

        // Перед PUT нужен актуальный sha (мог измениться, если кто-то пушил параллельно).
        // Мы уже получили sha выше — используем его. Если конфликт — GitHub вернёт 409,
        // и мы попадём в catch.
        await githubPut(FILE_PATH, merged, remoteSha, `Синхронизация: +${toAdd.length} расходов`);
        pushed = toAdd.length;
      }

      // Помечаем все неотправленные как синхронизированные
      await markSynced(unsynced.map(e => e.id));
    }

    setStatus('success');
    return { pulled, pushed };
  } catch (e) {
    console.error('[github-sync] fullSync ошибка:', e);
    setStatus('error');
    return { pulled: 0, pushed: 0 };
  }
}
