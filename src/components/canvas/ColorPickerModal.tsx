import { memo, useEffect, useState } from 'react';
import { LayoutChangeEvent, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { Canvas, Circle, RadialGradient, SweepGradient } from '@shopify/react-native-skia';
import { colors, spacing } from '../../theme';

type Props = {
  visible: boolean;
  color: string;
  onChange: (hex: string) => void;
  onClose: () => void;
};

type Mode = 'wheel' | 'rgb';

const WHEEL_SIZE = 196;
const WHEEL_RADIUS = WHEEL_SIZE / 2;
const WHEEL_CENTER = { x: WHEEL_RADIUS, y: WHEEL_RADIUS };
const HUE_STOPS = ['#FF0000', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#FF00FF', '#FF0000'];

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '').trim();
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.padEnd(6, '0').slice(0, 6);
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return { r: 23, g: 23, b: 23 };
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const part = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`.toUpperCase();
}

function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  'worklet';
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (h < 60) {
    rp = c;
    gp = x;
  } else if (h < 120) {
    rp = x;
    gp = c;
  } else if (h < 180) {
    gp = c;
    bp = x;
  } else if (h < 240) {
    gp = x;
    bp = c;
  } else if (h < 300) {
    rp = x;
    bp = c;
  } else {
    rp = c;
    bp = x;
  }
  return {
    r: Math.round((rp + m) * 255),
    g: Math.round((gp + m) * 255),
    b: Math.round((bp + m) * 255),
  };
}

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  'worklet';
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = 60 * (((gn - bn) / d) % 6);
    else if (max === gn) h = 60 * ((bn - rn) / d + 2);
    else h = 60 * ((rn - gn) / d + 4);
  }
  if (h < 0) h += 360;
  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
}

function hsvToHex(h: number, s: number, v: number) {
  'worklet';
  const { r, g, b } = hsvToRgb(h, s, v);
  const channel = (n: number) => {
    const clamped = Math.max(0, Math.min(255, Math.round(n)));
    const chars = '0123456789ABCDEF';
    return chars[Math.floor(clamped / 16)] + chars[clamped % 16];
  };
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

const ColorWheelBase = memo(function ColorWheelBase() {
  return (
    <Canvas style={{ width: WHEEL_SIZE, height: WHEEL_SIZE }} opaque={false}>
      <Circle cx={WHEEL_RADIUS} cy={WHEEL_RADIUS} r={WHEEL_RADIUS}>
        <SweepGradient c={WHEEL_CENTER} colors={HUE_STOPS} />
      </Circle>
      <Circle cx={WHEEL_RADIUS} cy={WHEEL_RADIUS} r={WHEEL_RADIUS}>
        <RadialGradient
          c={WHEEL_CENTER}
          r={WHEEL_RADIUS}
          colors={['#FFFFFF', 'rgba(255,255,255,0)']}
        />
      </Circle>
    </Canvas>
  );
});

function SmoothSlider({
  label,
  value,
  shared,
  min,
  max,
  step = 1,
  suffix = '',
  onLive,
  onCommit,
}: {
  label: string;
  value: number;
  shared: SharedValue<number>;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onLive?: (value: number) => void;
  onCommit: (value: number) => void;
}) {
  const widthSv = useSharedValue(140);
  const onLayout = (e: LayoutChangeEvent) => {
    widthSv.value = Math.max(60, e.nativeEvent.layout.width);
  };
  const fillStyle = useAnimatedStyle(() => {
    const ratio = Math.min(1, Math.max(0, (shared.value - min) / Math.max(1e-6, max - min)));
    return { width: ratio * widthSv.value };
  });
  const thumbStyle = useAnimatedStyle(() => {
    const ratio = Math.min(1, Math.max(0, (shared.value - min) / Math.max(1e-6, max - min)));
    return { left: ratio * Math.max(0, widthSv.value - 18) };
  });
  const gesture = Gesture.Pan()
    .minDistance(0)
    .hitSlop(8)
    .onBegin((e) => {
      const ratio = Math.min(1, Math.max(0, e.x / Math.max(1, widthSv.value)));
      shared.value = min + ratio * (max - min);
      if (onLive) onLive(shared.value);
    })
    .onUpdate((e) => {
      const ratio = Math.min(1, Math.max(0, e.x / Math.max(1, widthSv.value)));
      shared.value = min + ratio * (max - min);
      if (onLive) onLive(shared.value);
    })
    .onEnd(() => {
      const next = Math.round(shared.value / step) * step;
      const clamped = Math.min(max, Math.max(min, next));
      shared.value = clamped;
      runOnJS(onCommit)(clamped);
    });

  return (
    <View style={styles.sliderWrap}>
      <Text style={styles.sliderLabel}>
        {label}: {Math.round(value)}
        {suffix}
      </Text>
      <GestureDetector gesture={gesture}>
        <View style={styles.trackHit} onLayout={onLayout}>
          <View style={styles.track}>
            <Animated.View style={[styles.fill, fillStyle]} />
          </View>
          <Animated.View style={[styles.thumb, thumbStyle]} />
        </View>
      </GestureDetector>
    </View>
  );
}

export function ColorPickerModal({ visible, color, onChange, onClose }: Props) {
  const initialRgb = hexToRgb(color);
  const initialHsv = rgbToHsv(initialRgb.r, initialRgb.g, initialRgb.b);

  const [mode, setMode] = useState<Mode>('wheel');
  const [r, setR] = useState(initialRgb.r);
  const [g, setG] = useState(initialRgb.g);
  const [b, setB] = useState(initialRgb.b);
  const [h, setH] = useState(initialHsv.h);
  const [s, setS] = useState(initialHsv.s);
  const [v, setV] = useState(initialHsv.v || 1);
  const [hex, setHex] = useState(color.toUpperCase());
  const hue = useSharedValue(initialHsv.h);
  const sat = useSharedValue(initialHsv.s);
  const val = useSharedValue(initialHsv.v || 1);
  const red = useSharedValue(initialRgb.r);
  const green = useSharedValue(initialRgb.g);
  const blue = useSharedValue(initialRgb.b);

  useEffect(() => {
    if (!visible) return;
    const nextRgb = hexToRgb(color);
    const nextHsv = rgbToHsv(nextRgb.r, nextRgb.g, nextRgb.b);
    const nextV = nextHsv.v || 1;
    setR(nextRgb.r);
    setG(nextRgb.g);
    setB(nextRgb.b);
    setH(nextHsv.h);
    setS(nextHsv.s);
    setV(nextV);
    setHex(color.toUpperCase());
    hue.value = nextHsv.h;
    sat.value = nextHsv.s;
    val.value = nextV;
    red.value = nextRgb.r;
    green.value = nextRgb.g;
    blue.value = nextRgb.b;
    setMode('wheel');
  }, [visible]);

  const paint = (nr: number, ng: number, nb: number, hsv: { h: number; s: number; v: number }) => {
    setR(nr);
    setG(ng);
    setB(nb);
    setH(hsv.h);
    setS(hsv.s);
    setV(hsv.v);
    hue.value = hsv.h;
    sat.value = hsv.s;
    val.value = hsv.v;
    red.value = nr;
    green.value = ng;
    blue.value = nb;
    setHex(rgbToHex(nr, ng, nb));
  };

  const applyRgb = (nr: number, ng: number, nb: number) => {
    const hsv = rgbToHsv(nr, ng, nb);
    paint(nr, ng, nb, hsv);
    onChange(rgbToHex(nr, ng, nb));
  };

  const applyHsv = (nh: number, ns: number, nv: number) => {
    const rgb = hsvToRgb(nh, ns, nv);
    paint(rgb.r, rgb.g, rgb.b, { h: nh, s: ns, v: nv });
    onChange(rgbToHex(rgb.r, rgb.g, rgb.b));
  };

  const placeOnWheel = (x: number, y: number) => {
    'worklet';
    const dx = x - WHEEL_RADIUS;
    const dy = y - WHEEL_RADIUS;
    const dist = Math.min(WHEEL_RADIUS, Math.hypot(dx, dy));
    let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (angle < 0) angle += 360;
    hue.value = angle;
    sat.value = Math.min(1, Math.max(0, dist / WHEEL_RADIUS));
  };

  const wheelGesture = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => {
      placeOnWheel(e.x, e.y);
    })
    .onUpdate((e) => {
      placeOnWheel(e.x, e.y);
    })
    .onEnd(() => {
      runOnJS(applyHsv)(hue.value, sat.value, val.value);
    });

  const onHexInput = (text: string) => {
    const formatted = text.startsWith('#') ? text : `#${text}`;
    setHex(formatted.toUpperCase());
    if (/^#([0-9A-Fa-f]{6})$/.test(formatted)) {
      const parsed = hexToRgb(formatted);
      const hsv = rgbToHsv(parsed.r, parsed.g, parsed.b);
      setR(parsed.r);
      setG(parsed.g);
      setB(parsed.b);
      setH(hsv.h);
      setS(hsv.s);
      setV(hsv.v);
      hue.value = hsv.h;
      sat.value = hsv.s;
      val.value = hsv.v;
      red.value = parsed.r;
      green.value = parsed.g;
      blue.value = parsed.b;
      onChange(rgbToHex(parsed.r, parsed.g, parsed.b));
    }
  };

  const cursorStyle = useAnimatedStyle(() => {
    const rad = (hue.value * Math.PI) / 180;
    return {
      left: WHEEL_RADIUS + Math.cos(rad) * sat.value * WHEEL_RADIUS - 9,
      top: WHEEL_RADIUS + Math.sin(rad) * sat.value * WHEEL_RADIUS - 9,
      backgroundColor: hsvToHex(hue.value, sat.value, val.value),
    };
  });
  const shadeStyle = useAnimatedStyle(() => ({
    opacity: 1 - Math.max(0, Math.min(1, val.value)),
  }));
  const previewStyle = useAnimatedStyle(() => ({
    backgroundColor: hsvToHex(hue.value, sat.value, val.value),
  }));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.flex}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={styles.card} onPress={() => {}}>
            <View style={styles.topRow}>
              <Animated.View style={[styles.preview, previewStyle]} />
              <View style={styles.switchWrap}>
                <Pressable
                  onPress={() => setMode('wheel')}
                  style={[styles.switchBtn, mode === 'wheel' && styles.switchBtnActive]}
                >
                  <Text style={[styles.switchText, mode === 'wheel' && styles.switchTextActive]}>
                    Круг
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setMode('rgb')}
                  style={[styles.switchBtn, mode === 'rgb' && styles.switchBtnActive]}
                >
                  <Text style={[styles.switchText, mode === 'rgb' && styles.switchTextActive]}>
                    RGB · HEX
                  </Text>
                </Pressable>
              </View>
            </View>

            {mode === 'wheel' ? (
              <>
                <GestureDetector gesture={wheelGesture}>
                  <View style={styles.wheelWrap}>
                    <ColorWheelBase />
                    <Animated.View pointerEvents="none" style={[styles.shade, shadeStyle]} />
                    <Animated.View pointerEvents="none" style={[styles.cursor, cursorStyle]} />
                  </View>
                </GestureDetector>

                <View style={styles.sliders}>
                  <SmoothSlider
                    label="Оттенок"
                    value={Math.round(h)}
                    shared={hue}
                    min={0}
                    max={360}
                    suffix="°"
                    onCommit={(deg) => applyHsv(deg, sat.value, val.value)}
                  />
                  <SmoothSlider
                    label="Насыщ."
                    value={Math.round(s * 100)}
                    shared={sat}
                    min={0}
                    max={1}
                    step={0.01}
                    suffix="%"
                    onCommit={(ns) => applyHsv(hue.value, ns, val.value)}
                  />
                  <SmoothSlider
                    label="Яркость"
                    value={Math.round(v * 100)}
                    shared={val}
                    min={0}
                    max={1}
                    step={0.01}
                    suffix="%"
                    onCommit={(nv) => applyHsv(hue.value, sat.value, nv)}
                  />
                </View>
              </>
            ) : (
              <>
                <TextInput
                  value={hex}
                  onChangeText={onHexInput}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={7}
                  style={styles.hexInput}
                  placeholder="#000000"
                  placeholderTextColor={colors.textMuted}
                />
                <View style={styles.sliders}>
                  <SmoothSlider
                    label="R"
                    value={r}
                    shared={red}
                    min={0}
                    max={255}
                    onLive={(nr) => {
                      'worklet';
                      const hsv = rgbToHsv(nr, green.value, blue.value);
                      hue.value = hsv.h;
                      sat.value = hsv.s;
                      val.value = hsv.v;
                    }}
                    onCommit={(nr) => applyRgb(nr, green.value, blue.value)}
                  />
                  <SmoothSlider
                    label="G"
                    value={g}
                    shared={green}
                    min={0}
                    max={255}
                    onLive={(ng) => {
                      'worklet';
                      const hsv = rgbToHsv(red.value, ng, blue.value);
                      hue.value = hsv.h;
                      sat.value = hsv.s;
                      val.value = hsv.v;
                    }}
                    onCommit={(ng) => applyRgb(red.value, ng, blue.value)}
                  />
                  <SmoothSlider
                    label="B"
                    value={b}
                    shared={blue}
                    min={0}
                    max={255}
                    onLive={(nb) => {
                      'worklet';
                      const hsv = rgbToHsv(red.value, green.value, nb);
                      hue.value = hsv.h;
                      sat.value = hsv.s;
                      val.value = hsv.v;
                    }}
                    onCommit={(nb) => applyRgb(red.value, green.value, nb)}
                  />
                  <SmoothSlider
                    label="Оттенок"
                    value={Math.round(h)}
                    shared={hue}
                    min={0}
                    max={360}
                    suffix="°"
                    onCommit={(deg) => applyHsv(deg, sat.value, val.value)}
                  />
                  <SmoothSlider
                    label="Насыщ."
                    value={Math.round(s * 100)}
                    shared={sat}
                    min={0}
                    max={1}
                    step={0.01}
                    suffix="%"
                    onCommit={(ns) => applyHsv(hue.value, ns, val.value)}
                  />
                  <SmoothSlider
                    label="Яркость"
                    value={Math.round(v * 100)}
                    shared={val}
                    min={0}
                    max={1}
                    step={0.01}
                    suffix="%"
                    onCommit={(nv) => applyHsv(hue.value, sat.value, nv)}
                  />
                </View>
              </>
            )}

            <Pressable onPress={onClose} style={styles.doneBtn}>
              <Text style={styles.doneText}>Готово</Text>
            </Pressable>
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
    backgroundColor: 'rgba(24,24,27,0.35)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing.md,
    maxWidth: 340,
    width: '100%',
    alignSelf: 'center',
    gap: spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  preview: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  switchWrap: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    padding: 3,
  },
  switchBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 10,
    alignItems: 'center',
  },
  switchBtnActive: {
    backgroundColor: colors.accent,
  },
  switchText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  switchTextActive: {
    color: '#fff',
  },
  hexInput: {
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 12,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  wheelWrap: {
    width: WHEEL_SIZE,
    height: WHEEL_SIZE,
    alignSelf: 'center',
    borderRadius: WHEEL_RADIUS,
    overflow: 'hidden',
    marginVertical: 4,
  },
  shade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000',
  },
  cursor: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#fff',
  },
  sliders: {
    alignItems: 'center',
    gap: 6,
  },
  sliderWrap: {
    width: 220,
  },
  sliderLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 4,
  },
  trackHit: {
    height: 28,
    justifyContent: 'center',
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  thumb: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.accent,
  },
  doneBtn: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  doneText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
});
