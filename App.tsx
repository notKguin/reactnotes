import { useFonts } from 'expo-font';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { NoteEditor } from './src/components/NoteEditor';
import { NoteList } from './src/components/NoteList';
import { FONT_MAP } from './src/fonts';
import { useNotes } from './src/hooks/useNotes';
import { colors, TABLET_BREAKPOINT } from './src/theme';

function NotesApp() {
  const { width } = useWindowDimensions();
  const isTablet = width >= TABLET_BREAKPOINT;
  const {
    ready,
    notes,
    folders,
    selected,
    selectedId,
    setSelectedId,
    addNote,
    updateNote,
    togglePin,
    deleteNote,
    duplicateNote,
    addFolder,
    deleteFolder,
  } = useNotes();

  useEffect(() => {
    if (isTablet || selectedId === null) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setSelectedId(null);
      return true;
    });
    return () => sub.remove();
  }, [isTablet, selectedId, setSelectedId]);

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (isTablet) {
    return (
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.split}>
          <View style={[styles.sidebar, width >= 1100 && styles.sidebarWide]}>
            <NoteList
              notes={notes}
              folders={folders}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onAdd={(folder) => addNote('blank', folder)}
              onTogglePin={togglePin}
              onDuplicate={duplicateNote}
              onDelete={deleteNote}
              onCreateFolder={addFolder}
              onDeleteFolder={deleteFolder}
              compact
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.pane}>
            <NoteEditor
              note={selected}
              folders={folders}
              onCreateFolder={addFolder}
              onChange={updateNote}
              onDelete={deleteNote}
              wide
            />
          </View>
        </View>
        <StatusBar style="dark" />
      </SafeAreaView>
      </KeyboardAvoidingView>
    );
  }

  const showEditor = selectedId !== null;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right', 'bottom']}>
      {showEditor ? (
        <NoteEditor
          note={selected}
          folders={folders}
          onCreateFolder={addFolder}
          showBack
          onBack={() => setSelectedId(null)}
          onChange={updateNote}
          onDelete={(id) => {
            deleteNote(id);
            setSelectedId(null);
          }}
        />
      ) : (
        <NoteList
          notes={notes}
          folders={folders}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onAdd={(folder) => addNote('blank', folder)}
          onTogglePin={togglePin}
          onDuplicate={duplicateNote}
          onDelete={deleteNote}
          onCreateFolder={addFolder}
          onDeleteFolder={deleteFolder}
        />
      )}
      <StatusBar style="dark" />
    </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts(FONT_MAP);

  if (!fontsLoaded && !fontError) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <NotesApp />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  split: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    width: '34%',
    maxWidth: 380,
    minWidth: 260,
  },
  sidebarWide: {
    width: '28%',
    maxWidth: 420,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  pane: {
    flex: 1,
  },
});
