import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { Canvas } from '@shopify/react-native-skia';
import { boundsOfStrokes } from '../../strokeUtils';
import { renderSkiaStroke } from '../../skiaStrokes';
import { colors } from '../../theme';
import { useSpinGesture } from '../../spinGesture';
import type { Stroke } from '../../types';

type Props = {
  groupId: string;
  strokes: Stroke[];
  selected: boolean;
  canInteract: boolean;
  canvasScale: SharedValue<number>;
  onSelect: () => void;
  onDelete: () => void;
  onTransformEnd: (params: {
    dx: number;
    dy: number;
    scale: number;
    rotationDeg: number;
    cx: number;
    cy: number;
  }) => void;
};

export function StrokeGroupBlock({
  strokes,
  selected,
  canInteract,
  canvasScale,
  onSelect,
  onDelete,
  onTransformEnd,
}: Props) {
  const box = boundsOfStrokes(strokes);
  const bx = box?.x ?? 0;
  const by = box?.y ?? 0;
  const bw = box?.width ?? 40;
  const bh = box?.height ?? 40;

  const dx = useSharedValue(0);
  const dy = useSharedValue(0);
  const scale = useSharedValue(1);
  const rot = useSharedValue(0);

  const startDx = useSharedValue(0);
  const startDy = useSharedValue(0);
  const startScale = useSharedValue(1);

  useEffect(() => {
    dx.value = 0;
    dy.value = 0;
    scale.value = 1;
    rot.value = 0;
  }, [strokes, dx, dy, scale, rot]);

  const cx = bx + bw / 2;
  const cy = by + bh / 2;

  const commit = () => {
    const curDx = dx.value;
    const curDy = dy.value;
    const curScale = scale.value;
    const curRot = rot.value;
    if (
      Math.abs(curDx) < 0.5 &&
      Math.abs(curDy) < 0.5 &&
      Math.abs(curScale - 1) < 0.01 &&
      Math.abs(curRot) < 0.5
    ) {
      return;
    }
    onTransformEnd({
      dx: curDx,
      dy: curDy,
      scale: curScale,
      rotationDeg: curRot,
      cx,
      cy,
    });
  };

  const { ref: spinRef, gesture: rotate } = useSpinGesture(rot, canInteract && selected, commit);

  if (!box) return null;

  const makeMove = () =>
    Gesture.Pan()
      .enabled(canInteract && selected)
      .onBegin(() => {
        startDx.value = dx.value;
        startDy.value = dy.value;
      })
      .onUpdate((e) => {
        const s = Math.max(0.05, canvasScale.value);
        dx.value = startDx.value + e.translationX / s;
        dy.value = startDy.value + e.translationY / s;
      })
      .onEnd(() => {
        runOnJS(commit)();
      });

  const bodyPan = makeMove();
  const handlePan = makeMove();

  const resize = Gesture.Pan()
    .enabled(canInteract && selected)
    .onBegin(() => {
      startScale.value = scale.value;
    })
    .onUpdate((e) => {
      const s = Math.max(0.05, canvasScale.value);
      const delta = (e.translationX / s + e.translationY / s) / Math.max(80, (bw + bh) / 2);
      scale.value = Math.max(0.25, Math.min(4, startScale.value + delta));
    })
    .onEnd(() => {
      runOnJS(commit)();
    });

  const pinch = Gesture.Pinch()
    .enabled(canInteract && selected)
    .onBegin(() => {
      startScale.value = scale.value;
    })
    .onUpdate((e) => {
      scale.value = Math.max(0.25, Math.min(4, startScale.value * e.scale));
    })
    .onEnd(() => {
      runOnJS(commit)();
    });

  const style = useAnimatedStyle(() => {
    const pad = selected ? 22 : 0;
    return {
      position: 'absolute',
      left: bx - pad,
      top: by - pad,
      width: bw + pad * 2,
      height: bh + pad * 2,
      padding: pad,
      overflow: 'visible',
      transform: [
        { translateX: dx.value },
        { translateY: dy.value },
        { rotate: `${rot.value}deg` },
        { scale: scale.value },
      ],
    };
  }, [selected, bx, by, bw, bh]);

  return (
    <GestureDetector gesture={Gesture.Simultaneous(bodyPan, pinch)}>
      <Animated.View
        ref={spinRef}
        collapsable={false}
        style={style}
        pointerEvents={canInteract ? 'auto' : 'none'}
      >
        <Pressable
          onPress={onSelect}
          disabled={!canInteract}
          style={[styles.frame, selected && styles.selected]}
        >
          <Canvas style={{ width: bw, height: bh }} pointerEvents="none">
            {strokes.flatMap((s) => renderSkiaStroke(s, bx, by))}
          </Canvas>
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
              accessibilityLabel="Удалить фигуру"
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
  frame: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  selected: {
    borderColor: colors.accent,
    borderStyle: 'dashed',
    backgroundColor: 'rgba(63, 63, 70, 0.04)',
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
    elevation: 3,
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
