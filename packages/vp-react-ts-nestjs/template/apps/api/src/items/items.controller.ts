import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { createItemSchema, type CreateItem, type Item } from '@app/contracts'

import { ZodValidationPipe } from '../common/zod-validation.pipe'
import { ItemsService } from './items.service'

@Controller('items')
export class ItemsController {
  constructor(private readonly items: ItemsService) {}

  @Get()
  findAll(): Item[] {
    return this.items.findAll()
  }

  @Get(':id')
  findOne(@Param('id') id: string): Item {
    return this.items.findOne(id)
  }

  @Post()
  create(@Body(new ZodValidationPipe(createItemSchema)) body: CreateItem): Item {
    return this.items.create(body)
  }
}
