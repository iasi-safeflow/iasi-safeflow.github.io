import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { Text, TextInput } from '@/components/AppText';
import { Chip, ErrorText, Icon, useStyles } from '@/components/ui';
import { announce } from '@/lib/a11y';
import { api, ApiError } from '@/lib/api';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/themeMode';
import { fonts, radius, TOUCH } from '@/theme';

export type StreetResult = { label: string; lat: number; lon: number };

// Explicit street search via backend Nominatim proxy: never queries while typing (follows OSM Nominatim policy).
export function StreetSearch({
  token,
  onSelect,
  selected,
  compact = true,
  unavailableText = t.streetUnavailableMap,
  style,
}: {
  token?: string | null;
  onSelect: (result: StreetResult) => void;
  selected?: { lat: number; lon: number } | null;
  compact?: boolean;
  unavailableText?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<StreetResult[] | null>(null);
  const [error, setError] = useState('');

  const canSearch = query.trim().length >= 3 && !searching;

  const runSearch = async () => {
    if (!canSearch) return;
    setSearching(true);
    setError('');
    setResults(null);
    try {
      const res = await api<{ available: boolean; results: StreetResult[] }>(
        `/geo/search?q=${encodeURIComponent(query.trim())}`,
        { token },
      );
      if (!res.available) {
        setError(unavailableText);
      } else {
        setResults(res.results);
        announce(res.results.length ? `${res.results.length} rezultate.` : t.streetNoResults);
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) setError(e.detail.message);
      else setError(unavailableText);
    } finally {
      setSearching(false);
    }
  };

  const clear = () => {
    setQuery('');
    setResults(null);
    setError('');
  };

  const pick = (r: StreetResult) => {
    onSelect(r);
    if (compact) setResults(null);
  };

  return (
    <View style={style}>
      <View style={s.row}>
        <View
          style={[
            s.inputWrap,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderWidth: colors.lineWidth,
            },
          ]}
        >
          <Icon name="search" size={18} color={colors.muted} />
          <TextInput
            value={query}
            onChangeText={(v) => {
              setQuery(v);
              if (error) setError('');
            }}
            placeholder={t.streetSearchPlaceholder}
            placeholderTextColor={colors.muted}
            accessibilityLabel={t.streetSearchA11y}
            accessibilityHint={t.streetSearchHint}
            returnKeyType="search"
            onSubmitEditing={runSearch}
            maxLength={100}
            style={[s.input, { color: colors.text }]}
          />
          {(query.length > 0 || results !== null) && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t.streetSearchClear}
              onPress={clear}
              hitSlop={6}
              style={s.clearBtn}
            >
              <Icon name="x" size={18} color={colors.muted} />
            </Pressable>
          )}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.streetSearch}
          accessibilityHint={t.streetSearchHint}
          aria-disabled={!canSearch}
          aria-busy={searching}
          disabled={!canSearch}
          onPress={runSearch}
          style={({ pressed }) => [
            s.searchBtn,
            {
              backgroundColor: colors.primary,
              opacity: !canSearch ? 0.5 : pressed ? 0.85 : 1,
            },
          ]}
        >
          {searching ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={[s.searchBtnText, { color: colors.onPrimary }]}>{t.streetSearch}</Text>
          )}
        </Pressable>
      </View>

      {!compact && <Text style={[styles.muted, { fontSize: 12, marginTop: 4 }]}>{t.streetSearchHint}</Text>}
      <ErrorText>{error}</ErrorText>

      {results !== null && (
        <View
          style={[
            s.resultsBox,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderWidth: colors.lineWidth,
            },
          ]}
        >
          {results.length === 0 ? (
            <View style={s.resultsHeader}>
              <Text style={[styles.muted, { flex: 1 }]}>{t.streetNoResults}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t.streetSearchClose}
                onPress={() => setResults(null)}
                hitSlop={6}
                style={s.closeSmall}
              >
                <Icon name="x" size={18} color={colors.muted} />
              </Pressable>
            </View>
          ) : (
            <>
              <View style={s.resultsHeader}>
                <Text style={[styles.muted, { flex: 1, fontSize: 12 }]}>{t.osmAttribution}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t.streetSearchClose}
                  onPress={() => setResults(null)}
                  hitSlop={6}
                  style={s.closeSmall}
                >
                  <Icon name="x" size={18} color={colors.muted} />
                </Pressable>
              </View>
              {compact ? (
                results.map((r, i) => (
                  <Pressable
                    key={`${r.lat},${r.lon}`}
                    accessibilityRole="button"
                    accessibilityLabel={r.label}
                    onPress={() => pick(r)}
                    style={({ pressed }) => [
                      s.resultItem,
                      i > 0 && { borderTopWidth: 1, borderTopColor: colors.border },
                      { opacity: pressed ? 0.75 : 1 },
                    ]}
                  >
                    <Icon name="map-pin" size={16} color={colors.primary} />
                    <Text style={[styles.body, { flex: 1, fontSize: 15 }]}>{r.label}</Text>
                  </Pressable>
                ))
              ) : (
                <View accessibilityRole="radiogroup" accessibilityLabel={t.streetSearchLabel} style={styles.chips}>
                  {results.map((r) => (
                    <Chip
                      key={`${r.lat},${r.lon}`}
                      label={r.label}
                      selected={!!selected && selected.lat === r.lat && selected.lon === r.lon}
                      onPress={() => pick(r)}
                    />
                  ))}
                </View>
              )}
            </>
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: TOUCH,
    borderRadius: radius.input,
    paddingLeft: 12,
    paddingRight: 4,
  },
  input: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 15,
    paddingVertical: 10,
    minWidth: 0,
  },
  clearBtn: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' },
  searchBtn: {
    minHeight: TOUCH,
    borderRadius: radius.button,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBtnText: { fontFamily: fonts.extrabold, fontSize: 15 },
  resultsBox: { marginTop: 6, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 },
  resultsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  closeSmall: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center', marginRight: -8 },
  resultItem: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: TOUCH, paddingVertical: 8 },
});
