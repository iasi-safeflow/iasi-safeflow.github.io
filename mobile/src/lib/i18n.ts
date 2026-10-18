// All user-facing text (Romanian). Keys mirror backend/app/domain.py.

export const CATEGORY_LABELS: Record<string, string> = {
  intersectie_periculoasa: 'Intersecție periculoasă / circulație confuză',
  trecere_pietoni_nesigura: 'Trecere de pietoni nesigură / vizibilitate obstrucționată',
  defect_carosabil: 'Defect al carosabilului (groapă, denivelare)',
  banda_blocata: 'Bandă blocată / obstacol / oprire periculoasă',
  semnalizare_lipsa: 'Indicator sau semafor deteriorat ori lipsă',
  iluminat_slab: 'Iluminat slab / vizibilitate redusă',
  coada_recurenta: 'Coadă recurentă semnalată ca problemă de siguranță',
  tipar_near_miss: 'Situații repetate evitate la limită (near-miss)',
  incident_trecut: 'Incident din trecut (fără răniți, neverificat)',
  alta: 'Altele / necesită analiză',
};

export const EMERGENCY_CATEGORY = 'incident_activ';
export const EMERGENCY_CATEGORY_LABEL = 'Incident în desfășurare acum (accident, răniți, pericol)';

export const STATUS_LABELS: Record<string, string> = {
  submitted: 'Primit',
  under_review: 'În analiză',
  validated: 'Validat',
  referred: 'Pregătit pentru sesizare (netrimis)',
  resolved: 'Rezolvat (conform recenzentului)',
  rejected: 'Respins',
  expired: 'Expirat',
};

// Reviewer-facing short labels for the required rejection reason.
export const REJECTION_REASON_LABELS: Record<string, string> = {
  duplicate: 'Duplicat',
  not_road_safety: 'Nu ține de siguranța rutieră',
  insufficient_info: 'Informații insuficiente',
  outside_area: 'În afara zonei Iași',
  abusive_spam: 'Conținut abuziv / spam',
};

// What the reporter sees in "Ale mele": neutral wording. The reviewer's private note is never shown.
export const REJECTION_REASON_TEXT: Record<string, string> = {
  duplicate: 'Duplicat – problema a fost deja semnalată.',
  not_road_safety: 'Nu ține de siguranța rutieră – raportul nu descrie o problemă de siguranță rutieră.',
  insufficient_info: 'Informații insuficiente – descrierea nu a fost suficientă pentru analiză.',
  outside_area: 'În afara zonei Iași – locația nu este în zona acoperită.',
  abusive_spam: 'Conținut abuziv / spam – raportul nu respectă regulile de utilizare.',
};

