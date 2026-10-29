import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector, PointerType } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { notifyChange, Skia } from '@shopify/react-native-skia';
import ViewShot, { type ViewShotRef } from 'react-native-view-shot';
import { getBackground } from '../../backgrounds';
import { exportCanvasAsPdf, exportCanvasAsPng } from '../../exportNote';
import { DEFAULT_FONT } from '../../fonts';
import { pickAndPersistImage } from '../../media';
import { createDefaultLayer } from '../../storage';
import {
  boundsOfStrokes,
  buildShapePoints,
  dist,
  eraseStrokesPartial,
  eraseStrokesWhole,
  smoothPoints,
  strokeInsidePolygon,
  strokeInsideRect,
  transformSelectedStrokes,
  uid,
  type SmoothingLevel,
} from '../../strokeUtils';
import { colors, PAGE, spacing, TABLET_BREAKPOINT } from '../../theme';
import type {
  BackgroundId,
  CanvasElement,
  CanvasTool,
  CropRect,
  EraserMode,
  ImageMask,
  LassoMode,
  LayerItem,
  Note,
  NotePatch,
  Point,
  ShapeKind,
  StickerElement,
  StickerVariant,
  Stroke,
  TextAlignH,
  TextAlignV,
  TextElement,
} from '../../types';
import { BackgroundLayer } from './BackgroundLayer';
import { CanvasToolbar } from './CanvasToolbar';
import { DrawingLayer } from './DrawingLayer';
import { ImageBlock } from './ImageBlock';
import { ImageCropModal } from './ImageCropModal';
import { LayersPanel } from './LayersPanel';
import { StickerBlock, STICKER_TONES } from './StickerBlock';
import { StrokeGroupBlock } from './StrokeGroupBlock';
import { TextBlock } from './TextBlock';

type Props = {
  note: Note;
  folders: string[];
  onCreateFolder: (name: string) => string;
  onChange: (id: string, patch: NotePatch) => void;
  onDelete: (id: string) => void;
  showBack?: boolean;
  onBack?: () => void;
  wide?: boolean;
};

type Snapshot = {
  elements: CanvasElement[];
  strokes: Stroke[];
  layers: LayerItem[];
  activeLayerId: string;
};

type DrawToolKey = 'pen' | 'highlighter' | 'shape' | 'eraser';

type ToolConfig = {
  color: string;
  width: number;
  opacity: number;
  smoothing: SmoothingLevel;
};

const DEFAULT_TOOL_CONFIGS: Record<DrawToolKey, ToolConfig> = {
  pen: { color: '#171717', width: 4, opacity: 1, smoothing: 45 },
  highlighter: { color: '#CA8A04', width: 18, opacity: 0.35, smoothing: 25 },
  shape: { color: '#171717', width: 3, opacity: 1, smoothing: 0 },
  eraser: { color: '#171717', width: 14, opacity: 1, smoothing: 0 },
};

function isDrawKey(tool: CanvasTool): tool is DrawToolKey {
  return tool === 'pen' || tool === 'highlighter' || tool === 'shape' || tool === 'eraser';
}

const MAX_HISTORY = 40;
const STYLUS_PREF_KEY = '@notes/input-stylus-only';

type RenderChunk =
  | { kind: 'strokes'; key: string; strokes: Stroke[] }
  | { kind: 'element'; key: string; element: CanvasElement; interactive: boolean };

