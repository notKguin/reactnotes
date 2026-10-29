import { useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ListRenderItem,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { notePreview } from '../storage';
import { colors, spacing } from '../theme';
import type { Note } from '../types';
import { NoteThumbnail } from './NoteThumbnail';

type Props = {
  notes: Note[];
  folders: string[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: (folder: string) => void;
  onTogglePin: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onCreateFolder: (name: string) => string;
  onDeleteFolder: (name: string) => void;
  compact?: boolean;
};

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function NoteList({
  notes,
  folders,
  selectedId,
  onSelect,
  onAdd,
  onTogglePin,
  onDuplicate,
  onDelete,
  onCreateFolder,
  onDeleteFolder,
  compact,
}: Props) {
  const [folder, setFolder] = useState('Все');
  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [folderError, setFolderError] = useState('');
  const [query, setQuery] = useState('');
  const [menuNote, setMenuNote] = useState<Note | null>(null);

  const q = query.trim().toLowerCase();
  const filtered = notes.filter((n) => {
    if (folder !== 'Все' && n.folder !== folder) return false;
    if (!q) return true;
    const hay = `${n.title} ${notePreview(n)} ${n.folder}`.toLowerCase();
    return hay.includes(q);
  });

  const submitFolder = () => {
    const name = draftName.trim();
    if (!name || name === 'Все') {
      setFolderError('Введите другое название');
      return;
    }
    const created = onCreateFolder(name);
    if (!created) {
      setFolderError('Не удалось создать группу');
      return;
    }
    setDraftName('');
    setFolderError('');
    setCreating(false);
    setFolder(created);
  };

  const confirmDeleteFolder = (name: string) => {
    Alert.alert('Удалить группу?', `Листы из «${name}» останутся без группы.`, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: () => {
          onDeleteFolder(name);
          if (folder === name) setFolder('Все');
        },
      },
    ]);
  };

  const renderItem: ListRenderItem<Note> = ({ item }) => {
    const active = item.id === selectedId;
    return (
      <Animated.View
        entering={FadeIn.duration(180)}
        layout={LinearTransition.springify().damping(19)}
      >
        <Pressable
          onPress={() => onSelect(item.id)}
          onLongPress={() => setMenuNote(item)}
          delayLongPress={260}
          style={[styles.row, active && styles.rowActive]}
          accessibilityRole="button"
          accessibilityState={{ selected: active }}
        >
          <NoteThumbnail note={item} />
          <View style={styles.rowBody}>
            <View style={styles.rowTop}>
              <Text style={styles.title} numberOfLines={1}>
                {item.title.trim() || 'Без названия'}
              </Text>
              <Pressable
                onPress={() => onTogglePin(item.id)}
                hitSlop={8}
                accessibilityLabel={item.pinned ? 'Открепить' : 'Закрепить'}
              >
                <MaterialCommunityIcons
                  name={item.pinned ? 'pin' : 'pin-outline'}
                  size={18}
                  color={item.pinned ? colors.accent : colors.textMuted}
                />
              </Pressable>
              <Pressable
                onPress={() => setMenuNote(item)}
                hitSlop={8}
                accessibilityLabel="Действия с листом"
              >
                <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} />
              </Pressable>
            </View>
            <Text style={styles.preview} numberOfLines={compact ? 1 : 2}>
              {notePreview(item)}
            </Text>
            <View style={styles.meta}>
              <Text style={styles.folderTag}>{item.folder || 'Без группы'}</Text>
              <Text style={styles.date}>{formatDate(item.updatedAt)}</Text>
            </View>
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.heading}>Заметки</Text>
        <Pressable
          onPress={() => onAdd(folder === 'Все' ? '' : folder)}
          style={styles.addBtn}
          accessibilityRole="button"
        >
          <Text style={styles.addLabel}>＋ Лист</Text>
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Поиск по названию и тексту"
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {query.length > 0 ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Очистить поиск">
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.foldersWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.folders}
        >
          <Pressable
            onPress={() => setFolder('Все')}
            style={[styles.folderChip, folder === 'Все' && styles.folderChipActive]}
          >
            <Text
              style={[styles.folderText, folder === 'Все' && styles.folderTextActive]}
            >
              Все
            </Text>
          </Pressable>
          {folders.map((f) => (
            <Pressable
              key={f}
              onPress={() => setFolder(f)}
              onLongPress={() => confirmDeleteFolder(f)}
              accessibilityHint="Удерживайте, чтобы удалить группу"
              style={[styles.folderChip, folder === f && styles.folderChipActive]}
            >
              <Text style={[styles.folderText, folder === f && styles.folderTextActive]}>
                {f}
              </Text>
            </Pressable>
          ))}
          <Pressable
            onPress={() => {
              setDraftName('');
              setFolderError('');
              setCreating(true);
            }}
            style={styles.addFolderChip}
            accessibilityLabel="Новая группа"
          >
            <Ionicons name="add" size={16} color={colors.toolIdle} />
          </Pressable>
        </ScrollView>
      </View>

      {filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{q ? 'Ничего не нашлось' : 'Пока пусто'}</Text>
          <Text style={styles.emptyHint}>
            {q
              ? 'Попробуйте другое слово или снимите фильтр группы.'
              : 'Создайте лист или добавьте свою группу кнопкой «＋».'}
          </Text>
          {!q ? (
            <Pressable
              onPress={() => onAdd(folder === 'Все' ? '' : folder)}
              style={styles.emptyBtn}
            >
              <Text style={styles.emptyBtnText}>Новый лист</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ItemSeparatorComponent={() => <View style={styles.sep} />}
        />
      )}

      <Modal
        visible={creating}
        transparent
        animationType="fade"
        onRequestClose={() => setCreating(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setCreating(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Новая группа</Text>
            <TextInput
              value={draftName}
              onChangeText={(value) => {
                setDraftName(value);
                if (folderError) setFolderError('');
              }}
              placeholder="Название группы"
              placeholderTextColor={colors.textMuted}
              autoFocus
              style={styles.modalInput}
              onSubmitEditing={submitFolder}
            />
            {folderError ? <Text style={styles.folderError}>{folderError}</Text> : null}
            <View style={styles.modalActions}>
              <Pressable onPress={() => setCreating(false)} style={styles.modalBtn}>
                <Text style={styles.modalCancel}>Отмена</Text>
              </Pressable>
              <Pressable onPress={submitFolder} style={[styles.modalBtn, styles.modalPrimary]}>
                <Text style={styles.modalPrimaryText}>Создать</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={menuNote !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuNote(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setMenuNote(null)}>
          <Pressable style={styles.actionCard} onPress={() => {}}>
            <Text style={styles.actionTitle} numberOfLines={1}>
              {menuNote?.title.trim() || 'Без названия'}
            </Text>
            <Pressable
              onPress={() => {
                if (menuNote) onDuplicate(menuNote.id);
                setMenuNote(null);
              }}
              style={styles.actionRow}
            >
              <Ionicons name="copy-outline" size={20} color={colors.text} />
              <Text style={styles.actionText}>Сделать копию</Text>
            </Pressable>
            <View style={styles.actionDivider} />
            <Pressable
              onPress={() => {
                const target = menuNote;
                setMenuNote(null);
                if (!target) return;
                Alert.alert('Удалить лист?', 'Действие нельзя отменить.', [
                  { text: 'Отмена', style: 'cancel' },
                  {
                    text: 'Удалить',
                    style: 'destructive',
                    onPress: () => onDelete(target.id),
                  },
                ]);
              }}
              style={styles.actionRow}
            >
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
              <Text style={[styles.actionText, styles.actionDanger]}>Удалить</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  heading: {
    fontSize: 30,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.6,
  },
  searchWrap: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    minHeight: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    paddingVertical: 8,
  },
  addBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 12,
  },
  addLabel: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  foldersWrap: {
    paddingBottom: spacing.sm,
  },
  folders: {
    paddingHorizontal: spacing.md,
    gap: 8,
    alignItems: 'center',
  },
  folderChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
  },
  folderChipActive: {
    backgroundColor: colors.accent,
  },
  folderText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  folderTextActive: {
    color: '#fff',
  },
  addFolderChip: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowActive: {
    backgroundColor: colors.selected,
    borderColor: colors.accent,
  },
  rowBody: {
    flex: 1,
    justifyContent: 'space-between',
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  preview: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
    marginTop: 2,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  folderTag: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
  },
  date: {
    fontSize: 11,
    color: colors.textMuted,
  },
  sep: {
    height: spacing.sm,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptyHint: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 12,
  },
  emptyBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  folderError: {
    marginTop: 8,
    color: colors.danger,
    fontSize: 13,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(24,24,27,0.35)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing.md,
    maxWidth: 360,
    width: '100%',
    alignSelf: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surfaceMuted,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: spacing.md,
  },
  modalBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  modalCancel: {
    color: colors.textMuted,
    fontWeight: '600',
  },
  modalPrimary: {
    backgroundColor: colors.accent,
  },
  modalPrimaryText: {
    color: '#fff',
    fontWeight: '600',
  },
  actionCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    maxWidth: 320,
    width: '100%',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMuted,
    paddingVertical: 8,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
  },
  actionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  actionDanger: {
    color: colors.danger,
  },
});
