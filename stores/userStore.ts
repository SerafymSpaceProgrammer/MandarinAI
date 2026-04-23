import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
import type { HskLevel, Profile } from "../types";
import { supabase } from "../lib/supabase";

interface UserState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  sessionLoaded: boolean;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  setSessionLoaded: () => void;
  updateHskLevel: (level: HskLevel) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useUserStore = create<UserState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  sessionLoaded: false,

  setSession: (session) =>
    set({ session, user: session?.user ?? null }),

  setProfile: (profile) => set({ profile }),

  setSessionLoaded: () => set({ sessionLoaded: true }),

  updateHskLevel: async (level) => {
    const { user } = get();
    if (!user) return;
    await supabase
      .from("profiles")
      .update({ hsk_level: level })
      .eq("id", user.id);
    set((s) => ({ profile: s.profile ? { ...s.profile, hsk_level: level } : null }));
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null, profile: null });
  },
}));
