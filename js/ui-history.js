import { CATEGORIES, BANKS, formatMoney, formatDate, todayISO, DAY_NAMES } from './constants.js';
import { getExpensesByDateRange, getExpensesByMonth, deleteExpense, getAllExpenses, clearAllData } from './db.js';

// ==================== СОСТОЯНИЕ ====================

let currentFilter = 'today';
let expandedItemId = null;

// Bank tag class mapping: index -> CSS modifier class
const BANK_TAG_CLASSES = ['bank-tag--sber', 'bank-tag--alfa', 'bank-tag--tbank', 'bank-tag--yandex'];

// ==================== ЭЛЕМЕНТЫ ====================

const $ = (id) => document.getElementById(id);

// ==================== ЭКСПОРТ ====================

export function initHistoryScreen() {
  setupFilterButtons();
  setupClearHistory();
}

export async function showHistoryScreen() {
  expandedItemId = null;
  await loadAndRender();
}

// ==================== ФИЛЬТРЫ ====================

function setupFilterButtons() {
  const btnToday = $('filter-today');
  const btnWeek = $('filter-week');
  const btnMonth = $('filter-month');

  const buttons = [btnToday, btnWeek, btnMonth];

  function activate(btn, filter) {
    if (!btn) return;
    btn.addEventListener('click', async () => {
      currentFilter = filter;
      buttons.forEach(b => { if (b) b.classList.remove('active'); });
      btn.classList.add('active');
      await loadAndRender();
    });
  }

  activate(btnToday, 'today');
  activate(btnWeek, 'week');
  activate(btnMonth, 'month');

  // Начальное выделение
  if (btnToday) btnToday.classList.add('active');
}

// ==================== ЗАГРУЗКА ДАННЫХ ====================

async function loadExpenses() {
  try {
    const today = todayISO();

    if (currentFilter === 'today') {
      return await getExpensesByDateRange(today, today);
    }

    if (currentFilter === 'week') {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      const weekAgo = d.toISOString().slice(0, 10);
      return await getExpensesByDateRange(weekAgo, today);
    }

    if (currentFilter === 'month') {
      const monthKey = today.slice(0, 7);
      return await getExpensesByMonth(monthKey);
    }

    return [];
  } catch (err) {
    console.error('Ошибка загрузки расходов:', err);
    return [];
  }
}

// ==================== РЕНДЕРИНГ ====================

async function loadAndRender() {
  const expenses = await loadExpenses();
  renderExpenseList(expenses);
}

function renderExpenseList(expenses) {
  const list = $('history-list');
  if (!list) return;

  list.innerHTML = '';

  // Показать/скрыть кнопку очистки
  const actionsDiv = $('history-actions');
  if (actionsDiv) actionsDiv.style.display = expenses.length > 0 ? 'flex' : 'none';

  if (expenses.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';

    const icon = document.createElement('span');
    icon.className = 'empty-state__icon';
    icon.textContent = '\uD83D\uDCCB';
    empty.appendChild(icon);

    const title = document.createElement('p');
    title.className = 'empty-state__title';
    title.textContent = 'Нет расходов за этот период';
    empty.appendChild(title);

    list.appendChild(empty);
    return;
  }

  // Сортировка: новые сверху
  const sorted = [...expenses].sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return (b.time || '').localeCompare(a.time || '');
  });

  // Группировка по дате
  const groups = new Map();
  sorted.forEach(exp => {
    if (!groups.has(exp.date)) {
      groups.set(exp.date, []);
    }
    groups.get(exp.date).push(exp);
  });

  groups.forEach((items, date) => {
    const dayTotal = items.reduce((sum, e) => sum + e.amount, 0);

    // Группа дня
    const dayGroup = document.createElement('div');
    dayGroup.className = 'day-group';

    // Заголовок группы
    const header = document.createElement('div');
    header.className = 'day-group__header';

    const dateSpan = document.createElement('span');
    dateSpan.className = 'day-group__date';
    dateSpan.textContent = formatDayHeader(date);

    const totalSpan = document.createElement('span');
    totalSpan.className = 'day-group__total';
    totalSpan.textContent = formatMoney(dayTotal);

    header.appendChild(dateSpan);
    header.appendChild(totalSpan);
    dayGroup.appendChild(header);

    // Элементы расходов
    items.forEach(exp => {
      const item = createExpenseItem(exp);
      dayGroup.appendChild(item);
    });

    list.appendChild(dayGroup);
  });
}

function formatDayHeader(isoDate) {
  const d = new Date(isoDate + 'T00:00:00');
  const dayName = DAY_NAMES[d.getDay()];
  return formatDate(isoDate) + ', ' + dayName;
}

