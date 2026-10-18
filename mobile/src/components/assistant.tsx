import { ReactNode, useState } from 'react';
import { Pressable, Text, TextStyle, View } from 'react-native';

import { AssistantAnalysis, AssistantFlag, Evidence, Factor, ReviewReport } from '@/lib/api';
import {
  CATEGORY_LABELS,
  DUPLICATE_LEVEL_LABELS,
  DUPLICATE_REASON_LABELS,
  EVIDENCE_KIND_LABELS,
  factorText,
  FLAG_LABELS,
  formatDateTime,
  IMPORTANCE_LABELS,
  t,
  TRIGGER_LABELS,
} from '@/lib/i18n';
import { useTheme } from '@/lib/themeMode';
import { fonts, radius } from '@/theme';
import { Button, Icon, IconName, StatusBadge, useStyles } from './ui';

// Everything here shows review-assistant output: suggestions for a human reviewer, never a verification.

export const FLAG_ICONS: Record<string, IconName> = {
  personal_data: 'user-x',
  abusive: 'slash',
  vague: 'help-circle',
  not_road_safety: 'minus-circle',
  possible_emergency: 'alert-triangle',
};

function Pill({ label, bg, fg, icon }: { label: string; bg: string; fg: string; icon?: IconName }) {
  const styles = useStyles();
  return (
    <View style={[styles.badge, { backgroundColor: bg, flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
      {icon && <Icon name={icon} size={13} color={fg} />}
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function ImportancePill({ level, score }: { level: string; score?: number }) {
  const { colors } = useTheme();
  const soft =
    level === 'high' ? colors.statusSoft.under_review : level === 'medium' ? colors.statusSoft.submitted : colors.statusSoft.rejected;
  const label = `${t.importance}: ${IMPORTANCE_LABELS[level] ?? level}${score !== undefined ? ` · ${score}/100` : ''}`;
  return <Pill label={label} bg={soft.bg} fg={soft.text} icon="bar-chart-2" />;
}

export function DuplicatePill({ level }: { level: string }) {
  const { colors } = useTheme();
  const soft = colors.statusSoft.referred;
  return <Pill label={DUPLICATE_LEVEL_LABELS[level] ?? level} bg={soft.bg} fg={soft.text} icon="copy" />;
}

export function FlagPill({ code }: { code: string }) {
  const { colors } = useTheme();
  const emergency = code === 'possible_emergency';
  return (
    <Pill
      label={FLAG_LABELS[code] ?? code}
      bg={emergency ? colors.alertBg : colors.primarySoft}
      fg={emergency ? colors.alertText : colors.primarySoftText}
      icon={FLAG_ICONS[code] ?? 'flag'}
    />
  );
}

export function SuggestionLabel() {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.badge, styles.badgeOutline, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
      <Icon name="cpu" size={13} color={colors.muted} />
      <Text style={[styles.badgeText, styles.mutedColor]}>{t.assistantDisclaimer}</Text>
    </View>
  );
}

// "De ce?": each factor with its points, behind a toggle.
export function WhyToggle({ factors }: { factors: Factor[] }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        hitSlop={8}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36 }}
      >
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.primarySoftText} />
        <Text style={{ fontFamily: fonts.extrabold, fontSize: 14, color: colors.primarySoftText }}>{open ? t.hideWhy : t.why}</Text>
      </Pressable>
      {open &&
        factors.map((f) => (
          <View key={f.code} style={{ flexDirection: 'row', gap: 10, paddingVertical: 3 }}>
            <Text style={{ fontFamily: fonts.extrabold, fontSize: 14, color: colors.text, width: 38, textAlign: 'right' }}>
              +{f.points}
            </Text>
            <Text style={[styles.muted, { flex: 1 }]}>{factorText(f.code, f.detail)}</Text>
          </View>
        ))}
    </View>
  );
}

