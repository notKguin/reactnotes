import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, {
  FadeInDown,
  FadeOutDown,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { colors, spacing } from '../../theme';
import type { LayerItem } from '../../types';

type Props = {
  layers: LayerItem[];
  activeLayerId: string;
  onSelectLayer: (id: string) => void;
  onAddLayer: () => void;
  onDeleteLayer: (id: string) => void;
  onToggleVisible: (id: string) => void;
  onToggleLocked: (id: string) => void;
  onMoveLayer: (id: string, direction: 'up' | 'down') => void;
};

export function LayersPanel({
  layers,
  activeLayerId,
  onSelectLayer,
  onAddLayer,
  onDeleteLayer,
  onToggleVisible,
  onToggleLocked,
  onMoveLayer,
}: Props) {
  const [open, setOpen] = useState(false);
  const fabScale = useSharedValue(1);
  const active = layers.find((l) => l.id === activeLayerId) ?? layers[layers.length - 1];
  const reversed = [...layers].reverse();

  const fabAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: fabScale.value }],
  }));

  return (
    <View style={styles.root} pointerEvents="box-none">
      {open ? (
        <Animated.View
          entering={FadeInDown.duration(200)}
          exiting={FadeOutDown.duration(150)}
          layout={LinearTransition.springify().damping(18)}
          style={styles.card}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Слои ({layers.length})</Text>
            <View style={styles.headerBtns}>
              <Pressable
                onPress={onAddLayer}
                style={styles.iconBtn}
                accessibilityLabel="Новый слой"
              >
                <Ionicons name="add" size={18} color={colors.text} />
              </Pressable>
              <Pressable
                onPress={() => setOpen(false)}
                style={styles.iconBtn}
                accessibilityLabel="Свернуть слои"
              >
                <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
              </Pressable>
            </View>
          </View>

          <ScrollView style={styles.list}>
            {reversed.map((layer) => {
              const isSelected = layer.id === active?.id;
              const idxInOriginal = layers.findIndex((l) => l.id === layer.id);
              const canMoveUp = idxInOriginal < layers.length - 1;
              const canMoveDown = idxInOriginal > 0;

              return (
                <Animated.View
                  key={layer.id}
                  layout={LinearTransition.springify().damping(20)}
                >
                  <Pressable
                    onPress={() => onSelectLayer(layer.id)}
                    style={[styles.row, isSelected && styles.rowActive]}
                  >
                    <Pressable
                      onPress={() => onToggleVisible(layer.id)}
                      hitSlop={6}
                      style={styles.smallHit}
                      accessibilityLabel={layer.visible ? 'Скрыть слой' : 'Показать слой'}
                    >
                      <Ionicons
                        name={layer.visible ? 'eye-outline' : 'eye-off-outline'}
                        size={16}
                        color={layer.visible ? colors.text : colors.textMuted}
                      />
                    </Pressable>

                    <Text
                      style={[
                        styles.layerName,
                        !layer.visible && styles.layerMuted,
                        isSelected && styles.layerNameActive,
                      ]}
                      numberOfLines={1}
                    >
                      {layer.name}
                    </Text>

                    <Pressable
                      onPress={() => onToggleLocked(layer.id)}
                      hitSlop={6}
                      style={styles.smallHit}
                      accessibilityLabel={layer.locked ? 'Разблокировать' : 'Заблокировать'}
                    >
                      <Ionicons
                        name={layer.locked ? 'lock-closed' : 'lock-open-outline'}
                        size={14}
                        color={layer.locked ? colors.accent : colors.textMuted}
                      />
                    </Pressable>

                    <Pressable
                      onPress={() => onMoveLayer(layer.id, 'up')}
                      disabled={!canMoveUp}
                      hitSlop={4}
                      style={[styles.smallHit, !canMoveUp && styles.disabled]}
                      accessibilityLabel="Слой выше"
                    >
                      <Ionicons name="arrow-up" size={14} color={colors.textMuted} />
                    </Pressable>

                    <Pressable
                      onPress={() => onMoveLayer(layer.id, 'down')}
                      disabled={!canMoveDown}
                      hitSlop={4}
                      style={[styles.smallHit, !canMoveDown && styles.disabled]}
                      accessibilityLabel="Слой ниже"
                    >
                      <Ionicons name="arrow-down" size={14} color={colors.textMuted} />
                    </Pressable>

                    {layers.length > 1 ? (
                      <Pressable
                        onPress={() => {
                          Alert.alert(
                            'Удалить слой?',
                            `«${layer.name}» и всё, что на нём нарисовано, исчезнут.`,
                            [
                              { text: 'Отмена', style: 'cancel' },
                              {
                                text: 'Удалить',
                                style: 'destructive',
                                onPress: () => onDeleteLayer(layer.id),
                              },
                            ],
                          );
                        }}
                        hitSlop={6}
                        style={styles.smallHit}
                        accessibilityLabel="Удалить слой"
                      >
                        <Ionicons name="trash-outline" size={15} color={colors.danger} />
                      </Pressable>
                    ) : null}
                  </Pressable>
                </Animated.View>
              );
            })}
          </ScrollView>
        </Animated.View>
      ) : null}

      <Animated.View style={fabAnimStyle}>
        <Pressable
          onPressIn={() => {
            fabScale.value = withSpring(0.93, { damping: 15, stiffness: 300 });
          }}
          onPressOut={() => {
            fabScale.value = withSpring(1, { damping: 15, stiffness: 300 });
          }}
          onPress={() => setOpen((v) => !v)}
          style={styles.fab}
          accessibilityLabel="Открыть слои"
        >
          <Ionicons name="layers-outline" size={20} color="#fff" />
          <Text style={styles.fabText} numberOfLines={1}>
            {active?.name ?? 'Слой 1'}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
    alignItems: 'flex-end',
    zIndex: 50,
  },
  card: {
    width: 248,
    maxHeight: 270,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  headerBtns: {
    flexDirection: 'row',
    gap: 4,
  },
  iconBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    maxHeight: 210,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderRadius: 10,
    marginBottom: 3,
    gap: 4,
  },
  rowActive: {
    backgroundColor: colors.accentSoft,
  },
  layerName: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    fontWeight: '500',
  },
  layerNameActive: {
    fontWeight: '700',
    color: colors.accentDeep,
  },
  layerMuted: {
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  smallHit: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.25,
  },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  fabText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    maxWidth: 110,
  },
});
