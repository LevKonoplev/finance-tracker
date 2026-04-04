import { CATEGORIES, DEFAULT_BUDGETS, MONTH_NAMES, formatMoney, currentMonthKey } from './constants.js';
import { getExpensesByMonth, getBudget } from './db.js';

// ==================== СОСТОЯНИЕ ====================

let activeMonthKey = currentMonthKey();
let donutChart = null;
let dailyChart = null;

// ==================== ЭЛЕМЕНТЫ ====================

const $ = (id) => document.getElementById(id);

// ==================== ЭКСПОРТ ====================

export function initAnalyticsScreen() {
  setupMonthSelector();
}

export async function showAnalyticsScreen() {
  activeMonthKey = currentMonthKey();
  updateMonthDisplay();
  await loadAndRender();
}

// ==================== НАВИГАЦИЯ ПО МЕСЯЦАМ ====================

function setupMonthSelector() {
  const container = $('analytics-month');
  if (!container) return;

  container.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-direction]');
    if (!btn) return;

    const direction = parseInt(btn.dataset.direction, 10);
    changeMonth(direction);
    await loadAndRender();
  });

  updateMonthDisplay();
}

function changeMonth(direction) {
  const [year, month] = activeMonthKey.split('-').map(Number);
  const d = new Date(year, month - 1 + direction, 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  activeMonthKey = y + '-' + m;
  updateMonthDisplay();
}

function updateMonthDisplay() {
  const container = $('analytics-month');
  if (!container) return;

  const [year, month] = activeMonthKey.split('-').map(Number);
  const monthName = MONTH_NAMES[month - 1];

  const label = container.querySelector('.month-label');
  if (label) {
    label.textContent = monthName + ' ' + year;
  }
}

// ==================== ЗАГРУЗКА И РЕНДЕРИНГ ====================

async function loadAndRender() {
  try {
    const expenses = await getExpensesByMonth(activeMonthKey);
    const budgetData = await getBudget(activeMonthKey);
    const budgets = budgetData ? budgetData.categories : { ...DEFAULT_BUDGETS };

    renderSummaryCards(expenses, budgets);
    renderDonutChart(expenses);
    renderDailyChart(expenses);
    renderCategoryTable(expenses, budgets);
  } catch (err) {
    console.error('Ошибка загрузки аналитики:', err);
  }
}

// ==================== ИТОГОВЫЕ КАРТОЧКИ ====================

function renderSummaryCards(expenses, budgets) {
  const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalBudget = Object.values(budgets).reduce((sum, v) => sum + v, 0);
  const remaining = totalBudget - totalSpent;

  // Сколько дней осталось в месяце
  const [year, month] = activeMonthKey.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = new Date();
  let remainingDays;

  if (year === today.getFullYear() && month === today.getMonth() + 1) {
    remainingDays = daysInMonth - today.getDate() + 1;
    if (remainingDays < 1) remainingDays = 1;
  } else {
    remainingDays = daysInMonth;
  }

  const perDay = remaining > 0 ? remaining / remainingDays : 0;

  setSummaryCard('summary-spent', formatMoney(totalSpent));
  setSummaryCard('summary-budget', formatMoney(totalBudget));

  const remainingEl = $('summary-remaining');
  if (remainingEl) {
    const valueEl = remainingEl.querySelector('.summary-value');
    if (valueEl) {
      valueEl.textContent = formatMoney(remaining);
      valueEl.className = 'summary-value ' + (remaining >= 0 ? 'positive' : 'negative');
    }
  }

  setSummaryCard('summary-perday', formatMoney(perDay));
}

function setSummaryCard(id, value) {
  const el = $(id);
  if (!el) return;
  const valueEl = el.querySelector('.summary-value');
  if (valueEl) {
    valueEl.textContent = value;
  }
}

// ==================== КОЛЬЦЕВАЯ ДИАГРАММА ====================

function renderDonutChart(expenses) {
  const canvas = $('chart-donut');
  if (!canvas || !window.Chart) return;

  // Агрегация по категориям
  const catSpending = {};
  expenses.forEach(e => {
    catSpending[e.category] = (catSpending[e.category] || 0) + e.amount;
  });

  const activeCategories = CATEGORIES.filter(c => catSpending[c.name] > 0);
  const labels = activeCategories.map(c => c.emoji + ' ' + c.name);
  const data = activeCategories.map(c => catSpending[c.name]);
  const colors = activeCategories.map(c => c.color);

  if (donutChart) {
    donutChart.destroy();
  }

  donutChart = new window.Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: '#fff',
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '60%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 12,
            usePointStyle: true,
            font: { size: 12 },
          },
        },
        tooltip: {
          callbacks: {
            label(ctx) {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct = total > 0 ? Math.round((ctx.parsed / total) * 100) : 0;
              return ' ' + formatMoney(ctx.parsed) + ' (' + pct + '%)';
            },
          },
        },
      },
    },
  });
}

