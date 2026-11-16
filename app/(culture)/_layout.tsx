import React, { useEffect } from 'react';
import { Tabs } from 'expo-router';
import * as QuickActions from 'expo-quick-actions';
import { useQuickActionRouting } from 'expo-quick-actions/router';
import { Platform } from 'react-native';
import { CalendarDays, Heart, Map, Settings, Zap } from 'lucide-react-native';
import { cultureTheme, cultureNavigation } from '../../src/features/culture/core';
import { useCulture } from '../../src/features/culture/provider';

export default function CultureTabs() {
  const { primary } = useCulture();
  useQuickActionRouting();
  useEffect(() => {
    void QuickActions.setItems([
      { id: 'agenda', title: 'Agenda', subtitle: 'Actes culturals', icon: Platform.OS === 'android' ? 'shortcut_agenda' : 'date', params: { href: '/(culture)' } },
      { id: 'ara', title: 'Ara', subtitle: 'Actes en curs', icon: Platform.OS === 'android' ? 'shortcut_ara' : 'time', params: { href: '/(culture)/ara' } },
      { id: 'mapa', title: 'Mapa', subtitle: 'La cultura al mapa', icon: Platform.OS === 'android' ? 'shortcut_mapa' : 'location', params: { href: '/(culture)/mapa' } },
    ]).catch(() => { /* Shortcuts are optional on unsupported launchers. */ });
  }, []);
  const icons = [CalendarDays, Zap, Map, Heart, Settings];
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: primary,
    tabBarInactiveTintColor: cultureTheme.muted, tabBarStyle: { backgroundColor: cultureTheme.surface, borderTopColor: cultureTheme.border },
    tabBarLabelStyle: { fontFamily: 'Inter_600SemiBold', fontSize: 11 } }}>
    {cultureNavigation.map((item, index) => { const Icon = icons[index]; return <Tabs.Screen key={item.path}
      name={index === 0 ? 'index' : item.path.slice(1)} options={{ title: item.title, tabBarIcon: ({ color, size }) => <Icon size={size} color={color} /> }} />; })}
  </Tabs>;
}
