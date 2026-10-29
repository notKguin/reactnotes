import type { BackgroundId } from './types';

export type BackgroundTemplate = {
  id: BackgroundId;
  label: string;
  paper: string;
  ink: string;
  line: string;
};

export const PAPER_PRESETS = [
  '#FFFFFF',
  '#FFFDF8',
  '#F5F5F4',
  '#FEF9C3',
  '#E8D5B5',
  '#E0F2FE',
  '#FCE7F3',
  '#1C1917',
];

export const LINE_PRESETS = [
  '#D6CBB8',
  '#CBD5E1',
  '#A1A1AA',
  '#93C5FD',
  '#F9A8D4',
  '#44403C',
];

export const BACKGROUNDS: BackgroundTemplate[] = [
  { id: 'blank', label: 'Чистый', paper: '#FFFFFF', ink: '#171717', line: '#D4D4D8' },
  { id: 'lined', label: 'Узкая линия', paper: '#FFFDF8', ink: '#171717', line: '#D6CBB8' },
  { id: 'wideLined', label: 'Широкая линия', paper: '#FFFDF8', ink: '#171717', line: '#D6CBB8' },
  { id: 'grid', label: 'Клетка', paper: '#FAFAF9', ink: '#171717', line: '#E4E4E7' },
  { id: 'dots', label: 'Точки', paper: '#F8FAFC', ink: '#0F172A', line: '#CBD5E1' },
  { id: 'isometric', label: 'Изометрия', paper: '#F8FAFC', ink: '#0F172A', line: '#CBD5E1' },
  { id: 'cornell', label: 'Корнелл', paper: '#FFFDF8', ink: '#171717', line: '#D6CBB8' },
  { id: 'music', label: 'Нотный стан', paper: '#FFFDF8', ink: '#171717', line: '#A8A29E' },
  { id: 'checklist', label: 'Чек-лист', paper: '#FFFFFF', ink: '#171717', line: '#D4D4D8' },
  { id: 'columns', label: 'Две колонки', paper: '#FFFFFF', ink: '#171717', line: '#E4E4E7' },
  { id: 'kraft', label: 'Крафт', paper: '#E8D5B5', ink: '#3F2A14', line: '#C4A574' },
  { id: 'dark', label: 'Тёмный', paper: '#1C1917', ink: '#F5F5F4', line: '#44403C' },
];

export function getBackground(id: BackgroundId): BackgroundTemplate {
  return BACKGROUNDS.find((b) => b.id === id) ?? BACKGROUNDS[0];
}
