import { z } from 'zod'

/** Validate `process.env` at boot — the app fails fast with a clear error if something is missing. */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(__API_PORT__)
})

export type Env = z.infer<typeof envSchema>

/** DI token for the parsed, validated environment. */
export const ENV = Symbol('ENV')

export const loadEnv = (): Env => envSchema.parse(process.env)
