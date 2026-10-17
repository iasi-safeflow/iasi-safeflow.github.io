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
  referred: 'Pregătit pentru sesizare (netrimis)',
  resolved: 'Rezolvat (conform recenzentului)',
  rejected: 'Respins',
  expired: 'Expirat',
};

export const STATUS_COLORS: Record<string, string> = {
  submitted: '#1f6feb',
  under_review: '#d29922',
  referred: '#8957e5',
  resolved: '#2da44e',
  rejected: '#6e7781',
  expired: '#6e7781',
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
  tabReview: 'Recenzie',
  tabAccount: 'Cont',

  sourceUserReport: 'Raport utilizator – neverificat',
  sourceSimulated: 'Date simulate',
  mapDisclaimer:
    'Locații aproximative (~100 m). Fiecare punct este o observație a unui utilizator, nu o confirmare oficială.',

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
};

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
}
