import { Redirect, useLocalSearchParams } from 'expo-router';

/** Preserve old shared event links without mounting the archived Supabase client. */
export default function LegacyEventRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <Redirect href={id ? `/actes/${encodeURIComponent(id)}` : '/(culture)'} />;
}