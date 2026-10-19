export type WhatsAppContact =
  | { available: true; digits: string; url: string }
  | { available: false; reason: "missing" | "international-required" }

export function getWhatsAppContact(phone: string | null | undefined): WhatsAppContact {
  const value = phone?.trim() ?? ""

  if (!value) return { available: false, reason: "missing" }

  if (!/^\+?[0-9\s().-]+$/.test(value)) {
    return { available: false, reason: "international-required" }
  }

  const storedDigits = value.replace(/[^0-9]/g, "")
  const digits = value.startsWith("00") ? storedDigits.slice(2) : storedDigits

  if (!digits || digits.startsWith("0")) {
    return { available: false, reason: "international-required" }
  }

  return {
    available: true,
    digits,
    url: `https://wa.me/${digits}`,
  }
}
