import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { EventMap } from '../map/components/EventMap';
import type { Event } from '../../entities/event/types';
import { eventText, isLive, type CulturalEvent } from './core';
import { useCulture } from './provider';
import { styles } from './ui';

/** Adapter for the existing bundled map renderer, not a second event domain. */
export function CultureMap({ events }: { events: CulturalEvent[] }) {
  const { data, preferences, now } = useCulture();
  const markers = useMemo<Event[]>(() => events.slice(0, 200).flatMap((event) => {
    const place = data?.places.find((item) => item.id === event.place_id);
    if (!place || event.status === 'cancelled') return [];
    const text = eventText(event, preferences.locale);
    const base = { id: event.id, title: text.title, shortDescription: text.summary,
      type: 'altres' as const, category: 'cultural' as const, start: event.starts_at, end: event.ends_at,
      state: isLive(event, now) ? 'now' as const : Date.parse(event.ends_at) <= now.getTime() ? 'finished' as const : 'upcoming' as const,
      locationName: place.name };
    return [event.route ? { ...base, kind: 'mobile' as const, route: event.route } :
      { ...base, kind: 'static' as const, location: { lat: place.latitude, lng: place.longitude } }];
  }), [events, data?.places, preferences.locale, now]);
  return <View style={{ gap: 8 }}><View style={{ height: 360, borderRadius: 16, overflow: 'hidden' }}>
    <EventMap events={markers} onEventPress={(event) => router.push(`/actes/${event.id}`)} />
  </View><Text style={styles.meta}>Fins a 200 actes no cancel·lats. El mapa necessita connexió. Alternativa accessible: llista d’actes.</Text></View>;
}