import { Global, Module } from '@nestjs/common'

import { ENV, loadEnv } from './env'

// Global so any provider can inject the validated env via `@Inject(ENV)`.
@Global()
@Module({
  providers: [{ provide: ENV, useFactory: loadEnv }],
  exports: [ENV]
})
export class ConfigModule {}
