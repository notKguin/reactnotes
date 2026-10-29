import { File } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { RefObject } from 'react';
import { Alert } from 'react-native';
import { captureRef, type ViewShotRef } from 'react-native-view-shot';

export async function exportCanvasAsPng(ref: RefObject<ViewShotRef | null>): Promise<void> {
  try {
    if (!ref.current) return;
    const uri = await captureRef(ref, { format: 'png', quality: 1 });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Экспорт листа (PNG)',
      });
    } else {
      Alert.alert('Готово', `Сохранено: ${uri}`);
    }
  } catch {
    Alert.alert('Ошибка', 'Не удалось экспортировать PNG.');
  }
}

export async function exportCanvasAsPdf(
  ref: RefObject<ViewShotRef | null>,
  title: string,
): Promise<void> {
  try {
    if (!ref.current) return;
    const pngUri = await captureRef(ref, { format: 'png', quality: 0.95 });
    const base64 = await new File(pngUri).base64();
    const safeTitle = (title || 'Лист').replace(/[<>]/g, '');
    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page { margin: 12px; }
    body { margin: 0; font-family: sans-serif; color: #171717; }
    h1 { font-size: 18px; margin: 0 0 8px 0; }
    img { width: 100%; height: auto; display: block; border-radius: 8px; }
  </style>
</head>
<body>
  <h1>${safeTitle}</h1>
  <img src="data:image/png;base64,${base64}" />
</body>
</html>`;
    const { uri } = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
        dialogTitle: 'Экспорт листа (PDF)',
      });
    } else {
      Alert.alert('Готово', `PDF: ${uri}`);
    }
  } catch {
    Alert.alert('Ошибка', 'Не удалось создать PDF.');
  }
}
