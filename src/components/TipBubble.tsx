import { Pressable, StyleSheet, Text } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { colors, spacing } from '../theme';
import { TIP_COPY, type TipId } from '../tips';

type Props = {
  tipId: TipId | null;
  onDismiss: (id: TipId) => void;
};

export function TipBubble({ tipId, onDismiss }: Props) {
  if (!tipId) return null;
  const text = TIP_COPY[tipId];

  return (
    <Animated.View
      key={tipId}
      entering={FadeInUp.duration(220)}
      exiting={FadeOutUp.duration(160)}
      style={styles.wrap}
      pointerEvents="box-none"
    >
      <Animated.View style={styles.bubble}>
        <Text style={styles.text}>{text}</Text>
        <Pressable
          onPress={() => onDismiss(tipId)}
          hitSlop={10}
          style={styles.close}
          accessibilityLabel="Больше не показывать"
        >
          <Ionicons name="close" size={16} color={colors.tipText} />
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.sm,
    marginHorizontal: spacing.md,
    alignItems: 'flex-start',
    zIndex: 40,
  },
  bubble: {
    maxWidth: 340,
    backgroundColor: colors.tipBg,
    borderRadius: 14,
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 36,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  text: {
    color: colors.tipText,
    fontSize: 13,
    lineHeight: 18,
  },
  close: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
