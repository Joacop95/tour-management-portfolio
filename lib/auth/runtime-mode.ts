export const isProduction = process.env.NODE_ENV === "production"

export const isDevToolsEnabled =
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS === "true"
