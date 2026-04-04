/**
 * export.js — Экспорт расходов в Excel (.xlsx) с помощью SheetJS.
 *
 * SheetJS (XLSX) подключается глобально через <script> в HTML
 * и доступен как window.XLSX.
 *
 * Генерирует файл с тремя листами:
 *   1. «Расходы» — детальный список всех трат за месяц
 *   2. «Сводка» — бюджет vs. факт по каждой категории
 *   3. «По дням» — ежедневная разбивка по категориям
 */

import { getExpensesByMonth, getBudget } from './db.js';
import {
  CATEGORIES,
  DEFAULT_BUDGETS,
  MONTH_NAMES,
  DAY_NAMES,
  formatDate,
} from './constants.js';

/**
 * Генерирует и скачивает .xlsx файл с расходами за указанный месяц.
 *
 * @param {string} monthKey — ключ месяца в формате "YYYY-MM" (например, "2026-04")
 */
export async function exportToXlsx(monthKey) {
  const XLSX = window.XLSX;
  if (!XLSX) {
    console.error('[export] SheetJS (XLSX) не загружен. Добавьте <script> в HTML.');
    return;
  }

  // Загрузка данных
  const expenses = await getExpensesByMonth(monthKey);
  const budgetRecord = await getBudget(monthKey);
  const budgets = budgetRecord ? budgetRecord : DEFAULT_BUDGETS;

  // Получаем объект бюджетов: если budgetRecord — это объект из IndexedDB
  // с полем id (monthKey) и полями категорий, извлекаем только категории
  const budgetMap = {};
  const categoryNames = CATEGORIES.map(c => c.name);
  for (const cat of categoryNames) {
    budgetMap[cat] = budgets[cat] ?? DEFAULT_BUDGETS[cat] ?? 0;
  }

  // Создаём книгу
  const wb = XLSX.utils.book_new();

  // ==================== Лист 1: Расходы ====================
  const sheet1 = buildExpensesSheet(XLSX, expenses);
  XLSX.utils.book_append_sheet(wb, sheet1, 'Расходы');

  // ==================== Лист 2: Сводка ====================
  const sheet2 = buildSummarySheet(XLSX, expenses, budgetMap, categoryNames);
  XLSX.utils.book_append_sheet(wb, sheet2, 'Сводка');

  // ==================== Лист 3: По дням ====================
  const sheet3 = buildDailySheet(XLSX, expenses, monthKey, categoryNames);
  XLSX.utils.book_append_sheet(wb, sheet3, 'По дням');

  // Скачивание файла
  const monthIndex = parseInt(monthKey.slice(5), 10) - 1;
  const monthName = MONTH_NAMES[monthIndex];
  const year = monthKey.slice(0, 4);
  XLSX.writeFile(wb, `Расходы_${monthName}_${year}.xlsx`);
}

// ==================== ЛИСТ «РАСХОДЫ» ====================

/**
 * Строит лист с детальным списком расходов.
 * Колонки: Дата, Время, Категория, Сумма, Место, Банк, Комментарий.
 * Сортировка по дате (ASC), затем по времени (ASC).
 */
