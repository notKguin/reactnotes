import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { BACKGROUNDS, LINE_PRESETS, PAPER_PRESETS } from '../../backgrounds';
import {
  canUseBold,
  FONT_CATEGORY_LABELS,
  FONT_OPTIONS,
  type FontCategory,
} from '../../fonts';
import { type SmoothingLevel } from '../../strokeUtils';
import { colors, PEN_COLORS, spacing, TABLET_BREAKPOINT } from '../../theme';
import { dismissTip, loadDismissedTips, type TipId } from '../../tips';
import type {
  BackgroundId,
  CanvasTool,
  EraserMode,
  ImageMask,
  LassoMode,
  ShapeKind,
  StickerVariant,
  TextAlignH,
  TextAlignV,
  TextElement,
} from '../../types';
import { TipBubble } from '../TipBubble';
import { ColorPickerModal } from './ColorPickerModal';
import { ShapeIcon } from './ShapeIcon';
import { STICKER_TONES, STICKER_VARIANTS } from './StickerBlock';
import { ValueSlider } from './ValueSlider';

type Panel = 'none' | 'draw' | 'page' | 'fonts' | 'folder' | 'export' | 'shapes';
type ColorTarget = 'pen' | 'text' | 'sticker' | 'paper' | 'line';
type IconSet = 'ion' | 'mci';

export const SHAPES: { kind: ShapeKind; icon: string; label: string }[] = [
  { kind: 'line', icon: 'minus', label: 'Линия' },
  { kind: 'dashedLine', icon: 'dots-horizontal', label: 'Пунктир' },
  { kind: 'arrow', icon: 'arrow-top-right', label: 'Стрелка' },
  { kind: 'doubleArrow', icon: 'arrow-left-right', label: 'Двойная стрелка' },
  { kind: 'rect', icon: 'rectangle-outline', label: 'Прямоугольник' },
  { kind: 'roundedRect', icon: 'square-rounded-outline', label: 'Скруглённый прямоугольник' },
  { kind: 'ellipse', icon: 'circle-outline', label: 'Круг / овал' },
  { kind: 'triangle', icon: 'triangle-outline', label: 'Треугольник' },
  { kind: 'rightTriangle', icon: 'triangle-outline', label: 'Прямоугольный треугольник' },
  { kind: 'diamond', icon: 'cards-diamond-outline', label: 'Ромб' },
  { kind: 'pentagon', icon: 'pentagon-outline', label: 'Пятиугольник' },
  { kind: 'hexagon', icon: 'hexagon-outline', label: 'Шестиугольник' },
  { kind: 'octagon', icon: 'octagon-outline', label: 'Восьмиугольник' },
  { kind: 'star', icon: 'star-outline', label: 'Звезда' },
  { kind: 'heart', icon: 'heart-outline', label: 'Сердце' },
  { kind: 'cloud', icon: 'cloud-outline', label: 'Облако' },
  { kind: 'callout', icon: 'message-outline', label: 'Выноска' },
  { kind: 'checkmark', icon: 'check', label: 'Галочка' },
  { kind: 'cross', icon: 'close', label: 'Крестик' },
  { kind: 'wave', icon: 'sine-wave', label: 'Волна' },
  { kind: 'bracket', icon: 'code-braces', label: 'Фигурная скобка' },
];

const IMAGE_MASKS: { mask: ImageMask; icon: string; label: string }[] = [
  { mask: 'none', icon: 'crop-square', label: 'Без маски' },
  { mask: 'circle', icon: 'circle-outline', label: 'Круг' },
  { mask: 'diamond', icon: 'cards-diamond-outline', label: 'Ромб' },
  { mask: 'hexagon', icon: 'hexagon-outline', label: 'Гексагон' },
  { mask: 'star', icon: 'star-outline', label: 'Звезда' },
  { mask: 'heart', icon: 'heart-outline', label: 'Сердце' },
];

