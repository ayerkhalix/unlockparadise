export function backendConfigured() {
  const mode = process.env.UPD_DATA_MODE;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (mode && !["fixtures", "supabase"].includes(mode))
    throw new Error("Invalid UPD_DATA_MODE");
  if (mode === "fixtures") {
    if (process.env.NODE_ENV === "production")
      throw new Error("Production requires Supabase configuration");
    return false;
  }
  if (url && key) {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.hostname !== "127.0.0.1" && parsed.hostname !== "localhost")
      throw new Error("Invalid Supabase URL");
    return true;
  }
  if (url || key || mode === "supabase" || process.env.NODE_ENV === "production")
    throw new Error("BACKEND_UNCONFIGURED");
  return false;
}
export function publicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!backendConfigured() || !url || !key) throw new Error("BACKEND_UNCONFIGURED");
  return { url, key };
}
export function appOrigin() {
  const value = process.env.APP_URL;
  if (!value) {
    if (process.env.NODE_ENV === "production")
      throw new Error("APP_URL is required");
    return "http://127.0.0.1:3000";
  }
  return new URL(value).origin;
}
