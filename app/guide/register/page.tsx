import { Suspense } from "react"

import { GuideAuthForm } from "@/components/guide-portal/guide-auth-form"

export default function GuideRegisterPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-muted/40" />}>
      <GuideAuthForm mode="register" />
    </Suspense>
  )
}
