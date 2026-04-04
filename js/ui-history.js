import { CATEGORIES, BANKS, formatMoney, formatDate, todayISO, DAY_NAMES } from './constants.js';
import { getExpensesByDateRange, getExpensesByMonth, deleteExpense, getAllExpenses } from './db.js';

// ==================== СОСТОЯНИЕ ====================

let currentFilter = 'today';
let expandedItemId = null;

// ==================== ЭЛЕМЕНТЫ ====================

const $ = (id) => document.getElementById(id);

// ==================== ЭКСПОРТ ====================

export function initHistoryScreen() {
  setupFilterButtons();
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
      buttons.forEach(b => { if (b) b.classList.remove('filter-active'); });
      btn.classList.add('filter-active');
      await loadAndRender();
    });
  }

  activate(btnToday, 'today');
  activate(btnWeek, 'week');
  activate(btnMonth, 'month');

  // Начальное выделение
  if (btnToday) btnToday.classList.add('filter-active');
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

  if (expenses.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'Нет расходов за этот период';
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

    // Заголовок группы
    const header = document.createElement('div');
    header.className = 'day-header';

    const dateSpan = document.createElement('span');
    dateSpan.className = 'day-date';
    dateSpan.textContent = formatDayHeader(date);

    const totalSpan = document.createElement('span');
    totalSpan.className = 'day-total';
    totalSpan.textContent = formatMoney(dayTotal);

    header.appendChild(dateSpan);
    header.appendChild(totalSpan);
    list.appendChild(header);

    // Элементы расходов
    items.forEach(exp => {
      const item = createExpenseItem(exp);
      list.appendChild(item);
    });
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

  const wrapper = document.createElement('div');
  wrapper.className = 'expense-item';
  wrapper.dataset.id = expense.id;

  if (expandedItemId === expense.id) {
    wrapper.classList.add('expanded');
  }

  // Основное содержимое
  const main = document.createElement('div');
  main.className = 'expense-main';

  const leftDiv = document.createElement('div');
  leftDiv.className = 'expense-left';

  const amountSpan = document.createElement('span');
  amountSpan.className = 'expense-amount';
  amountSpan.textContent = formatMoney(expense.amount);
  leftDiv.appendChild(amountSpan);

  const chipSpan = document.createElement('span');
  chipSpan.className = 'category-chip';
  if (cat) {
    chipSpan.style.background = cat.color + '22';
    chipSpan.style.color = cat.color;
    chipSpan.textContent = cat.emoji + ' ' + expense.category;
  } else {
    chipSpan.textContent = expense.category;
  }
  leftDiv.appendChild(chipSpan);

  const rightDiv = document.createElement('div');
  rightDiv.className = 'expense-right';

  if (expense.place) {
    const placeSpan = document.createElement('span');
    placeSpan.className = 'expense-place';
    placeSpan.textContent = expense.place;
    rightDiv.appendChild(placeSpan);
  }

  if (bank) {
    const bankSpan = document.createElement('span');
    bankSpan.className = 'bank-tag';
    bankSpan.style.color = bank.color;
    bankSpan.textContent = bank.short;
    rightDiv.appendChild(bankSpan);
  }

  const timeSpan = document.createElement('span');
  timeSpan.className = 'expense-time';
  timeSpan.textContent = expense.time || '';
  rightDiv.appendChild(timeSpan);

  main.appendChild(leftDiv);
  main.appendChild(rightDiv);

  main.addEventListener('click', () => {
    toggleExpand(wrapper, expense.id);
  });

  wrapper.appendChild(main);

  // Развернутое содержимое
  const details = document.createElement('div');
  details.className = 'expense-details';

  if (expense.comment) {
    const commentDiv = document.createElement('div');
    commentDiv.className = 'expense-comment';
    commentDiv.textContent = expense.comment;
    details.appendChild(commentDiv);
  }

  if (expense.receipt) {
    const receiptDiv = document.createElement('div');
    receiptDiv.className = 'expense-receipt';
    const img = document.createElement('img');
    img.src = expense.receipt;
    img.className = 'receipt-thumb';
    img.alt = 'Чек';
    receiptDiv.appendChild(img);
    details.appendChild(receiptDiv);
  }

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'delete-btn';
  deleteBtn.textContent = 'Удалить';
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    handleDelete(expense.id);
  });
  details.appendChild(deleteBtn);

  wrapper.appendChild(details);

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
