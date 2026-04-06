import { CATEGORIES, BANKS, uuid, todayISO, nowTime } from './constants.js';
import { addExpense } from './db.js';

const $ = (id) => document.getElementById(id);

let saveCallback = null;

export function onBulkSave(callback) {
  saveCallback = callback;
}

export function initBulkScreen() {
  const addRowBtn = $('bulk-add-row');
  const saveBtn = $('bulk-save');

  if (addRowBtn) addRowBtn.addEventListener('click', addRow);
  if (saveBtn) saveBtn.addEventListener('click', handleBulkSave);
}

export function showBulkScreen() {
  const tbody = $('bulk-tbody');
  if (!tbody) return;
  // Если таблица пустая — добавить 5 строк
  if (tbody.children.length === 0) {
    for (let i = 0; i < 5; i++) addRow();
  }
}

function addRow() {
  const tbody = $('bulk-tbody');
  if (!tbody) return;

  const tr = document.createElement('tr');
  tr.className = 'bulk-row';

  // Дата
  const tdDate = document.createElement('td');
  const dateInput = document.createElement('input');
  dateInput.type = 'date';
  dateInput.className = 'bulk-input bulk-input--date';
  dateInput.value = todayISO();
  tdDate.appendChild(dateInput);
  tr.appendChild(tdDate);

  // Категория
  const tdCat = document.createElement('td');
  const catSelect = document.createElement('select');
  catSelect.className = 'bulk-input bulk-input--select';
  const emptyOpt = document.createElement('option');
  emptyOpt.value = '';
  emptyOpt.textContent = '—';
  catSelect.appendChild(emptyOpt);
  CATEGORIES.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.name;
    opt.textContent = cat.emoji + ' ' + cat.name;
    catSelect.appendChild(opt);
  });
  tdCat.appendChild(catSelect);
  tr.appendChild(tdCat);

  // Сумма
  const tdAmount = document.createElement('td');
  const amountInput = document.createElement('input');
  amountInput.type = 'text';
  amountInput.inputMode = 'decimal';
  amountInput.className = 'bulk-input bulk-input--amount';
  amountInput.placeholder = '0';
  tdAmount.appendChild(amountInput);
  tr.appendChild(tdAmount);

  // Комментарий
  const tdComment = document.createElement('td');
  const commentInput = document.createElement('input');
  commentInput.type = 'text';
  commentInput.className = 'bulk-input';
  commentInput.placeholder = 'Комментарий';
  tdComment.appendChild(commentInput);
  tr.appendChild(tdComment);

  // Банк
  const tdBank = document.createElement('td');
  const bankSelect = document.createElement('select');
  bankSelect.className = 'bulk-input bulk-input--select';
  const emptyBank = document.createElement('option');
  emptyBank.value = '';
  emptyBank.textContent = '—';
  bankSelect.appendChild(emptyBank);
  BANKS.forEach(bank => {
    const opt = document.createElement('option');
    opt.value = bank.name;
    opt.textContent = bank.short;
    bankSelect.appendChild(opt);
  });
  const lastBank = localStorage.getItem('lastBank');
  if (lastBank !== null) {
    const idx = parseInt(lastBank, 10);
    if (idx >= 0 && idx < BANKS.length) {
      bankSelect.value = BANKS[idx].name;
    }
  }
  tdBank.appendChild(bankSelect);
  tr.appendChild(tdBank);

  // Удалить строку
  const tdDel = document.createElement('td');
  const delBtn = document.createElement('button');
  delBtn.className = 'bulk-delete';
  delBtn.textContent = '\u2715';
  delBtn.title = 'Удалить строку';
  delBtn.addEventListener('click', () => tr.remove());
  tdDel.appendChild(delBtn);
  tr.appendChild(tdDel);

  tbody.appendChild(tr);
  amountInput.focus();
}

async function handleBulkSave() {
  const tbody = $('bulk-tbody');
  if (!tbody) return;

  const rows = tbody.querySelectorAll('.bulk-row');
  const expenses = [];
  let errors = 0;

  rows.forEach(tr => {
    const inputs = tr.querySelectorAll('.bulk-input');
    const date = inputs[0]?.value;
    const category = inputs[1]?.value;
    const amountRaw = inputs[2]?.value?.replace(',', '.').trim();
    const comment = inputs[3]?.value?.trim() || '';
    const bank = inputs[4]?.value || null;

    const amount = parseFloat(amountRaw);
    if (!amount || amount <= 0 || !category) {
      if (amountRaw || category) errors++;
      return;
    }

    expenses.push({
      id: uuid(),
      amount,
      category,
      bank,
      place: '',
      comment,
      receipt: null,
      date: date || todayISO(),
      time: nowTime(),
      createdAt: new Date().toISOString(),
      synced: false,
    });
  });

  if (expenses.length === 0) {
    showToast(errors > 0 ? 'Заполните сумму и категорию' : 'Нет данных для сохранения');
    return;
  }

  const saveBtn = $('bulk-save');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Сохранение...';
  }

  try {
    for (const exp of expenses) {
      await addExpense(exp);
      if (saveCallback) {
        try { await saveCallback(exp); } catch (e) { console.error('Sync error:', e); }
      }
    }

    showToast('Сохранено: ' + expenses.length + ' записей');

    // Очистить таблицу
    while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
    for (let i = 0; i < 5; i++) addRow();
  } catch (err) {
    console.error('Ошибка массового сохранения:', err);
    showToast('Ошибка сохранения');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Сохранить всё';
    }
  }
}

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}
