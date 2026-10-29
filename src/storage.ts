import AsyncStorage from '@react-native-async-storage/async-storage';
import { getBackground } from './backgrounds';
import type { BackgroundId, CanvasElement, LayerItem, Note, Stroke } from './types';

const STORAGE_KEY = '@notes/v2';
const LEGACY_KEY = '@notes/v1';
const FOLDERS_KEY = '@notes/folders/v1';

const BG_IDS: BackgroundId[] = [
  'blank',
  'lined',
  'wideLined',
  'grid',
  'dots',
  'isometric',
  'cornell',
  'music',
  'checklist',
  'columns',
  'kraft',
  'dark',
];

function isBackground(value: unknown): value is BackgroundId {
  return typeof value === 'string' && (BG_IDS as string[]).includes(value);
}

export function createDefaultLayer(): LayerItem {
  return {
    id: 'layer-1',
    name: 'Слой 1',
    visible: true,
    locked: false,
  };
}

function migrateNote(raw: Record<string, unknown>): Note {
  const now = Date.now();
  const id = typeof raw.id === 'string' ? raw.id : `${now}`;
  const title = typeof raw.title === 'string' ? raw.title : '';
  const body = typeof raw.body === 'string' ? raw.body : '';
  const folder = typeof raw.folder === 'string' ? raw.folder : '';
  const pinned = Boolean(raw.pinned);
  const createdAt = typeof raw.createdAt === 'number' ? raw.createdAt : now;
  const updatedAt = typeof raw.updatedAt === 'number' ? raw.updatedAt : now;
  const background = isBackground(raw.background) ? raw.background : 'blank';
  const tpl = getBackground(background);
  const paperColor =
    typeof raw.paperColor === 'string' && raw.paperColor ? raw.paperColor : tpl.paper;
  const lineColor =
    typeof raw.lineColor === 'string' && raw.lineColor ? raw.lineColor : tpl.line;
  const pageFullScreen = Boolean(raw.pageFullScreen);
  const pageWidth = typeof raw.pageWidth === 'number' ? raw.pageWidth : undefined;
  const pageHeight = typeof raw.pageHeight === 'number' ? raw.pageHeight : undefined;

  const layers: LayerItem[] =
    Array.isArray(raw.layers) && raw.layers.length > 0
      ? (raw.layers as LayerItem[]).map((l, idx) => ({
          id: typeof l.id === 'string' && l.id ? l.id : `layer-${idx + 1}`,
          name: typeof l.name === 'string' && l.name ? l.name : `Слой ${idx + 1}`,
          visible: l.visible !== false,
          locked: Boolean(l.locked),
        }))
      : [createDefaultLayer()];

  const activeLayerId =
    typeof raw.activeLayerId === 'string' && layers.some((l) => l.id === raw.activeLayerId)
      ? raw.activeLayerId
      : layers[layers.length - 1].id;

  const firstLayerId = layers[0].id;
  let seq = 1;

  const elements = (
    Array.isArray(raw.elements)
      ? (raw.elements as CanvasElement[])
      : body.trim()
        ? [
            {
              id: `${id}-body`,
              type: 'text' as const,
              x: 24,
              y: 24,
              width: 320,
              text: body,
              fontFamily: 'Caveat_400Regular',
              fontSize: 20,
              color: '#171717',
              rotation: 0,
              bold: false,
              italic: false,
              underline: false,
            },
          ]
        : []
  ).map((el) => {
    const order = typeof el.order === 'number' ? el.order : seq++;
    const layerId =
      typeof el.layerId === 'string' && layers.some((l) => l.id === el.layerId)
        ? el.layerId
        : firstLayerId;
    if (el.type === 'text') {
      return {
        ...el,
        rotation: el.rotation ?? 0,
        bold: !!el.bold,
        italic: !!el.italic,
        underline: !!el.underline,
        layerId,
        order,
      };
    }
    if (el.type === 'sticker') {
      return {
        ...el,
        rotation: el.rotation ?? 0,
        tone: el.tone || '#FEF3C7',
        variant: el.variant ?? 'note',
        layerId,
        order,
      };
    }
    return {
      ...el,
      rotation: el.rotation ?? 0,
      aspectRatio: el.aspectRatio || el.width / Math.max(1, el.height),
      cornerRadius: el.cornerRadius ?? 12,
      mask: el.mask ?? 'none',
      layerId,
      order,
    };
  });

  const strokes = (Array.isArray(raw.strokes) ? (raw.strokes as Stroke[]) : []).map((s) => ({
    ...s,
    layerId:
      typeof s.layerId === 'string' && layers.some((l) => l.id === s.layerId)
        ? s.layerId
        : firstLayerId,
    order: typeof s.order === 'number' ? s.order : seq++,
  }));

  return {
    id,
    title,
    body,
    folder,
    pinned,
    background,
    paperColor,
    lineColor,
    pageFullScreen,
    pageWidth,
    pageHeight,
    layers,
    activeLayerId,
    elements,
    strokes,
    createdAt,
    updatedAt,
  };
}

export async function loadNotes(): Promise<Note[]> {
  const raw = (await AsyncStorage.getItem(STORAGE_KEY)) ?? (await AsyncStorage.getItem(LEGACY_KEY));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => migrateNote(item as Record<string, unknown>));
  } catch {
    return [];
  }
}

export async function saveNotes(notes: Note[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

export async function loadFolders(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(FOLDERS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
  } catch {
    return [];
  }
}

export async function saveFolders(folders: string[]): Promise<void> {
  await AsyncStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
}

export function createEmptyNote(background: BackgroundId = 'blank', folder = ''): Note {
  const now = Date.now();
  const tpl = getBackground(background);
  const baseLayer = createDefaultLayer();
  return {
    id: `${now}-${Math.random().toString(36).slice(2, 9)}`,
    title: '',
    body: '',
    folder,
    pinned: false,
    background,
    paperColor: tpl.paper,
    lineColor: tpl.line,
    layers: [baseLayer],
    activeLayerId: baseLayer.id,
    elements: [],
    strokes: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function notePreview(note: Note): string {
  const textEl = note.elements.find((e) => e.type === 'text');
  if (textEl && textEl.type === 'text' && textEl.text.trim()) {
    const t = textEl.text.trim();
    return t.length > 80 ? `${t.slice(0, 80)}…` : t;
  }
  const stickerEl = note.elements.find((e) => e.type === 'sticker');
  if (stickerEl && stickerEl.type === 'sticker' && stickerEl.text.trim()) {
    return stickerEl.text.trim();
  }
  if (note.elements.some((e) => e.type === 'image')) return 'Фото на холсте';
  if (note.strokes.length > 0) return 'Рисунок';
  if (note.body.trim()) {
    const t = note.body.trim();
    return t.length > 80 ? `${t.slice(0, 80)}…` : t;
  }
  return 'Пустой лист';
}
