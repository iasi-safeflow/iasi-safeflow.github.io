# Android TalkBack & Accessibility Test Script

Follow these steps on an Android phone (APK or local web build) to verify the accessibility features and street search end-to-end.

## 1. Turn on TalkBack
1. Open Android **Settings → Accessibility → TalkBack** and turn it on.
   *(Tip: holding both Volume keys for 3 seconds toggles TalkBack if the shortcut is enabled.)*

## 2. Open the app and accept the simplified mode
1. Open **Iași SafeFlow**.
2. Verify the **112 banner** (`Sună 112`) is read first on Home.
3. When the prompt *"Folosiți un cititor de ecran. Activați modul simplificat pentru nevăzători?"* appears, tap **Da**.
4. Verify Home opens on **"Probleme semnalate în apropiere"** with distance and Romanian direction for each report (and street name when cached), and **"Vezi harta"** is available at the top.

## 3. Sign up / log in
1. Open the **Cont** tab → **Creează cont** (or **Autentificare**).
2. Create a test account or sign in and verify form errors/labels are read clearly.

## 4. Send a report using GPS (5-step flow)
1. Return to **Hartă** and tap **Semnalează o problemă**.
2. **Pasul 1 din 5 (Siguranță):** select **Nu**, then **Continuă**.
3. **Pasul 2 din 5 (Categorie):** pick a category, then **Continuă**.
4. **Pasul 3 din 5 (Locație):** wait for GPS read-back (*"Locație stabilită lângă [stradă], precizie … metri."* or accuracy fallback).
   - Optionally tap **Folosește altă locație**, type a street (e.g. `Copou`), tap **Caută**, and choose a result.
   - Tap **Continuă**.
5. **Pasul 4 din 5 (Descriere):** verify the dictation hint (*"Puteți dicta descrierea folosind microfonul tastaturii."*), enter at least 10 characters, keep/adjust the time, and tap **Continuă**.
6. **Pasul 5 din 5 (Verificare și trimitere):** verify the summary is read aloud, then tap **Trimite raportul**.
7. Confirm the report ID (`SF-…`) is announced.

## 5. Find it in "Ale mele"
1. Open **Ale mele** (`Rapoartele mele`) and verify the new report card is read as one coherent item with status and verification label.

## 6. Trigger the 112 stop screen
1. Start a new report and tap **Da** on the danger question (or choose *"Incident în desfășurare acum"*).
2. Verify the **112 stop screen** (`Opriți-vă aici`) is announced immediately, focus moves to its heading, and strong haptic feedback fires.

## 7. Use "Citește cu voce tare", "Text mare", and "Contrast ridicat"
1. In **Cont → Accesibilitate**, turn **Mod cititor de ecran** off temporarily (the *"Citește cu voce tare"* button hides when TalkBack is active to avoid double speech; test *"Citește cu voce tare"* with TalkBack off on the 112 stop screen or a report summary).
2. Toggle **Text mare** and **Contrast ridicat** in both **Luminos** and **Întunecat** themes and verify there is no clipped text and map markers show status letters with thick borders.

## 8. Street search on the standard Home & Report maps
1. With **Mod cititor de ecran** off, on **Hartă**, enter a street (e.g. `Stefan cel Mare`) in the search box above the map, tap **Caută**, select a result, and confirm the map moves there.
2. On **Semnalează o problemă → Nu**, use the search box above the form map to jump to a street and confirm the pin is placed there.
