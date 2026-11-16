import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { createCultureClient, dayKey, resolveFestival, cultureTheme, mergeCatalogPages, type CultureCatalog, type Locale } from './core';

// This is a public URL, never a database credential. No legacy Supabase fallback.
const apiUrl = process.env.EXPO_PUBLIC_CULTURE_API_URL ?? '';
export const cultureClient = createCultureClient(apiUrl);
const CACHE = 'culture:catalog:v2';
const PREFS = 'culture:preferences:v1';
type Preferences = { mode: string; locale: Locale; favorites: string[] };
const defaults: Preferences = { mode: 'auto', locale: 'ca', favorites: [] };

function useCultureState() {
  const [data, setData] = useState<CultureCatalog | null>(null);
  const [preferences, setPreferences] = useState(defaults);
  const [pending, setPending] = useState(true);
  const [pagingPaused, setPagingPaused] = useState(false);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState('');
  const [storageError, setStorageError] = useState(false);
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(new Date());
  const lastAttempt = useRef(0);
  const currentFrom = useRef<string | undefined>(undefined);
  const currentCity = useRef('');
  const resultCity = useRef('');
  const loadedExtraPages = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const preferenceWrites = useRef(Promise.resolve());

  const refresh = useCallback(async (from?: string, city?: string) => {
    if (from) currentFrom.current = from;
    if (city !== undefined) currentCity.current = city;
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    lastAttempt.current = Date.now();
    setPending(true);
    try {
      if (!apiUrl) throw new Error('Configura EXPO_PUBLIC_CULTURE_API_URL per connectar l’agenda.');
      const result = await cultureClient.catalog(currentFrom.current, request.signal, currentCity.current);
      if (request.signal.aborted) return;
      loadedExtraPages.current = false;
      setPagingPaused(false);
      resultCity.current = result.data.selectedCity ?? '';
      setData(result.data); setOffline(result.offline); setError('');
      await AsyncStorage.setItem(CACHE, JSON.stringify(result.data)).catch(() => setStorageError(true));
    } catch (cause) {
      if (!request.signal.aborted) {
        currentCity.current = resultCity.current;
        setOffline(true);
        setError(cause instanceof Error ? cause.message : 'No es pot actualitzar.');
      }
    } finally {
      if (!request.signal.aborted) setPending(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!data || data.nextOffset == null || pending) return;
    controller.current?.abort();
    const request = new AbortController(); controller.current = request; setPending(true);
    try {
      const page = await cultureClient.catalog(data.from, request.signal, data.selectedCity, data.nextOffset);
      if (request.signal.aborted) return;
      loadedExtraPages.current = true;
      setPagingPaused(true);
      const merged = mergeCatalogPages(data, page.data);
      setData(merged); setOffline(page.offline); setError('');
      await AsyncStorage.setItem(CACHE, JSON.stringify(merged)).catch(() => setStorageError(true));
    } catch (cause) {
      if (!request.signal.aborted) setError(cause instanceof Error ? cause.message : 'No es poden carregar més actes.');
    } finally { if (!request.signal.aborted) setPending(false); }
  }, [data, pending]);

  useEffect(() => {
    let mounted = true;
    void Promise.all([AsyncStorage.getItem(CACHE), AsyncStorage.getItem(PREFS)]).then(([cached, saved]) => {
      if (!mounted) return;
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as CultureCatalog;
          if (parsed.city?.id && Array.isArray(parsed.events) && Array.isArray(parsed.places)) {
            currentCity.current = parsed.selectedCity ?? ''; resultCity.current = currentCity.current;
            setData(parsed); setOffline(true); setPending(false);
          }
        } catch { setStorageError(true); }
      }
      if (saved) {
        try {
          const value = JSON.parse(saved);
          setPreferences({ mode: typeof value.mode === 'string' ? value.mode : 'auto',
            locale: ['ca', 'es', 'en'].includes(value.locale) ? value.locale : 'ca',
            favorites: Array.isArray(value.favorites) ? value.favorites.filter((id: unknown) => typeof id === 'string') : [] });
        } catch { setStorageError(true); }
      }
    }).catch(() => { if (mounted) setStorageError(true); }).finally(() => {
      if (mounted) { setReady(true); void refresh(); }
    });
    return () => { mounted = false; controller.current?.abort(); };
  }, [refresh]);

  useEffect(() => {
    if (!ready) return;
    preferenceWrites.current = preferenceWrites.current.then(() => AsyncStorage.setItem(PREFS, JSON.stringify(preferences))).catch(() => setStorageError(true));
  }, [preferences, ready]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        if (AppState.currentState === 'active' && !loadedExtraPages.current && Date.now() - lastAttempt.current >= 60_000) await refresh();
        schedule();
      }, 60_000 + Math.random() * 15_000);
    };
    schedule();
    const clock = setInterval(() => { if (AppState.currentState === 'active') setNow(new Date()); }, 30_000);
    const subscription = AppState.addEventListener('change', schedule);
    return () => { clearTimeout(timer); clearInterval(clock); subscription.remove(); };
  }, [refresh]);

  const festival = preferences.mode === 'auto' && data?.selectedCity === '' ? null : resolveFestival(data?.festivals ?? [], preferences.mode, dayKey(now, data?.city.timezone));
  const primary = festival?.primary_color ?? cultureTheme.primary;
  return { data, preferences, setPreferences, pending, offline, error, storageError, now, festival, primary, refresh, loadMore, pagingPaused };
}
const Context = createContext<ReturnType<typeof useCultureState> | null>(null);
export function CultureProvider({ children }: { children: React.ReactNode }) {
  const value = useCultureState();
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useCulture() {
  const value = useContext(Context);
  if (!value) throw new Error('CultureProvider is required');
  return value;
}