export function NoteCanvas({
  note,
  folders,
  onCreateFolder,
  onChange,
  onDelete,
  showBack,
  onBack,
  wide,
}: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const isTablet = windowWidth >= TABLET_BREAKPOINT || !!wide;

  const [tool, setTool] = useState<CanvasTool>('select');
  const [shapeKind, setShapeKind] = useState<ShapeKind>('rect');
  const [eraserMode, setEraserMode] = useState<EraserMode>('partial');
  const [lassoMode, setLassoMode] = useState<LassoMode>('free');
  const [toolConfigs, setToolConfigs] = useState<Record<DrawToolKey, ToolConfig>>(
    DEFAULT_TOOL_CONFIGS,
  );
  const [stylusOnly, setStylusOnlyState] = useState(windowWidth >= TABLET_BREAKPOINT);
  const [stickerTone, setStickerTone] = useState(STICKER_TONES[0]);
  const [stickerVariant, setStickerVariant] = useState<StickerVariant>('note');
  const [textDefaults, setTextDefaults] = useState<{
    fontFamily: string;
    fontSize: number;
    color: string;
    bold: boolean;
    italic: boolean;
    underline: boolean;
    alignH: TextAlignH;
    alignV: TextAlignV;
  }>({
    fontFamily: DEFAULT_FONT,
    fontSize: isTablet ? 22 : 18,
    color: '#171717',
    bold: false,
    italic: false,
    underline: false,
    alignH: 'left',
    alignV: 'top',
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewportSize, setViewportSize] = useState({
    width: isTablet ? PAGE.minWidthTablet : PAGE.minWidthPhone,
    height: PAGE.minHeight,
  });
  const [undoStack, setUndoStack] = useState<Snapshot[]>([]);
  const [redoStack, setRedoStack] = useState<Snapshot[]>([]);
  const [lassoPath, setLassoPath] = useState<Point[] | null>(null);
  const [lassoRect, setLassoRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [lassoIds, setLassoIds] = useState<Set<string>>(new Set());
  const [zoomed, setZoomed] = useState(false);
  const [zoomFactor, setZoomFactor] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);
  const [cropping, setCropping] = useState(false);
  const [renderStrokes, setRenderStrokes] = useState<Stroke[]>(note.strokes);

  const layers = useMemo<LayerItem[]>(
    () => (note.layers && note.layers.length > 0 ? note.layers : [createDefaultLayer()]),
    [note.layers],
  );
  const activeLayerId = useMemo(() => {
    if (note.activeLayerId && layers.some((l) => l.id === note.activeLayerId)) {
      return note.activeLayerId;
    }
    return layers[layers.length - 1].id;
  }, [layers, note.activeLayerId]);
  const activeLayer = useMemo(
    () => layers.find((l) => l.id === activeLayerId) ?? layers[layers.length - 1],
    [layers, activeLayerId],
  );

  const activeKey: DrawToolKey = isDrawKey(tool) ? tool : 'pen';
  const activeCfg = toolConfigs[activeKey];
  const penColor = activeCfg.color;
  const penWidth = activeCfg.width;
  const penOpacity = activeCfg.opacity;
  const smoothing = activeCfg.smoothing;

  const updateActiveConfig = (partial: Partial<ToolConfig>) => {
    setToolConfigs((prev) => ({
      ...prev,
      [activeKey]: { ...prev[activeKey], ...partial },
    }));
  };

  const viewShotRef = useRef<ViewShotRef | null>(null);
  const strokeRef = useRef<Stroke | null>(null);
  const shapeStartRef = useRef<Point | null>(null);
  const lassoStartRef = useRef<Point | null>(null);
  const shapeKindRef = useRef(shapeKind);
  const eraserModeRef = useRef(eraserMode);
  const lassoModeRef = useRef(lassoMode);
  const strokesRef = useRef(note.strokes);
  const elementsRef = useRef(note.elements);
  const layersRef = useRef(layers);
  const activeLayerRef = useRef(activeLayer);
  const toolRef = useRef(tool);
  const toolConfigsRef = useRef(toolConfigs);
  const stylusOnlyRef = useRef(stylusOnly);
  const eraseSnapshotTakenRef = useRef(false);
  const erasePaintAt = useRef(0);
  const lassoIdsRef = useRef<Set<string>>(new Set());
  const lassoPathRef = useRef<Point[]>([]);
  const pinchingRef = useRef(false);
  const zoomRef = useRef(1);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canvasScale = useSharedValue(1);
  const drawMode = useSharedValue(0);
  const canInk = useSharedValue(1);
  const stylusOnlySv = useSharedValue(0);
  const penColorSv = useSharedValue('#171717');
  const penWidthSv = useSharedValue(4);
  const penOpacitySv = useSharedValue(1);
  const hiColorSv = useSharedValue('#CA8A04');
  const hiWidthSv = useSharedValue(18);
  const hiOpacitySv = useSharedValue(0.35);
  const liveBuilder = useSharedValue(Skia.PathBuilder.Make());
  const livePath = useSharedValue(Skia.PathBuilder.Make().detach());
  const liveColor = useSharedValue('#171717');
  const liveWidth = useSharedValue(4);
  const liveOpacity = useSharedValue(1);
  const livePts = useSharedValue<Point[]>([]);
  const inking = useSharedValue(0);
  zoomRef.current = zoomFactor;
  canvasScale.value = zoomFactor;
  drawMode.value =
    tool === 'pen' ? 1 : tool === 'highlighter' ? 2 : tool === 'shape' ? 3 : tool === 'eraser' ? 4 : tool === 'lasso' ? 5 : 0;
  canInk.value = activeLayer.visible && !activeLayer.locked ? 1 : 0;
  stylusOnlySv.value = stylusOnly ? 1 : 0;
  penColorSv.value = toolConfigs.pen.color;
  penWidthSv.value = toolConfigs.pen.width;
  penOpacitySv.value = toolConfigs.pen.opacity;
  hiColorSv.value = toolConfigs.highlighter.color;
  hiWidthSv.value = toolConfigs.highlighter.width;
  hiOpacitySv.value = toolConfigs.highlighter.opacity;

  elementsRef.current = note.elements;
  layersRef.current = layers;
  activeLayerRef.current = activeLayer;
  toolRef.current = tool;
  shapeKindRef.current = shapeKind;
  eraserModeRef.current = eraserMode;
  lassoModeRef.current = lassoMode;
  toolConfigsRef.current = toolConfigs;
  stylusOnlyRef.current = stylusOnly;
  lassoIdsRef.current = lassoIds;

  useEffect(() => {
    strokesRef.current = note.strokes;
    setRenderStrokes(note.strokes);
  }, [note.strokes]);

  const bg = getBackground(note.background);
  const paperColor = note.paperColor || bg.paper;
  const lineColor = note.lineColor || bg.line;
  const selected = note.elements.find((e) => e.id === selectedId) ?? null;
  const selectedText = selected?.type === 'text' ? selected : null;
  const selectedImage = selected?.type === 'image' ? selected : null;
  const selectedSticker = selected?.type === 'sticker' ? selected : null;
  const canInteract = tool === 'select';

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);

  useEffect(() => {
    setSelectedId(null);
    strokeRef.current = null;
    inking.value = 0;
    livePts.value = [];
    liveBuilder.value.reset();
    livePath.value = liveBuilder.value.build();
    setUndoStack([]);
    setRedoStack([]);
    setLassoIds(new Set());
    setLassoPath(null);
    setLassoRect(null);
    scale.value = 1;
    savedScale.value = 1;
    setZoomFactor(1);
    setZoomed(false);
    setNotice(null);
  }, [note.id, scale, savedScale]);

  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(STYLUS_PREF_KEY).then((value) => {
      if (cancelled || value == null) return;
      setStylusOnlyState(value === '1');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    },
    [],
  );

  const setStylusOnly = (value: boolean) => {
    setStylusOnlyState(value);
    void AsyncStorage.setItem(STYLUS_PREF_KEY, value ? '1' : '0');
  };

  const showNotice = (text: string) => {
    setNotice(text);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 2800);
  };

  const toPage = (x: number, y: number) => {
    const s = Math.max(0.05, zoomRef.current);
    return { x: x / s, y: y / s };
  };

  const applyZoom = (next: number) => {
    setZoomFactor(next);
    setZoomed(Math.abs(next - 1) > 0.05);
  };

  const getNextOrder = () => {
    let maxOrder = 0;
    for (const el of elementsRef.current) {
      if ((el.order ?? 0) > maxOrder) maxOrder = el.order ?? 0;
    }
    for (const s of strokesRef.current) {
      if ((s.order ?? 0) > maxOrder) maxOrder = s.order ?? 0;
    }
    return maxOrder + 1;
  };

  const getMinOrder = () => {
    let minOrder = 0;
    for (const el of elementsRef.current) {
      if ((el.order ?? 0) < minOrder) minOrder = el.order ?? 0;
    }
    for (const s of strokesRef.current) {
      if ((s.order ?? 0) < minOrder) minOrder = s.order ?? 0;
    }
    return minOrder - 1;
  };

  /**
   * Строим чанки отрисовки:
   * 1) слои снизу вверх в порядке списка `layers` (только `visible: true`)
   * 2) внутри каждого слоя элементы и штрихи отсортированы строго по `order` (времени создания):
   *    если фото создано раньше, а поверх него нарисовали штрих — штрих гарантированно выше фото!
   */
  const renderChunks = useMemo<RenderChunk[]>(() => {
    const chunks: RenderChunk[] = [];
    const defaultLayerId = layers[0].id;

    for (const layer of layers) {
      if (!layer.visible) continue;
      const isLayerInteractive = !layer.locked;

      const items: (
        | { kind: 'stroke'; order: number; stroke: Stroke }
        | { kind: 'element'; order: number; element: CanvasElement }
      )[] = [];

      for (const s of renderStrokes) {
        if (lassoIds.has(s.id)) continue;
        const lid = s.layerId ?? defaultLayerId;
        if (lid === layer.id) {
          items.push({ kind: 'stroke', order: s.order ?? 0, stroke: s });
        }
      }

      for (const el of note.elements) {
        const lid = el.layerId ?? defaultLayerId;
        if (lid === layer.id) {
          items.push({ kind: 'element', order: el.order ?? 0, element: el });
        }
      }

      items.sort((a, b) => a.order - b.order);

      let strokeRun: Stroke[] = [];
      const flushStrokes = (suffix: string) => {
        if (strokeRun.length > 0) {
          chunks.push({
            kind: 'strokes',
            key: `s-${layer.id}-${suffix}`,
            strokes: strokeRun,
          });
          strokeRun = [];
        }
      };

      items.forEach((it, idx) => {
        if (it.kind === 'stroke') {
          strokeRun.push(it.stroke);
        } else {
          flushStrokes(`${idx}`);
          chunks.push({
            kind: 'element',
            key: `el-${it.element.id}`,
            element: it.element,
            interactive: isLayerInteractive,
          });
        }
      });
      flushStrokes('tail');
    }

    return chunks;
  }, [layers, renderStrokes, lassoIds, note.elements]);

  const liveHostKey = [...renderChunks].reverse().find((item) => item.kind === 'strokes')?.key ?? null;

  const selectedLassoStrokes = useMemo(
    () => renderStrokes.filter((s) => lassoIds.has(s.id)),
    [renderStrokes, lassoIds],
  );

  const patch = useCallback(
    (next: NotePatch) => {
      const bodyFromText =
        next.elements?.find((e): e is TextElement => e.type === 'text')?.text ?? note.body;
      onChange(note.id, { ...next, body: bodyFromText });
    },
    [note.body, note.id, onChange],
  );

  const pushHistory = () => {
    const snap: Snapshot = {
      elements: elementsRef.current,
      strokes: strokesRef.current,
      layers: layersRef.current,
      activeLayerId: activeLayerRef.current.id,
    };
    setUndoStack((prev) => [...prev.slice(-(MAX_HISTORY - 1)), snap]);
    setRedoStack([]);
  };

  const updateElements = (elements: CanvasElement[], record = true) => {
    if (record) pushHistory();
    elementsRef.current = elements;
    patch({ elements });
  };

  const commitStrokes = (next: Stroke[], record = true) => {
    if (record) pushHistory();
    strokesRef.current = next;
    setRenderStrokes(next);
    patch({ strokes: next });
  };

  const handleUndo = () => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setRedoStack((r) => [
        ...r,
        {
          elements: elementsRef.current,
          strokes: strokesRef.current,
          layers: layersRef.current,
          activeLayerId: activeLayerRef.current.id,
        },
      ]);
      elementsRef.current = last.elements;
      strokesRef.current = last.strokes;
      layersRef.current = last.layers;
      setRenderStrokes(last.strokes);
      patch({
        elements: last.elements,
        strokes: last.strokes,
        layers: last.layers,
        activeLayerId: last.activeLayerId,
      });
      return prev.slice(0, -1);
    });
  };

  const handleRedo = () => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setUndoStack((u) => [
        ...u,
        {
          elements: elementsRef.current,
          strokes: strokesRef.current,
          layers: layersRef.current,
          activeLayerId: activeLayerRef.current.id,
        },
      ]);
      elementsRef.current = last.elements;
      strokesRef.current = last.strokes;
      layersRef.current = last.layers;
      setRenderStrokes(last.strokes);
      patch({
        elements: last.elements,
        strokes: last.strokes,
        layers: last.layers,
        activeLayerId: last.activeLayerId,
      });
      return prev.slice(0, -1);
    });
  };

  const onPageLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setViewportSize({
      width: Math.max(1, Math.round(width)),
      height: Math.max(1, Math.round(height)),
    });
  };

  const framePad = note.pageFullScreen ? 0 : spacing.md * 2;
  const defaultPageWidth = Math.max(280, viewportSize.width - framePad);
  const defaultPageHeight = Math.max(
    PAGE.minHeight,
    Math.round(defaultPageWidth * (isTablet ? 1.25 : 1.45)),
  );

  const pageSize = useMemo(() => {
    if (note.pageFullScreen) {
      return {
        width: viewportSize.width,
        height: viewportSize.height,
      };
    }
    return {
      width: note.pageWidth ?? defaultPageWidth,
      height: note.pageHeight ?? defaultPageHeight,
    };
  }, [
    note.pageFullScreen,
    note.pageWidth,
    note.pageHeight,
    viewportSize.width,
    viewportSize.height,
    defaultPageWidth,
    defaultPageHeight,
  ]);

  const pageOverflowsX =
    pageSize.width * zoomFactor + framePad > viewportSize.width + 1;

  const layerBlockedNotice = () => {
    showNotice(
      activeLayer.locked
        ? 'Слой заблокирован. Снимите замок в панели слоёв.'
        : 'Активный слой скрыт. Включите его в панели слоёв.',
    );
  };

  const addTextAt = (x: number, y: number) => {
    if (!activeLayer.visible || activeLayer.locked) {
      layerBlockedNotice();
      return;
    }
    const el: TextElement = {
      id: uid('text'),
      type: 'text',
      x,
      y,
      width: isTablet ? 340 : 220,
      height: Math.round(textDefaults.fontSize * 1.45 + 12),
      text: '',
      fontFamily: textDefaults.fontFamily,
      fontSize: textDefaults.fontSize,
      color: textDefaults.color || bg.ink,
      rotation: 0,
      bold: textDefaults.bold,
      italic: textDefaults.italic,
      underline: textDefaults.underline,
      alignH: textDefaults.alignH,
      alignV: textDefaults.alignV,
      layerId: activeLayer.id,
      order: getNextOrder(),
    };
    updateElements([...elementsRef.current, el]);
    setSelectedId(el.id);
    setLassoIds(new Set());
    setTool('select');
  };

  const addStickerAt = (x: number, y: number) => {
    if (!activeLayer.visible || activeLayer.locked) {
      layerBlockedNotice();
      return;
    }
    const el: StickerElement = {
      id: uid('sticker'),
      type: 'sticker',
      x,
      y,
      width: isTablet ? 170 : 140,
      height: isTablet ? 140 : 120,
      text: '',
      tone: stickerTone,
      variant: stickerVariant,
      rotation: -2,
      layerId: activeLayer.id,
      order: getNextOrder(),
    };
    updateElements([...elementsRef.current, el]);
    setSelectedId(el.id);
    setLassoIds(new Set());
    setTool('select');
  };

  const addPhoto = async () => {
    if (!activeLayer.visible || activeLayer.locked) {
      layerBlockedNotice();
      return;
    }
    const picked = await pickAndPersistImage();
    if (picked.status === 'cancelled') return;
    if (picked.status === 'denied') {
      Alert.alert('Нет доступа', 'Разрешите доступ к галерее, чтобы добавить фото.');
      return;
    }
    if (picked.status === 'error') {
      Alert.alert('Не удалось открыть фото', 'Попробуйте выбрать другое изображение.');
      return;
    }
    const maxSide = isTablet ? 320 : 220;
    const aspect = picked.image.aspectRatio;
    const width = aspect >= 1 ? maxSide : maxSide * aspect;
    const height = aspect >= 1 ? maxSide / aspect : maxSide;
    const el: CanvasElement = {
      id: uid('img'),
      type: 'image',
      x: 36,
      y: 72,
      width,
      height,
      aspectRatio: aspect,
      uri: picked.image.uri,
      rotation: 0,
      cornerRadius: 12,
      mask: 'none',
      layerId: activeLayer.id,
      order: getNextOrder(),
    };
    updateElements([...elementsRef.current, el]);
    setSelectedId(el.id);
    setLassoIds(new Set());
    setTool('select');
  };

  const applyCropToSelectedPhoto = (crop: CropRect) => {
    if (!selectedImage) return;
    const baseAspect =
      selectedImage.aspectRatio > 0
        ? selectedImage.aspectRatio
        : selectedImage.width / Math.max(1, selectedImage.height);
    const nextAspect = (baseAspect * crop.w) / Math.max(0.05, crop.h);
    const width = selectedImage.width;
    const height = width / nextAspect;
    patchElement(selectedImage.id, {
      crop,
      width,
      height,
    });
  };

  const bringSelectedToFront = () => {
    const nextOrd = getNextOrder();
    const topLayer =
      [...layers].reverse().find((l) => l.visible && !l.locked) ?? activeLayer;
    if (selectedId) {
      patchElement(selectedId, { order: nextOrd, layerId: topLayer.id });
      if (activeLayer.id !== topLayer.id) {
        onChange(note.id, { activeLayerId: topLayer.id });
      }
      return;
    }
    if (lassoIds.size > 0) {
      let step = nextOrd;
      commitStrokes(
        strokesRef.current.map((s) =>
          lassoIds.has(s.id) ? { ...s, order: step++, layerId: topLayer.id } : s,
        ),
      );
    }
  };

  const sendSelectedToBack = () => {
    let minOrd = getMinOrder();
    const bottomLayer = layers.find((l) => l.visible && !l.locked) ?? activeLayer;
    if (selectedId) {
      patchElement(selectedId, { order: minOrd, layerId: bottomLayer.id });
      if (activeLayer.id !== bottomLayer.id) {
        onChange(note.id, { activeLayerId: bottomLayer.id });
      }
      return;
    }
    if (lassoIds.size > 0) {
      commitStrokes(
        strokesRef.current.map((s) =>
          lassoIds.has(s.id) ? { ...s, order: minOrd--, layerId: bottomLayer.id } : s,
        ),
      );
    }
  };

  // Операции со слоями (как в Photoshop)
  const handleSelectLayer = (id: string) => {
    setSelectedId(null);
    setLassoIds(new Set());
    onChange(note.id, { activeLayerId: id });
  };

  const handleAddLayer = () => {
    pushHistory();
    const num = layers.length + 1;
    const newLayer: LayerItem = {
      id: uid('layer'),
      name: `Слой ${num}`,
      visible: true,
      locked: false,
    };
    const nextLayers = [...layers, newLayer];
    layersRef.current = nextLayers;
    patch({ layers: nextLayers, activeLayerId: newLayer.id });
  };

  const handleDeleteLayer = (id: string) => {
    if (layers.length <= 1) return;
    const nextLayers = layers.filter((l) => l.id !== id);
    const nextActive =
      activeLayerId === id ? nextLayers[nextLayers.length - 1].id : activeLayerId;
    const defaultId = layers[0].id;
    const nextElements = elementsRef.current.filter((e) => (e.layerId ?? defaultId) !== id);
    const nextStrokes = strokesRef.current.filter((s) => (s.layerId ?? defaultId) !== id);
    pushHistory();
    elementsRef.current = nextElements;
    strokesRef.current = nextStrokes;
    setRenderStrokes(nextStrokes);
    setSelectedId(null);
    setLassoIds(new Set());
    patch({
      layers: nextLayers,
      activeLayerId: nextActive,
      elements: nextElements,
      strokes: nextStrokes,
    });
  };

  const handleToggleLayerVisible = (id: string) => {
    const nextLayers = layers.map((l) =>
      l.id === id ? { ...l, visible: !l.visible } : l,
    );
    patch({ layers: nextLayers });
  };

  const handleToggleLayerLocked = (id: string) => {
    const nextLayers = layers.map((l) =>
      l.id === id ? { ...l, locked: !l.locked } : l,
    );
    patch({ layers: nextLayers });
  };

  const handleMoveLayer = (id: string, direction: 'up' | 'down') => {
    const idx = layers.findIndex((l) => l.id === id);
    if (idx < 0) return;
    const targetIdx = direction === 'up' ? idx + 1 : idx - 1;
    if (targetIdx < 0 || targetIdx >= layers.length) return;
    const nextLayers = [...layers];
    const [item] = nextLayers.splice(idx, 1);
    nextLayers.splice(targetIdx, 0, item);
    patch({ layers: nextLayers });
  };

  const eraseNear = (point: Point) => {
    const curLayer = activeLayerRef.current;
    if (!curLayer.visible || curLayer.locked) return;
    const defaultId = layers[0].id;
    const radius = Math.max(12, toolConfigsRef.current.eraser.width * 1.6);
    const prev = strokesRef.current;
    const onActive = prev.filter((s) => (s.layerId ?? defaultId) === curLayer.id);
    const erasedActive =
      eraserModeRef.current === 'whole'
        ? eraseStrokesWhole(onActive, point, radius)
        : eraseStrokesPartial(onActive, point, radius);
    if (erasedActive !== onActive) {
      if (!eraseSnapshotTakenRef.current) {
        pushHistory();
        eraseSnapshotTakenRef.current = true;
      }
      const others = prev.filter((s) => (s.layerId ?? defaultId) !== curLayer.id);
      const next = [...others, ...erasedActive];
      strokesRef.current = next;
      const now = Date.now();
      if (now - erasePaintAt.current > 16) {
        erasePaintAt.current = now;
        setRenderStrokes(strokesRef.current);
      }
    }
  };

  const paintLive = (pts: Point[], color: string, width: number, opacity: number) => {
    const b = Skia.PathBuilder.Make();
    if (pts.length > 0) {
      b.moveTo(pts[0].x, pts[0].y);
      if (pts.length === 1) {
        b.lineTo(pts[0].x + 0.1, pts[0].y + 0.1);
      } else {
        for (let i = 1; i < pts.length; i += 1) b.lineTo(pts[i].x, pts[i].y);
      }
    }
    liveColor.value = color;
    liveWidth.value = width;
    liveOpacity.value = opacity;
    livePath.value = b.detach();
  };

  const clearLivePath = () => {
    inking.value = 0;
    livePts.value = [];
    liveBuilder.value.reset();
    livePath.value = liveBuilder.value.build();
  };

  const allowedPointer = (pointerType?: number) => {
    const t = toolRef.current;
    if ((t === 'pen' || t === 'highlighter' || t === 'shape') && stylusOnlyRef.current) {
      return pointerType !== PointerType.TOUCH;
    }
    return true;
  };

  const beginStroke = (
    rawX: number,
    rawY: number,
    pressure?: number | null,
    pointerType?: number,
  ) => {
    if (pinchingRef.current) return;
    const { x, y } = toPage(rawX, rawY);
    const curLayer = activeLayerRef.current;
    if (!curLayer.visible || curLayer.locked) {
      showNotice(
        curLayer.locked
          ? 'Слой заблокирован. Снимите замок в панели слоёв.'
          : 'Активный слой скрыт. Включите его в панели слоёв.',
      );
      return;
    }
    const currentTool = toolRef.current;

    if (currentTool === 'lasso') {
      lassoStartRef.current = { x, y };
      setLassoIds(new Set());
      if (lassoModeRef.current === 'rect') {
        setLassoRect({ x, y, width: 1, height: 1 });
        setLassoPath(null);
      } else {
        lassoPathRef.current = [{ x, y }];
        setLassoPath([{ x, y }]);
        setLassoRect(null);
      }
      return;
    }

    if (!allowedPointer(pointerType)) {
      if (pointerType === PointerType.TOUCH) {
        showNotice('Сейчас рисует только стилус. Сверху включите «Палец+стилус».');
      }
      return;
    }
    eraseSnapshotTakenRef.current = false;

    if (currentTool === 'eraser') {
      eraseNear({ x, y });
      return;
    }
    if (currentTool === 'shape') {
      const cfg = toolConfigsRef.current.shape;
      shapeStartRef.current = { x, y };
      const stroke: Stroke = {
        id: uid('shape'),
        points: [{ x, y, width: cfg.width }],
        color: cfg.color,
        width: cfg.width,
        opacity: cfg.opacity,
        layerId: curLayer.id,
        order: getNextOrder(),
      };
      strokeRef.current = stroke;
      paintLive(stroke.points, cfg.color, cfg.width, cfg.opacity);
      return;
    }
  };

  const moveStroke = (
    rawX: number,
    rawY: number,
    pressure?: number | null,
    pointerType?: number,
  ) => {
    if (pinchingRef.current) return;
    const { x, y } = toPage(rawX, rawY);
    const curLayer = activeLayerRef.current;
    if (!curLayer.visible || curLayer.locked) return;
    const currentTool = toolRef.current;

    if (currentTool === 'lasso') {
      if (lassoModeRef.current === 'rect' && lassoStartRef.current) {
        const sx = lassoStartRef.current.x;
        const sy = lassoStartRef.current.y;
        setLassoRect({
          x: Math.min(sx, x),
          y: Math.min(sy, y),
          width: Math.max(2, Math.abs(x - sx)),
          height: Math.max(2, Math.abs(y - sy)),
        });
      } else {
        const last = lassoPathRef.current[lassoPathRef.current.length - 1];
        if (last && dist(last, { x, y }) < 4) return;
        const nextPath = [...lassoPathRef.current, { x, y }];
        lassoPathRef.current = nextPath;
        setLassoPath(nextPath);
      }
      return;
    }

    if (!allowedPointer(pointerType)) return;
    if (currentTool === 'eraser') {
      eraseNear({ x, y });
      return;
    }
    if (currentTool === 'shape' && shapeStartRef.current && strokeRef.current) {
      const cfg = toolConfigsRef.current.shape;
      const pts = buildShapePoints(
        shapeKindRef.current,
        shapeStartRef.current,
        { x, y },
        cfg.width,
      );
      const next = { ...strokeRef.current, points: pts };
      strokeRef.current = next;
      paintLive(pts, cfg.color, cfg.width, cfg.opacity);
      return;
    }
  };

  const endStroke = (endX?: number, endY?: number) => {
    const end = endX != null && endY != null ? toPage(endX, endY) : null;
    const currentTool = toolRef.current;

    if (currentTool === 'eraser') {
      if (eraseSnapshotTakenRef.current) {
        eraseSnapshotTakenRef.current = false;
        patch({ strokes: strokesRef.current });
      }
      return;
    }

    if (currentTool === 'lasso') {
      const curLayer = activeLayerRef.current;
      const defaultId = layers[0].id;
      const picked = new Set<string>();
      if (lassoModeRef.current === 'rect' && lassoStartRef.current) {
        const start = lassoStartRef.current;
        const endPoint = {
          x: end?.x ?? start.x,
          y: end?.y ?? start.y,
        };
        if (Math.hypot(endPoint.x - start.x, endPoint.y - start.y) > 6) {
          for (const s of strokesRef.current) {
            if ((s.layerId ?? defaultId) !== curLayer.id) continue;
            if (strokeInsideRect(s, start, endPoint)) picked.add(s.id);
          }
        }
      } else {
        const poly = lassoPathRef.current;
        if (poly.length >= 3) {
          for (const s of strokesRef.current) {
            if ((s.layerId ?? defaultId) !== curLayer.id) continue;
            if (strokeInsidePolygon(s, poly)) picked.add(s.id);
          }
        }
      }
      lassoStartRef.current = null;
      lassoPathRef.current = [];
      setLassoPath(null);
      setLassoRect(null);
      setLassoIds(picked);
      if (picked.size > 0) {
        setSelectedId(null);
      }
      return;
    }

    const current = strokeRef.current;
    const wasShape = currentTool === 'shape';
    strokeRef.current = null;
    shapeStartRef.current = null;
    clearLivePath();
    if (current && current.points.length >= 1) {
      const smoothLvl =
        currentTool === 'pen' || currentTool === 'highlighter'
          ? toolConfigsRef.current[currentTool].smoothing
          : 0;
      const points = wasShape
        ? current.points
        : smoothPoints(current.points, smoothLvl);
      const finished = { ...current, points };
      commitStrokes([...strokesRef.current, finished], true);
      if (wasShape) {
        setLassoIds(new Set([finished.id]));
        setSelectedId(null);
        setTool('select');
      }
    }
  };

  const cancelLiveStroke = () => {
    pinchingRef.current = true;
    strokeRef.current = null;
    shapeStartRef.current = null;
    lassoStartRef.current = null;
    clearLivePath();
    setLassoPath(null);
    setLassoRect(null);
    lassoPathRef.current = [];
  };

  const finishPinchGuard = () => {
    pinchingRef.current = false;
  };

  const scaleSelectedFromCanvasPinch = (factor: number) => {
    const clamped = Math.max(0.3, Math.min(3.5, factor));
    if (lassoIdsRef.current.size > 0) {
      const grpStrokes = strokesRef.current.filter((s) => lassoIdsRef.current.has(s.id));
      const box = boundsOfStrokes(grpStrokes);
      if (!box) return;
      const transformed = transformSelectedStrokes(
        strokesRef.current,
        lassoIdsRef.current,
        {
          dx: 0,
          dy: 0,
          scale: clamped,
          rotationDeg: 0,
          cx: box.x + box.width / 2,
          cy: box.y + box.height / 2,
        },
      );
      commitStrokes(transformed, true);
      return;
    }
    if (selectedImage) {
      const nextW = Math.max(80, Math.min(900, selectedImage.width * clamped));
      const baseAspect =
        selectedImage.aspectRatio > 0
          ? selectedImage.aspectRatio
          : selectedImage.width / Math.max(1, selectedImage.height);
      const c = selectedImage.crop ?? { x: 0, y: 0, w: 1, h: 1 };
      const effAspect = (baseAspect * c.w) / Math.max(0.05, c.h);
      patchElement(selectedImage.id, {
        width: nextW,
        height: nextW / effAspect,
      });
      return;
    }
    if (selectedSticker) {
      patchElement(selectedSticker.id, {
        width: Math.max(100, Math.min(700, selectedSticker.width * clamped)),
        height: Math.max(70, Math.min(700, selectedSticker.height * clamped)),
      });
      return;
    }
    if (selectedText) {
      patchElement(selectedText.id, {
        width: Math.max(100, Math.min(700, selectedText.width * clamped)),
      });
    }
  };

  const handleCanvasTap = (rawX: number, rawY: number) => {
    const { x, y } = toPage(rawX, rawY);
    if (tool === 'text') {
      addTextAt(x, y);
      return;
    }
    if (tool === 'sticker') {
      addStickerAt(x, y);
      return;
    }
    setSelectedId(null);
    setLassoIds(new Set());
  };

  const isScrollingMode = tool === 'select' || tool === 'text' || tool === 'sticker';
  const hasObjectOrGroupSelected = !!selectedId || lassoIds.size > 0;
  const canInteractWithLassoGroup =
    lassoIds.size > 0 && (tool === 'select' || tool === 'lasso');

  const finishInk = () => {
    const raw = livePts.value;
    const points = raw.map((p) => ({
      x: p.x,
      y: p.y,
      width: p.width,
      pressure: p.pressure,
    }));
    const color = liveColor.value;
    const width = liveWidth.value;
    const opacity = liveOpacity.value;
    const mode = drawMode.value;
    clearLivePath();
    if (points.length === 0 || pinchingRef.current) return;
    const currentTool = mode === 2 ? 'highlighter' : 'pen';
    const smoothLvl = toolConfigsRef.current[currentTool].smoothing;
    const stroke: Stroke = {
      id: uid('stroke'),
      points: smoothPoints(points, smoothLvl),
      color,
      width,
      opacity,
      layerId: activeLayerRef.current.id,
      order: getNextOrder(),
    };
    commitStrokes([...strokesRef.current, stroke], true);
  };

  const inkWidth = (base: number, pressure?: number | null) => {
    'worklet';
    if (pressure == null || Number.isNaN(pressure)) return base;
    const p = Math.min(1, Math.max(0.05, pressure));
    return Math.max(1, base * (0.35 + p * 1.4));
  };

  const toInk = (rawX: number, rawY: number) => {
    'worklet';
    const s = Math.max(0.05, canvasScale.value);
    return { x: rawX / s, y: rawY / s };
  };

  const beginInk = (rawX: number, rawY: number, pressure: number | null | undefined, mode: number) => {
    'worklet';
    const { x, y } = toInk(rawX, rawY);
    const base = mode === 2 ? hiWidthSv.value : penWidthSv.value;
    const width = mode === 2 ? base : inkWidth(base, pressure);
    liveColor.value = mode === 2 ? hiColorSv.value : penColorSv.value;
    liveWidth.value = base;
    liveOpacity.value = mode === 2 ? hiOpacitySv.value : penOpacitySv.value;
    const builder = liveBuilder.value;
    builder.reset();
    builder.moveTo(x, y);
    livePath.value = builder.build();
    notifyChange(livePath);
    livePts.value = [{ x, y, width, pressure: pressure ?? undefined }];
    inking.value = 1;
  };

  const extendInk = (
    rawX: number,
    rawY: number,
    pressure: number | null | undefined,
    mode: number,
  ) => {
    'worklet';
    if (!inking.value) return;
    const { x, y } = toInk(rawX, rawY);
    const pts = livePts.value;
    const last = pts[pts.length - 1];
    if (last) {
      const dx = x - last.x;
      const dy = y - last.y;
      if (dx * dx + dy * dy < 0.16) return;
    }
    const base = mode === 2 ? hiWidthSv.value : penWidthSv.value;
    const width = mode === 2 ? base : inkWidth(base, pressure);
    pts.push({ x, y, width, pressure: pressure ?? undefined });
    liveBuilder.value.lineTo(x, y);
    livePath.value = liveBuilder.value.build();
    notifyChange(livePath);
  };

  const drawGesture = Gesture.Pan()
    .enabled(!isScrollingMode)
    .minDistance(0)
    .maxPointers(1)
    .onBegin((e) => {
      if (e.numberOfPointers > 1) {
        runOnJS(cancelLiveStroke)();
        return;
      }
      const mode = drawMode.value;
      if (mode === 1 || mode === 2) {
        if (!canInk.value) {
          runOnJS(beginStroke)(e.x, e.y, e.stylusData?.pressure, e.pointerType);
          return;
        }
        if (stylusOnlySv.value === 1 && e.pointerType === PointerType.TOUCH) {
          runOnJS(beginStroke)(e.x, e.y, e.stylusData?.pressure, e.pointerType);
          return;
        }
        beginInk(e.x, e.y, e.stylusData?.pressure, mode);
        return;
      }
      runOnJS(beginStroke)(e.x, e.y, e.stylusData?.pressure, e.pointerType);
    })
    .onUpdate((e) => {
      if (e.numberOfPointers > 1) {
        runOnJS(cancelLiveStroke)();
        return;
      }
      const mode = drawMode.value;
      if (mode === 1 || mode === 2) {
        extendInk(e.x, e.y, e.stylusData?.pressure, mode);
        return;
      }
      runOnJS(moveStroke)(e.x, e.y, e.stylusData?.pressure, e.pointerType);
    })
    .onEnd((e) => {
      const mode = drawMode.value;
      if ((mode === 1 || mode === 2) && inking.value) {
        runOnJS(finishInk)();
        return;
      }
      runOnJS(endStroke)(e.x, e.y);
    });

  const tapGesture = Gesture.Tap()
    .enabled(isScrollingMode)
    .maxDistance(8)
    .onEnd((e) => {
      runOnJS(handleCanvasTap)(e.x, e.y);
    });

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      runOnJS(cancelLiveStroke)();
    })
    .onUpdate((e) => {
      if (hasObjectOrGroupSelected) return;
      const next = Math.min(2.5, Math.max(0.8, savedScale.value * e.scale));
      scale.value = next;
    })
    .onEnd((e) => {
      if (hasObjectOrGroupSelected) {
        runOnJS(scaleSelectedFromCanvasPinch)(e.scale);
      } else {
        const next = Math.min(2.5, Math.max(0.8, scale.value));
        scale.value = next;
        savedScale.value = next;
        runOnJS(applyZoom)(next);
      }
      runOnJS(finishPinchGuard)();
    })
    .onFinalize(() => {
      runOnJS(finishPinchGuard)();
    });

  const canvasGesture = isScrollingMode
    ? Gesture.Simultaneous(pinchGesture, tapGesture)
    : Gesture.Simultaneous(pinchGesture, drawGesture);

  const zoomStyle = useAnimatedStyle(() => ({
    transformOrigin: 'left top',
    transform: [{ scale: scale.value }],
  }));

  const resetZoom = () => {
    scale.value = 1;
    savedScale.value = 1;
    setZoomFactor(1);
    setZoomed(false);
  };

  const confirmDelete = () => {
    Alert.alert('Удалить заметку?', 'Действие нельзя отменить.', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: () => onDelete(note.id) },
    ]);
  };

  const deleteSelected = () => {
    if (lassoIds.size > 0) {
      commitStrokes(strokesRef.current.filter((s) => !lassoIds.has(s.id)));
      setLassoIds(new Set());
      return;
    }
    if (!selectedId) return;
    updateElements(elementsRef.current.filter((e) => e.id !== selectedId));
    setSelectedId(null);
  };

  const applyFont = (fontFamily: string) => {
    setTextDefaults((prev) => ({ ...prev, fontFamily }));
    if (!selectedText) return;
    updateElements(
      elementsRef.current.map((e) => (e.id === selectedText.id ? { ...e, fontFamily } : e)),
    );
  };

  const applyFontSize = (fontSize: number) => {
    setTextDefaults((prev) => ({ ...prev, fontSize }));
    if (!selectedText) return;
    const prevSize = Math.max(1, selectedText.fontSize);
    const ratio = fontSize / prevSize;
    const width = Math.max(80, Math.min(1400, selectedText.width * ratio));
    const height = Math.max(
      28,
      Math.min(1400, (selectedText.height ?? Math.round(prevSize * 1.45 + 12)) * ratio),
    );
    updateElements(
      elementsRef.current.map((e) =>
        e.id === selectedText.id ? { ...e, fontSize, width, height } : e,
      ),
    );
  };

  const applyTextColor = (color: string) => {
    setTextDefaults((prev) => ({ ...prev, color }));
    if (!selectedText) return;
    updateElements(
      elementsRef.current.map((e) => (e.id === selectedText.id ? { ...e, color } : e)),
    );
  };

  const applyTextStyle = (
    stylePatch: Partial<
      Pick<TextElement, 'bold' | 'italic' | 'underline' | 'alignH' | 'alignV'>
    >,
  ) => {
    setTextDefaults((prev) => ({ ...prev, ...stylePatch }));
    if (!selectedText) return;
    updateElements(
      elementsRef.current.map((e) =>
        e.id === selectedText.id ? { ...e, ...stylePatch } : e,
      ),
    );
  };

  const applyStickerTone = (tone: string) => {
    setStickerTone(tone);
    if (selectedSticker) {
      patchElement(selectedSticker.id, { tone });
    }
  };

  const applyStickerVariant = (variant: StickerVariant) => {
    setStickerVariant(variant);
    if (selectedSticker) {
      patchElement(selectedSticker.id, { variant });
    }
  };

  const patchElement = (id: string, partial: Partial<CanvasElement>, record = true) => {
    updateElements(
      elementsRef.current.map((item) =>
        item.id === id ? ({ ...item, ...partial } as CanvasElement) : item,
      ),
      record,
    );
  };

  return (
    <View style={styles.root}>
      <CanvasToolbar
        tool={tool}
        onTool={(t) => {
          setTool(t);
          if (t !== 'lasso' && t !== 'select') setLassoIds(new Set());
          if (
            t === 'pen' ||
            t === 'highlighter' ||
            t === 'shape' ||
            t === 'eraser' ||
            t === 'lasso'
          ) {
            setSelectedId(null);
          }
        }}
        shapeKind={shapeKind}
        onShapeKind={setShapeKind}
        eraserMode={eraserMode}
        onEraserMode={setEraserMode}
        lassoMode={lassoMode}
        onLassoMode={setLassoMode}
        penColor={penColor}
        onPenColor={(color) => updateActiveConfig({ color })}
        penWidth={penWidth}
        onPenWidth={(width) => updateActiveConfig({ width })}
        penOpacity={penOpacity}
        onPenOpacity={(opacity) => updateActiveConfig({ opacity })}
        smoothing={smoothing}
        onSmoothing={(s) => updateActiveConfig({ smoothing: s })}
        stylusOnly={stylusOnly}
        onStylusOnly={setStylusOnly}
        stickerTone={selectedSticker?.tone ?? stickerTone}
        onStickerTone={applyStickerTone}
        stickerVariant={selectedSticker?.variant ?? stickerVariant}
        onStickerVariant={applyStickerVariant}
        imageMask={selectedImage?.mask ?? null}
        onImageMask={(mask: ImageMask) => {
          if (selectedImage) patchElement(selectedImage.id, { mask });
        }}
        imageCornerRadius={selectedImage?.cornerRadius ?? null}
        onImageCornerRadius={(cornerRadius: number) => {
          if (selectedImage) patchElement(selectedImage.id, { cornerRadius });
        }}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        background={note.background}
        onBackground={(id: BackgroundId) => {
          const tpl = getBackground(id);
          patch({
            background: id,
            paperColor: tpl.paper,
            lineColor: tpl.line,
          });
        }}
        paperColor={paperColor}
        onPaperColor={(c) => patch({ paperColor: c })}
        lineColor={lineColor}
        onLineColor={(c) => patch({ lineColor: c })}
        pageFullScreen={!!note.pageFullScreen}
        onPageFullScreen={(pageFullScreen) => patch({ pageFullScreen })}
        pageWidth={pageSize.width}
        onPageWidth={(pageWidth) => patch({ pageWidth, pageFullScreen: false })}
        pageHeight={pageSize.height}
        onPageHeight={(pageHeight) => patch({ pageHeight, pageFullScreen: false })}
        folder={note.folder}
        folders={folders}
        onFolder={(folder) => patch({ folder })}
        onCreateFolder={onCreateFolder}
        pinned={!!note.pinned}
        onTogglePin={() => onChange(note.id, { pinned: !note.pinned })}
        onExportPng={() => {
          setSelectedId(null);
          setLassoIds(new Set());
          resetZoom();
          setTimeout(() => void exportCanvasAsPng(viewShotRef), 220);
        }}
        onExportPdf={() => {
          setSelectedId(null);
          setLassoIds(new Set());
          resetZoom();
          setTimeout(() => void exportCanvasAsPdf(viewShotRef, note.title), 220);
        }}
        onResetZoom={resetZoom}
        zoomed={zoomed}
        selectedFont={selectedText?.fontFamily ?? textDefaults.fontFamily}
        onFont={applyFont}
        fontSize={selectedText?.fontSize ?? textDefaults.fontSize}
        onFontSize={applyFontSize}
        textColor={selectedText?.color ?? textDefaults.color}
        onTextColor={applyTextColor}
        textStyle={
          selectedText
            ? {
                bold: !!selectedText.bold,
                italic: !!selectedText.italic,
                underline: !!selectedText.underline,
                alignH: selectedText.alignH ?? 'left',
                alignV: selectedText.alignV ?? 'top',
              }
            : {
                bold: textDefaults.bold,
                italic: textDefaults.italic,
                underline: textDefaults.underline,
                alignH: textDefaults.alignH,
                alignV: textDefaults.alignV,
              }
        }
        onTextStyle={applyTextStyle}
        onAddPhoto={() => {
          void addPhoto();
        }}
        onCropPhoto={() => {
          if (selectedImage) setCropping(true);
        }}
        onBringToFront={bringSelectedToFront}
        onSendToBack={sendSelectedToBack}
        onDeleteSelected={deleteSelected}
        hasSelection={!!selectedId || lassoIds.size > 0}
        hasTextSelection={!!selectedText}
        hasImageSelection={!!selectedImage}
        hasStickerSelection={!!selectedSticker}
        showBack={showBack}
        onBack={onBack}
        onDeleteNote={confirmDelete}
      />

      <TextInput
        value={note.title}
        onChangeText={(title) => onChange(note.id, { title })}
        placeholder="Название листа"
        placeholderTextColor={colors.textMuted}
        style={[styles.title, isTablet && styles.titleWide]}
      />

      {notice ? (
        <Pressable onPress={() => setNotice(null)} style={styles.notice}>
          <Text style={styles.noticeText}>{notice}</Text>
        </Pressable>
      ) : null}

      <View style={styles.scroll} onLayout={onPageLayout}>
        <ScrollView
          style={styles.scroll}
          scrollEnabled={isScrollingMode}
          disableScrollViewPanResponder={!isScrollingMode}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          nestedScrollEnabled
          overScrollMode="never"
          bounces={false}
        >
          <ScrollView
            horizontal
            scrollEnabled={isScrollingMode}
            disableScrollViewPanResponder={!isScrollingMode}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            showsHorizontalScrollIndicator={pageOverflowsX}
            overScrollMode="never"
            bounces={false}
            contentContainerStyle={[
              styles.scrollContent,
              isTablet && styles.scrollContentTablet,
              note.pageFullScreen && styles.scrollContentFull,
              pageOverflowsX ? styles.scrollAlignStart : styles.scrollAlignCenter,
            ]}
          >
        <GestureDetector gesture={canvasGesture}>
          <View
            collapsable={false}
            style={{
              width: pageSize.width * zoomFactor,
              height: pageSize.height * zoomFactor,
            }}
          >
          <Animated.View
            pointerEvents="box-none"
            style={[{ width: pageSize.width, height: pageSize.height }, zoomStyle]}
          >
            <ViewShot
              ref={viewShotRef}
              options={{ format: 'png', quality: 1 }}
              style={[
                styles.page,
                note.pageFullScreen && styles.pageFull,
                {
                  width: pageSize.width,
                  height: pageSize.height,
                  alignSelf: note.pageFullScreen
                    ? 'stretch'
                    : isTablet
                      ? 'center'
                      : 'stretch',
                },
              ]}
            >
              <BackgroundLayer
                background={note.background}
                paperColor={paperColor}
                lineColor={lineColor}
                width={pageSize.width}
                height={pageSize.height}
              />

              {/* Отрисовка по слоям и строго в хронологическом порядке (по старости) внутри каждого слоя */}
              {renderChunks.map((chunk) => {
                if (chunk.kind === 'strokes') {
                  const isLiveHost = chunk.key === liveHostKey;
                  return (
                    <DrawingLayer
                      key={chunk.key}
                      strokes={chunk.strokes}
                      width={pageSize.width}
                      height={pageSize.height}
                      livePath={isLiveHost ? livePath : undefined}
                      liveColor={isLiveHost ? liveColor : undefined}
                      liveWidth={isLiveHost ? liveWidth : undefined}
                      liveOpacity={isLiveHost ? liveOpacity : undefined}
                    />
                  );
                }

                const el = chunk.element;
                const elCanInteract = canInteract && chunk.interactive;
                const selectElement = () => {
                  setSelectedId(el.id);
                  setLassoIds(new Set());
                  setTool('select');
                  const targetLayer = el.layerId ?? layers[0].id;
                  if (targetLayer !== activeLayer.id) {
                    onChange(note.id, { activeLayerId: targetLayer });
                  }
                };
                if (el.type === 'text') {
                  return (
                    <TextBlock
                      key={chunk.key}
                      element={{
                        ...el,
                        rotation: el.rotation ?? 0,
                        bold: !!el.bold,
                        italic: !!el.italic,
                        underline: !!el.underline,
                      }}
                      selected={selectedId === el.id}
                      canInteract={elCanInteract}
                      canvasScale={canvasScale}
                      onSelect={selectElement}
                      onBeginEdit={pushHistory}
                      onDelete={() => {
                        updateElements(elementsRef.current.filter((e) => e.id !== el.id));
                        setSelectedId(null);
                      }}
                      onChange={(partial) => patchElement(el.id, partial, false)}
                      onTransformEnd={(partial) => patchElement(el.id, partial, true)}
                    />
                  );
                }
                if (el.type === 'sticker') {
                  return (
                    <StickerBlock
                      key={chunk.key}
                      element={{
                        ...el,
                        rotation: el.rotation ?? 0,
                        variant: el.variant ?? 'note',
                      }}
                      selected={selectedId === el.id}
                      canInteract={elCanInteract}
                      canvasScale={canvasScale}
                      onSelect={selectElement}
                      onBeginEdit={pushHistory}
                      onDelete={() => {
                        updateElements(elementsRef.current.filter((e) => e.id !== el.id));
                        setSelectedId(null);
                      }}
                      onChange={(partial) => patchElement(el.id, partial, false)}
                      onTransformEnd={(partial) => patchElement(el.id, partial, true)}
                    />
                  );
                }
                return (
                  <ImageBlock
                    key={chunk.key}
                    element={{
                      ...el,
                      rotation: el.rotation ?? 0,
                      aspectRatio:
                        el.aspectRatio || el.width / Math.max(1, el.height),
                      cornerRadius: el.cornerRadius ?? 12,
                      mask: el.mask ?? 'none',
                    }}
                    selected={selectedId === el.id}
                    canInteract={elCanInteract}
                    canvasScale={canvasScale}
                    onSelect={selectElement}
                    onDelete={() => {
                      updateElements(elementsRef.current.filter((e) => e.id !== el.id));
                      setSelectedId(null);
                    }}
                    onTransformEnd={(partial) => patchElement(el.id, partial, true)}
                  />
                );
              })}

              {liveHostKey == null ? (
                <DrawingLayer
                  strokes={[]}
                  width={pageSize.width}
                  height={pageSize.height}
                  livePath={livePath}
                  liveColor={liveColor}
                  liveWidth={liveWidth}
                  liveOpacity={liveOpacity}
                />
              ) : null}

              {/* Контур лассо / прямоугольного выделения */}
              {lassoPath || lassoRect ? (
                <DrawingLayer
                  strokes={[]}
                  lassoPath={lassoPath}
                  lassoBox={lassoRect}
                  width={pageSize.width}
                  height={pageSize.height}
                />
              ) : null}

              {/* Выделенные через лассо/прямоугольник штрихи как интерактивный объект */}
              {selectedLassoStrokes.length > 0 ? (
                <StrokeGroupBlock
                  groupId="lasso-selection"
                  strokes={selectedLassoStrokes}
                  selected
                  canInteract={canInteractWithLassoGroup}
                  canvasScale={canvasScale}
                  onSelect={() => {}}
                  onDelete={deleteSelected}
                  onTransformEnd={(params) => {
                    const transformed = transformSelectedStrokes(
                      strokesRef.current,
                      lassoIdsRef.current,
                      params,
                    );
                    commitStrokes(transformed, true);
                  }}
                />
              ) : null}
            </ViewShot>
          </Animated.View>
          </View>
        </GestureDetector>
          </ScrollView>
        </ScrollView>
      </View>

      <LayersPanel
        layers={layers}
        activeLayerId={activeLayer.id}
        onSelectLayer={handleSelectLayer}
        onAddLayer={handleAddLayer}
        onDeleteLayer={handleDeleteLayer}
        onToggleVisible={handleToggleLayerVisible}
        onToggleLocked={handleToggleLayerLocked}
        onMoveLayer={handleMoveLayer}
      />

      <ImageCropModal
        visible={cropping && !!selectedImage}
        uri={selectedImage?.uri ?? null}
        aspectRatio={selectedImage?.aspectRatio ?? 1}
        initialCrop={selectedImage?.crop}
        onApply={applyCropToSelectedPhoto}
        onClose={() => setCropping(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  titleWide: {
    fontSize: 26,
    paddingHorizontal: spacing.lg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  scrollContentTablet: {
    paddingVertical: spacing.lg,
  },
  scrollContentFull: {
    padding: 0,
    paddingBottom: 0,
  },
  scrollAlignCenter: {
    alignItems: 'center',
  },
  scrollAlignStart: {
    alignItems: 'flex-start',
  },
  notice: {
    marginHorizontal: spacing.md,
    marginTop: spacing.xs,
    backgroundColor: colors.tipBg,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  noticeText: {
    color: colors.tipText,
    fontSize: 13,
    lineHeight: 18,
  },
  page: {
    backgroundColor: '#fff',
    borderRadius: 18,
    overflow: 'visible',
    elevation: 3,
    shadowColor: '#1C1917',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  pageFull: {
    borderRadius: 0,
    elevation: 0,
    shadowOpacity: 0,
  },
});
