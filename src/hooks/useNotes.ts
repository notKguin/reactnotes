import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cleanupOrphanImages } from '../media';
import {
  createEmptyNote,
  loadFolders,
  loadNotes,
  saveFolders,
  saveNotes,
} from '../storage';
import type { BackgroundId, Note, NotePatch } from '../types';

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notesRef = useRef(notes);
  notesRef.current = notes;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [loadedNotes, loadedFolders] = await Promise.all([
        loadNotes(),
        loadFolders(),
      ]);
      if (cancelled) return;
      const fromNotes = loadedNotes
        .map((n) => n.folder?.trim())
        .filter((f): f is string => Boolean(f));
      const merged = Array.from(new Set([...loadedFolders, ...fromNotes]));
      setNotes(loadedNotes);
      setFolders(merged);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const snapshot = notesRef.current;
      void saveNotes(snapshot).then(() => {
        if (notesRef.current !== snapshot) return;
        void cleanupOrphanImages(notesRef.current);
      });
    }, 280);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [notes, ready]);

  useEffect(() => {
    if (!ready) return;
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      void saveNotes(notesRef.current);
    };
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    void saveFolders(folders);
  }, [folders, ready]);

  const sorted = useMemo(
    () =>
      [...notes].sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return b.updatedAt - a.updatedAt;
      }),
    [notes],
  );

  const selected = useMemo(
    () => notes.find((n) => n.id === selectedId) ?? null,
    [notes, selectedId],
  );

  const addNote = useCallback(
    (background: BackgroundId = 'blank', folder = '') => {
      const note = createEmptyNote(background, folder);
      setNotes((prev) => [note, ...prev]);
      setSelectedId(note.id);
      return note;
    },
    [],
  );

  const updateNote = useCallback((id: string, patch: NotePatch) => {
    const keys = Object.keys(patch) as (keyof NotePatch)[];
    const onlyMeta = keys.every((k) => k === 'pinned' || k === 'activeLayerId');
    setNotes((prev) =>
      prev.map((n) =>
        n.id === id
          ? {
              ...n,
              ...patch,
              updatedAt: onlyMeta ? n.updatedAt : Date.now(),
            }
          : n,
      ),
    );
  }, []);

  const togglePin = useCallback((id: string) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, pinned: !n.pinned } : n)),
    );
  }, []);

  const deleteNote = useCallback((id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    setSelectedId((curr) => (curr === id ? null : curr));
  }, []);

  const duplicateNote = useCallback((id: string) => {
    if (!notesRef.current.some((n) => n.id === id)) return;
    const now = Date.now();
    const newId = `${now}-${Math.random().toString(36).slice(2, 9)}`;
    setNotes((prev) => {
      const source = prev.find((n) => n.id === id);
      if (!source) return prev;
      const copy: Note = {
        ...source,
        id: newId,
        title: source.title.trim() ? `${source.title} (копия)` : 'Без названия (копия)',
        pinned: false,
        layers: source.layers.map((l) => ({ ...l })),
        elements: source.elements.map((el) => ({
          ...el,
          id: `${el.id}-copy-${Math.random().toString(36).slice(2, 6)}`,
        })),
        strokes: source.strokes.map((s) => ({
          ...s,
          id: `${s.id}-copy-${Math.random().toString(36).slice(2, 6)}`,
          points: s.points.map((p) => ({ ...p })),
        })),
        createdAt: now,
        updatedAt: now,
      };
      return [copy, ...prev];
    });
    setSelectedId(newId);
  }, []);

  const addFolder = useCallback((rawName: string) => {
    const name = rawName.trim();
    if (!name || name === 'Все') return '';
    setFolders((prev) => (prev.includes(name) ? prev : [...prev, name]));
    return name;
  }, []);

  const deleteFolder = useCallback((name: string) => {
    setFolders((prev) => prev.filter((f) => f !== name));
    setNotes((prev) =>
      prev.map((n) => (n.folder === name ? { ...n, folder: '' } : n)),
    );
  }, []);

  return {
    ready,
    notes: sorted,
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
  };
}
