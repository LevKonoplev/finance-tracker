// Категории расходов
export const CATEGORIES = [
  { name: 'Продукты',          emoji: '🛒', color: '#4CAF50' },
  { name: 'Еда вне дома',     emoji: '🍔', color: '#FF9800' },
  { name: 'Транспорт',        emoji: '🚇', color: '#2196F3' },
  { name: 'Кофе',             emoji: '☕', color: '#795548' },
  { name: 'Табак',            emoji: '🚬', color: '#607D8B' },
  { name: 'Развлечения',      emoji: '🎮', color: '#9C27B0' },
  { name: 'Одежда',           emoji: '👕', color: '#E91E63' },
  { name: 'Здоровье/красота', emoji: '💊', color: '#00BCD4' },
  { name: 'Связь/подписки',   emoji: '📱', color: '#3F51B5' },
  { name: 'Переводы людям',   emoji: '💸', color: '#FF5722' },
  { name: 'Крупные покупки',  emoji: '🛍️', color: '#FFC107' },
  { name: 'Буфер',            emoji: '📦', color: '#9E9E9E' },
];

// Банки
export const BANKS = [
  { name: 'Сбербанк',    short: 'Сбер',   color: '#21A038' },
  { name: 'Альфа-Банк',  short: 'Альфа',  color: '#EF3124' },
  { name: 'Т-Банк',      short: 'Т-Банк', color: '#FFE033' },
  { name: 'Яндекс Банк', short: 'Яндекс', color: '#FC3F1D' },
];

// Дефолтные бюджеты
export const DEFAULT_BUDGETS = {
  'Продукты': 12000,
  'Еда вне дома': 10000,
  'Транспорт': 4000,
  'Кофе': 2000,
  'Табак': 2000,
  'Развлечения': 6000,
  'Одежда': 5000,
  'Здоровье/красота': 3000,
  'Связь/подписки': 2000,
  'Переводы людям': 5000,
  'Крупные покупки': 7000,
  'Буфер': 5000,
};

// Доход
export const INCOME = {
  advance: 60500,
  salary: 100500,
  stipend: 3700,
  get total() { return this.advance + this.salary + this.stipend; },
};

// Названия месяцев
export const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

export const DAY_NAMES = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

// Утилиты
export function formatMoney(n) {
  return new Intl.NumberFormat('ru-RU').format(Math.round(n)) + ' ₽';
}

export function formatDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function nowTime() {
  return new Date().toTimeString().slice(0, 5);
}

export function currentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

export function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}
