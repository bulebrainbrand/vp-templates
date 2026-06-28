import { BadRequestException, type PipeTransform } from '@nestjs/common'
import type { ZodSchema } from 'zod'

/**
 * Minimal, zero-dependency bridge between Zod and Nest's pipe system. Use it per-route against a
 * schema from `@app/contracts`, e.g. `@Body(new ZodValidationPipe(createItemSchema)) body: CreateItem`.
 */
export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value)
    if (!result.success) throw new BadRequestException(result.error.flatten())
    return result.data
  }
}
