import { Share } from 'react-native';

import type { DossierOut } from '@/lib/api';

// Native Android/iOS: share via OS share sheet (WhatsApp, Gmail, Drive, Copy, etc.).
export const isWebDossier = false;

export async function shareDossier(dossier: DossierOut): Promise<void> {
  await Share.share({ title: `Dosar sesizare ${dossier.public_id}`, message: dossier.text });
}

export async function copyDossier(_text: string): Promise<boolean> {
  return false;
}

export function downloadDossier(_publicId: string, _text: string): void {}

export function printDossier(_html: string): void {}
