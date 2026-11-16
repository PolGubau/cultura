import React, { useMemo, useState } from 'react';
import { Alert, FlatList, Linking, ScrollView, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { eventText, filterEvents, isLive, formatDate, dayKey, type CulturalEvent } from './core';
import { useCulture } from './provider';
import { Button, Favorite, Status, styles } from './ui';
import { CultureMap } from './map';

export type CultureView = 'agenda' | 'now' | 'map' | 'favorites' | 'settings';
const titles: Record<CultureView, string> = { agenda: 'Què fem a Mataró?', now: 'Està passant ara', map: 'La cultura, al mapa', favorites: 'La teva agenda', settings: 'Al teu gust' };
export function CultureScreen({ view }: { view: CultureView }) {
  const { data, festival, preferences, setPreferences, now, pending, refresh } = useCulture();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [day, setDay] = useState('');
  const events = useMemo(() => filterEvents(data?.events ?? [], { festivalId: festival?.id, query, category,
    locale: preferences.locale, favorites: view === 'favorites' ? preferences.favorites : undefined })
    .filter((event) => view === 'now' ? isLive(event, now) : !day ||
      (dayKey(event.starts_at, data?.city.timezone) <= day && dayKey(new Date(Date.parse(event.ends_at) - 1), data?.city.timezone) >= day)),
    [data, festival?.id, query, category, preferences, view, now, day]);
  const days = useMemo(() => [...new Set((data?.events ?? []).map((event) => dayKey(event.starts_at, data?.city.timezone)))], [data]);
  if (view === 'map') return <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}><ScrollView contentContainerStyle={styles.content}><Text accessibilityRole="header" style={styles.title}>{titles.map}</Text><CultureMap /></ScrollView></SafeAreaView>;
  const header = <View style={styles.header}>
    <Text style={styles.brand}>{festival?.name ?? 'Mataró · Cultura'}</Text>
    <Text style={styles.meta}>Tot l’any, a prop teu · {data?.city.name ?? 'Mataró'}</Text>
    <Text accessibilityRole="header" style={styles.title}>{titles[view]}</Text>
    <Text style={styles.body}>{festival?.description || 'Música, cultura popular, exposicions i plans per compartir.'}</Text>
    {festival?.logo_url && <Image source={{ uri: festival.logo_url }} style={{ width: 64, height: 64 }} contentFit="contain" accessibilityLabel={`Logo de ${festival.name}`} />}
    {festival && <Button title="Veure tota la ciutat" onPress={() => setPreferences((previous) => ({ ...previous, mode: 'city' }))} />}
    <Status />
    {data?.announcements.filter((item) => (!item.festival_id || item.festival_id === festival?.id) && Date.parse(item.starts_at) <= now.getTime() && Date.parse(item.ends_at) > now.getTime()).map((item) =>
      <View key={item.id} style={styles.notice} accessibilityLiveRegion="polite"><Text style={styles.heading}>{item.title}</Text><Text style={styles.body}>{item.message}</Text></View>)}
    {view !== 'settings' && <>
      <TextInput style={styles.input} placeholderTextColor="#776C6A" accessibilityLabel="Cerca actes" placeholder="Acte, artista o organització" value={query} onChangeText={setQuery} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        <Button title="Totes" selected={!category} onPress={() => setCategory('')} />
        {data?.categories.map((item) => <Button key={item.id} title={item.name} selected={category === item.id} onPress={() => setCategory(item.id)} />)}
      </ScrollView>
      {view !== 'now' && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        <Button title="Tots els dies" selected={!day} onPress={() => setDay('')} />
        {days.map((item) => <Button key={item} title={item} selected={day === item} onPress={() => setDay(item)} />)}
      </ScrollView>}
      {view === 'now' && <Text style={styles.meta}>Les exposicions es mostren a l’agenda, no com a actes en directe.</Text>}
    </>}
  </View>;
  if (view === 'settings') return <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}><ScrollView contentContainerStyle={styles.content}>
    {header}
    <View style={styles.card}><Text style={styles.heading}>Ciutat o festa</Text>
      {[{ id: 'auto', name: 'Automàtic segons les dates' }, { id: 'city', name: 'Tota l’agenda de Mataró' }, ...(data?.festivals ?? [])].map((item) =>
        <Button key={item.id} title={item.name} selected={preferences.mode === item.id} onPress={() => setPreferences((previous) => ({ ...previous, mode: item.id }))} />)}
    </View>
    <View style={styles.card}><Text style={styles.heading}>Idioma dels actes</Text>
      {(['ca', 'es', 'en'] as const).map((locale, index) => <Button key={locale} title={['Català', 'Castellano', 'English'][index]} selected={preferences.locale === locale} onPress={() => setPreferences((previous) => ({ ...previous, locale }))} />)}
      <Text style={styles.meta}>Si no hi ha traducció, es mostra en català. La interfície és en català.</Text>
    </View>
    <View style={styles.card}><Text style={styles.heading}>Sense connexió</Text><Text style={styles.body}>L’agenda consultada es desa automàticament. Els mapes i les imatges necessiten connexió.</Text>
      <Button title="Actualitzar agenda" onPress={() => void refresh()} disabled={pending} />
      <Button title="Proposa un acte" onPress={() => {
        try {
          const url = new URL('/proposa', process.env.EXPO_PUBLIC_CULTURE_API_URL);
          if (url.protocol !== 'https:' || url.username || url.password) throw new Error();
          void Linking.openURL(url.toString()).catch(() => Alert.alert('Enllaç no disponible', 'Torna-ho a provar més tard.'));
        } catch { Alert.alert('Enllaç no disponible', 'Configura la URL segura de l’agenda.'); }
      }} />
      <Text style={styles.meta}>Iniciativa independent. Encara no és un servei oficial de l’Ajuntament.</Text>
      <Button title="Privacitat" onPress={() => {
        try {
          const url = new URL('/legal/privacitat', process.env.EXPO_PUBLIC_CULTURE_API_URL);
          if (url.protocol !== 'https:' || url.username || url.password) throw new Error();
          void Linking.openURL(url.toString()).catch(() => Alert.alert('Enllaç no disponible', 'Torna-ho a provar més tard.'));
        } catch { Alert.alert('Enllaç no disponible', 'Configura la URL segura de l’agenda.'); }
      }} />
    </View>
  </ScrollView></SafeAreaView>;
  return <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
    <FlatList data={events} keyExtractor={(event) => event.id} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"
      initialNumToRender={12} windowSize={7} refreshing={pending} onRefresh={() => void refresh(data?.from)}
      ListHeaderComponent={header} renderItem={({ item }) => <EventCard event={item} />}
      ListEmptyComponent={<View style={styles.card}><Text style={styles.heading}>{view === 'favorites' ? 'Encara no tens actes desats aquí' : pending ? 'Carregant l’agenda…' : 'No hi ha actes per mostrar'}</Text>
        <Text style={styles.body}>Canvia els filtres o consulta un altre període. No mostrem programació de prova.</Text></View>}
      ListFooterComponent={data && view !== 'now' ? <View style={styles.header}>
        {data.hasMore && <Text style={styles.meta}>Límit de 1.000 actes. Tria un període posterior per consultar-ne més.</Text>}
        <View style={styles.row}><Button title="← Període anterior" disabled={pending} onPress={() => { setDay(''); void refresh(shiftDay(data.from, -90)); }} />
          <Button title="Període següent →" disabled={pending} onPress={() => { setDay(''); void refresh(data.to); }} /></View>
        <Text style={styles.meta}>{data.from} — {data.to} · Actualitzat: {formatDate(data.fetchedAt, data.city.timezone)}</Text>
      </View> : null} />
  </SafeAreaView>;
}
function shiftDay(day: string, count: number) { const value = new Date(`${day}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + count); return value.toISOString().slice(0, 10); }
function EventCard({ event }: { event: CulturalEvent }) {
  const { data, preferences, now } = useCulture();
  const text = eventText(event, preferences.locale);
  return <View style={[styles.card, event.status === 'cancelled' && { borderStyle: 'dashed' }]}>
    <View style={styles.between}><Text style={styles.meta}>{data?.categories.find((category) => category.id === event.category_id)?.name}{isLive(event, now) ? ' · Ara' : event.format === 'exhibition' ? ' · Exposició' : ''}</Text><Favorite id={event.id} /></View>
    <Text style={styles.heading} accessibilityRole="link" onPress={() => router.push(`/actes/${event.id}`)}>{text.title}</Text>
    {event.status === 'cancelled' && <Text style={styles.heading}>Cancel·lat · {event.cancellation_reason}</Text>}
    <Text style={styles.meta}>{formatDate(event.starts_at, data!.city.timezone, preferences.locale)}{event.format === 'exhibition' ? ` — ${formatDate(event.ends_at, data!.city.timezone, preferences.locale)}` : ''}</Text>
    <Text style={styles.body}>{text.summary}</Text>
    <Text style={styles.meta}>{data?.places.find((place) => place.id === event.place_id)?.name}{event.price ? ` · ${event.price}` : ''}</Text>
    <Button title="Veure acte" onPress={() => router.push(`/actes/${event.id}`)} />
  </View>;
}
