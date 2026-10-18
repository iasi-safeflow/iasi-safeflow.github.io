import { RefObject, useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

// Spoken announcements and focus moves for screen readers (TalkBack, VoiceOver, and NVDA/VoiceOver on the web).

let liveRegions: { polite: HTMLElement; assertive: HTMLElement } | null = null;

// The browser has no announce API: text placed in an aria-live region is read out instead.
function webLiveRegion(urgent: boolean): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  if (!liveRegions) {
    const make = (mode: 'polite' | 'assertive') => {
      const el = document.createElement('div');
      el.setAttribute('aria-live', mode);
      el.setAttribute('aria-atomic', 'true');
      el.setAttribute('role', mode === 'assertive' ? 'alert' : 'status');
      // Visually hidden but still read (the usual "sr-only" pattern).
      el.style.cssText =
        'position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;';
      document.body.appendChild(el);
      return el;
    };
    liveRegions = { polite: make('polite'), assertive: make('assertive') };
  }
  return urgent ? liveRegions.assertive : liveRegions.polite;
}

export function announce(message: string, { urgent = false }: { urgent?: boolean } = {}) {
  if (!message) return;
  if (Platform.OS === 'web') {
    const el = webLiveRegion(urgent);
    if (!el) return;
    // Clearing first makes a repeated identical message be read again.
    el.textContent = '';
    setTimeout(() => {
      el.textContent = message;
    }, 50);
    return;
  }
  AccessibilityInfo.announceForAccessibility(message);
}

// Moves the screen reader (and keyboard focus on the web) to an element, e.g. the heading of a new screen.
export function focusOn(ref: RefObject<unknown>) {
  const node = ref.current;
  if (!node) return;
  if (Platform.OS === 'web') {
    const el = node as HTMLElement;
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    el.focus();
    return;
  }
  // Native: a short delay lets the screen reader finish announcing the screen change first.
  setTimeout(() => AccessibilityInfo.sendAccessibilityEvent(node as Parameters<typeof AccessibilityInfo.sendAccessibilityEvent>[0], 'focus'), 300);
}

function useSystemFlag(read: () => Promise<boolean>, event: 'reduceMotionChanged' | 'screenReaderChanged') {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let active = true;
    read()
      .then((v) => active && setOn(v))
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener(event, (v: boolean) => setOn(v));
    return () => {
      active = false;
      sub.remove();
    };
  }, [read, event]);
  return on;
}

export function useReduceMotion(): boolean {
  return useSystemFlag(AccessibilityInfo.isReduceMotionEnabled, 'reduceMotionChanged');
}

const never = () => Promise.resolve(false);

// Browsers never report a running screen reader, so on the web this is always false. (react-native-web's
// isScreenReaderEnabled() always answers true, which would ask every web visitor about the screen-reader mode and
// hide "Citește cu voce tare".)
export function useScreenReader(): boolean {
  return useSystemFlag(Platform.OS === 'web' ? never : AccessibilityInfo.isScreenReaderEnabled, 'screenReaderChanged');
}