type Props = {
  tool: CanvasTool;
  onTool: (tool: CanvasTool) => void;
  shapeKind: ShapeKind;
  onShapeKind: (kind: ShapeKind) => void;
  eraserMode: EraserMode;
  onEraserMode: (mode: EraserMode) => void;
  lassoMode: LassoMode;
  onLassoMode: (mode: LassoMode) => void;
  penColor: string;
  onPenColor: (color: string) => void;
  penWidth: number;
  onPenWidth: (width: number) => void;
  penOpacity: number;
  onPenOpacity: (opacity: number) => void;
  smoothing: SmoothingLevel;
  onSmoothing: (level: SmoothingLevel) => void;
  stylusOnly: boolean;
  onStylusOnly: (value: boolean) => void;
  stickerTone: string;
  onStickerTone: (tone: string) => void;
  stickerVariant: StickerVariant;
  onStickerVariant: (variant: StickerVariant) => void;
  imageMask: ImageMask | null;
  onImageMask: (mask: ImageMask) => void;
  imageCornerRadius: number | null;
  onImageCornerRadius: (radius: number) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  background: BackgroundId;
  onBackground: (id: BackgroundId) => void;
  paperColor: string;
  onPaperColor: (color: string) => void;
  lineColor: string;
  onLineColor: (color: string) => void;
  pageFullScreen: boolean;
  onPageFullScreen: (full: boolean) => void;
  pageWidth: number;
  onPageWidth: (width: number) => void;
  pageHeight: number;
  onPageHeight: (height: number) => void;
  folder: string;
  folders: string[];
  onFolder: (folder: string) => void;
  onCreateFolder: (name: string) => string;
  pinned: boolean;
  onTogglePin: () => void;
  onExportPng: () => void;
  onExportPdf: () => void;
  onResetZoom: () => void;
  zoomed: boolean;
  selectedFont: string | null;
  onFont: (fontFamily: string) => void;
  fontSize: number | null;
  onFontSize: (size: number) => void;
  textColor: string | null;
  onTextColor: (color: string) => void;
  textStyle: {
    bold: boolean;
    italic: boolean;
    underline: boolean;
    alignH: TextAlignH;
    alignV: TextAlignV;
  } | null;
  onTextStyle: (
    patch: Partial<
      Pick<TextElement, 'bold' | 'italic' | 'underline' | 'alignH' | 'alignV'>
    >,
  ) => void;
  onAddPhoto: () => void;
  onCropPhoto: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onDeleteSelected: () => void;
  hasSelection: boolean;
  hasTextSelection: boolean;
  hasImageSelection: boolean;
  hasStickerSelection: boolean;
  showBack?: boolean;
  onBack?: () => void;
  onDeleteNote: () => void;
};

function ToolBtn({
  label,
  name,
  set = 'ion',
  active,
  disabled,
  onPress,
}: {
  label: string;
  name: string;
  set?: IconSet;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const color = active ? '#fff' : colors.toolIdle;
  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPressIn={() => {
          scale.value = withSpring(0.9, { damping: 15, stiffness: 320 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 15, stiffness: 320 });
        }}
        onPress={onPress}
        disabled={disabled}
        style={[
          styles.toolBtn,
          active && styles.toolBtnActive,
          disabled && styles.toolBtnDisabled,
        ]}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        {set === 'mci' ? (
          <MaterialCommunityIcons
            name={name as ComponentProps<typeof MaterialCommunityIcons>['name']}
            size={22}
            color={color}
          />
        ) : (
          <Ionicons name={name as ComponentProps<typeof Ionicons>['name']} size={22} color={color} />
        )}
      </Pressable>
    </Animated.View>
  );
}

function StyleToggle({
  label,
  active,
  disabled,
  onPress,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      style={[
        styles.styleBtn,
        active && styles.styleBtnActive,
        disabled && styles.styleBtnDisabled,
      ]}
    >
      {children}
    </Pressable>
  );
}

function iconOn(color: string): string {
  const hex = color.replace('#', '');
  if (hex.length < 6) return '#fff';
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return '#fff';
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? '#171717' : '#fff';
}

