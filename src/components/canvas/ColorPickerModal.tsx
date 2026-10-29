import { memo, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
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
const HUE_SLICES = 48;
const SAT_RINGS = 6;

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

function sectorPath(
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number,
  a0: number,
  a1: number,
) {
  const x0 = cx + rOuter * Math.cos(a0);
  const y0 = cy + rOuter * Math.sin(a0);
  const x1 = cx + rOuter * Math.cos(a1);
  const y1 = cy + rOuter * Math.sin(a1);
  if (rInner <= 0.5) {
    return `M ${cx} ${cy} L ${x0} ${y0} A ${rOuter} ${rOuter} 0 0 1 ${x1} ${y1} Z`;
  }
  const x2 = cx + rInner * Math.cos(a1);
  const y2 = cy + rInner * Math.sin(a1);
  const x3 = cx + rInner * Math.cos(a0);
  const y3 = cy + rInner * Math.sin(a0);
  return `M ${x0} ${y0} A ${rOuter} ${rOuter} 0 0 1 ${x1} ${y1} L ${x2} ${y2} A ${rInner} ${rInner} 0 0 0 ${x3} ${y3} Z`;
}

const ColorWheelGraphic = memo(function ColorWheelGraphic({ val }: { val: number }) {
  const cells = useMemo(() => {
    const out: { key: string; d: string; fill: string }[] = [];
    for (let ring = 0; ring < SAT_RINGS; ring += 1) {
      const r0 = (ring / SAT_RINGS) * WHEEL_RADIUS;
      const r1 = ((ring + 1) / SAT_RINGS) * WHEEL_RADIUS;
      const sat = (ring + 0.65) / SAT_RINGS;
      for (let i = 0; i < HUE_SLICES; i += 1) {
        const a0 = (i / HUE_SLICES) * Math.PI * 2;
        const a1 = ((i + 1.04) / HUE_SLICES) * Math.PI * 2;
        const hue = (i / HUE_SLICES) * 360;
        const { r, g, b } = hsvToRgb(hue, sat, val);
        out.push({
          key: `${ring}-${i}`,
          d: sectorPath(WHEEL_RADIUS, WHEEL_RADIUS, r0, r1, a0, a1),
          fill: rgbToHex(r, g, b),
        });
      }
    }
    return out;
  }, [val]);

  return (
    <Svg width={WHEEL_SIZE} height={WHEEL_SIZE}>
      {cells.map((c) => (
        <Path key={c.key} d={c.d} fill={c.fill} />
      ))}
    </Svg>
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

  useEffect(() => {
    const nextRgb = hexToRgb(color);
    const nextHsv = rgbToHsv(nextRgb.r, nextRgb.g, nextRgb.b);
    setR(nextRgb.r);
    setG(nextRgb.g);
    setB(nextRgb.b);
    setH(nextHsv.h);
    setS(nextHsv.s);
    setV(nextHsv.v || 1);
    setHex(color.toUpperCase());
    if (visible) setMode('wheel');
  }, [color, visible]);

  const applyRgb = (nr: number, ng: number, nb: number) => {
    setR(nr);
    setG(ng);
    setB(nb);
    const hsv = rgbToHsv(nr, ng, nb);
    setH(hsv.h);
    setS(hsv.s);
    setV(hsv.v);
    const nextHex = rgbToHex(nr, ng, nb);
    setHex(nextHex);
    onChange(nextHex);
  };

  const applyHsv = (nh: number, ns: number, nv: number) => {
    setH(nh);
    setS(ns);
    setV(nv);
    const rgb = hsvToRgb(nh, ns, nv);
    setR(rgb.r);
    setG(rgb.g);
    setB(rgb.b);
    const nextHex = rgbToHex(rgb.r, rgb.g, rgb.b);
    setHex(nextHex);
    onChange(nextHex);
  };

  const pickOnWheel = (x: number, y: number) => {
    const dx = x - WHEEL_RADIUS;
    const dy = y - WHEEL_RADIUS;
    const dist = Math.min(WHEEL_RADIUS, Math.hypot(dx, dy));
    let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (angle < 0) angle += 360;
    const sat = Math.min(1, Math.max(0, dist / WHEEL_RADIUS));
    applyHsv(angle, sat, v);
  };

  const wheelGesture = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => {
      runOnJS(pickOnWheel)(e.x, e.y);
    })
    .onUpdate((e) => {
      runOnJS(pickOnWheel)(e.x, e.y);
    });

  const onHexInput = (text: string) => {
    const formatted = text.startsWith('#') ? text : `#${text}`;
    setHex(formatted.toUpperCase());
    if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(formatted)) {
      const parsed = hexToRgb(formatted);
      applyRgb(parsed.r, parsed.g, parsed.b);
    }
  };

  const rad = (h * Math.PI) / 180;
  const cursorX = WHEEL_RADIUS + Math.cos(rad) * s * WHEEL_RADIUS;
  const cursorY = WHEEL_RADIUS + Math.sin(rad) * s * WHEEL_RADIUS;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.topRow}>
            <View style={[styles.preview, { backgroundColor: rgbToHex(r, g, b) }]} />
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
                  <ColorWheelGraphic val={Math.max(0.15, v)} />
                  <Svg
                    width={WHEEL_SIZE}
                    height={WHEEL_SIZE}
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                  >
                    <Circle
                      cx={cursorX}
                      cy={cursorY}
                      r={8}
                      stroke="#FFFFFF"
                      strokeWidth={2.5}
                      fill={rgbToHex(r, g, b)}
                    />
                  </Svg>
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
