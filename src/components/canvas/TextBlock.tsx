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
import { resolveFontFamily } from '../../fonts';
import { useSpinGesture } from '../../spinGesture';
import { colors } from '../../theme';
import type { TextElement } from '../../types';

type Props = {
  element: TextElement;
  selected: boolean;
  canInteract: boolean;
  canvasScale: SharedValue<number>;
  onSelect: () => void;
  onDelete: () => void;
  onBeginEdit: () => void;
  onChange: (patch: Partial<TextElement>) => void;
  onTransformEnd: (
    patch: Pick<TextElement, 'x' | 'y' | 'rotation' | 'width' | 'height' | 'fontSize'>,
  ) => void;
};

export function TextBlock({
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
  const rotation = useSharedValue(element.rotation ?? 0);
  const width = useSharedValue(element.width);
  const height = useSharedValue(element.height ?? 60);
  const startX = useSharedValue(element.x);
  const startY = useSharedValue(element.y);
  const startW = useSharedValue(element.width);
  const startH = useSharedValue(element.height ?? 60);
  const fontSizeSv = useSharedValue(element.fontSize);
  const startFont = useSharedValue(element.fontSize);
  const sentFont = useSharedValue(element.fontSize);
  const [liveFont, setLiveFont] = useState(element.fontSize);
  const [editing, setEditing] = useState(false);
  const editSnapshot = useRef(false);

  useEffect(() => {
    x.value = element.x;
    y.value = element.y;
    rotation.value = element.rotation ?? 0;
    width.value = element.width;
    height.value = element.height ?? 60;
  }, [
    element.x,
    element.y,
    element.rotation,
    element.width,
    element.height,
    x,
    y,
    rotation,
    width,
    height,
  ]);

  useEffect(() => {
    fontSizeSv.value = element.fontSize;
    sentFont.value = element.fontSize;
    setLiveFont(element.fontSize);
  }, [element.fontSize, fontSizeSv, sentFont]);

  useEffect(() => {
    if (!selected) {
      setEditing(false);
      editSnapshot.current = false;
      return;
    }
    setEditing(true);
  }, [selected]);

  const publishFont = (size: number) => {
    setLiveFont(Math.round(size));
  };

  const commit = () => {
    onTransformEnd({
      x: x.value,
      y: y.value,
      rotation: rotation.value,
      width: width.value,
      height: height.value,
      fontSize: Math.max(8, Math.min(200, Math.round(fontSizeSv.value))),
    });
  };

  const trackFont = (nextW: number, nextH: number) => {
    'worklet';
    const rw = nextW / Math.max(1, startW.value);
    const rh = nextH / Math.max(1, startH.value);
    const ratio = Math.sqrt(Math.max(0.2, rw) * Math.max(0.2, rh));
    const nextFont = Math.max(8, Math.min(200, startFont.value * ratio));
    fontSizeSv.value = nextFont;
    if (Math.abs(nextFont - sentFont.value) >= 0.8) {
      sentFont.value = nextFont;
      runOnJS(publishFont)(nextFont);
    }
  };

  const makeMoveGesture = () =>
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

  const bodyPan = makeMoveGesture();
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

  const { ref: spinRef, gesture: rotate } = useSpinGesture(
    rotation,
    canInteract && selected,
    commit,
  );

  const resize = Gesture.Pan()
    .enabled(canInteract && selected)
    .onBegin(() => {
      startW.value = width.value;
      startH.value = height.value;
      startFont.value = fontSizeSv.value;
    })
    .onUpdate((e) => {
      const s = Math.max(0.05, canvasScale.value);
      const sx = (startW.value + e.translationX / s) / Math.max(1, startW.value);
      const sy = (startH.value + e.translationY / s) / Math.max(1, startH.value);
      const scale = Math.max(0.35, Math.min(6, (sx + sy) / 2));
      width.value = Math.max(80, Math.min(1400, startW.value * scale));
      height.value = Math.max(36, Math.min(1400, startH.value * scale));
      const nextFont = Math.max(8, Math.min(200, startFont.value * scale));
      fontSizeSv.value = nextFont;
      if (Math.abs(nextFont - sentFont.value) >= 0.8) {
        sentFont.value = nextFont;
        runOnJS(publishFont)(nextFont);
      }
    })
    .onEnd(() => {
      runOnJS(commit)();
    });

  const pinch = Gesture.Pinch()
    .enabled(canInteract && selected)
    .onBegin(() => {
      startW.value = width.value;
      startH.value = height.value;
      startFont.value = fontSizeSv.value;
    })
    .onUpdate((e) => {
      width.value = Math.max(80, Math.min(900, startW.value * e.scale));
      height.value = Math.max(36, Math.min(900, startH.value * e.scale));
      trackFont(width.value, height.value);
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
      width: width.value + pad * 2,
      minHeight: height.value + pad * 2,
      padding: pad,
      overflow: 'visible',
      transform: [{ rotate: `${rotation.value}deg` }],
    };
  }, [selected]);

  const alignH = element.alignH ?? 'left';
  const alignV = element.alignV ?? 'top';
  const justifyContent =
    alignV === 'middle' ? 'center' : alignV === 'bottom' ? 'flex-end' : 'flex-start';

  const family = resolveFontFamily(element.fontFamily, !!element.bold);
  const textStyle = {
    fontFamily: family,
    fontSize: liveFont,
    color: element.text ? element.color : colors.textMuted,
    fontStyle: element.italic ? ('italic' as const) : ('normal' as const),
    textDecorationLine: element.underline ? ('underline' as const) : ('none' as const),
    textAlign: alignH,
  };

  return (
    <GestureDetector gesture={Gesture.Simultaneous(bodyPan, pinch)}>
      <Animated.View
        ref={spinRef}
        collapsable={false}
        style={style}
        pointerEvents={canInteract ? 'auto' : 'none'}
      >
        {selected ? (
          <View
            style={[
              styles.box,
              { minHeight: element.height ?? 60, justifyContent },
              styles.selected,
            ]}
          >
            <TextInput
              value={element.text}
              onChangeText={(text) => {
                if (!editSnapshot.current) {
                  editSnapshot.current = true;
                  onBeginEdit();
                }
                onChange({ text });
              }}
              autoFocus
              multiline
              style={[styles.input, textStyle, { color: element.color }]}
              placeholder="Текст…"
              placeholderTextColor={colors.textMuted}
              textAlignVertical={
                alignV === 'middle' ? 'center' : alignV === 'bottom' ? 'bottom' : 'top'
              }
            />
          </View>
        ) : (
          <Pressable
            onPress={() => {
              if (!canInteract) return;
              onSelect();
            }}
            disabled={!canInteract}
            style={[styles.box, { minHeight: element.height ?? 60, justifyContent }]}
          >
            <View pointerEvents="none">
              <Text style={[styles.input, textStyle]}>{element.text || 'Текст…'}</Text>
            </View>
          </Pressable>
        )}

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
              accessibilityLabel="Удалить объект"
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
  box: {
    flex: 1,
    minHeight: 36,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  selected: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(63, 63, 70, 0.06)',
  },
  input: {
    padding: 0,
    margin: 0,
    minHeight: 28,
  },
  handles: {
    ...StyleSheet.absoluteFill,
    zIndex: 4,
  },
  handle: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
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
    bottom: 2,
    right: 2,
    backgroundColor: '#3F3F46',
  },
  deleteHandle: {
    bottom: 2,
    left: 2,
    backgroundColor: colors.danger,
  },
  handleGlyph: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
