import { CATEGORIES, DEFAULT_BUDGETS, INCOME, currentMonthKey, formatMoney } from './constants.js';
import { getSetting, setSetting, getBudget, saveBudget, clearAllData } from './db.js';

// ==================== ЭЛЕМЕНТЫ ====================

const $ = (id) => document.getElementById(id);

// ==================== ЭКСПОРТ ====================

export function initSettingsScreen() {
  setupGitHubSection();
  setupBudgetEditor();
  setupIncomeEditor();
  setupExportButton();
  setupClearData();
}

export async function showSettingsScreen() {
  await loadGitHubConfig();
  await loadBudgets();
  await loadIncome();
}

// ==================== GITHUB SYNC ====================

function setupGitHubSection() {
  const tokenInput = $('github-token');
  const repoInput = $('github-repo');
  const saveBtn = $('github-save-btn');
  const syncBtn = $('sync-now-btn');
  const toggleBtn = $('github-token-toggle');

  // Переключатель видимости токена
  if (toggleBtn && tokenInput) {
    toggleBtn.addEventListener('click', () => {
      if (tokenInput.type === 'password') {
        tokenInput.type = 'text';
        toggleBtn.textContent = 'Скрыть';
      } else {
        tokenInput.type = 'password';
        toggleBtn.textContent = 'Показать';
      }
    });
  }

  // Сохранение конфигурации GitHub
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      try {
        const token = tokenInput ? tokenInput.value.trim() : '';
        const repo = repoInput ? repoInput.value.trim() : '';

        await setSetting('githubToken', token);
        await setSetting('githubRepo', repo);

        showToast('Настройки GitHub сохранены');
        updateSyncStatus('Настроено');
      } catch (err) {
        console.error('Ошибка сохранения настроек GitHub:', err);
        showToast('Ошибка сохранения');
      }
    });
  }

  // Синхронизация
  if (syncBtn) {
    syncBtn.addEventListener('click', async () => {
      try {
        syncBtn.disabled = true;
        syncBtn.textContent = 'Синхронизация...';
        updateSyncStatus('Синхронизация...');

        // Динамический импорт github-sync
        const { githubSync } = await import('./github-sync.js');
        await githubSync.sync();

        updateSyncStatus('Синхронизировано: ' + new Date().toLocaleTimeString('ru-RU'));
        showToast('Синхронизация завершена');
      } catch (err) {
        console.error('Ошибка синхронизации:', err);
        updateSyncStatus('Ошибка синхронизации');
        showToast('Ошибка синхронизации');
      } finally {
        syncBtn.disabled = false;
        syncBtn.textContent = 'Синхронизировать сейчас';
      }
    });
  }
}

async function loadGitHubConfig() {
  try {
    const token = await getSetting('githubToken');
    const repo = await getSetting('githubRepo');

    const tokenInput = $('github-token');
    const repoInput = $('github-repo');

    if (tokenInput && token) tokenInput.value = token;
    if (repoInput && repo) repoInput.value = repo;

    if (token && repo) {
      updateSyncStatus('Настроено');
    } else {
      updateSyncStatus('Не настроено');
    }
  } catch (err) {
    console.error('Ошибка загрузки настроек GitHub:', err);
  }
}

function updateSyncStatus(text) {
  const status = $('sync-status');
  if (status) {
    status.textContent = text;
  }
}

// ==================== РЕДАКТОР БЮДЖЕТОВ ====================

function setupBudgetEditor() {
  const saveBtn = $('budget-save-btn');
  if (!saveBtn) return;

  saveBtn.addEventListener('click', async () => {
    try {
      const budgets = {};
      CATEGORIES.forEach(cat => {
        const input = $('budget-' + cat.name);
        if (input) {
          budgets[cat.name] = parseFloat(input.value) || 0;
        }
      });

      await saveBudget({
        id: currentMonthKey(),
        categories: budgets,
        updatedAt: new Date().toISOString(),
      });

      showToast('Бюджет сохранён');
    } catch (err) {
      console.error('Ошибка сохранения бюджета:', err);
      showToast('Ошибка сохранения бюджета');
    }
  });
}

