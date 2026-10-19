import { notFound } from "next/navigation"

import { isDevToolsEnabled } from "@/lib/auth/runtime-mode"

export default function DevLayout({ children }: { children: React.ReactNode }) {
  if (!isDevToolsEnabled) notFound()

  return children
}
