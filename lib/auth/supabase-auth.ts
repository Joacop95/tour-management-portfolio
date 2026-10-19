import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js"

import { getSupabaseBrowserClient } from "@/lib/supabase/client"

export type SupabaseAuthStateChangeHandler = (
  event: AuthChangeEvent,
  session: Session | null
) => void

export type SupabasePasswordSignInResult = {
  success: boolean
  error: string | null
  session: Session | null
  user: User | null
}

export type SupabasePasswordSignUpResult = SupabasePasswordSignInResult

export type SupabaseAuthActionResult = {
  success: boolean
  error: string | null
}

export type SupabaseAuthErrorKind =
  | "existing_account"
  | "unauthorized"
  | "invalid_credentials"
  | "generic"

type SupabasePasswordSignUpOptions = {
  emailRedirectPath?: string
  signupIntent?: "guide" | "internal"
}

const signInTimeoutMessage =
  "Sign-in timed out. Check that Supabase local is running and the auth user exists."
const signUpTimeoutMessage =
  "Registration timed out. Check that Supabase local is running and try again."

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === "string") {
    return error
  }

  return "Unexpected Supabase Auth error."
}

export function classifySupabaseAuthError(
  error: string | null
): SupabaseAuthErrorKind {
  const normalizedError = error?.toLowerCase() ?? ""

  if (
    normalizedError.includes("already registered") ||
    normalizedError.includes("already exists") ||
    normalizedError.includes("user already")
  ) {
    return "existing_account"
  }

  if (
    normalizedError.includes("not authorized for this application") ||
    normalizedError.includes("forbidden") ||
    normalizedError.includes("status 403")
  ) {
    return "unauthorized"
  }

  if (
    normalizedError.includes("invalid login credentials") ||
    normalizedError.includes("invalid credentials")
  ) {
    return "invalid_credentials"
  }

  return "generic"
}

export function isLikelyExistingSupabaseAccount(user: User | null) {
  return Boolean(user && user.identities?.length === 0)
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage = signInTimeoutMessage
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error(timeoutMessage))
    }, timeoutMs)

    promise
      .then((value) => {
        window.clearTimeout(timeoutId)
        resolve(value)
      })
      .catch((error) => {
        window.clearTimeout(timeoutId)
        reject(error)
      })
  })
}

export function getBrowserAuthRedirectUrl(path: string) {
  if (
    typeof window === "undefined" ||
    !path.startsWith("/") ||
    path.startsWith("//")
  ) {
    return null
  }

  return new URL(path, window.location.origin).toString()
}

export async function getCurrentSupabaseSession(): Promise<Session | null> {
  const supabase = getSupabaseBrowserClient()

  if (!supabase) {
    return null
  }

  const { data, error } = await supabase.auth.getSession()

  if (error) {
    return null
  }

  return data.session
}

export async function getCurrentSupabaseUser(): Promise<User | null> {
  const supabase = getSupabaseBrowserClient()

  if (!supabase) {
    return null
  }

  const { data, error } = await supabase.auth.getUser()

  if (error) {
    return null
  }

  return data.user
}

export function onSupabaseAuthStateChange(
  handler: SupabaseAuthStateChangeHandler
) {
  const supabase = getSupabaseBrowserClient()

  if (!supabase) {
    return () => {}
  }

  const { data } = supabase.auth.onAuthStateChange(handler)

  return () => {
    data.subscription.unsubscribe()
  }
}

export async function signInSupabaseUserWithPassword(
  email: string,
  password: string
): Promise<SupabasePasswordSignInResult> {
  const supabase = getSupabaseBrowserClient()

  if (!supabase) {
    return {
      success: false,
      error: "Supabase environment variables are not configured.",
      session: null,
      user: null,
    }
  }

  try {
    const { data, error } = await withTimeout(
      supabase.auth.signInWithPassword({
        email,
        password,
      }),
      15000
    )

    if (error) {
      return {
        success: false,
        error: error.message,
        session: null,
        user: null,
      }
    }

    return {
      success: true,
      error: null,
      session: data.session,
      user: data.user,
    }
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error),
      session: null,
      user: null,
    }
  }
}

export async function signUpSupabaseUserWithPassword(
  email: string,
  password: string,
  options: SupabasePasswordSignUpOptions = {}
): Promise<SupabasePasswordSignUpResult> {
  const supabase = getSupabaseBrowserClient()

  if (!supabase) {
    return {
      success: false,
      error: "Supabase environment variables are not configured.",
      session: null,
      user: null,
    }
  }

  try {
    const emailRedirectTo = options.emailRedirectPath
      ? getBrowserAuthRedirectUrl(options.emailRedirectPath)
      : null
    const { data, error } = await withTimeout(
      supabase.auth.signUp({
        email,
        password,
        options: {
          ...(emailRedirectTo ? { emailRedirectTo } : {}),
          ...(options.signupIntent
            ? { data: { signup_intent: options.signupIntent } }
            : {}),
        },
      }),
      15000,
      signUpTimeoutMessage
    )

    if (error) {
      return {
        success: false,
        error: error.message,
        session: null,
        user: null,
      }
    }

    return {
      success: true,
      error: null,
      session: data.session,
      user: data.user,
    }
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error),
      session: null,
      user: null,
    }
  }
}

export async function resendSupabaseSignupConfirmation(
  email: string
): Promise<SupabaseAuthActionResult> {
  const supabase = getSupabaseBrowserClient()
  const emailRedirectTo = getBrowserAuthRedirectUrl("/guide/login")

  if (!supabase || !emailRedirectTo) {
    return {
      success: false,
      error: "Supabase Auth is unavailable.",
    }
  }

  try {
    const { error } = await withTimeout(
      supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo },
      }),
      15000,
      "Confirmation email request timed out. Please try again."
    )

    return {
      success: !error,
      error: error?.message ?? null,
    }
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error),
    }
  }
}

export async function requestSupabasePasswordReset(
  email: string
): Promise<SupabaseAuthActionResult> {
  const supabase = getSupabaseBrowserClient()

  const redirectTo = getBrowserAuthRedirectUrl("/reset-password")

  if (!supabase || !redirectTo) {
    return {
      success: false,
      error: "Supabase Auth is unavailable.",
    }
  }

  try {
    const { error } = await withTimeout(
      supabase.auth.resetPasswordForEmail(email, { redirectTo }),
      15000,
      "Password reset request timed out. Please try again."
    )

    return {
      success: !error,
      error: error?.message ?? null,
    }
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error),
    }
  }
}

export async function updateSupabaseUserPassword(
  password: string
): Promise<SupabaseAuthActionResult> {
  const supabase = getSupabaseBrowserClient()

  if (!supabase) {
    return {
      success: false,
      error: "Supabase environment variables are not configured.",
    }
  }

  try {
    const { error } = await withTimeout(
      supabase.auth.updateUser({ password }),
      15000,
      "Password update timed out. Please try again."
    )

    return {
      success: !error,
      error: error?.message ?? null,
    }
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error),
    }
  }
}

export async function signOutSupabaseUser(): Promise<{ error: string | null }> {
  const supabase = getSupabaseBrowserClient()

  if (!supabase) {
    return {
      error: "Supabase environment variables are not configured.",
    }
  }

  const { error } = await supabase.auth.signOut()

  return {
    error: error?.message ?? null,
  }
}
