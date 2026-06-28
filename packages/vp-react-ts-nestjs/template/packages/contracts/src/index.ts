import { z } from 'zod'

/**
 * Shared API contracts. Both ends import from here so there is a single source of truth:
 * the api validates request bodies against these schemas (via the ZodValidationPipe) and the
 * web app uses the inferred types to type its `fetch` responses.
 */

export const itemSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  createdAt: z.string()
})

export const createItemSchema = itemSchema.pick({ name: true })

export type Item = z.infer<typeof itemSchema>
export type CreateItem = z.infer<typeof createItemSchema>
