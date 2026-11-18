import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Image, Platform, View } from 'react-native';

import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/themeMode';
import { radius } from '@/theme';
import { Text } from './AppText';
import { Button, Card, ErrorText, Label, useStyles } from './ui';

export type DraftPhoto = {
  previewUri: string;
  base64: string;
  mimeType: string;
};

const MAX_PHOTOS = 2;
const MAX_DIMENSION = 1280;

async function prepareAsset(asset: ImagePicker.ImagePickerAsset): Promise<DraftPhoto> {
  try {
    const ctx = ImageManipulator.manipulate(asset.uri);
    const maxSide = Math.max(asset.width || 0, asset.height || 0);
    if (maxSide > MAX_DIMENSION) {
      ctx.resize(asset.width >= asset.height ? { width: MAX_DIMENSION } : { height: MAX_DIMENSION });
    }
    const rendered = await ctx.renderAsync();
    const saved = await rendered.saveAsync({
      compress: 0.72,
      format: SaveFormat.JPEG,
      base64: true,
    });
    if (saved.base64) {
      return {
        previewUri: saved.uri || `data:image/jpeg;base64,${saved.base64}`,
        base64: saved.base64,
        mimeType: 'image/jpeg',
      };
    }
  } catch {
    // Fallback below if asset.base64 was already returned (backend still validates and strips EXIF).
  }
  if (!asset.base64) throw new Error(t.photoFailed);
  const mime = asset.mimeType && ['image/jpeg', 'image/png', 'image/webp'].includes(asset.mimeType) ? asset.mimeType : 'image/jpeg';
  return {
    previewUri: asset.uri || `data:${mime};base64,${asset.base64}`,
    base64: asset.base64,
    mimeType: mime,
  };
}

export function PhotoPickerField({
  photos,
  onChange,
}: {
  photos: DraftPhoto[];
  onChange: (next: DraftPhoto[]) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const addFromAsset = async (asset: ImagePicker.ImagePickerAsset) => {
    const prepared = await prepareAsset(asset);
    onChange([...photos, prepared].slice(0, MAX_PHOTOS));
  };

  const pickGallery = async () => {
    setError('');
    setBusy(true);
    try {
      if (Platform.OS !== 'web') {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (perm.status !== 'granted') {
          setError(t.photoDenied);
          return;
        }
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        base64: true,
        exif: false,
      });
      if (!res.canceled && res.assets?.[0]) {
        await addFromAsset(res.assets[0]);
      }
    } catch {
      setError(t.photoFailed);
    } finally {
      setBusy(false);
    }
  };

  const captureCamera = async () => {
    setError('');
    setBusy(true);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (perm.status !== 'granted') {
        setError(t.photoDenied);
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        base64: true,
        exif: false,
      });
      if (!res.canceled && res.assets?.[0]) {
        await addFromAsset(res.assets[0]);
      }
    } catch {
      setError(t.photoFailed);
    } finally {
      setBusy(false);
    }
  };

  const removeAt = (idx: number) => {
    onChange(photos.filter((_, i) => i !== idx));
  };

  return (
    <View style={{ marginBottom: 10 }}>
      <Label>{t.photosLabel}</Label>
      <Text style={[styles.muted, { marginBottom: 6 }]}>{t.photosHint}</Text>
      {photos.length < MAX_PHOTOS && (
        <>
          <Button
            title={t.addFromGallery}
            icon="image"
            variant="secondary"
            onPress={pickGallery}
            loading={busy}
            disabled={busy}
          />
          {Platform.OS !== 'web' && (
            <Button
              title={t.takePhoto}
              icon="camera"
              variant="secondary"
              onPress={captureCamera}
              disabled={busy}
            />
          )}
        </>
      )}
      <ErrorText>{error}</ErrorText>
      {photos.map((p, idx) => (
        <Card key={`${idx}-${p.previewUri.slice(-24)}`}>
          <Image
            source={{ uri: p.previewUri }}
            resizeMode="cover"
            accessibilityLabel={t.photoPreviewA11y.replace('{n}', String(idx + 1))}
            style={{
              width: '100%',
              height: 180,
              borderRadius: radius.input,
              backgroundColor: colors.border,
              marginBottom: 8,
            }}
          />
          <Button
            title={t.photoRemove}
            icon="trash-2"
            variant="secondary"
            onPress={() => removeAt(idx)}
          />
        </Card>
      ))}
    </View>
  );
}
