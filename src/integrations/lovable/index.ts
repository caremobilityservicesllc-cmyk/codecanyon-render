// Cloud auth integration module.
// Supports self-hosted builds where @lovable.dev/cloud-auth-js is unavailable.

import { supabase } from "../supabase/client";

type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

let lovableAuth: any = null;

// Dynamically load the Cloud auth SDK — silently skip if unavailable (self-hosted)
const loadCloudAuth = async () => {
  if (lovableAuth) return lovableAuth;
  try {
    const mod = await import(/* @vite-ignore */ "@lovable.dev/cloud-auth-js");
    lovableAuth = mod.createLovableAuth();
    return lovableAuth;
  } catch {
    return null;
  }
};

export const lovable = {
  auth: {
    signInWithOAuth: async (provider: "google" | "apple", opts?: SignInOptions) => {
      const auth = await loadCloudAuth();
      if (!auth) {
        return { error: new Error("Cloud auth SDK is not available in this environment. Use Supabase OAuth directly.") };
      }

      const result = await auth.signInWithOAuth(provider, {
        redirect_uri: opts?.redirect_uri,
        extraParams: {
          ...opts?.extraParams,
        },
      });

      if (result.redirected) {
        return result;
      }

      if (result.error) {
        return result;
      }

      try {
        await supabase.auth.setSession(result.tokens);
      } catch (e) {
        return { error: e instanceof Error ? e : new Error(String(e)) };
      }
      return result;
    },
  },
};
