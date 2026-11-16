import React, { useEffect, useState } from 'react';
import { Alert, Linking, ScrollView, Share, Text, View } from 'react-native';
import { Image } from 'expo-image';
import * as Calendar from 'expo-calendar';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { eventText, formatDate, type CulturalEvent, type CultureCatalog } from './core';
import { cultureClient, useCulture } from './provider';
import { Button, Favorite, Status, styles } from './ui';

export default function CultureDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, preferences } = useCulture();
  const [context, setContext] = useState<{ event: CulturalEvent; catalog: CultureCatalog } | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState(false);
  const cached = data?.events.find((item) => item.id === id);
  useEffect(() => {
    const controller = new AbortController();
    setContext(null); setError('');
    if (!cached || attempt) {
      setPending(true);
      void cultureClient.eventContext(id, controller.signal).then((next) => {
        if (!controller.signal.aborted) setContext(next);
      }).catch(() => { if (!controller.signal.aborted) setError('No es pot carregar l’acte. Comprova la connexió.'); })
        .finally(() => { if (!controller.signal.aborted) setPending(false); });
    }
    return () => controller.abort();
  }, [id, cached, attempt]);
  const event = cached ?? (context?.event.id === id ? context.event : null);
  const catalog = cached ? data : context?.catalog;
  if (!event || !catalog) return <SafeAreaView style={styles.screen}><View style={styles.content}>
    <Button title="← Agenda" onPress={() => router.replace('/(culture)')} />
    <Text style={styles.body}>{pending ? 'Carregant l’acte…' : error || 'Acte no disponible.'}</Text>
    <Button title="Reintentar" disabled={pending} onPress={() => setAttempt((value) => value + 1)} />
  </View></SafeAreaView>;
  const text = eventText(event, preferences.locale);
  const place = catalog.places.find((item) => item.id === event.place_id);
  const publicUrl = `${(process.env.EXPO_PUBLIC_CULTURE_API_URL ?? '').replace(/\/$/, '')}/actes/${event.id}`;
  const open = async (url: string) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error();
      await Linking.openURL(url);
    } catch { Alert.alert('Enllaç no disponible', 'Torna-ho a provar més tard.'); }
  };
  return <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}><ScrollView contentContainerStyle={styles.content}>
    <View style={styles.between}><Button title="← Agenda" onPress={() => router.canGoBack() ? router.back() : router.replace('/(culture)')} /><Favorite id={event.id} /></View>
    <Status />
    {event.image_url && <Image source={{ uri: event.image_url }} style={{ width: '100%', height: 230, borderRadius: 16 }} contentFit="cover" accessibilityLabel={text.title} />}
    <Text accessibilityRole="header" style={styles.title}>{text.title}</Text>
    {event.status === 'cancelled' && <Text style={styles.notice}>Cancel·lat · {event.cancellation_reason}</Text>}
    <Text style={styles.body}>{text.summary}</Text>
    <View style={styles.card}>
      <Text style={styles.body}>{formatDate(event.starts_at, catalog.city.timezone, preferences.locale)} — {formatDate(event.ends_at, catalog.city.timezone, preferences.locale)}</Text>
      <Text style={styles.body}>{place?.name} · {place?.address}</Text>
      {event.price && <Text style={styles.body}>Preu · {event.price}</Text>}
      {event.schedule_notes && <Text style={styles.body}>{event.schedule_notes}</Text>}
      {event.accessibility && <Text style={styles.body}>Accessibilitat · {event.accessibility}</Text>}
      {event.organizer && <Text style={styles.body}>Organitza · {event.organizer}</Text>}
    </View>
    <Text style={styles.body}>{text.description}</Text>
    {place && <Button title="Com arribar-hi" onPress={() => void open(`https://www.openstreetmap.org/directions?to=${place.latitude},${place.longitude}`)} />}
    {event.booking_url && <Button title="Reserves i entrades" onPress={() => void open(event.booking_url!)} />}
    <Button title="Compartir" onPress={() => { void Share.share({ title: text.title, message: `${text.title}\n${publicUrl}` }).catch(() => Alert.alert('No es pot compartir ara.')); }} />
    <Button title="Afegir al calendari" disabled={event.status === 'cancelled'} onPress={() => {
      void Calendar.createEventInCalendarAsync({ title: text.title, startDate: new Date(event.starts_at), endDate: new Date(event.ends_at),
        location: place?.name, notes: `${text.summary}\n${publicUrl}` }).catch(() => Alert.alert('Calendari no disponible', 'Comprova que tens una aplicació de calendari instal·lada.'));
    }} />
    <Text style={styles.meta}>Horaris en la zona {catalog.city.timezone}. Consulta els avisos abans de sortir.</Text>
  </ScrollView></SafeAreaView>;
}