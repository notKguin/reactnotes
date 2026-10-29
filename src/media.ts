import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'react-native';
import type { Note } from './types';

function ensureNotesDir(): Directory {
  const dir = new Directory(Paths.document, 'note-images');
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  return dir;
}

const recentImageNames = new Map<string, number>();

function fileNameOf(uri: string): string {
  const clean = uri.split('?')[0];
  const name = clean.split('/').pop() || clean;
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

function rememberImage(uri: string) {
  recentImageNames.set(fileNameOf(uri), Date.now());
}

async function persistAsset(sourceUri: string): Promise<string> {
  const ext = sourceUri.split('.').pop()?.split('?')[0] || 'jpg';
  const safeExt = /^[a-z0-9]+$/i.test(ext) ? ext : 'jpg';
  const dest = new File(
    ensureNotesDir(),
    `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`,
  );
  const src = new File(sourceUri);
  await src.copy(dest);
  rememberImage(dest.uri);
  return dest.uri;
}

function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      reject,
    );
  });
}

export type PickedImage = {
  uri: string;
  width: number;
  height: number;
  aspectRatio: number;
};

export type PickImageResult =
  | { status: 'ok'; image: PickedImage }
  | { status: 'cancelled' }
  | { status: 'denied' }
  | { status: 'error' };

export async function pickAndPersistImage(options?: {
  allowsEditing?: boolean;
}): Promise<PickImageResult> {
  try {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return { status: 'denied' };
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
      allowsEditing: options?.allowsEditing ?? false,
    });

    if (result.canceled || !result.assets?.[0]?.uri) {
      return { status: 'cancelled' };
    }

    const asset = result.assets[0];
    const uri = await persistAsset(asset.uri);
    let width = asset.width || 0;
    let height = asset.height || 0;
    if (!width || !height) {
      const size = await getImageSize(uri);
      width = size.width;
      height = size.height;
    }
    return {
      status: 'ok',
      image: {
        uri,
        width,
        height,
        aspectRatio: width / Math.max(1, height),
      },
    };
  } catch {
    return { status: 'error' };
  }
}

/** Удаляет файлы в note-images/, на которые не ссылается ни одна заметка. */
export async function cleanupOrphanImages(notes: Note[]): Promise<void> {
  try {
    const dir = ensureNotesDir();
    const entries = dir.list();
    if (entries.length === 0) return;

    const used = new Set<string>();
    for (const note of notes) {
      for (const el of note.elements) {
        if (el.type === 'image' && el.uri) {
          used.add(fileNameOf(el.uri));
        }
      }
    }

    const now = Date.now();
    for (const entry of entries) {
      if (!(entry instanceof File)) continue;
      const name = fileNameOf(entry.uri);
      if (used.has(name)) continue;
      const rememberedAt = recentImageNames.get(name);
      if (rememberedAt != null && now - rememberedAt < 15000) continue;
      entry.delete();
      recentImageNames.delete(name);
    }
  } catch {
    // Очистка — фоновая, ошибки ФС игнорируем
  }
}
