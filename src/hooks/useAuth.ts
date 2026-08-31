import { useState, useEffect } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

function passwordResetRedirect() {
  const configured = String(import.meta.env.VITE_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const origin = window.location.origin;
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
  const base = isLocal && configured ? configured : origin;
  return `${base}/reset-password`;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = (email: string, password: string) =>
    supabase.auth.signInWithPassword({ email, password });

  const signUp = (email: string, password: string, name: string) =>
    supabase.auth.signUp({ email, password, options: { data: { name } } });

  const signOut = () => supabase.auth.signOut();

  const resetPasswordForEmail = (email: string) =>
    supabase.auth.resetPasswordForEmail(email, {
      redirectTo: passwordResetRedirect(),
    });

  const updatePassword = (password: string) =>
    supabase.auth.updateUser({ password });

  return { user, session, loading, signIn, signUp, signOut, resetPasswordForEmail, updatePassword };
}
