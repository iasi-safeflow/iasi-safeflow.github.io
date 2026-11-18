import type { DossierOut } from '@/lib/api';

export const isWebDossier = true;

export async function shareDossier(dossier: DossierOut): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.share) {
    await navigator.share({ title: `Dosar sesizare ${dossier.public_id}`, text: dossier.text });
  }
}

export async function copyDossier(text: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return false;
  await navigator.clipboard.writeText(text);
  return true;
}

export function downloadDossier(publicId: string, text: string): void {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dosar-${publicId}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function printDossier(html: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank', 'noopener,noreferrer');
  if (win) setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