export const t = {
  appName: 'Iași SafeFlow',
  banner: 'Urgență sau răniți? Sunați la 112. SafeFlow nu este un serviciu de urgență.',
  bannerCall: 'Sună 112',
  emergencyTitle: 'Opriți-vă aici',
  emergencyPastHint:
    'Dacă doriți să semnalați un incident din trecut, fără răniți și fără pericol imediat, puteți trimite separat un raport non-urgent, neverificat.',
  emergencyPastButton: 'Raportez un incident din trecut',
  emergencyBack: 'Înapoi',

  tabMap: 'Hartă',
  tabReport: 'Raportează',
  tabMine: 'Rapoartele mele',
  tabMineShort: 'Ale mele',
  tabReview: 'Recenzie',
  tabAccount: 'Cont',
  tabHistory: 'Istoric AI',

  sourceUserReport: 'Raport utilizator – neverificat',
  sourceSimulated: 'Date simulate',
  reviewerVerified: 'Verificat de un recenzent',
  held: 'În așteptare – va fi publicat după verificare',
  rejectedPrefix: 'Respins',
  mapDisclaimer:
    'Locații aproximative (~100 m). Fiecare punct este o observație a unui utilizator, nu o confirmare oficială.',
  mapLoading: 'Se încarcă rapoartele… Prima încărcare poate dura până la un minut.',
  homeLabel: 'SafeFlow Iași',
  greeting: 'Bună ziua! Ce ați observat azi?',
  reportCtaTitle: 'Semnalează o problemă',
  reportCtaSub: 'durează cam un minut',
  approxZone: 'zonă ~100 m',
  closeCard: 'Închide',
  theme: 'Temă',
  themeAuto: 'Automat',
  themeLight: 'Luminos',
  themeDark: 'Întunecat',

  dangerQuestion: 'Este cineva rănit sau există un pericol imediat chiar acum?',
  yes: 'Da',
  no: 'Nu',
  category: 'Categorie',
  location: 'Locație',
  locationHint: 'Atingeți harta pentru a plasa punctul sau folosiți GPS.',
  useGps: 'Folosește GPS',
  gpsDenied: 'Permisiunea de localizare a fost refuzată. Plasați punctul pe hartă.',
  gpsFailed: 'Nu am putut obține locația GPS. Plasați punctul pe hartă.',
  description: 'Descriere',
  descriptionPlaceholder: 'Ce ați observat? (fără nume, numere de înmatriculare sau date personale)',
  observedAt: 'Când ați observat',
  now: 'Acum',
  pickDate: 'Alege data și ora',
  privacyNote:
    'Descrierea și locația exactă sunt vizibile doar recenzenților autorizați. Pe harta publică apar doar categoria, statusul, data și o locație aproximativă (~100 m). Contul dvs. nu este afișat public.',
  submit: 'Trimite raportul',
  submitting: 'Se trimite…',
  submitted: 'Raport înregistrat',
  submittedBody:
    'Raportul este o observație neverificată și va fi analizat de un recenzent. Nu a fost transmis niciunei autorități.',
  reportId: 'ID raport',
  newReport: 'Raport nou',
  loginToReport: 'Autentificați-vă pentru a trimite un raport non-urgent.',
  sessionEnded:
    'Sesiunea s-a încheiat: sesiunea a expirat sau contul nu mai există pe serverul demo, care se resetează periodic. Ce ați completat rămâne în formular.',

  login: 'Autentificare',
  register: 'Creează cont',
  email: 'E-mail',
  password: 'Parolă (minim 8 caractere)',
  logout: 'Deconectare',
  noAccount: 'Nu aveți cont? Creați unul',
  haveAccount: 'Aveți deja cont? Autentificați-vă',
  roleReporter: 'Raportor',
  roleReviewer: 'Recenzent',

  mineEmpty: 'Nu ați trimis încă niciun raport.',
  lookupTitle: 'Verifică statusul după ID',
  lookup: 'Verifică',
  notFound: 'Raportul nu a fost găsit.',

  queueTitle: 'Coada de recenzie',
  queueEmpty: 'Niciun raport pentru acest filtru.',
  all: 'Toate',
  notes: 'Notă (opțional, vizibilă doar recenzenților)',
  changeStatus: 'Schimbă statusul',
  actValidate: 'Validează',
  actReject: 'Respinge',
  actUnderReview: 'Pune în analiză',
  actReopen: 'Redeschide',
  heldForReview: 'Ascuns de pe harta publică până la decizia unui recenzent.',
  rejectTitle: 'Motivul respingerii',
  rejectHint: 'Raportorul vede doar motivul, în formulare neutră. Nota rămâne privată.',
  rejectNote: 'Notă privată (opțional, vizibilă doar recenzenților)',
  rejectConfirm: 'Respinge raportul',
  cancel: 'Anulează',
  reason: 'Motiv',

  // Review assistant: every result is a suggestion and is labelled as one.
  assistantTitle: 'Analiză automată',
  assistantDisclaimer: 'Sugestie automată – nu este o verificare',
  importance: 'Importanță',
  importanceNote: 'Importanța este o sugestie de prioritizare, nu o dovadă că locul este periculos.',
  why: 'De ce?',
  hideWhy: 'Ascunde detaliile',
  flagsTitle: 'Semnale',
  noFlags: 'Niciun semnal.',
  flagCall112: 'Dacă este o urgență, sunați la 112',
  duplicatesTitle: 'Posibile duplicate',
  noDuplicates: 'Niciun duplicat sugerat.',
  thisReport: 'Acest raport',
  linkDuplicate: 'Leagă ca duplicat',
  notDuplicate: 'Nu e duplicat',
  revokeDuplicate: 'Anulează legătura',
  linkHint: 'Dacă le legați, raportul mai nou ({id}) este respins cu motivul „Duplicat”. Se poate anula.',
  duplicateUnavailable: 'Unul dintre rapoarte este respins; redeschideți-l înainte de a le lega.',
  linkedAsDuplicateOf: 'Legat ca duplicat al raportului',
  linkedDuplicate: 'Duplicat legat de acest raport',
  noAnalysis: 'Nicio analiză automată pentru acest raport.',
  assistantVersion: 'Versiune',
  checkedAt: 'Verificat',
  checksCount: 'verificări',
  sortImportance: 'După importanță',
  heldFilter: 'În așteptare (ascunse)',
  historyIntro:
    'Analiză automată explicabilă (reguli + similaritate de text). Deciziile recenzenților pot fi folosite ulterior pentru a antrena un model.',
  historyEmpty: 'Nicio verificare pentru aceste filtre.',
  reviewerDecision: 'Decizia recenzentului',
  filterFlag: 'Semnal',
  filterImportance: 'Importanță',
  filterDecision: 'Decizie',
  audit: 'Jurnal de audit',
  auditEmpty: 'Nicio acțiune încă.',
  reporterRef: 'Raportor (pseudonim)',
  observed: 'Observat',
  created: 'Trimis',
  gps: 'GPS',
  pin: 'Punct pe hartă',

  networkError: 'Serverul nu poate fi contactat. Verificați conexiunea și adresa API.',
  genericError: 'A apărut o eroare.',
  retry: 'Reîncearcă',
  loading: 'Se încarcă…',

  offline: 'Fără conexiune la internet. Rapoartele și harta au nevoie de internet; apelul la 112 funcționează.',
  installTitle: 'Instalează aplicația',
  installBody: 'Adăugați SafeFlow pe ecranul principal, ca pe o aplicație obișnuită.',
  installPwa: 'Instalează din browser',
  installApk: 'Descarcă aplicația Android (APK)',
  appVersion: 'Versiune aplicație',
};

