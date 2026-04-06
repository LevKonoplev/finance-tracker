import { CATEGORIES, BANKS, uuid, todayISO, nowTime, formatMoney } from './constants.js';
import { addExpense, getRecentPlaces } from './db.js';

// ==================== СОСТОЯНИЕ ====================

let selectedCategory = null;
let selectedBank = null;
let photoBase64 = null;
let saveCallback = null;

// Bank class mapping: index -> CSS modifier class
const BANK_CLASSES = ['bank-btn--sber', 'bank-btn--alfa', 'bank-btn--tbank', 'bank-btn--yandex'];

// ==================== ЭЛЕМЕНТЫ ====================

const $ = (id) => document.getElementById(id);

// ==================== ЭКСПОРТ: колбэк сохранения ====================

export function onSave(callback) {
  saveCallback = callback;
}

// ==================== ИНИЦИАЛИЗАЦИЯ ====================

export function initAddScreen() {
  renderCategoryGrid();
  renderBankSelector();
  setupAmountInput();
  setupPlaceAutocomplete();
  setupCommentToggle();
  setupSaveButton();
}

export function showAddScreen() {
  resetForm();
}

// ==================== СЕТКА КАТЕГОРИЙ ====================

function renderCategoryGrid() {
  const grid = $('category-grid');
  if (!grid) return;

  grid.innerHTML = '';
  CATEGORIES.forEach((cat, index) => {
    const btn = document.createElement('button');
    btn.className = 'category-grid__item';
    btn.dataset.index = index;
    btn.style.setProperty('--cat-color', cat.color);

    const emojiSpan = document.createElement('span');
    emojiSpan.className = 'category-grid__emoji';
    emojiSpan.textContent = cat.emoji;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'category-grid__name';
    nameSpan.textContent = cat.name;

    btn.appendChild(emojiSpan);
    btn.appendChild(nameSpan);

    btn.addEventListener('click', () => {
      grid.querySelectorAll('.category-grid__item').forEach(b => b.classList.remove('selected'));
      if (selectedCategory === index) {
        selectedCategory = null;
      } else {
        selectedCategory = index;
        btn.classList.add('selected');
      }
    });

    grid.appendChild(btn);
  });
}

// ==================== ПЕРЕКЛЮЧАТЕЛЬ БАНКОВ ====================

function renderBankSelector() {
  const container = $('bank-selector');
  if (!container) return;

  container.innerHTML = '';
  BANKS.forEach((bank, index) => {
    const btn = document.createElement('button');
    btn.className = 'bank-btn ' + (BANK_CLASSES[index] || '');
    btn.dataset.index = index;
    btn.textContent = bank.short;

    btn.addEventListener('click', () => {
      container.querySelectorAll('.bank-btn').forEach(b => b.classList.remove('selected'));
      if (selectedBank === index) {
        selectedBank = null;
      } else {
        selectedBank = index;
        btn.classList.add('selected');
      }
    });

    container.appendChild(btn);
  });
}

// ==================== ВВОД СУММЫ ====================

function setupAmountInput() {
  const input = $('amount-input');
  if (!input) return;

  input.setAttribute('inputmode', 'decimal');
  input.addEventListener('focus', () => {
    input.setAttribute('inputmode', 'decimal');
  });
}

// ==================== АВТОКОМПЛИТ МЕСТ ====================

function setupPlaceAutocomplete() {
  const input = $('place-input');
  const suggestions = $('place-suggestions');
  if (!input || !suggestions) return;

  input.addEventListener('focus', async () => {
    try {
      const places = await getRecentPlaces();
      renderSuggestions(places, input.value);
    } catch (err) {
      console.error('Ошибка загрузки мест:', err);
    }
  });

  input.addEventListener('input', async () => {
    try {
      const places = await getRecentPlaces();
      renderSuggestions(places, input.value);
    } catch (err) {
      console.error('Ошибка загрузки мест:', err);
    }
  });

  document.addEventListener('click', (e) => {
    if (!suggestions.contains(e.target) && e.target !== input) {
      suggestions.style.display = 'none';
    }
  });
}

