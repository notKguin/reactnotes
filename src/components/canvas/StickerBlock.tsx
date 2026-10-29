import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { colors } from '../../theme';
import { useSpinGesture } from '../../spinGesture';
import type { StickerElement, StickerVariant } from '../../types';

export const STICKER_TONES = [
  '#FEF3C7',
  '#E0F2FE',
  '#FCE7F3',
  '#DCFCE7',
  '#F3E8FF',
  '#FFEDD5',
  '#F5F5F4',
];

export const STICKER_VARIANTS: { id: StickerVariant; label: string }[] = [
  { id: 'note', label: 'Стикер' },
  { id: 'tape', label: 'Скотч' },
  { id: 'tag', label: 'Ярлык' },
  { id: 'badge', label: 'Капсула' },
  { id: 'card', label: 'Карточка' },
  { id: 'outline', label: 'Контур' },
];

type Props = {
  element: StickerElement;
  selected: boolean;
  canInteract: boolean;
  canvasScale: SharedValue<number>;
  onSelect: () => void;
  onDelete: () => void;
  onBeginEdit: () => void;
  onChange: (patch: Partial<StickerElement>) => void;
  onTransformEnd: (
    patch: Pick<StickerElement, 'x' | 'y' | 'width' | 'height' | 'rotation'>,
  ) => void;
};

