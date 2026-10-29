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
import Svg, {
  ClipPath,
  Defs,
  Ellipse,
  Image as SvgImage,
  Path,
  Polygon,
  Rect,
} from 'react-native-svg';
import { colors } from '../../theme';
import { useSpinGesture } from '../../spinGesture';
import type { ImageElement, ImageMask } from '../../types';

type Props = {
  element: ImageElement;
  selected: boolean;
  canInteract: boolean;
  canvasScale: SharedValue<number>;
  onSelect: () => void;
  onDelete: () => void;
  onTransformEnd: (
    patch: Pick<ImageElement, 'x' | 'y' | 'width' | 'height' | 'rotation'>,
  ) => void;
};

/**
 * Вписываем фигуру-маску в квадрат min(w, h) по центру,
 * чтобы круг/звезда/сердце/ромб/гексагон не растягивались на прямоугольных фото.
 */
function maskShape(mask: ImageMask, w: number, h: number, radius: number) {
  const cx = w / 2;
  const cy = h / 2;
  if (mask === 'none') {
    const r = Math.min(radius, cx, cy);
    return <Rect x={0} y={0} width={w} height={h} rx={r} ry={r} />;
  }

  const size = Math.min(w, h);
  const half = size / 2;
  const ox = cx - half;
  const oy = cy - half;

  if (mask === 'circle') {
    return <Ellipse cx={cx} cy={cy} rx={half} ry={half} />;
  }
  if (mask === 'diamond') {
    return (
      <Polygon
        points={`${cx},${oy} ${ox + size},${cy} ${cx},${oy + size} ${ox},${cy}`}
      />
    );
  }
  if (mask === 'hexagon') {
    const x1 = ox + size * 0.25;
    const x2 = ox + size * 0.75;
    return (
      <Polygon
        points={`${x1},${oy} ${x2},${oy} ${ox + size},${cy} ${x2},${oy + size} ${x1},${oy + size} ${ox},${cy}`}
      />
    );
  }
  if (mask === 'star') {
    const pts: string[] = [];
    for (let i = 0; i < 10; i += 1) {
      const f = i % 2 === 0 ? 1 : 0.45;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      pts.push(`${cx + Math.cos(a) * half * f},${cy + Math.sin(a) * half * f}`);
    }
    return <Polygon points={pts.join(' ')} />;
  }
  // heart в квадрате size x size
  const d = [
    `M ${cx} ${oy + size * 0.92}`,
    `C ${ox + size * 0.12} ${oy + size * 0.62}, ${ox} ${oy + size * 0.32}, ${ox + size * 0.25} ${oy + size * 0.14}`,
    `C ${ox + size * 0.4} ${oy + size * 0.04}, ${cx} ${oy + size * 0.16}, ${cx} ${oy + size * 0.28}`,
    `C ${cx} ${oy + size * 0.16}, ${ox + size * 0.6} ${oy + size * 0.04}, ${ox + size * 0.75} ${oy + size * 0.14}`,
    `C ${ox + size} ${oy + size * 0.32}, ${ox + size * 0.88} ${oy + size * 0.62}, ${cx} ${oy + size * 0.92}`,
    'Z',
  ].join(' ');
  return <Path d={d} />;
}

export function ImageBlock({
  element,
  selected,
  canInteract,
  canvasScale,
  onSelect,
  onDelete,
  onTransformEnd,
}: Props) {
  const baseAspect =
    element.aspectRatio > 0 ? element.aspectRatio : element.width / Math.max(1, element.height);
  const crop = element.crop ?? { x: 0, y: 0, w: 1, h: 1 };
  const effectiveAspect = (baseAspect * crop.w) / Math.max(0.05, crop.h);

  const x = useSharedValue(element.x);
  const y = useSharedValue(element.y);
  const w = useSharedValue(element.width);
  const h = useSharedValue(element.height);
  const rotation = useSharedValue(element.rotation ?? 0);
  const startX = useSharedValue(element.x);
  const startY = useSharedValue(element.y);
  const startW = useSharedValue(element.width);
  const aspectSv = useSharedValue(effectiveAspect);

  useEffect(() => {
    x.value = element.x;
    y.value = element.y;
    w.value = element.width;
    h.value = element.height;
    rotation.value = element.rotation ?? 0;
    aspectSv.value = effectiveAspect;
  }, [
    element.x,
    element.y,
    element.width,
    element.height,
    element.rotation,
    effectiveAspect,
    x,
    y,
    w,
    h,
    rotation,
    aspectSv,
  ]);

  const commit = () => {
    onTransformEnd({
      x: x.value,
      y: y.value,
      width: w.value,
      height: h.value,
      rotation: rotation.value,
    });
  };

  const makeMoveGesture = () =>
    Gesture.Pan()
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

  const bodyPan = makeMoveGesture();
  const handlePan = makeMoveGesture();

  const resize = Gesture.Pan()
    .enabled(canInteract && selected)
    .onBegin(() => {
      startW.value = w.value;
    })
    .onUpdate((e) => {
      const s = Math.max(0.05, canvasScale.value);
      const nextW = Math.max(80, startW.value + e.translationX / s);
      w.value = nextW;
      h.value = nextW / aspectSv.value;
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
    .enabled(canInteract && selected)
    .onBegin(() => {
      startW.value = w.value;
    })
    .onUpdate((e) => {
      const nextW = Math.max(80, Math.min(900, startW.value * e.scale));
      w.value = nextW;
      h.value = nextW / aspectSv.value;
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

  const mask = element.mask ?? 'none';
  const radius = element.cornerRadius ?? 12;
  const clipId = `clip-${element.id}-${mask}-${radius}-${Math.round(element.width)}-${Math.round(element.height)}`;

  const fullW = element.width / Math.max(0.05, crop.w);
  const fullH = element.height / Math.max(0.05, crop.h);
  const offsetX = -crop.x * fullW;
  const offsetY = -crop.y * fullH;

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
          <Svg key={clipId} width={element.width} height={element.height}>
            <Defs>
              <ClipPath id={clipId}>
                {maskShape(mask, element.width, element.height, radius)}
              </ClipPath>
            </Defs>
            <SvgImage
              href={{ uri: element.uri }}
              x={offsetX}
              y={offsetY}
              width={fullW}
              height={fullH}
              preserveAspectRatio="none"
              clipPath={`url(#${clipId})`}
            />
          </Svg>
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
              accessibilityLabel="Удалить фото"
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
    borderWidth: 1.5,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  selected: {
    borderColor: colors.accent,
    borderStyle: 'dashed',
  },
  handles: {
    ...StyleSheet.absoluteFill,
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
    fontSize: 14,
    fontWeight: '700',
  },
});