function renderSuggestions(places, query) {
  const suggestions = $('place-suggestions');
  const input = $('place-input');
  if (!suggestions) return;

  const filtered = query
    ? places.filter(p => p.toLowerCase().includes(query.toLowerCase()))
    : places;

  if (filtered.length === 0) {
    suggestions.style.display = 'none';
    return;
  }

  suggestions.innerHTML = '';
  filtered.forEach(place => {
    const div = document.createElement('div');
    div.className = 'suggestion-item';
    div.textContent = place;
    div.addEventListener('click', () => {
      input.value = place;
      suggestions.style.display = 'none';
    });
    suggestions.appendChild(div);
  });

  suggestions.style.display = 'block';
}

// ==================== КОММЕНТАРИЙ ====================

function setupCommentToggle() {
  const section = $('comment-section');
  const toggle = $('comment-toggle');
  if (!section || !toggle) return;

  toggle.addEventListener('click', (e) => {
    e.preventDefault();
    section.classList.toggle('open');
    const input = $('comment-input');
    if (input && section.classList.contains('open')) {
      input.focus();
    }
  });
}

// ==================== СОХРАНЕНИЕ ====================

function setupSaveButton() {
  const btn = $('save-btn');
  if (!btn) return;

  btn.addEventListener('click', handleSave);
}

async function handleSave() {
  const amountInput = $('amount-input');
  const placeInput = $('place-input');
  const commentInput = $('comment-input');

  // Валидация
  const amountRaw = amountInput ? amountInput.value.replace(',', '.').trim() : '';
  const amount = parseFloat(amountRaw);

  if (!amount || isNaN(amount) || amount <= 0) {
    showToast('Введите сумму');
    return;
  }

  if (selectedCategory === null) {
    showToast('Выберите категорию');
    return;
  }

  const expense = {
    id: uuid(),
    amount,
    category: CATEGORIES[selectedCategory].name,
    bank: selectedBank !== null ? BANKS[selectedBank].name : null,
    place: placeInput ? placeInput.value.trim() : '',
    comment: commentInput ? commentInput.value.trim() : '',
    receipt: photoBase64 || null,
    date: $('date-input') ? $('date-input').value || todayISO() : todayISO(),
    time: nowTime(),
    createdAt: new Date().toISOString(),
    synced: false,
  };

  try {
    await addExpense(expense);

    // Запомнить последний банк
    if (selectedBank !== null) {
      localStorage.setItem('lastBank', String(selectedBank));
    }

    // Вызвать колбэк синхронизации
    if (saveCallback) {
      try {
        await saveCallback(expense);
      } catch (syncErr) {
        console.error('Ошибка синхронизации:', syncErr);
      }
    }

    showToast('Сохранено!');
    resetForm();
  } catch (err) {
    console.error('Ошибка сохранения:', err);
    showToast('Ошибка сохранения');
  }
}

// ==================== СБРОС ФОРМЫ ====================

function resetForm() {
  const amountInput = $('amount-input');
  const placeInput = $('place-input');
  const commentInput = $('comment-input');
  const commentSection = $('comment-section');
  const suggestions = $('place-suggestions');

  const dateInput = $('date-input');
  if (dateInput) dateInput.value = todayISO();
  if (amountInput) amountInput.value = '';
  if (placeInput) placeInput.value = '';
  if (commentInput) commentInput.value = '';
  if (commentSection) commentSection.classList.remove('open');
  if (suggestions) suggestions.style.display = 'none';

  photoBase64 = null;

  // Сбросить категорию
  selectedCategory = null;
  const grid = $('category-grid');
  if (grid) {
    grid.querySelectorAll('.category-grid__item').forEach(b => b.classList.remove('selected'));
  }

  // Восстановить последний банк
  selectedBank = null;
  const bankContainer = $('bank-selector');
  if (bankContainer) {
    bankContainer.querySelectorAll('.bank-btn').forEach(b => b.classList.remove('selected'));
  }

  const lastBank = localStorage.getItem('lastBank');
  if (lastBank !== null) {
    const bankIndex = parseInt(lastBank, 10);
    if (bankIndex >= 0 && bankIndex < BANKS.length) {
      selectedBank = bankIndex;
      const bankBtn = bankContainer?.querySelector('[data-index="' + bankIndex + '"]');
      if (bankBtn) bankBtn.classList.add('selected');
    }
  }
}

// ==================== ТОСТ ====================

let toastTimer = null;

function showToast(message, duration = 2000) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}
