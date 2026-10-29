import { useCallback, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { colors } from '../../theme';

type Props = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
};

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

export function ValueSlider({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = '',
  onChange,
}: Props) {
  const [trackW, setTrackW] = useState(140);
  const trackRef = useRef(140);
  const propsRef = useRef({ min, max, step, onChange });
  propsRef.current = { min, max, step, onChange };

  const onLayout = (e: LayoutChangeEvent) => {
    const next = Math.max(60, e.nativeEvent.layout.width);
    trackRef.current = next;
    setTrackW(next);
  };

  const applyAt = useCallback((x: number) => {
    const current = propsRef.current;
    const width = Math.max(1, trackRef.current);
    const ratio = clamp(x / width, 0, 1);
    const raw = current.min + ratio * (current.max - current.min);
    const stepped = Math.round(raw / current.step) * current.step;
    current.onChange(Number(clamp(stepped, current.min, current.max).toFixed(2)));
  }, []);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .hitSlop(8)
        .runOnJS(true)
        .onBegin((e) => {
          applyAt(e.x);
        })
        .onUpdate((e) => {
          applyAt(e.x);
        }),
    [applyAt],
  );

  const ratio = clamp((value - min) / Math.max(1e-6, max - min), 0, 1);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        {label}: {Math.round(value)}
        {suffix}
      </Text>
      <GestureDetector gesture={gesture}>
        <View style={styles.trackHit} onLayout={onLayout}>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${ratio * 100}%` }]} />
          </View>
          <View style={[styles.thumb, { left: ratio * (trackW - 18) }]} />
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 170,
    marginRight: 10,
  },
  label: {
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
});