function createExpenseItem(expense) {
  const cat = CATEGORIES.find(c => c.name === expense.category);
  const bank = BANKS.find(b => b.name === expense.bank);
  const bankIndex = BANKS.findIndex(b => b.name === expense.bank);

  const wrapper = document.createElement('div');
  wrapper.className = 'expense-item';
  wrapper.dataset.id = expense.id;

  // Icon
  const iconDiv = document.createElement('div');
  iconDiv.className = 'expense-item__icon';
  if (cat) {
    iconDiv.textContent = cat.emoji;
    iconDiv.style.backgroundColor = cat.color + '1A';
  }
  wrapper.appendChild(iconDiv);

  // Body
  const body = document.createElement('div');
  body.className = 'expense-item__body';

  // Top row: place + amount
  const top = document.createElement('div');
  top.className = 'expense-item__top';

  const placeSpan = document.createElement('span');
  placeSpan.className = 'expense-item__place';
  placeSpan.textContent = expense.place || (cat ? cat.name : expense.category);
  top.appendChild(placeSpan);

  const amountSpan = document.createElement('span');
  amountSpan.className = 'expense-item__amount';
  amountSpan.textContent = formatMoney(expense.amount);
  top.appendChild(amountSpan);

  body.appendChild(top);

  // Bottom row: category chip + bank tag + time
  const bottom = document.createElement('div');
  bottom.className = 'expense-item__bottom';

  const chipSpan = document.createElement('span');
  chipSpan.className = 'category-chip';
  if (cat) {
    chipSpan.style.background = cat.color + '22';
    chipSpan.style.color = cat.color;

    const chipEmoji = document.createElement('span');
    chipEmoji.className = 'category-chip__emoji';
    chipEmoji.textContent = cat.emoji;
    chipSpan.appendChild(chipEmoji);

    const chipText = document.createTextNode(' ' + expense.category);
    chipSpan.appendChild(chipText);
  } else {
    chipSpan.textContent = expense.category;
  }
  bottom.appendChild(chipSpan);

  if (bank && bankIndex >= 0) {
    const bankSpan = document.createElement('span');
    bankSpan.className = 'bank-tag ' + (BANK_TAG_CLASSES[bankIndex] || '');
    bankSpan.textContent = bank.short;
    bottom.appendChild(bankSpan);
  }

  const timeSpan = document.createElement('span');
  timeSpan.className = 'expense-item__time';
  timeSpan.textContent = expense.time || '';
  bottom.appendChild(timeSpan);

  body.appendChild(bottom);
  wrapper.appendChild(body);

  // Кнопка удаления (видна при раскрытии)
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn-danger';
  deleteBtn.textContent = 'Удалить';
  deleteBtn.style.cssText = 'display:none; margin-top:8px; padding:8px; font-size:0.8125rem;';
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    handleDelete(expense.id);
  });
  wrapper.appendChild(deleteBtn);

  // Click to expand (show delete button)
  wrapper.addEventListener('click', () => {
    const isExpanded = wrapper.classList.contains('expanded');
    // Свернуть все
    const list = $('history-list');
    if (list) {
      list.querySelectorAll('.expense-item').forEach(el => {
        el.classList.remove('expanded');
        const btn = el.querySelector('.btn-danger');
        if (btn) btn.style.display = 'none';
      });
    }
    if (!isExpanded) {
      wrapper.classList.add('expanded');
      deleteBtn.style.display = 'flex';
      expandedItemId = expense.id;
    } else {
      expandedItemId = null;
    }
  });

  return wrapper;
}

// ==================== РАСКРЫТИЕ ЭЛЕМЕНТА ====================

function toggleExpand(wrapper, id) {
  const list = $('history-list');
  if (!list) return;

  if (expandedItemId === id) {
    wrapper.classList.remove('expanded');
    expandedItemId = null;
  } else {
    // Свернуть предыдущий
    list.querySelectorAll('.expense-item.expanded').forEach(el => {
      el.classList.remove('expanded');
    });
    wrapper.classList.add('expanded');
    expandedItemId = id;
  }
}

// ==================== УДАЛЕНИЕ ====================

async function handleDelete(id) {
  const confirmed = confirm('Удалить эту запись?');
  if (!confirmed) return;

  try {
    await deleteExpense(id);
    expandedItemId = null;
    await loadAndRender();
    showToast('Удалено');
  } catch (err) {
    console.error('Ошибка удаления:', err);
    showToast('Ошибка удаления');
  }
}

// ==================== ОЧИСТКА ИСТОРИИ ====================

function setupClearHistory() {
  const btn = $('clear-history-btn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const confirmed = confirm('Удалить ВСЕ расходы? Это действие нельзя отменить.');
    if (!confirmed) return;

    const doubleConfirmed = confirm('Точно удалить ВСЕ расходы из истории?');
    if (!doubleConfirmed) return;

    try {
      await clearAllData();
      expandedItemId = null;
      await loadAndRender();
      showToast('История очищена');
    } catch (err) {
      console.error('Ошибка очистки:', err);
      showToast('Ошибка очистки');
    }
  });
}

// ==================== ТОСТ ====================

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, 2000);
}
