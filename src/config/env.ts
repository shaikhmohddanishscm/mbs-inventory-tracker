const readEnv = (name: string): string => {
  const value = import.meta.env[name]
  if (!value || typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

const readAnyEnv = (names: string[]): string => {
  for (const name of names) {
    const value = import.meta.env[name]
    if (value && typeof value === 'string' && value.trim().length > 0) {
      return value
    }
  }
  throw new Error(`Missing required environment variable. Expected one of: ${names.join(', ')}`)
}

export const env = {
  supabaseUrl: readEnv('VITE_SUPABASE_URL'),
  supabaseAnonKey: readAnyEnv(['VITE_SUPABASE_ANON_KEY', 'VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY']),
  allowedLoginEmail: readEnv('VITE_ALLOWED_LOGIN_EMAIL').toLowerCase(),
}

export const optionalEnv = {
  appName: (import.meta.env.VITE_APP_NAME as string | undefined) ?? 'Microbial Solutions Inventory Tracker',
}