export const IMPORTANCE_LABELS: Record<string, string> = { high: 'Ridicată', medium: 'Medie', low: 'Scăzută' };

export const DUPLICATE_LEVEL_LABELS: Record<string, string> = {
  probable: 'Probabil duplicat',
  possible: 'Posibil duplicat',
};

export const DUPLICATE_REASON_LABELS: Record<string, string> = {
  similar_text: 'text asemănător',
  very_close: 'la cel mult 50 m',
  same_category: 'aceeași categorie',
};

export const FLAG_LABELS: Record<string, string> = {
  personal_data: 'Date personale',
  abusive: 'Limbaj abuziv',
  vague: 'Descriere vagă',
  not_road_safety: 'Posibil fără legătură rutieră',
  possible_emergency: 'Posibilă urgență – verificați',
};

export const EVIDENCE_KIND_LABELS: Record<string, string> = {
  plate: 'număr de înmatriculare',
  phone: 'telefon',
  email: 'e-mail',
};

export const TRIGGER_LABELS: Record<string, string> = {
  created: 'raport nou',
  nearby_report: 'raport nou în apropiere',
  reviewer_decision: 'după o decizie a recenzentului',
};

export const DECISION_LABELS: Record<string, string> = {
  pending: 'Nicio decizie încă',
  validated: 'Validat',
  rejected: 'Respins',
  status_change: 'Status schimbat',
  duplicate_link: 'Duplicat acceptat',
  not_duplicate: 'Marcat „Nu e duplicat”',
  duplicate_revoke: 'Legătură de duplicat anulată',
};

// One "De ce?" line per importance factor; `detail` comes from backend/app/assistant/priority.py.
export function factorText(code: string, detail: unknown): string {
  switch (code) {
    case 'category':
      return `Categorie: ${CATEGORY_LABELS[String(detail)] ?? String(detail)}`;
    case 'vulnerable_users': {
      const words = Array.isArray(detail) ? detail.map(String) : [];
      return words.length ? `Utilizatori vulnerabili menționați: ${words.join(', ')}` : 'Nu sunt menționați utilizatori vulnerabili';
    }
    case 'corroboration':
      return `Rapoarte similare în apropiere (30 de zile): ${Number(detail)}`;
    case 'recency': {
      const days = Math.round(Number(detail));
      return days < 1 ? 'Observat în ultima zi' : `Observat acum ${days} ${days === 1 ? 'zi' : 'zile'}`;
    }
    case 'location_precision':
      return typeof detail === 'number' ? `Precizie locație: ±${Math.round(detail)} m` : 'Fără precizie GPS (punct pe hartă)';
    case 'description': {
      const d = (detail ?? {}) as { chars?: number; words?: number };
      return `Descriere: ${d.chars ?? 0} caractere, ${d.words ?? 0} cuvinte`;
    }
    default:
      return code;
  }
}

// Source and verification labels: "Date simulate" and/or "Verificat de un recenzent", otherwise
// "Raport utilizator – neverificat". Verified only means a reviewer validated it, never an official confirmation.
export function sourceLabels(simulated: boolean, verification = 'unverified'): string[] {
  const labels = simulated ? [t.sourceSimulated] : [];
  if (verification === 'reviewer_verified') labels.push(t.reviewerVerified);
  else if (!simulated) labels.push(t.sourceUserReport);
  return labels;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
}

// "N observații în jur", with Romanian plural rules (1 observație, 2–19 observații, 20+ de observații).
export function nearbyLabel(n: number): string {
  if (n === 1) return '1 observație în jur';
  const rest = n % 100;
  return n !== 0 && (rest === 0 || rest >= 20) ? `${n} de observații în jur` : `${n} observații în jur`;
}

// The public API gives only the observation date, so this counts whole days in local time.
export function timeAgo(isoDate: string, now = new Date()): string {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((today.getTime() - new Date(y, m - 1, d).getTime()) / 86_400_000);
  if (days <= 0) return 'azi';
  if (days === 1) return 'ieri';
  if (days < 20) return `acum ${days} zile`;
  if (days <= 30) return `acum ${days} de zile`;
  return formatDate(isoDate);
}