function buildExpensesSheet(XLSX, expenses) {
  // Сортируем: по дате, затем по времени
  const sorted = [...expenses].sort((a, b) => {
    const dateCmp = (a.date || '').localeCompare(b.date || '');
    if (dateCmp !== 0) return dateCmp;
    return (a.time || '').localeCompare(b.time || '');
  });

  const header = ['Дата', 'Время', 'Категория', 'Сумма', 'Место', 'Банк', 'Комментарий'];
  const rows = [header];

  for (const exp of sorted) {
    rows.push([
      exp.date ? formatDate(exp.date) : '',
      exp.time || '',
      exp.category || '',
      exp.amount ?? 0,
      exp.place || '',
      exp.bank || '',
      exp.comment || '',
    ]);
  }

  // Если нет расходов — добавляем информационную строку
  if (sorted.length === 0) {
    rows.push(['Нет расходов за этот месяц', '', '', '', '', '', '']);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Ширина колонок
  ws['!cols'] = [
    { wch: 12 },  // Дата
    { wch: 8 },   // Время
    { wch: 18 },  // Категория
    { wch: 12 },  // Сумма
    { wch: 25 },  // Место
    { wch: 14 },  // Банк
    { wch: 30 },  // Комментарий
  ];

  return ws;
}

// ==================== ЛИСТ «СВОДКА» ====================

/**
 * Строит сводный лист: бюджет vs. факт по каждой категории.
 * Колонки: Категория, Бюджет, Факт, Остаток, %.
 * В конце — итоговая строка.
 */
function buildSummarySheet(XLSX, expenses, budgetMap, categoryNames) {
  // Считаем факт по каждой категории
  const factMap = {};
  for (const cat of categoryNames) {
    factMap[cat] = 0;
  }
  for (const exp of expenses) {
    const cat = exp.category;
    if (cat && cat in factMap) {
      factMap[cat] += exp.amount || 0;
    } else if (cat) {
      // Неизвестная категория — всё равно учитываем
      factMap[cat] = (factMap[cat] || 0) + (exp.amount || 0);
    }
  }

  const header = ['Категория', 'Бюджет', 'Факт', 'Остаток', '%'];
  const rows = [header];

  let totalBudget = 0;
  let totalFact = 0;

  for (const cat of categoryNames) {
    const budget = budgetMap[cat] || 0;
    const fact = factMap[cat] || 0;
    const remainder = budget - fact;
    const pct = budget > 0 ? Math.round(fact / budget * 100) : (fact > 0 ? 999 : 0);

    totalBudget += budget;
    totalFact += fact;

    rows.push([cat, budget, fact, remainder, `${pct}%`]);
  }

  // Итоговая строка
  const totalRemainder = totalBudget - totalFact;
  const totalPct = totalBudget > 0 ? Math.round(totalFact / totalBudget * 100) : 0;
  rows.push(['ИТОГО', totalBudget, totalFact, totalRemainder, `${totalPct}%`]);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Ширина колонок
  ws['!cols'] = [
    { wch: 20 },  // Категория
    { wch: 12 },  // Бюджет
    { wch: 12 },  // Факт
    { wch: 12 },  // Остаток
    { wch: 8 },   // %
  ];

  // Жирный шрифт для итоговой строки (если SheetJS Pro / community поддерживает стили)
  const lastRow = rows.length - 1;
  for (let col = 0; col < header.length; col++) {
    const cellRef = XLSX.utils.encode_cell({ r: lastRow, c: col });
    if (ws[cellRef]) {
      ws[cellRef].s = { font: { bold: true } };
    }
  }

  return ws;
}

// ==================== ЛИСТ «ПО ДНЯМ» ====================

/**
 * Строит лист с разбивкой расходов по дням.
 * Колонки: Дата, День недели, Всего, [по одной колонке на категорию].
 * Строка для каждого дня месяца (включая дни без расходов).
 */
function buildDailySheet(XLSX, expenses, monthKey, categoryNames) {
  const year = parseInt(monthKey.slice(0, 4), 10);
  const month = parseInt(monthKey.slice(5), 10); // 1-based
  const daysInMonth = new Date(year, month, 0).getDate();

  // Подсчёт расходов по дням и категориям
  // Ключ: "YYYY-MM-DD", значение: { [category]: сумма }
  const dailyMap = {};
  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = `${monthKey}-${String(day).padStart(2, '0')}`;
    dailyMap[dateKey] = {};
    for (const cat of categoryNames) {
      dailyMap[dateKey][cat] = 0;
    }
  }

  for (const exp of expenses) {
    const dateKey = exp.date;
    if (dateKey && dailyMap[dateKey]) {
      const cat = exp.category;
      if (cat) {
        dailyMap[dateKey][cat] = (dailyMap[dateKey][cat] || 0) + (exp.amount || 0);
      }
    }
  }

  // Заголовок
  const header = ['Дата', 'День недели', 'Всего', ...categoryNames];
  const rows = [header];

  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = `${monthKey}-${String(day).padStart(2, '0')}`;
    const dateObj = new Date(year, month - 1, day);
    const dayOfWeek = DAY_NAMES[dateObj.getDay()];
    const dateFormatted = formatDate(dateKey);

    const catAmounts = categoryNames.map(cat => dailyMap[dateKey][cat] || 0);
    const total = catAmounts.reduce((sum, v) => sum + v, 0);

    rows.push([dateFormatted, dayOfWeek, total, ...catAmounts]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Ширина колонок: Дата(12), День(6), Всего(10), категории(12 каждая)
  ws['!cols'] = [
    { wch: 12 },  // Дата
    { wch: 6 },   // День недели
    { wch: 10 },  // Всего
    ...categoryNames.map(() => ({ wch: 12 })),
  ];

  return ws;
}
