import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { EventMap } from '../map/components/EventMap';
import type { Event } from '../../entities/event/types';
import { dayKey, eventText, isLive, type MapBounds, type MapEvent, type MapFilters } from './core';
import { cultureClient, useCulture } from './provider';
import { Button, CityPicker, styles } from './ui';

export function CultureMap() {
  const { preferences, now } = useCulture();
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const [filters, setFilters] = useState<MapFilters>({ cities: [], festivals: [] });
  const [city, setCity] = useState('');
  const [festival, setFestival] = useState('');
  const [day, setDay] = useState('');
  const [events, setEvents] = useState<MapEvent[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  const from = dayKey(now);
  useEffect(() => {
    const request = new AbortController();
    void cultureClient.mapFilters(request.signal).then(setFilters).catch(() => { if (!request.signal.aborted) setError('No es poden carregar els filtres.'); });
    return () => request.abort();
  }, []);
  const load = useCallback(async (offset: number, signal: AbortSignal) => {
    if (!bounds) return;
    setPending(true);
    try {
      const page = await cultureClient.mapEvents({ bounds, from, day, city, festival, offset }, signal);
      if (signal.aborted) return;
      setEvents((previous) => offset ? [...previous, ...page.events.filter((event) => !previous.some((old) => old.id === event.id))] : page.events);
      setNextOffset(page.nextOffset); setLimitReached(Boolean(page.limitReached)); setError('');
    } catch { if (!signal.aborted) setError('No es poden carregar els actes del mapa. Revisa la connexió i la data.'); }
    finally { if (!signal.aborted) setPending(false); }
  }, [bounds, from, day, city, festival]);
  useEffect(() => {
    controller.current?.abort();
    const request = new AbortController(); controller.current = request;
    setEvents([]); setNextOffset(null); setLimitReached(false);
    const timer = setTimeout(() => void load(0, request.signal), 400);
    return () => { clearTimeout(timer); request.abort(); controller.current?.abort(); };
  }, [load]);
  const markers = useMemo<Event[]>(() => events.map((event) => {
    const text = eventText(event, preferences.locale);
    const base = { id: event.id, title: text.title, shortDescription: text.summary,
      type: 'altres' as const, category: 'cultural' as const, start: event.starts_at, end: event.ends_at,
      state: isLive(event, now) ? 'now' as const : Date.parse(event.ends_at) <= now.getTime() ? 'finished' as const : 'upcoming' as const,
      locationName: event.place.name };
    return { ...base, kind: 'static' as const, location: { lat: event.place.latitude, lng: event.place.longitude } };
  }), [events, preferences.locale, now]);
  return <View style={styles.header}>
    <CityPicker cities={filters.cities} selected={city} onSelect={(id) => { setCity(id); setFestival(''); }} />
    <Text style={styles.heading}>Festa</Text><ScrollView horizontal contentContainerStyle={styles.row}>
      <Button title="Totes" selected={!festival} onPress={() => setFestival('')} />
      {filters.festivals.filter((item) => !city || item.city_id === city).map((item) => <Button key={item.id} title={`${item.name} · ${filters.cities.find((c) => c.id === item.city_id)?.name ?? ''}`} selected={festival === item.id} onPress={() => setFestival(item.id)} />)}
    </ScrollView>
    <TextInput style={styles.input} accessibilityLabel="Dia, any mes dia" placeholder="Dia: AAAA-MM-DD (opcional)" value={day} onChangeText={setDay} />
    <View style={{ height: 360, borderRadius: 16, overflow: 'hidden' }}><EventMap multiCity events={markers} onViewportChange={setBounds} onEventPress={(event) => router.push(`/actes/${event.id}`)} /></View>
    <Text style={styles.meta}>Actes de la zona visible, dels propers 90 dies si no tries una data. La zona visible s’envia al servidor.</Text>
    {!!error && <><Text accessibilityLiveRegion="polite" style={styles.meta}>{error}</Text><Button title="Reintentar" onPress={() => { controller.current?.abort(); const request = new AbortController(); controller.current = request; void load(0, request.signal); }} /></>}
    <Text accessibilityLiveRegion="polite" style={styles.meta}>{pending ? 'Carregant actes…' : `${events.length} actes carregats`}</Text>
    {events.map((event) => <Button key={event.id} title={`${eventText(event, preferences.locale).title} · ${event.place.name} · ${event.city.name}${event.status === 'cancelled' ? ' · Cancel·lat' : ''}`} onPress={() => router.push(`/actes/${event.id}`)} />)}
    {nextOffset !== null && <><Text style={styles.meta}>Hi ha més actes en aquesta zona que encara no es mostren al mapa.</Text><Button title="Carregar més actes d’aquesta zona" disabled={pending} onPress={() => { controller.current?.abort(); const request = new AbortController(); controller.current = request; void load(nextOffset, request.signal); }} /></>}
    {limitReached && <Text style={styles.meta}>S’ha arribat al límit de consulta. Acosta el mapa o aplica un filtre.</Text>}
  </View>;
}
