import { Gesture } from 'react-native-gesture-handler';
import { measure, runOnJS, useAnimatedRef, useSharedValue } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import type { View } from 'react-native';

export function useSpinGesture(
  rotation: SharedValue<number>,
  enabled: boolean,
  onEnd: () => void,
) {
  const ref = useAnimatedRef<View>();
  const pivotX = useSharedValue(0);
  const pivotY = useSharedValue(0);
  const lastAngle = useSharedValue(0);
  const ready = useSharedValue(0);

  const gesture = Gesture.Pan()
    .enabled(enabled)
    .minDistance(0)
    .onBegin((e) => {
      const box = measure(ref);
      ready.value = box ? 1 : 0;
      if (!box) return;
      pivotX.value = box.pageX + box.width / 2;
      pivotY.value = box.pageY + box.height / 2;
      lastAngle.value = Math.atan2(e.absoluteY - pivotY.value, e.absoluteX - pivotX.value);
    })
    .onUpdate((e) => {
      if (!ready.value) return;
      const angle = Math.atan2(e.absoluteY - pivotY.value, e.absoluteX - pivotX.value);
      let step = angle - lastAngle.value;
      if (step > Math.PI) step -= Math.PI * 2;
      if (step < -Math.PI) step += Math.PI * 2;
      rotation.value += (step * 180) / Math.PI;
      lastAngle.value = angle;
    })
    .onEnd(() => {
      runOnJS(onEnd)();
    });

  return { ref, gesture };
}
