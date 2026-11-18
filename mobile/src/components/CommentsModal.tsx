import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';

import { Text } from '@/components/AppText';
import { announce } from '@/lib/a11y';
import { api, ApiError, CommentTag, errorText, PublicComment, PublicReport, UpdatesSummary } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getDeviceId } from '@/lib/deviceId';
import { useHaptics } from '@/lib/feedback';
import { COMMENT_TAG_LABELS, formatDateTime, t } from '@/lib/i18n';
import { needsEmergencyStop } from '@/lib/safety';
import { useTheme } from '@/lib/themeMode';
import { radius } from '@/theme';
import { EmergencyStop } from './EmergencyStop';
import { Button, Card, ErrorText, Field, Heading, Icon, SourceBadge, useStyles } from './ui';
import { fonts, TOUCH } from '@/theme';

const TAG_ORDER: CommentTag[] = ['still_there', 'worse', 'looks_resolved'];

// Structured community updates + moderated comments modal on an open or published public report.
export function CommentsModal({
  report,
  onClose,
  onUpdated,
}: {
  report: PublicReport | null;
  onClose: () => void;
  onUpdated: (publicId: string, summary: UpdatesSummary, approvedCount: number) => void;
}) {
  const { token } = useAuth();
  const { colors } = useTheme();
  const styles = useStyles();
  const haptic = useHaptics();
  const [comments, setComments] = useState<PublicComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [tag, setTag] = useState<CommentTag>('still_there');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [stopped, setStopped] = useState(false);

  useEffect(() => {
    if (!report) return;
    setTag('still_there');
    setBody('');
    setError('');
    setNotice('');
    setStopped(false);
    setLoading(true);
    api<PublicComment[]>(`/public/reports/${report.public_id}/comments`)
      .then(setComments)
      .catch((e) => setError(errorText(e)))
      .finally(() => setLoading(false));
  }, [report?.public_id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!report) return null;

  const canPost = report.status !== 'resolved' && report.status !== 'expired';
  const trimmed = body.trim();
  const bodyTooShort = trimmed.length > 0 && trimmed.length < 5;

  const submit = async () => {
    if (bodyTooShort) {
      setError(t.commentBodyTooShort);
      return;
    }
    if (needsEmergencyStop({ description: trimmed })) {
      setBody('');
      setStopped(true);
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const deviceId = await getDeviceId();
      const res = await api<{
        moderation_status: string;
        updates_summary: UpdatesSummary;
        approved_comments_count: number;
      }>(`/public/reports/${report.public_id}/comments`, {
        method: 'POST',
        token,
        headers: { 'X-Device-Id': deviceId },
        body: { tag, body: trimmed },
      });
      onUpdated(report.public_id, res.updates_summary, res.approved_comments_count);
      setBody('');
      const msg = res.moderation_status === 'pending' ? t.commentPendingNotice : t.commentTagSaved;
      setNotice(msg);
      announce(msg);
      haptic('success');
    } catch (e) {
      if (e instanceof ApiError && e.detail.code === 'call_112') {
        setBody('');
        setStopped(true);
      } else {
        setError(errorText(e));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable accessibilityLabel={t.closeCard} onPress={onClose} style={{ flex: 1, backgroundColor: colors.shadow }} />
        <View
          style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: radius.card,
            borderTopRightRadius: radius.card,
            borderWidth: colors.lineWidth,
            borderColor: colors.border,
            maxHeight: '88%',
            padding: 18,
          }}
        >
          <ScrollView keyboardShouldPersistTaps="handled">
            {stopped ? (
              <EmergencyStop onPastIncident={() => setStopped(false)} onBack={() => setStopped(false)} />
            ) : (
              <>
                <Heading level={2} style={{ marginTop: 0 }}>
                  {t.commentsTitle} · {report.public_id}
                </Heading>

                <View style={[styles.row, { gap: 6, marginBottom: 10 }]}>
                  {TAG_ORDER.map((k) => (
                    <View
                      key={k}
                      style={[
                        styles.badge,
                        {
                          backgroundColor: colors.primarySoft,
                          borderWidth: colors.lineWidth,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.badgeText, { color: colors.primarySoftText }]}>
                        {COMMENT_TAG_LABELS[k]}: {report.updates_summary?.[k] ?? 0}
                      </Text>
                    </View>
                  ))}
                </View>

                {loading ? (
                  <Text style={styles.muted}>{t.loading}</Text>
                ) : comments.length === 0 ? (
                  <Text style={[styles.muted, { marginBottom: 10 }]}>{t.commentsEmpty}</Text>
                ) : (
                  comments.map((c) => (
                    <Card key={c.id} style={{ backgroundColor: colors.bg }}>
                      <View style={[styles.row, { gap: 6 }]}>
                        <View style={[styles.badge, { backgroundColor: colors.primarySoft, marginTop: 0 }]}>
                          <Text style={[styles.badgeText, { color: colors.primarySoftText }]}>
                            {COMMENT_TAG_LABELS[c.tag] ?? c.tag}
                          </Text>
                        </View>
                        <Text style={styles.muted}>{formatDateTime(c.created_at)}</Text>
                      </View>
                      <Text style={[styles.body, { marginTop: 6 }]}>{c.body}</Text>
                      {c.is_simulated && (
                        <View style={styles.row}>
                          <SourceBadge simulated />
                        </View>
                      )}
                    </Card>
                  ))
                )}

                {canPost && (
                  <View style={{ marginTop: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
                    <Text style={styles.label}>{t.commentAddTitle}</Text>
                    <View
                      style={[styles.chips, { gap: 8, marginBottom: 8 }]}
                      accessibilityRole="radiogroup"
                      accessibilityLabel={t.commentAddTitle}
                    >
                      {TAG_ORDER.map((k) => {
                        const selected = tag === k;
                        return (
                          <Pressable
                            key={k}
                            accessibilityRole="radio"
                            accessibilityLabel={COMMENT_TAG_LABELS[k]}
                            aria-checked={selected}
                            onPress={() => setTag(k)}
                            style={({ pressed }) => ({
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 6,
                              minHeight: TOUCH,
                              paddingHorizontal: 14,
                              paddingVertical: 10,
                              borderRadius: radius.button,
                              backgroundColor: selected ? colors.primary : colors.primarySoft,
                              borderWidth: colors.lineWidth,
                              borderColor: selected ? colors.primary : colors.border,
                              opacity: pressed ? 0.85 : 1,
                            })}
                          >
                            {selected && <Icon name="check" size={16} color={colors.onPrimary} />}
                            <Text
                              style={{
                                fontFamily: fonts.extrabold,
                                fontSize: 14,
                                color: selected ? colors.onPrimary : colors.primarySoftText,
                              }}
                            >
                              {COMMENT_TAG_LABELS[k]}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    <Field
                      label={t.commentAddTitle}
                      value={body}
                      onChangeText={(v) => {
                        setBody(v);
                        if (error) setError('');
                      }}
                      placeholder={t.commentPlaceholder}
                      multiline
                      maxLength={300}
                      style={{ minHeight: 72, textAlignVertical: 'top' }}
                    />
                    {notice ? <Text style={[styles.body, { color: colors.primarySoftText, marginBottom: 6 }]}>{notice}</Text> : null}
                    <ErrorText>{error}</ErrorText>
                    <Button title={t.commentSubmit} icon="send" onPress={submit} loading={busy} disabled={busy} />
                  </View>
                )}
                <Button title={t.closeCard} variant="secondary" onPress={onClose} />
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
