// __SERVEWEB_PATH_IMPORT__
import { Module } from '@nestjs/common'
// __SERVEWEB_MODULE_IMPORT__
import { LoggerModule } from 'nestjs-pino'

import { ConfigModule } from './config/config.module'
import { ENV, type Env } from './config/env'
import { HealthModule } from './health/health.module'
import { ItemsModule } from './items/items.module'

@Module({
  imports: [
    // __SERVEWEB_MODULE__
    ConfigModule,
    LoggerModule.forRootAsync({
      // Read NODE_ENV from the Zod-validated env (the global ConfigModule) instead of raw process.env.
      inject: [ENV],
      useFactory: (env: Env) => ({
        pinoHttp: {
          // pino emits JSON by default. In dev, pretty-print it (single line, colored) so the logs are
          // readable in the same terminal as the web dev server. In production, emit raw JSON to stdout.
          transport: env.NODE_ENV === 'production' ? undefined : { target: 'pino-pretty', options: { singleLine: true } }
        },
        // Named wildcard (`*path`) instead of the legacy `*`: with `setGlobalPrefix('api')` this middleware
        // route becomes `/api/*path`, which Express 5 / path-to-regexp 8 accepts without a deprecation warning.
        forRoutes: ['*path']
      })
    }),
    HealthModule,
    ItemsModule
  ]
})
export class AppModule {}