export function StickerBlock({
  element,
  selected,
  canInteract,
  canvasScale,
  onSelect,
  onDelete,
  onBeginEdit,
  onChange,
  onTransformEnd,
}: Props) {
  const x = useSharedValue(element.x);
  const y = useSharedValue(element.y);
  const w = useSharedValue(element.width);
  const h = useSharedValue(element.height);
  const rotation = useSharedValue(element.rotation ?? 0);
  const startX = useSharedValue(element.x);
  const startY = useSharedValue(element.y);
  const startW = useSharedValue(element.width);
  const startH = useSharedValue(element.height);
  const [editing, setEditing] = useState(false);
  const editSnapshot = useRef(false);

  useEffect(() => {
    x.value = element.x;
    y.value = element.y;
    w.value = element.width;
    h.value = element.height;
    rotation.value = element.rotation ?? 0;
  }, [
    element.x,
    element.y,
    element.width,
    element.height,
    element.rotation,
    x,
    y,
    w,
    h,
    rotation,
  ]);

  useEffect(() => {
    if (!selected) {
      setEditing(false);
      editSnapshot.current = false;
    }
  }, [selected]);

  const commit = () => {
    onTransformEnd({
      x: x.value,
      y: y.value,
      width: w.value,
      height: h.value,
      rotation: rotation.value,
    });
  };

  const makeMove = () =>
    Gesture.Pan()
      .enabled(canInteract && selected && !editing)
      .onBegin(() => {
        startX.value = x.value;
        startY.value = y.value;
      })
      .onUpdate((e) => {
        const s = Math.max(0.05, canvasScale.value);
        x.value = startX.value + e.translationX / s;
        y.value = startY.value + e.translationY / s;
      })
      .onEnd(() => {
        runOnJS(commit)();
      });

  const bodyPan = makeMove();
  const handlePan = Gesture.Pan()
    .enabled(canInteract && selected)
    .onBegin(() => {
      startX.value = x.value;
      startY.value = y.value;
    })
    .onUpdate((e) => {
      const s = Math.max(0.05, canvasScale.value);
      x.value = startX.value + e.translationX / s;
      y.value = startY.value + e.translationY / s;
    })
    .onEnd(() => {
      runOnJS(commit)();
    });

  const resize = Gesture.Pan()
    .enabled(canInteract && selected)
    .onBegin(() => {
      startW.value = w.value;
      startH.value = h.value;
    })
    .onUpdate((e) => {
      const s = Math.max(0.05, canvasScale.value);
      w.value = Math.max(100, startW.value + e.translationX / s);
      h.value = Math.max(70, startH.value + e.translationY / s);
    })
    .onEnd(() => {
      runOnJS(commit)();
    });

  const { ref: spinRef, gesture: rotate } = useSpinGesture(
    rotation,
    canInteract && selected,
    commit,
  );

  const pinch = Gesture.Pinch()
    .enabled(canInteract && selected && !editing)
    .onBegin(() => {
      startW.value = w.value;
      startH.value = h.value;
    })
    .onUpdate((e) => {
      w.value = Math.max(100, Math.min(700, startW.value * e.scale));
      h.value = Math.max(70, Math.min(700, startH.value * e.scale));
    })
    .onEnd(() => {
      runOnJS(commit)();
    });

  const style = useAnimatedStyle(() => {
    const pad = selected ? 22 : 0;
    return {
      position: 'absolute',
      left: x.value - pad,
      top: y.value - pad,
      width: w.value + pad * 2,
      height: h.value + pad * 2,
      padding: pad,
      overflow: 'visible',
      transform: [{ rotate: `${rotation.value}deg` }],
    };
  }, [selected]);

  const variant = element.variant ?? 'note';
  const tone = element.tone || STICKER_TONES[0];

  return (
    <GestureDetector gesture={Gesture.Simultaneous(bodyPan, pinch)}>
      <Animated.View
        ref={spinRef}
        collapsable={false}
        style={style}
        pointerEvents={canInteract ? 'auto' : 'none'}
      >
        <Pressable
          onPress={() => {
            if (!canInteract) return;
            if (!selected) {
              onSelect();
              return;
            }
            editSnapshot.current = false;
            setEditing(true);
          }}
          disabled={!canInteract}
          style={[
            styles.card,
            variant === 'note' && { backgroundColor: tone, borderRadius: 4 },
            variant === 'tape' && { backgroundColor: tone, borderRadius: 10 },
            variant === 'tag' && {
              backgroundColor: tone,
              borderRadius: 12,
              borderLeftWidth: 6,
              borderLeftColor: colors.accent,
            },
            variant === 'badge' && { backgroundColor: tone, borderRadius: 28 },
            variant === 'card' && {
              backgroundColor: tone,
              borderRadius: 18,
              borderWidth: 1.5,
              borderColor: 'rgba(0,0,0,0.14)',
            },
            variant === 'outline' && {
              backgroundColor: 'rgba(255,255,255,0.85)',
              borderRadius: 14,
              borderWidth: 2,
              borderColor: tone,
              borderStyle: 'dashed',
            },
            selected && styles.selected,
          ]}
        >
          {variant === 'tape' ? <View style={styles.tapeStrip} /> : null}
          {variant === 'note' ? <View style={styles.cornerFold} /> : null}
          {editing && selected ? (
            <TextInput
              value={element.text}
              onChangeText={(text) => {
                if (!editSnapshot.current) {
                  editSnapshot.current = true;
                  onBeginEdit();
                }
                onChange({ text });
              }}
              onBlur={() => setEditing(false)}
              autoFocus
              multiline
              style={styles.input}
              placeholder="Заметка…"
              placeholderTextColor={colors.textMuted}
            />
          ) : (
            <Text style={styles.text} numberOfLines={6}>
              {element.text || 'Заметка…'}
            </Text>
          )}
        </Pressable>

        {selected ? (
          <Animated.View
            entering={FadeIn.duration(140)}
            style={styles.handles}
            pointerEvents="box-none"
          >
            <GestureDetector gesture={handlePan}>
              <View style={[styles.handle, styles.moveHandle]}>
                <Text style={styles.handleGlyph}>✥</Text>
              </View>
            </GestureDetector>
            <GestureDetector gesture={rotate}>
              <View style={[styles.handle, styles.rotateHandle]}>
                <Text style={styles.handleGlyph}>↻</Text>
              </View>
            </GestureDetector>
            <GestureDetector gesture={resize}>
              <View style={[styles.handle, styles.resizeHandle]}>
                <Text style={styles.handleGlyph}>↘</Text>
              </View>
            </GestureDetector>
            <Pressable
              onPress={onDelete}
              hitSlop={6}
              accessibilityLabel="Удалить стикер"
              style={[styles.handle, styles.deleteHandle]}
            >
              <Ionicons name="trash-outline" size={14} color="#fff" />
            </Pressable>
          </Animated.View>
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  tapeStrip: {
    width: 48,
    height: 12,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.65)',
    alignSelf: 'center',
    marginTop: -16,
    marginBottom: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.12)',
  },
  cornerFold: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 14,
    height: 14,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderTopLeftRadius: 6,
  },
  selected: {
    borderColor: colors.accent,
    borderWidth: 2,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    fontFamily: 'Caveat_400Regular',
    textAlignVertical: 'top',
  },
  text: {
    fontSize: 18,
    color: colors.text,
    fontFamily: 'Caveat_400Regular',
  },
  handles: {
    ...StyleSheet.absoluteFill,
  },
  handle: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moveHandle: {
    top: 2,
    left: 2,
  },
  rotateHandle: {
    top: 2,
    right: 2,
    backgroundColor: '#525252',
  },
  resizeHandle: {
    right: 2,
    bottom: 2,
    backgroundColor: '#3F3F46',
  },
  deleteHandle: {
    left: 2,
    bottom: 2,
    backgroundColor: colors.danger,
  },
  handleGlyph: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});
