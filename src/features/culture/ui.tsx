import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { cultureTheme as theme, readableForeground } from './core';
import { useCulture } from './provider';

export function Button({ title, onPress, selected = false, disabled = false }: { title: string; onPress: () => void; selected?: boolean; disabled?: boolean }) {
  const { primary } = useCulture();
  return <Pressable accessibilityRole="button" accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress}
    style={[styles.button, selected && { backgroundColor: primary, borderColor: primary }, disabled && { opacity: 0.5 }]}>
    <Text style={[styles.body, selected && { color: readableForeground(primary) }]}>{title}</Text>
  </Pressable>;
}
export function Favorite({ id }: { id: string }) {
  const { preferences, setPreferences, primary } = useCulture();
  const selected = preferences.favorites.includes(id);
  return <Pressable accessibilityRole="button" accessibilityLabel={selected ? 'Treure dels favorits' : 'Desar als favorits'}
    accessibilityState={{ selected }} style={styles.favorite} onPress={() => setPreferences((previous) => ({ ...previous,
      favorites: previous.favorites.includes(id) ? previous.favorites.filter((item) => item !== id) : [...previous.favorites, id] }))}>
    <Text style={{ color: primary, fontSize: 28 }}>{selected ? '♥' : '♡'}</Text>
  </Pressable>;
}
export function Status() {
  const { offline, error, storageError, refresh, pending } = useCulture();
  return <View>
    {(offline || error) && <View style={styles.notice} accessibilityLiveRegion="polite">
      <Text style={styles.body}>{error || 'Sense connexió: dades guardades. Els horaris poden haver canviat.'}</Text>
      <Button title="Reintentar" onPress={() => void refresh()} disabled={pending} />
    </View>}
    {storageError && <Text style={styles.notice}>No es poden desar les dades al dispositiu.</Text>}
  </View>;
}
export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.background },
  content: { padding: 20, paddingBottom: 40, gap: 16, width: '100%', maxWidth: 800, alignSelf: 'center' },
  header: { marginBottom: 12, gap: 8 },
  brand: { fontFamily: 'Inter_700Bold', color: theme.text, fontSize: 20 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 30, color: theme.text, lineHeight: 36 },
  heading: { fontFamily: 'Inter_700Bold', fontSize: 19, color: theme.text, lineHeight: 26 },
  body: { fontFamily: 'Inter_400Regular', fontSize: 16, color: theme.text, lineHeight: 24 },
  meta: { fontFamily: 'Inter_400Regular', color: theme.muted, fontSize: 13, lineHeight: 20 },
  card: { padding: 18, backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1, borderRadius: 16, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  button: { minHeight: 46, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderColor: theme.border, borderWidth: 1, backgroundColor: theme.surface, justifyContent: 'center' },
  favorite: { minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center' },
  input: { fontFamily: 'Inter_400Regular', minHeight: 48, padding: 12, borderWidth: 1, borderColor: theme.border, borderRadius: 12, fontSize: 16, color: theme.text, backgroundColor: theme.surface },
  notice: { backgroundColor: theme.surface, padding: 16, borderLeftWidth: 4, borderLeftColor: theme.primary, marginVertical: 10, gap: 10 },
});