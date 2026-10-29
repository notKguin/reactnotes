import { memo, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { Canvas, Circle, RadialGradient, SweepGradient } from '@shopify/react-native-skia';
import { colors, spacing } from '../../theme';
import { ValueSlider } from './ValueSlider';

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

  const vRef = useRef(v);
  vRef.current = v;
  const pending = useRef<{ h: number; s: number } | null>(null);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (!visible) return;
    const nextRgb = hexToRgb(color);
    const nextHsv = rgbToHsv(nextRgb.r, nextRgb.g, nextRgb.b);
    setR(nextRgb.r);
    setG(nextRgb.g);
    setB(nextRgb.b);
    setH(nextHsv.h);
    setS(nextHsv.s);
    setV(nextHsv.v || 1);
    setHex(color.toUpperCase());
    setMode('wheel');
  }, [visible]);

  const paint = (nr: number, ng: number, nb: number, hsv: { h: number; s: number; v: number }) => {
    setR(nr);
    setG(ng);
    setB(nb);
    setH(hsv.h);
    setS(hsv.s);
    setV(hsv.v);
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

  const previewWheel = (x: number, y: number) => {
    const dx = x - WHEEL_RADIUS;
    const dy = y - WHEEL_RADIUS;
    const dist = Math.min(WHEEL_RADIUS, Math.hypot(dx, dy));
    let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (angle < 0) angle += 360;
    const sat = Math.min(1, Math.max(0, dist / WHEEL_RADIUS));
    pending.current = { h: angle, s: sat };
    if (frame.current != null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const next = pending.current;
      if (!next) return;
      const rgb = hsvToRgb(next.h, next.s, vRef.current);
      paint(rgb.r, rgb.g, rgb.b, { h: next.h, s: next.s, v: vRef.current });
    });
  };

  const commitWheel = () => {
    if (frame.current != null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }
    const next = pending.current;
    if (!next) return;
    applyHsv(next.h, next.s, vRef.current);
  };

  const wheelGesture = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => {
      runOnJS(previewWheel)(e.x, e.y);
    })
    .onUpdate((e) => {
      runOnJS(previewWheel)(e.x, e.y);
    })
    .onEnd(() => {
      runOnJS(commitWheel)();
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
      onChange(rgbToHex(parsed.r, parsed.g, parsed.b));
    }
  };

  const rad = (h * Math.PI) / 180;
  const cursorX = WHEEL_RADIUS + Math.cos(rad) * s * WHEEL_RADIUS;
  const cursorY = WHEEL_RADIUS + Math.sin(rad) * s * WHEEL_RADIUS;
  const currentHex = rgbToHex(r, g, b);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.flex}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={styles.card} onPress={() => {}}>
            <View style={styles.topRow}>
              <View style={[styles.preview, { backgroundColor: currentHex }]} />
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
                    <View
                      pointerEvents="none"
                      style={[
                        styles.shade,
                        { backgroundColor: `rgba(0,0,0,${1 - Math.max(0, Math.min(1, v))})` },
                      ]}
                    />
                    <View
                      pointerEvents="none"
                      style={[
                        styles.cursor,
                        { left: cursorX - 9, top: cursorY - 9, backgroundColor: currentHex },
                      ]}
                    />
                  </View>
                </GestureDetector>

                <View style={styles.sliders}>
                  <ValueSlider
                    label="Оттенок"
                    value={Math.round(h)}
                    min={0}
                    max={360}
                    suffix="°"
                    onChange={(deg) => applyHsv(deg, s, v)}
                  />
                  <ValueSlider
                    label="Насыщ."
                    value={Math.round(s * 100)}
                    min={0}
                    max={100}
                    suffix="%"
                    onChange={(pct) => applyHsv(h, pct / 100, v)}
                  />
                  <ValueSlider
                    label="Яркость"
                    value={Math.round(v * 100)}
                    min={0}
                    max={100}
                    suffix="%"
                    onChange={(pct) => applyHsv(h, s, pct / 100)}
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
                  <ValueSlider
                    label="R"
                    value={r}
                    min={0}
                    max={255}
                    onChange={(val) => applyRgb(val, g, b)}
                  />
                  <ValueSlider
                    label="G"
                    value={g}
                    min={0}
                    max={255}
                    onChange={(val) => applyRgb(r, val, b)}
                  />
                  <ValueSlider
                    label="B"
                    value={b}
                    min={0}
                    max={255}
                    onChange={(val) => applyRgb(r, g, val)}
                  />
                  <ValueSlider
                    label="Оттенок"
                    value={Math.round(h)}
                    min={0}
                    max={360}
                    suffix="°"
                    onChange={(deg) => applyHsv(deg, s, v)}
                  />
                  <ValueSlider
                    label="Насыщ."
                    value={Math.round(s * 100)}
                    min={0}
                    max={100}
                    suffix="%"
                    onChange={(pct) => applyHsv(h, pct / 100, v)}
                  />
                  <ValueSlider
                    label="Яркость"
                    value={Math.round(v * 100)}
                    min={0}
                    max={100}
                    suffix="%"
                    onChange={(pct) => applyHsv(h, s, pct / 100)}
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
