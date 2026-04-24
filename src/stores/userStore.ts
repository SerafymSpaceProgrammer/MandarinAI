import type { Session } from "@supabase/supabase-js";
import { create } from "zustand";

import { fetchOrCreateProfile, supabase } from "@/api";
import type { Profile } from "@/types";
import { logger } from "@/lib/logger";

type UserState = {
  /** true while we boot and read the persisted session from AsyncStorage. */
  initializing: boolean;
  session: Session | null;
  profile: Profile | null;

  /** Called once from the root layout. Safe to call multiple times. */
  bootstrap: () => Promise<void>;
  setProfile: (profile: Profile | null) => void;
  refreshProfile: () => Promise<void>;
};

let bootstrapped = false;

export const useUserStore = create<UserState>((set, get) => ({
  initializing: true,
  session: null,
  profile: null,

  bootstrap: async () => {
    if (bootstrapped) return;
    bootstrapped = true;

    const { data, error } = await supabase.auth.getSession();
    if (error) logger.warn("getSession error", error.message);

    const session = data.session ?? null;
    const profile = session ? await fetchOrCreateProfile(session.user.id) : null;
    set({ session, profile, initializing: false });

    supabase.auth.onAuthStateChange(async (event, nextSession) => {
      logger.debug("auth event", event);

      if (!nextSession) {
        set({ session: null, profile: null });
        return;
      }

      // Only re-fetch the profile on sign-in or when the user changes.
      const prev = get().session;
      const userChanged = prev?.user.id !== nextSession.user.id;
      const needsProfile = !get().profile || userChanged;

      set({ session: nextSession });

      if (needsProfile) {
        const profile = await fetchOrCreateProfile(nextSession.user.id);
        set({ profile });
      }
    });
  },

  setProfile: (profile) => set({ profile }),

  refreshProfile: async () => {
    const session = get().session;
    if (!session) return;
    const profile = await fetchOrCreateProfile(session.user.id);
    set({ profile });
  },
}));

// Handy selectors.
export const selectIsAuthenticated = (s: UserState) => !!s.session;
export const selectNeedsOnboarding = (s: UserState) =>
  !!s.session && !!s.profile && !s.profile.onboarding_completed;
