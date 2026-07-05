import { createSessionFromUrl, isAuthCallbackUrl } from '@/lib/auth';
import type { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface AuthStore {
  session: Session | null
  user: User | null
  isLoading: boolean
  isInitialized: boolean

  initialize: () => () => void
  handleDeepLink: (url: string) => Promise<void>
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  session: null,
  user: null,
  isLoading: true,
  isInitialized: false,

  initialize: () => {
    if (get().isInitialized) {
      return () => { }
    }

    set({ isInitialized: true });

    supabase.auth.getSession().then(({ data: { session } }) => {
      set({
        session,
        user: session?.user ?? null,
        isLoading: false
      })
    }

    )

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        set({
          session,
          user: session?.user ?? null,
          isLoading: false,
        })
      }
    );

    return () => subscription.unsubscribe()
  },

  handleDeepLink: async (url) => {
    if (!isAuthCallbackUrl(url)) return;
    await createSessionFromUrl(url);
  },
  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }
}))