async function loadBudgets() {
  const editor = $('budget-editor');
  if (!editor) return;

  try {
    const budgetData = await getBudget(currentMonthKey());
    const budgets = budgetData ? budgetData.categories : { ...DEFAULT_BUDGETS };

    editor.innerHTML = '';

    CATEGORIES.forEach(cat => {
      const value = budgets[cat.name] !== undefined ? budgets[cat.name] : (DEFAULT_BUDGETS[cat.name] || 0);

      const row = document.createElement('div');
      row.className = 'budget-row';

      const label = document.createElement('label');
      label.className = 'budget-label';

      const colorDot = document.createElement('span');
      colorDot.className = 'budget-cat-color';
      colorDot.style.background = cat.color;
      label.appendChild(colorDot);

      const labelText = document.createTextNode(' ' + cat.emoji + ' ' + cat.name);
      label.appendChild(labelText);

      row.appendChild(label);

      const inputWrap = document.createElement('div');
      inputWrap.className = 'budget-input-wrap';

      const input = document.createElement('input');
      input.type = 'number';
      input.id = 'budget-' + cat.name;
      input.className = 'budget-input';
      input.value = value;
      input.min = '0';
      input.step = '500';
      input.setAttribute('inputmode', 'numeric');
      inputWrap.appendChild(input);

      const currency = document.createElement('span');
      currency.className = 'budget-currency';
      currency.textContent = '\u20BD';
      inputWrap.appendChild(currency);

      row.appendChild(inputWrap);
      editor.appendChild(row);
    });
  } catch (err) {
    console.error('Ошибка загрузки бюджетов:', err);
  }
}

// ==================== РЕДАКТОР ДОХОДА ====================

function setupIncomeEditor() {
  const saveBtn = $('income-save-btn');
  if (!saveBtn) return;

  saveBtn.addEventListener('click', async () => {
    try {
      const advanceInput = $('income-advance');
      const salaryInput = $('income-salary');
      const stipendInput = $('income-stipend');

      const advance = parseFloat(advanceInput?.value) || 0;
      const salary = parseFloat(salaryInput?.value) || 0;
      const stipend = parseFloat(stipendInput?.value) || 0;

      await setSetting('income', { advance, salary, stipend });
      showToast('Доход сохранён');
    } catch (err) {
      console.error('Ошибка сохранения дохода:', err);
      showToast('Ошибка сохранения');
    }
  });
}

async function loadIncome() {
  try {
    const saved = await getSetting('income');
    const income = saved || { advance: INCOME.advance, salary: INCOME.salary, stipend: INCOME.stipend };

    const advanceInput = $('income-advance');
    const salaryInput = $('income-salary');
    const stipendInput = $('income-stipend');

    if (advanceInput) advanceInput.value = income.advance;
    if (salaryInput) salaryInput.value = income.salary;
    if (stipendInput) stipendInput.value = income.stipend;
  } catch (err) {
    console.error('Ошибка загрузки дохода:', err);
  }
}

// ==================== ЭКСПОРТ В EXCEL ====================

function setupExportButton() {
  const btn = $('export-btn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    try {
      btn.disabled = true;
      btn.textContent = 'Экспорт...';

      const { exportToXlsx } = await import('./export.js');
      await exportToXlsx();

      showToast('Экспорт завершён');
    } catch (err) {
      console.error('Ошибка экспорта:', err);
      showToast('Ошибка экспорта');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Экспорт в Excel';
    }
  });
}

// ==================== ОЧИСТКА ДАННЫХ ====================

function setupClearData() {
  const btn = $('clear-data-btn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    showClearConfirmation();
  });
}

function showClearConfirmation() {
  // Первое подтверждение
  const confirmed = confirm('Вы уверены, что хотите удалить все данные? Это действие нельзя отменить.');
  if (!confirmed) return;

  // Второе подтверждение
  const doubleConfirmed = confirm('Точно удалить ВСЕ данные? Расходы, бюджеты и настройки будут стёрты навсегда.');
  if (!doubleConfirmed) return;

  performClearData();
}

async function performClearData() {
  try {
    await clearAllData();
    localStorage.clear();
    showToast('Все данные удалены');

    // Перезагрузить настройки
    await showSettingsScreen();
  } catch (err) {
    console.error('Ошибка очистки данных:', err);
    showToast('Ошибка очистки данных');
  }
}

// ==================== ТОСТ ====================

function showToast(message) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('toast-visible');
  });

  setTimeout(() => {
    toast.classList.remove('toast-visible');
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}