// Plain text with the given character ranges highlighted (user text is never parsed as markup).
export function HighlightedText({ text, ranges, style }: { text: string; ranges: Evidence[]; style: TextStyle }) {
  const { colors } = useTheme();
  const mark = { backgroundColor: colors.statusSoft.under_review.bg, color: colors.statusSoft.under_review.text, fontFamily: fonts.extrabold };
  const sorted = [...ranges].filter((r) => r.end > r.start).sort((a, b) => a.start - b.start);
  const parts: ReactNode[] = [];
  let at = 0;
  sorted.forEach((r, i) => {
    if (r.start < at) return; // overlapping match: already highlighted
    if (r.start > at) parts.push(text.slice(at, r.start));
    parts.push(
      <Text key={i} style={mark}>
        {text.slice(r.start, r.end)}
      </Text>,
    );
    at = r.end;
  });
  if (at < text.length) parts.push(text.slice(at));
  return (
    <Text style={style} selectable>
      {parts}
    </Text>
  );
}

export function evidenceRanges(flags: AssistantFlag[]): Evidence[] {
  return flags.flatMap((f) => f.evidence);
}

function FlagRow({ flag }: { flag: AssistantFlag }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={{ paddingVertical: 6 }}>
      <FlagPill code={flag.code} />
      {flag.evidence.length > 0 && (
        <View style={[styles.row, { gap: 6, marginTop: 4 }]}>
          {flag.evidence.map((e, i) => (
            <Text
              key={i}
              style={{
                fontFamily: fonts.extrabold,
                fontSize: 13,
                backgroundColor: colors.statusSoft.under_review.bg,
                color: colors.statusSoft.under_review.text,
                borderRadius: 6,
                paddingHorizontal: 6,
                paddingVertical: 2,
              }}
            >
              {e.text}
              {e.kind ? ` (${EVIDENCE_KIND_LABELS[e.kind] ?? e.kind})` : ''}
            </Text>
          ))}
        </View>
      )}
      {flag.detail && flag.code !== 'possible_emergency' && <Text style={[styles.muted, { marginTop: 4 }]}>{flag.detail}</Text>}
      {flag.code === 'possible_emergency' && (
        <View style={[styles.row, { gap: 6, marginTop: 6 }]}>
          <Icon name="phone" size={16} color={colors.alertText} />
          <Text style={{ fontFamily: fonts.extrabold, fontSize: 14, color: colors.alertText, flex: 1 }}>{t.flagCall112}</Text>
        </View>
      )}
    </View>
  );
}

function SideCard({ title, category, description, observedAt, status }: {
  title: string;
  category: string;
  description: string;
  observedAt: string;
  status: string;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 10, backgroundColor: colors.bg }}>
      <Text style={[styles.label, { fontSize: 13 }]}>{title}</Text>
      <StatusBadge status={status} />
      <Text style={[styles.muted, { fontFamily: fonts.bold, color: colors.text, marginTop: 6 }]} numberOfLines={2}>
        {CATEGORY_LABELS[category] ?? category}
      </Text>
      <Text style={[styles.muted, { fontSize: 13, lineHeight: 18 }]} numberOfLines={5} selectable>
        {description}
      </Text>
      <Text style={[styles.muted, { fontSize: 12, marginTop: 4 }]}>{formatDateTime(observedAt)}</Text>
    </View>
  );
}

