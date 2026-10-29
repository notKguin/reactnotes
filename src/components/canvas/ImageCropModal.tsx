import { useEffect } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { colors, spacing } from '../../theme';
import type { CropRect } from '../../types';

type Props = {
  visible: boolean;
  uri: string | null;
  aspectRatio: number;
  initialCrop?: CropRect;
  onApply: (crop: CropRect) => void;
  onClose: () => void;
};

const STAGE_SIZE = 280;
const MIN_BOX = 44;

function clamp(v: number, min: number, max: number) {
  'worklet';
  return Math.min(max, Math.max(min, v));
}

export function ImageCropModal({
  visible,
  uri,
  aspectRatio,
  initialCrop,
  onApply,
  onClose,
}: Props) {
  const safeAspect = aspectRatio > 0 ? aspectRatio : 1;
  const imgW = safeAspect >= 1 ? STAGE_SIZE : STAGE_SIZE * safeAspect;
  const imgH = safeAspect >= 1 ? STAGE_SIZE / safeAspect : STAGE_SIZE;

  const bx = useSharedValue(0);
  const by = useSharedValue(0);
  const bw = useSharedValue(imgW);
  const bh = useSharedValue(imgH);

  const sx = useSharedValue(0);
  const sy = useSharedValue(0);
  const sw = useSharedValue(imgW);
  const sh = useSharedValue(imgH);

  useEffect(() => {
    const c = initialCrop ?? { x: 0, y: 0, w: 1, h: 1 };
    bx.value = c.x * imgW;
    by.value = c.y * imgH;
    bw.value = Math.max(MIN_BOX, c.w * imgW);
    bh.value = Math.max(MIN_BOX, c.h * imgH);
  }, [initialCrop, imgW, imgH, visible, bx, by, bw, bh]);

  const beginSave = () => {
    'worklet';
    sx.value = bx.value;
    sy.value = by.value;
    sw.value = bw.value;
    sh.value = bh.value;
  };

  const moveBox = Gesture.Pan()
    .minDistance(0)
    .onBegin(beginSave)
    .onUpdate((e) => {
      bx.value = clamp(sx.value + e.translationX, 0, imgW - bw.value);
      by.value = clamp(sy.value + e.translationY, 0, imgH - bh.value);
    });

  // 4 стороны
  const dragLeft = Gesture.Pan()
    .minDistance(0)
    .onBegin(beginSave)
    .onUpdate((e) => {
      const nx = clamp(sx.value + e.translationX, 0, sx.value + sw.value - MIN_BOX);
      bw.value = sw.value - (nx - sx.value);
      bx.value = nx;
    });

  const dragRight = Gesture.Pan()
    .minDistance(0)
    .onBegin(beginSave)
    .onUpdate((e) => {
      bw.value = clamp(sw.value + e.translationX, MIN_BOX, imgW - sx.value);
    });

  const dragTop = Gesture.Pan()
    .minDistance(0)
    .onBegin(beginSave)
    .onUpdate((e) => {
      const ny = clamp(sy.value + e.translationY, 0, sy.value + sh.value - MIN_BOX);
      bh.value = sh.value - (ny - sy.value);
      by.value = ny;
    });

  const dragBottom = Gesture.Pan()
    .minDistance(0)
    .onBegin(beginSave)
    .onUpdate((e) => {
      bh.value = clamp(sh.value + e.translationY, MIN_BOX, imgH - sy.value);
    });

  // 4 угла
  const dragTL = Gesture.Pan()
    .minDistance(0)
    .onBegin(beginSave)
    .onUpdate((e) => {
      const nx = clamp(sx.value + e.translationX, 0, sx.value + sw.value - MIN_BOX);
      const ny = clamp(sy.value + e.translationY, 0, sy.value + sh.value - MIN_BOX);
      bw.value = sw.value - (nx - sx.value);
      bh.value = sh.value - (ny - sy.value);
      bx.value = nx;
      by.value = ny;
    });

  const dragTR = Gesture.Pan()
    .minDistance(0)
    .onBegin(beginSave)
    .onUpdate((e) => {
      const ny = clamp(sy.value + e.translationY, 0, sy.value + sh.value - MIN_BOX);
      bw.value = clamp(sw.value + e.translationX, MIN_BOX, imgW - sx.value);
      bh.value = sh.value - (ny - sy.value);
      by.value = ny;
    });

  const dragBL = Gesture.Pan()
    .minDistance(0)
    .onBegin(beginSave)
    .onUpdate((e) => {
      const nx = clamp(sx.value + e.translationX, 0, sx.value + sw.value - MIN_BOX);
      bw.value = sw.value - (nx - sx.value);
      bh.value = clamp(sh.value + e.translationY, MIN_BOX, imgH - sy.value);
      bx.value = nx;
    });

  const dragBR = Gesture.Pan()
    .minDistance(0)
    .onBegin(beginSave)
    .onUpdate((e) => {
      bw.value = clamp(sw.value + e.translationX, MIN_BOX, imgW - sx.value);
      bh.value = clamp(sh.value + e.translationY, MIN_BOX, imgH - sy.value);
    });

  const boxStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: bx.value,
    top: by.value,
    width: bw.value,
    height: bh.value,
  }));

  const resetFull = () => {
    bx.value = 0;
    by.value = 0;
    bw.value = imgW;
    bh.value = imgH;
  };

  const commitCrop = () => {
    onApply({
      x: Math.max(0, Math.min(0.95, bx.value / imgW)),
      y: Math.max(0, Math.min(0.95, by.value / imgH)),
      w: Math.max(0.05, Math.min(1, bw.value / imgW)),
      h: Math.max(0.05, Math.min(1, bh.value / imgH)),
    });
    onClose();
  };

  if (!uri) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.flex}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={styles.card} onPress={() => {}}>
            <Text style={styles.title}>Обрезка фото</Text>

            <View style={[styles.stage, { width: imgW, height: imgH }]}>
              <Image
                source={{ uri }}
                style={{ width: imgW, height: imgH }}
                resizeMode="stretch"
              />
              <Animated.View style={[styles.cropBox, boxStyle]}>
                <GestureDetector gesture={moveBox}>
                  <View style={StyleSheet.absoluteFill} />
                </GestureDetector>

                {/* Стороны */}
                <GestureDetector gesture={dragTop}>
                  <View style={[styles.edgeHit, styles.edgeTop]}>
                    <View style={styles.edgeBarH} />
                  </View>
                </GestureDetector>
                <GestureDetector gesture={dragBottom}>
                  <View style={[styles.edgeHit, styles.edgeBottom]}>
                    <View style={styles.edgeBarH} />
                  </View>
                </GestureDetector>
                <GestureDetector gesture={dragLeft}>
                  <View style={[styles.edgeHit, styles.edgeLeft]}>
                    <View style={styles.edgeBarV} />
                  </View>
                </GestureDetector>
                <GestureDetector gesture={dragRight}>
                  <View style={[styles.edgeHit, styles.edgeRight]}>
                    <View style={styles.edgeBarV} />
                  </View>
                </GestureDetector>

                {/* Углы */}
                <GestureDetector gesture={dragTL}>
                  <View style={[styles.corner, styles.cornerTL]} />
                </GestureDetector>
                <GestureDetector gesture={dragTR}>
                  <View style={[styles.corner, styles.cornerTR]} />
                </GestureDetector>
                <GestureDetector gesture={dragBL}>
                  <View style={[styles.corner, styles.cornerBL]} />
                </GestureDetector>
                <GestureDetector gesture={dragBR}>
                  <View style={[styles.corner, styles.cornerBR]} />
                </GestureDetector>
              </Animated.View>
            </View>

            <View style={styles.actions}>
              <Pressable onPress={resetFull} style={styles.secondaryBtn}>
                <Text style={styles.secondaryText}>Сбросить</Text>
              </Pressable>
              <Pressable onPress={commitCrop} style={styles.primaryBtn}>
                <Text style={styles.primaryText}>Применить</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(24,24,27,0.45)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.md,
    maxWidth: 340,
    width: '100%',
    alignSelf: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  stage: {
    backgroundColor: '#18181B',
    borderRadius: 12,
    overflow: 'visible',
  },
  cropBox: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  edgeHit: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  edgeTop: {
    top: -14,
    left: 20,
    right: 20,
    height: 28,
  },
  edgeBottom: {
    bottom: -14,
    left: 20,
    right: 20,
    height: 28,
  },
  edgeLeft: {
    left: -14,
    top: 20,
    bottom: 20,
    width: 28,
  },
  edgeRight: {
    right: -14,
    top: 20,
    bottom: 20,
    width: 28,
  },
  edgeBarH: {
    width: 28,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.accent,
  },
  edgeBarV: {
    width: 6,
    height: 28,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.accent,
  },
  corner: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  cornerTL: {
    left: -13,
    top: -13,
  },
  cornerTR: {
    right: -13,
    top: -13,
  },
  cornerBL: {
    left: -13,
    bottom: -13,
  },
  cornerBR: {
    right: -13,
    bottom: -13,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
  },
  secondaryText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 14,
  },
  primaryBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: 'center',
  },
  primaryText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});
