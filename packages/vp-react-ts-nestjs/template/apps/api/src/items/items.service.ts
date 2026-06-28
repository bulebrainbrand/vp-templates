import { Injectable, NotFoundException } from '@nestjs/common'
import type { CreateItem, Item } from '@app/contracts'

/** A throwaway in-memory store so the template runs with zero infra. Swap for a real repository. */
@Injectable()
export class ItemsService {
  private readonly items: Item[] = []

  findAll(): Item[] {
    return this.items
  }

  findOne(id: string): Item {
    const item = this.items.find((i) => i.id === id)
    if (!item) throw new NotFoundException(`Item ${id} not found`)
    return item
  }

  create(input: CreateItem): Item {
    const item: Item = { id: crypto.randomUUID(), name: input.name, createdAt: new Date().toISOString() }
    this.items.push(item)
    return item
  }
}
