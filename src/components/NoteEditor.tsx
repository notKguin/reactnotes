import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';
import type { Note, NotePatch } from '../types';
import { NoteCanvas } from './canvas/NoteCanvas';

type Props = {
  note: Note | null;
  folders: string[];
  onCreateFolder: (name: string) => string;
  showBack?: boolean;
  onBack?: () => void;
  onChange: (id: string, patch: NotePatch) => void;
  onDelete: (id: string) => void;
  wide?: boolean;
};

export function NoteEditor({
  note,
  folders,
  onCreateFolder,
  showBack,
  onBack,
  onChange,
  onDelete,
  wide,
}: Props) {
  if (!note) {
    return (
      <View style={[styles.root, styles.placeholder]}>
        <Text style={styles.placeholderTitle}>Выберите лист</Text>
        <Text style={styles.placeholderHint}>
          На планшете список слева, холст справа. Добавляйте текст, фото и рисуйте стилусом или
          пальцем.
        </Text>
      </View>
    );
  }

  return (
    <NoteCanvas
      note={note}
      folders={folders}
      onCreateFolder={onCreateFolder}
      onChange={onChange}
      onDelete={onDelete}
      showBack={showBack}
      onBack={onBack}
      wide={wide}
    />
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.surfaceMuted,
  },
  placeholderTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  placeholderHint: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 420,
  },
});