// ==================== СТОЛБЧАТАЯ ДИАГРАММА ====================

function renderDailyChart(expenses) {
  const canvas = $('chart-daily');
  if (!canvas || !window.Chart) return;

  const [year, month] = activeMonthKey.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();

  // Суммы по дням
  const dailyData = new Array(daysInMonth).fill(0);
  expenses.forEach(e => {
    const day = parseInt(e.date.split('-')[2], 10);
    if (day >= 1 && day <= daysInMonth) {
      dailyData[day - 1] += e.amount;
    }
  });

  const labels = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  if (dailyChart) {
    dailyChart.destroy();
  }

  dailyChart = new window.Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Расходы',
        data: dailyData,
        backgroundColor: '#4CAF50',
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 10 } },
        },
        y: {
          beginAtZero: true,
          ticks: {
            callback(val) {
              if (val >= 1000) return Math.round(val / 1000) + 'к';
              return val;
            },
            font: { size: 10 },
          },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(ctx) {
              return formatMoney(ctx.parsed.y);
            },
          },
        },
      },
    },
  });
}

// ==================== ТАБЛИЦА КАТЕГОРИЙ ====================

function renderCategoryTable(expenses, budgets) {
  const table = $('category-table');
  if (!table) return;

  // Агрегация по категориям
  const catSpending = {};
  expenses.forEach(e => {
    catSpending[e.category] = (catSpending[e.category] || 0) + e.amount;
  });

  // Собрать данные для всех категорий с тратами
  const rows = CATEGORIES
    .map(cat => ({
      name: cat.name,
      emoji: cat.emoji,
      color: cat.color,
      spent: catSpending[cat.name] || 0,
      budget: budgets[cat.name] || 0,
    }))
    .filter(r => r.spent > 0 || r.budget > 0)
    .sort((a, b) => b.spent - a.spent);

  table.innerHTML = '';

  if (rows.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'Нет данных за этот период';
    table.appendChild(empty);
    return;
  }

  rows.forEach(row => {
    const percent = row.budget > 0 ? (row.spent / row.budget) * 100 : 0;
    const barColor = getProgressColor(percent);

    const tr = document.createElement('div');
    tr.className = 'category-row';

    // Заголовок строки
    const headerDiv = document.createElement('div');
    headerDiv.className = 'category-row-header';

    const dot = document.createElement('span');
    dot.className = 'category-dot';
    dot.style.background = row.color;
    headerDiv.appendChild(dot);

    const nameSpan = document.createElement('span');
    nameSpan.className = 'category-row-name';
    nameSpan.textContent = row.emoji + ' ' + row.name;
    headerDiv.appendChild(nameSpan);

    const valuesSpan = document.createElement('span');
    valuesSpan.className = 'category-row-values';
    valuesSpan.textContent = formatMoney(row.spent) + ' / ' + formatMoney(row.budget);
    headerDiv.appendChild(valuesSpan);

    tr.appendChild(headerDiv);

    // Прогресс-бар
    const barBg = document.createElement('div');
    barBg.className = 'progress-bar-bg';

    const barFill = document.createElement('div');
    barFill.className = 'progress-bar-fill';
    barFill.style.width = Math.min(percent, 100) + '%';
    barFill.style.background = barColor;
    barBg.appendChild(barFill);

    tr.appendChild(barBg);
    table.appendChild(tr);
  });
}

function getProgressColor(percent) {
  if (percent <= 70) return '#4CAF50';  // зеленый
  if (percent <= 90) return '#FFC107';  // желтый
  return '#F44336';                      // красный
}