export function AssistantPanel({
  analysis,
  report,
  busy,
  onDecide,
}: {
  analysis: AssistantAnalysis | null;
  report: ReviewReport;
  busy: string | null;
  onDecide: (otherId: string, action: 'link' | 'not_duplicate' | 'revoke') => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const run = analysis?.latest;
  return (
    <View
      style={[styles.card, { borderColor: colors.primarySoft, borderWidth: 2, borderRadius: radius.card }]}
      accessibilityLabel={`${t.assistantTitle}. ${t.assistantDisclaimer}`}
    >
      <View style={[styles.row, { gap: 8 }]}>
        <Icon name="cpu" size={22} color={colors.primarySoftText} />
        <Text style={[styles.h2, { marginTop: 0, marginBottom: 0, flex: 1 }]}>{t.assistantTitle}</Text>
      </View>
      <SuggestionLabel />

      {!run ? (
        <Text style={[styles.muted, { marginTop: 10 }]}>{t.noAnalysis}</Text>
      ) : (
        <>
          <View style={{ marginTop: 12 }}>
            <ImportancePill level={run.importance.level} score={run.importance.score} />
            <WhyToggle factors={run.importance.factors} />
            <Text style={[styles.muted, { fontSize: 12 }]}>{t.importanceNote}</Text>
          </View>

          <Text style={[styles.label, { marginTop: 14 }]}>{t.flagsTitle}</Text>
          {run.flags.length === 0 ? <Text style={styles.muted}>{t.noFlags}</Text> : run.flags.map((f) => <FlagRow key={f.code} flag={f} />)}

          <Text style={[styles.label, { marginTop: 14 }]}>{t.duplicatesTitle}</Text>
          {run.duplicates.length === 0 && run.confirmed_links.length === 0 && <Text style={styles.muted}>{t.noDuplicates}</Text>}
          {run.duplicates.map((d) => {
            const newer = d.report.created_at > report.created_at ? d.public_id : report.public_id;
            return (
              <View key={d.public_id} style={{ marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
                <View style={[styles.row, { gap: 4 }]}>
                  <DuplicatePill level={d.level} />
                  <Text style={styles.muted}>
                    {Math.round(d.score * 100)}% · {d.distance_m} m
                  </Text>
                </View>
                {d.reasons.length > 0 && (
                  <Text style={[styles.muted, { fontSize: 13, marginTop: 2 }]}>
                    {d.reasons.map((r) => DUPLICATE_REASON_LABELS[r] ?? r).join(' · ')}
                  </Text>
                )}
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <SideCard
                    title={`${t.thisReport} · ${report.public_id}`}
                    category={report.category}
                    description={report.description}
                    observedAt={report.observed_at}
                    status={report.status}
                  />
                  <SideCard
                    title={d.public_id}
                    category={d.report.category}
                    description={d.report.description}
                    observedAt={d.report.observed_at}
                    status={d.report.status}
                  />
                </View>
                {report.status === 'rejected' || d.report.status === 'rejected' ? (
                  // A stored suggestion can predate a rejection; linking then needs a reopen first.
                  <Text style={[styles.muted, { fontSize: 12, marginTop: 6 }]}>{t.duplicateUnavailable}</Text>
                ) : (
                  <>
                    <Text style={[styles.muted, { fontSize: 12, marginTop: 6 }]}>{t.linkHint.replace('{id}', newer)}</Text>
                    <Button
                      title={t.linkDuplicate}
                      icon="link"
                      variant="secondary"
                      onPress={() => onDecide(d.public_id, 'link')}
                      loading={busy === `link:${d.public_id}`}
                      disabled={!!busy}
                    />
                    <Button
                      title={t.notDuplicate}
                      icon="x"
                      variant="secondary"
                      onPress={() => onDecide(d.public_id, 'not_duplicate')}
                      loading={busy === `not_duplicate:${d.public_id}`}
                      disabled={!!busy}
                    />
                  </>
                )}
              </View>
            );
          })}
          {run.confirmed_links.map((l) => (
            <View key={l.public_id} style={{ marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
              <Text style={styles.body}>
                {l.role === 'original' ? `${t.linkedAsDuplicateOf} ${l.public_id}` : `${t.linkedDuplicate}: ${l.public_id}`}
              </Text>
              <Button
                title={t.revokeDuplicate}
                icon="rotate-ccw"
                variant="secondary"
                onPress={() => onDecide(l.public_id, 'revoke')}
                loading={busy === `revoke:${l.public_id}`}
                disabled={!!busy}
              />
            </View>
          ))}

          <Text style={[styles.muted, { fontSize: 12, marginTop: 14 }]}>
            {t.assistantVersion}: {run.assistant_version} · {t.checkedAt}: {formatDateTime(run.created_at)} (
            {TRIGGER_LABELS[run.triggered_by] ?? run.triggered_by}) · {analysis?.checks} {t.checksCount}
          </Text>
        </>
      )}
    </View>
  );
}
