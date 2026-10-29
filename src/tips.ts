import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@notes/dismissed-tips/v1';

export type TipId =
  | 'select'
  | 'pen'
  | 'highlighter'
  | 'shape'
  | 'eraser'
  | 'lasso'
  | 'text'
  | 'sticker'
  | 'photo'
  | 'background'
  | 'font'
  | 'object';

export const TIP_COPY: Record<TipId, string> = {
  select: 'Выбор: тап по объекту, ручки — перенос, поворот и размер. Двумя пальцами — зум листа.',
  pen: 'Перо: рисуйте пальцем или стилусом. Нажим стилуса меняет толщину. Режим «Стилус» игнорирует палец, чтобы ладонь не оставляла линий.',
  highlighter: 'Маркер: сплошная полупрозрачная линия поверх текста и рисунков.',
  shape: 'Фигура: выберите форму сверху и растяните её на листе.',
  eraser: 'Ластик: стирает только участок линии под курсором.',
  lasso: 'Лассо: обведите штрихи, затем перетащите выделенную область.',
  text: 'Текст: тап сразу открывает ввод и ручки. Угол меняет рамку и размер букв.',
  sticker: 'Стикер: тап по листу — заметка-стикер на полях.',
  photo: 'Фото: скругление углов и маски-фигуры появляются сверху при выборе фото.',
  background: 'Фон: шаблоны чистого листа, линий, клетки и др.',
  font: 'Шрифт и начертание (жирный, курсив, подчёркивание) для текста.',
  object: 'Объект: обрезка фото или удаление выбранного элемента.',
};

export async function loadDismissedTips(): Promise<Set<TipId>> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as TipId[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

export async function dismissTip(id: TipId, current: Set<TipId>): Promise<Set<TipId>> {
  const next = new Set(current);
  next.add(id);
  await AsyncStorage.setItem(KEY, JSON.stringify([...next]));
  return next;
}
