import { useEffect } from "react";
import { Stack } from "expo-router";
import { supabase } from "../lib/supabase";
import { useUserStore } from "../stores/userStore";

export default function RootLayout() {
  const { setSession, setProfile, setSessionLoaded } = useUserStore();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionLoaded();
      if (data.session?.user) {
        supabase
          .from("profiles")
          .select("*")
          .eq("id", data.session.user.id)
          .single()
          .then(({ data: p }) => { if (p) setProfile(p); });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setSessionLoaded();
      if (s?.user) {
        supabase
          .from("profiles")
          .select("*")
          .eq("id", s.user.id)
          .single()
          .then(({ data: p }) => { if (p) setProfile(p); });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="summary" options={{ presentation: "modal" }} />
    </Stack>
  );
}