export function CanvasToolbar(props: Props) {
  const {
    tool,
    onTool,
    shapeKind,
    onShapeKind,
    eraserMode,
    onEraserMode,
    lassoMode,
    onLassoMode,
    penColor,
    onPenColor,
    penWidth,
    onPenWidth,
    penOpacity,
    onPenOpacity,
    smoothing,
    onSmoothing,
    stylusOnly,
    onStylusOnly,
    stickerTone,
    onStickerTone,
    stickerVariant,
    onStickerVariant,
    imageMask,
    onImageMask,
    imageCornerRadius,
    onImageCornerRadius,
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    background,
    onBackground,
    paperColor,
    onPaperColor,
    lineColor,
    onLineColor,
    pageFullScreen,
    onPageFullScreen,
    pageWidth,
    onPageWidth,
    pageHeight,
    onPageHeight,
    folder,
    folders,
    onFolder,
    onCreateFolder,
    pinned,
    onTogglePin,
    onExportPng,
    onExportPdf,
    onResetZoom,
    zoomed,
    selectedFont,
    onFont,
    fontSize,
    onFontSize,
    textColor,
    onTextColor,
    textStyle,
    onTextStyle,
    onAddPhoto,
    onCropPhoto,
    onBringToFront,
    onSendToBack,
    onDeleteSelected,
    hasSelection,
    hasTextSelection,
    hasImageSelection,
    hasStickerSelection,
    showBack,
    onBack,
    onDeleteNote,
  } = props;

  const { width } = useWindowDimensions();
  const isTablet = width >= TABLET_BREAKPOINT;
  const compactBar = width < 430;
  const [panel, setPanel] = useState<Panel>('none');
  const [fontTab, setFontTab] = useState<FontCategory>('hand');
  const [activeTip, setActiveTip] = useState<TipId | null>(null);
  const [dismissed, setDismissed] = useState<Set<TipId>>(new Set());
  const [newFolderName, setNewFolderName] = useState('');
  const [colorTarget, setColorTarget] = useState<ColorTarget | null>(null);

  useEffect(() => {
    void loadDismissedTips().then(setDismissed);
  }, []);

  const showTip = (id: TipId) => {
    if (!dismissed.has(id)) setActiveTip(id);
  };

  const togglePanel = (next: Panel) => {
    setPanel((curr) => (curr === next ? 'none' : next));
  };

  const boldAvailable = selectedFont ? canUseBold(selectedFont) : false;
  const isDrawTool =
    tool === 'pen' || tool === 'highlighter' || tool === 'shape' || tool === 'eraser';
  const currentShape = SHAPES.find((s) => s.kind === shapeKind) ?? SHAPES[0];

  const activePickerColor =
    colorTarget === 'text'
      ? textColor || '#171717'
      : colorTarget === 'sticker'
        ? stickerTone
        : colorTarget === 'paper'
          ? paperColor
          : colorTarget === 'line'
            ? lineColor
            : penColor;

  const applyPickedColor = (hex: string) => {
    if (colorTarget === 'text') onTextColor(hex);
    else if (colorTarget === 'sticker') onStickerTone(hex);
    else if (colorTarget === 'paper') onPaperColor(hex);
    else if (colorTarget === 'line') onLineColor(hex);
    else onPenColor(hex);
  };

  return (
    <View style={[styles.root, isTablet && styles.rootTablet]}>
      <View style={styles.topBar}>
        {showBack ? (
          <Pressable onPress={onBack} hitSlop={10} style={styles.iconHit} accessibilityLabel="Назад">
            <Ionicons name="chevron-back" size={24} color={colors.accent} />
          </Pressable>
        ) : (
          <View style={styles.iconHit} />
        )}
        <View style={styles.topActions}>
          <Pressable
            onPress={() => onStylusOnly(!stylusOnly)}
            hitSlop={8}
            style={[styles.modePill, stylusOnly && styles.modePillActive]}
            accessibilityLabel={stylusOnly ? 'Ввод: только стилус' : 'Ввод: стилус и палец'}
          >
            <MaterialCommunityIcons
              name={stylusOnly ? 'pen' : 'hand-pointing-up'}
              size={16}
              color={stylusOnly ? '#fff' : colors.toolIdle}
            />
            {compactBar ? null : (
              <Text style={[styles.modePillText, stylusOnly && styles.modePillTextActive]}>
                {stylusOnly ? 'Стилус' : 'Палец+стилус'}
              </Text>
            )}
          </Pressable>
          {zoomed ? (
            <Pressable
              onPress={onResetZoom}
              hitSlop={8}
              style={styles.iconHit}
              accessibilityLabel="Сбросить масштаб"
            >
              <Ionicons name="contract-outline" size={20} color={colors.toolIdle} />
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => togglePanel('folder')}
            hitSlop={8}
            style={styles.iconHit}
            accessibilityLabel="Группа"
          >
            <Ionicons name="folder-outline" size={20} color={colors.toolIdle} />
          </Pressable>
          <Pressable
            onPress={onTogglePin}
            hitSlop={8}
            style={styles.iconHit}
            accessibilityLabel="Закрепить"
          >
            <MaterialCommunityIcons
              name={pinned ? 'pin' : 'pin-outline'}
              size={21}
              color={pinned ? colors.accent : colors.toolIdle}
            />
          </Pressable>
          <Pressable
            onPress={() => togglePanel('export')}
            hitSlop={8}
            style={styles.iconHit}
            accessibilityLabel="Экспорт"
          >
            <Ionicons name="share-outline" size={21} color={colors.toolIdle} />
          </Pressable>
          <Pressable
            onPress={onDeleteNote}
            hitSlop={10}
            style={styles.iconHit}
            accessibilityLabel="Удалить лист"
          >
            <Ionicons name="trash-outline" size={21} color={colors.danger} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.toolRow}
      >
        <ToolBtn name="arrow-undo-outline" label="Назад" disabled={!canUndo} onPress={onUndo} />
        <ToolBtn name="arrow-redo-outline" label="Вперёд" disabled={!canRedo} onPress={onRedo} />
        <ToolBtn
          name="move-outline"
          label="Выбор"
          active={tool === 'select'}
          onPress={() => {
            onTool('select');
            setPanel('none');
            showTip('select');
          }}
        />
        <ToolBtn
          name="pencil"
          set="mci"
          label="Перо"
          active={tool === 'pen'}
          onPress={() => {
            onTool('pen');
            setPanel('draw');
            showTip('pen');
          }}
        />
        <ToolBtn
          name="marker"
          set="mci"
          label="Маркер"
          active={tool === 'highlighter'}
          onPress={() => {
            onTool('highlighter');
            setPanel('draw');
            showTip('highlighter');
          }}
        />
        <ToolBtn
          name="shape-outline"
          set="mci"
          label="Фигуры"
          active={tool === 'shape'}
          onPress={() => {
            onTool('shape');
            setPanel('draw');
            showTip('shape');
          }}
        />
        <ToolBtn
          name="eraser"
          set="mci"
          label="Ластик"
          active={tool === 'eraser'}
          onPress={() => {
            onTool('eraser');
            setPanel('draw');
            showTip('eraser');
          }}
        />
        <ToolBtn
          name="lasso"
          set="mci"
          label="Лассо"
          active={tool === 'lasso'}
          onPress={() => {
            onTool('lasso');
            setPanel('none');
            showTip('lasso');
          }}
        />
        <ToolBtn
          name="format-text"
          set="mci"
          label="Текст"
          active={tool === 'text'}
          onPress={() => {
            onTool('text');
            setPanel('none');
            showTip('text');
          }}
        />
        <ToolBtn
          name="sticker-emoji"
          set="mci"
          label="Стикер"
          active={tool === 'sticker'}
          onPress={() => {
            onTool('sticker');
            setPanel('none');
            showTip('sticker');
          }}
        />
        <ToolBtn
          name="image-outline"
          label="Фото"
          onPress={() => {
            onAddPhoto();
            showTip('photo');
          }}
        />
        <ToolBtn
          name="grid-outline"
          label="Фон"
          active={panel === 'page'}
          onPress={() => {
            togglePanel('page');
            showTip('background');
          }}
        />
        <ToolBtn
          name="format-font"
          set="mci"
          label="Шрифт"
          active={panel === 'fonts'}
          onPress={() => {
            togglePanel('fonts');
            showTip('font');
          }}
        />
        {hasImageSelection ? (
          <ToolBtn
            name="crop-outline"
            label="Обрезать"
            onPress={() => {
              onCropPhoto();
              showTip('object');
            }}
          />
        ) : null}
        {hasSelection ? (
          <>
            <ToolBtn
              name="flip-to-front"
              set="mci"
              label="На передний план"
              onPress={onBringToFront}
            />
            <ToolBtn
              name="flip-to-back"
              set="mci"
              label="На задний план"
              onPress={onSendToBack}
            />
            <ToolBtn name="trash-outline" label="Убрать объект" onPress={onDeleteSelected} />
          </>
        ) : null}
      </ScrollView>

      {/* Фиксированный по высоте слот контекстных настроек — интерфейс не прыгает при выборе объектов */}
      <Animated.View
        key={`${panel}-${tool}-${hasTextSelection}-${hasImageSelection}-${hasStickerSelection}`}
        entering={FadeIn.duration(160)}
        style={styles.settingsSlot}
      >
        {panel === 'folder' ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.inline}>
            <Pressable
              onPress={() => {
                onFolder('');
                setPanel('none');
              }}
              style={[styles.chip, !folder && styles.chipActive]}
            >
              <Text style={[styles.chipText, !folder && styles.chipTextActive]}>Без группы</Text>
            </Pressable>
            {folders.map((f) => (
              <Pressable
                key={f}
                onPress={() => {
                  onFolder(f);
                  setPanel('none');
                }}
                style={[styles.chip, folder === f && styles.chipActive]}
              >
                <Text style={[styles.chipText, folder === f && styles.chipTextActive]}>{f}</Text>
              </Pressable>
            ))}
            <View style={styles.newFolderRow}>
              <TextInput
                value={newFolderName}
                onChangeText={setNewFolderName}
                placeholder="Новая группа…"
                placeholderTextColor={colors.textMuted}
                style={styles.newFolderInput}
                onSubmitEditing={() => {
                  const created = onCreateFolder(newFolderName);
                  setNewFolderName('');
                  if (created) {
                    onFolder(created);
                    setPanel('none');
                  }
                }}
              />
              <Pressable
                onPress={() => {
                  const created = onCreateFolder(newFolderName);
                  setNewFolderName('');
                  if (created) {
                    onFolder(created);
                    setPanel('none');
                  }
                }}
                style={styles.chip}
                accessibilityLabel="Создать группу"
              >
                <Ionicons name="add" size={18} color={colors.toolIdle} />
              </Pressable>
            </View>
          </ScrollView>
        ) : panel === 'export' ? (
          <View style={styles.inline}>
            <Pressable
              onPress={() => {
                setPanel('none');
                onExportPng();
              }}
              style={styles.chip}
            >
              <Text style={styles.chipText}>PNG</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setPanel('none');
                onExportPdf();
              }}
              style={styles.chip}
            >
              <Text style={styles.chipText}>PDF</Text>
            </Pressable>
          </View>
        ) : panel === 'page' ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.inline}>
            <Pressable
              onPress={() => onPageFullScreen(!pageFullScreen)}
              style={[styles.chip, pageFullScreen && styles.chipActive]}
              accessibilityLabel="На весь экран"
            >
              <Text style={[styles.chipText, pageFullScreen && styles.chipTextActive]}>
                На весь экран
              </Text>
            </Pressable>
            {!pageFullScreen ? (
              <>
                <ValueSlider
                  label="Ширина"
                  value={pageWidth}
                  min={320}
                  max={1600}
                  step={10}
                  suffix="px"
                  onChange={onPageWidth}
                />
                <ValueSlider
                  label="Высота"
                  value={pageHeight}
                  min={400}
                  max={2400}
                  step={20}
                  suffix="px"
                  onChange={onPageHeight}
                />
              </>
            ) : null}
            <View style={styles.sep} />
            {BACKGROUNDS.map((bg) => (
              <Pressable
                key={bg.id}
                onPress={() => onBackground(bg.id)}
                style={[styles.chip, background === bg.id && styles.chipActive]}
              >
                <Text
                  style={[
                    styles.chipText,
                    background === bg.id && styles.chipTextActive,
                  ]}
                >
                  {bg.label}
                </Text>
              </Pressable>
            ))}
            <View style={styles.sep} />
            {PAPER_PRESETS.map((c) => (
              <Pressable
                key={`p-${c}`}
                onPress={() => onPaperColor(c)}
                style={[
                  styles.swatch,
                  { backgroundColor: c },
                  paperColor === c && styles.swatchActive,
                  styles.swatchBorder,
                ]}
              />
            ))}
            <Pressable
              onPress={() => setColorTarget('paper')}
              accessibilityLabel="Цвет листа RGB"
              style={[styles.swatch, styles.swatchBorder, { backgroundColor: paperColor }]}
            >
              <Ionicons name="color-palette-outline" size={16} color={colors.toolIdle} />
            </Pressable>
            {background !== 'blank' ? (
              <>
                <View style={styles.sep} />
                {LINE_PRESETS.map((c) => (
                  <Pressable
                    key={`l-${c}`}
                    onPress={() => onLineColor(c)}
                    style={[
                      styles.swatch,
                      { backgroundColor: c },
                      lineColor === c && styles.swatchActive,
                      styles.swatchBorder,
                    ]}
                  />
                ))}
                <Pressable
                  onPress={() => setColorTarget('line')}
                  accessibilityLabel="Цвет разметки RGB"
                  style={[styles.swatch, styles.swatchBorder, { backgroundColor: lineColor }]}
                >
                  <Ionicons name="color-palette-outline" size={16} color={colors.toolIdle} />
                </Pressable>
              </>
            ) : null}
          </ScrollView>
        ) : isDrawTool ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.inline}>
            {tool === 'shape' ? (
              <>
                <Pressable
                  onPress={() => setPanel('shapes')}
                  style={styles.dropdownBtn}
                  accessibilityLabel={currentShape.label}
                >
                  <ShapeIcon kind={shapeKind} size={22} color={colors.text} />
                  <Ionicons name="chevron-down" size={14} color={colors.toolIdle} />
                </Pressable>
                <View style={styles.sep} />
              </>
            ) : null}
            {tool === 'eraser' ? (
              <>
                <Pressable
                  onPress={() => onEraserMode('partial')}
                  style={[styles.chip, eraserMode === 'partial' && styles.chipActive]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      eraserMode === 'partial' && styles.chipTextActive,
                    ]}
                  >
                    Частично
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => onEraserMode('whole')}
                  style={[styles.chip, eraserMode === 'whole' && styles.chipActive]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      eraserMode === 'whole' && styles.chipTextActive,
                    ]}
                  >
                    Целиком
                  </Text>
                </Pressable>
                <View style={styles.sep} />
              </>
            ) : null}
            {tool === 'pen' || tool === 'highlighter' || tool === 'shape' ? (
              <>
                {PEN_COLORS.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => onPenColor(c)}
                    style={[
                      styles.swatch,
                      { backgroundColor: c },
                      penColor === c && styles.swatchActive,
                      c === '#FFFFFF' && styles.swatchBorder,
                    ]}
                  />
                ))}
                <Pressable
                  onPress={() => setColorTarget('pen')}
                  accessibilityLabel="Палитра RGB"
                  style={[styles.swatch, styles.swatchBorder, { backgroundColor: penColor }]}
                >
                  <Ionicons name="color-palette-outline" size={16} color={iconOn(penColor)} />
                </Pressable>
                <View style={styles.sep} />
              </>
            ) : null}
            <ValueSlider
              label="Размер"
              value={penWidth}
              min={1}
              max={48}
              suffix="px"
              onChange={onPenWidth}
            />
            {tool !== 'eraser' ? (
              <ValueSlider
                label="Непрозр."
                value={Math.round(penOpacity * 100)}
                min={1}
                max={100}
                suffix="%"
                onChange={(pct) => onPenOpacity(pct / 100)}
              />
            ) : null}
            {tool === 'pen' || tool === 'highlighter' ? (
              <>
                <View style={styles.sep} />
                <ValueSlider
                  label="Сглаживание"
                  value={smoothing}
                  min={0}
                  max={100}
                  suffix="%"
                  onChange={onSmoothing}
                />
              </>
            ) : null}
          </ScrollView>
        ) : hasImageSelection ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.inline}>
            {IMAGE_MASKS.map((m) => (
              <Pressable
                key={m.mask}
                onPress={() => onImageMask(m.mask)}
                accessibilityLabel={m.label}
                style={[styles.chip, imageMask === m.mask && styles.chipActive]}
              >
                <MaterialCommunityIcons
                  name={m.icon as ComponentProps<typeof MaterialCommunityIcons>['name']}
                  size={18}
                  color={imageMask === m.mask ? '#fff' : colors.toolIdle}
                />
              </Pressable>
            ))}
            {imageMask === 'none' ? (
              <>
                <View style={styles.sep} />
                <ValueSlider
                  label="Углы"
                  value={imageCornerRadius ?? 12}
                  min={0}
                  max={80}
                  suffix="px"
                  onChange={onImageCornerRadius}
                />
              </>
            ) : null}
          </ScrollView>
        ) : tool === 'sticker' || hasStickerSelection ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.inline}>
            {STICKER_VARIANTS.map((v) => (
              <Pressable
                key={v.id}
                onPress={() => onStickerVariant(v.id)}
                style={[styles.chip, stickerVariant === v.id && styles.chipActive]}
              >
                <Text
                  style={[
                    styles.chipText,
                    stickerVariant === v.id && styles.chipTextActive,
                  ]}
                >
                  {v.label}
                </Text>
              </Pressable>
            ))}
            <View style={styles.sep} />
            {STICKER_TONES.map((tone) => (
              <Pressable
                key={tone}
                onPress={() => onStickerTone(tone)}
                style={[
                  styles.swatch,
                  { backgroundColor: tone },
                  stickerTone === tone && styles.swatchActive,
                  styles.swatchBorder,
                ]}
              />
            ))}
            <Pressable
              onPress={() => setColorTarget('sticker')}
              accessibilityLabel="Цвет стикера RGB"
              style={[styles.swatch, styles.swatchBorder, { backgroundColor: stickerTone }]}
            >
              <Ionicons name="color-palette-outline" size={16} color={colors.toolIdle} />
            </Pressable>
          </ScrollView>
        ) : (hasTextSelection || tool === 'text') && textStyle ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.inline}>
            <Pressable
              style={styles.chip}
              onPress={() => setPanel('fonts')}
              accessibilityLabel="Сменить шрифт"
            >
              <MaterialCommunityIcons name="format-font" size={18} color={colors.toolIdle} />
            </Pressable>
            <StyleToggle
              label="Жирный"
              active={textStyle.bold}
              disabled={!boldAvailable}
              onPress={() => onTextStyle({ bold: !textStyle.bold })}
            >
              <Text style={[styles.styleGlyph, textStyle.bold && styles.styleGlyphActive]}>B</Text>
            </StyleToggle>
            <StyleToggle
              label="Курсив"
              active={textStyle.italic}
              onPress={() => onTextStyle({ italic: !textStyle.italic })}
            >
              <Text style={[styles.styleGlyph, styles.italic, textStyle.italic && styles.styleGlyphActive]}>
                I
              </Text>
            </StyleToggle>
            <StyleToggle
              label="Подчёркивание"
              active={textStyle.underline}
              onPress={() => onTextStyle({ underline: !textStyle.underline })}
            >
              <Text style={[styles.styleGlyph, styles.underline, textStyle.underline && styles.styleGlyphActive]}>
                U
              </Text>
            </StyleToggle>
            <View style={styles.sep} />
            <StyleToggle
              label="Слева"
              active={textStyle.alignH === 'left'}
              onPress={() => onTextStyle({ alignH: 'left' })}
            >
              <MaterialCommunityIcons
                name="format-align-left"
                size={18}
                color={textStyle.alignH === 'left' ? '#fff' : colors.toolIdle}
              />
            </StyleToggle>
            <StyleToggle
              label="По центру"
              active={textStyle.alignH === 'center'}
              onPress={() => onTextStyle({ alignH: 'center' })}
            >
              <MaterialCommunityIcons
                name="format-align-center"
                size={18}
                color={textStyle.alignH === 'center' ? '#fff' : colors.toolIdle}
              />
            </StyleToggle>
            <StyleToggle
              label="Справа"
              active={textStyle.alignH === 'right'}
              onPress={() => onTextStyle({ alignH: 'right' })}
            >
              <MaterialCommunityIcons
                name="format-align-right"
                size={18}
                color={textStyle.alignH === 'right' ? '#fff' : colors.toolIdle}
              />
            </StyleToggle>
            <View style={styles.sep} />
            <StyleToggle
              label="Сверху"
              active={textStyle.alignV === 'top'}
              onPress={() => onTextStyle({ alignV: 'top' })}
            >
              <MaterialCommunityIcons
                name="format-vertical-align-top"
                size={18}
                color={textStyle.alignV === 'top' ? '#fff' : colors.toolIdle}
              />
            </StyleToggle>
            <StyleToggle
              label="Посередине"
              active={textStyle.alignV === 'middle'}
              onPress={() => onTextStyle({ alignV: 'middle' })}
            >
              <MaterialCommunityIcons
                name="format-vertical-align-center"
                size={18}
                color={textStyle.alignV === 'middle' ? '#fff' : colors.toolIdle}
              />
            </StyleToggle>
            <StyleToggle
              label="Снизу"
              active={textStyle.alignV === 'bottom'}
              onPress={() => onTextStyle({ alignV: 'bottom' })}
            >
              <MaterialCommunityIcons
                name="format-vertical-align-bottom"
                size={18}
                color={textStyle.alignV === 'bottom' ? '#fff' : colors.toolIdle}
              />
            </StyleToggle>
            <View style={styles.sep} />
            {PEN_COLORS.map((c) => (
              <Pressable
                key={`tc-${c}`}
                onPress={() => onTextColor(c)}
                style={[
                  styles.swatch,
                  { backgroundColor: c },
                  textColor === c && styles.swatchActive,
                  c === '#FFFFFF' && styles.swatchBorder,
                ]}
              />
            ))}
            <Pressable
              onPress={() => setColorTarget('text')}
              accessibilityLabel="Цвет текста RGB"
              style={[
                styles.swatch,
                styles.swatchBorder,
                { backgroundColor: textColor || '#171717' },
              ]}
            >
              <Ionicons
                name="color-palette-outline"
                size={16}
                color={iconOn(textColor || '#171717')}
              />
            </Pressable>
            <View style={styles.sep} />
            <ValueSlider
              label="Размер"
              value={fontSize ?? 20}
              min={8}
              max={160}
              suffix="pt"
              onChange={onFontSize}
            />
          </ScrollView>
        ) : tool === 'lasso' ? (
          <View style={styles.inline}>
            <Pressable
              onPress={() => onLassoMode('free')}
              style={[styles.chip, lassoMode === 'free' && styles.chipActive]}
              accessibilityLabel="Свободное лассо"
            >
              <MaterialCommunityIcons
                name="lasso"
                size={18}
                color={lassoMode === 'free' ? '#fff' : colors.toolIdle}
              />
            </Pressable>
            <Pressable
              onPress={() => onLassoMode('rect')}
              style={[styles.chip, lassoMode === 'rect' && styles.chipActive]}
              accessibilityLabel="Прямоугольное выделение"
            >
              <MaterialCommunityIcons
                name="select-drag"
                size={18}
                color={lassoMode === 'rect' ? '#fff' : colors.toolIdle}
              />
            </Pressable>
            {hasSelection ? (
              <>
                <View style={styles.sep} />
                <Pressable onPress={onBringToFront} style={styles.chip}>
                  <Text style={styles.chipText}>На передний план</Text>
                </Pressable>
                <Pressable onPress={onSendToBack} style={styles.chip}>
                  <Text style={styles.chipText}>На задний план</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        ) : hasSelection ? (
          <View style={styles.inline}>
            <Pressable onPress={onBringToFront} style={styles.chip}>
              <Text style={styles.chipText}>На передний план</Text>
            </Pressable>
            <Pressable onPress={onSendToBack} style={styles.chip}>
              <Text style={styles.chipText}>На задний план</Text>
            </Pressable>
          </View>
        ) : null}
      </Animated.View>

      <TipBubble
        tipId={activeTip}
        onDismiss={(id) => {
          void dismissTip(id, dismissed).then((next) => {
            setDismissed(next);
            setActiveTip(null);
          });
        }}
      />

      <ColorPickerModal
        visible={colorTarget !== null}
        color={activePickerColor}
        onChange={applyPickedColor}
        onClose={() => setColorTarget(null)}
      />

      <Modal
        visible={panel === 'shapes'}
        transparent
        animationType="slide"
        onRequestClose={() => setPanel('draw')}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setPanel('draw')}>
          <Pressable
            style={[styles.modalCard, isTablet && styles.modalCardTablet]}
            onPress={() => {}}
          >
            <View style={styles.shapeGrid}>
              {SHAPES.map((s) => {
                const active = shapeKind === s.kind;
                return (
                  <Pressable
                    key={s.kind}
                    onPress={() => {
                      onShapeKind(s.kind);
                      setPanel('draw');
                    }}
                    accessibilityLabel={s.label}
                    style={[styles.shapeCell, active && styles.shapeCellActive]}
                  >
                    <ShapeIcon
                      kind={s.kind}
                      size={32}
                      color={active ? '#FFFFFF' : colors.text}
                    />
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={panel === 'fonts'}
        transparent
        animationType="slide"
        onRequestClose={() => setPanel('none')}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setPanel('none')}>
          <Pressable
            style={[styles.modalCard, isTablet && styles.modalCardTablet]}
            onPress={() => {}}
          >
            <Text style={styles.modalTitle}>Шрифты</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabRow}
            >
              {(Object.keys(FONT_CATEGORY_LABELS) as FontCategory[]).map((key) => (
                <Pressable
                  key={key}
                  onPress={() => setFontTab(key)}
                  style={[styles.tab, fontTab === key && styles.tabActive]}
                >
                  <Text style={[styles.tabText, fontTab === key && styles.tabTextActive]}>
                    {FONT_CATEGORY_LABELS[key]}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <ScrollView style={{ maxHeight: isTablet ? 420 : 320 }}>
              {FONT_OPTIONS.filter((f) => f.category === fontTab).map((font) => (
                <Pressable
                  key={font.id}
                  onPress={() => {
                    onFont(font.regular);
                    setPanel('none');
                  }}
                  style={[
                    styles.fontRow,
                    (selectedFont === font.regular || selectedFont === font.bold) &&
                      styles.fontRowActive,
                  ]}
                >
                  <Text style={styles.fontName}>{font.label}</Text>
                  <Text style={[styles.fontSample, { fontFamily: font.regular }]}>
                    Живой пример кириллицы
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.panel,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingBottom: spacing.xs,
    zIndex: 20,
  },
  rootTablet: {
    paddingHorizontal: spacing.sm,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    marginBottom: 4,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
    marginRight: 4,
  },
  modePillActive: {
    backgroundColor: colors.accent,
  },
  modePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.toolIdle,
  },
  modePillTextActive: {
    color: '#fff',
  },
  toolRow: {
    paddingHorizontal: spacing.md,
    gap: 8,
    alignItems: 'center',
  },
  toolBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolBtnActive: {
    backgroundColor: colors.accent,
  },
  toolBtnDisabled: {
    opacity: 0.35,
  },
  iconHit: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsSlot: {
    height: 50,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: spacing.md,
  },
  sep: {
    width: 1,
    height: 22,
    backgroundColor: colors.border,
    marginHorizontal: 4,
  },
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
  },
  dropdownText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchActive: {
    borderWidth: 2,
    borderColor: colors.accent,
  },
  swatchBorder: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  chip: {
    minWidth: 36,
    height: 36,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: colors.accent,
  },
  chipText: {
    color: colors.toolIdle,
    fontWeight: '600',
    fontSize: 13,
  },
  chipTextActive: {
    color: '#fff',
  },
  styleBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  styleBtnActive: {
    backgroundColor: colors.accent,
  },
  styleBtnDisabled: {
    opacity: 0.35,
  },
  styleGlyph: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.toolIdle,
  },
  styleGlyphActive: {
    color: '#fff',
  },
  italic: {
    fontStyle: 'italic',
  },
  underline: {
    textDecorationLine: 'underline',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(24,24,27,0.35)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  modalCardTablet: {
    maxWidth: 520,
    alignSelf: 'center',
    width: '100%',
    borderRadius: 22,
    marginBottom: spacing.xl,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  tabRow: {
    gap: 8,
    paddingBottom: spacing.sm,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
    marginRight: 6,
  },
  tabActive: {
    backgroundColor: colors.accentSoft,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.accentDeep,
  },
  fontRow: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  shapeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    paddingVertical: 6,
  },
  shapeCell: {
    width: 54,
    height: 54,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shapeCellActive: {
    backgroundColor: colors.accent,
  },
  fontRowActive: {
    backgroundColor: colors.selected,
    borderRadius: 10,
    paddingHorizontal: 8,
  },
  fontName: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 4,
    fontWeight: '600',
  },
  fontSample: {
    fontSize: 22,
    color: colors.text,
  },
  newFolderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  newFolderInput: {
    minWidth: 130,
    height: 36,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
    color: colors.text,
    fontSize: 13,
  },
});
