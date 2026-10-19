import { Suspense } from "react"

import { InternalLoginForm } from "@/components/auth/internal-login-form"

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-muted/40" />}>
      <InternalLoginForm />
    </Suspense>
  )
}
