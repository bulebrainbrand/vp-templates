import 'reflect-metadata'

import { NestFactory } from '@nestjs/core'
import { Logger } from 'nestjs-pino'
// __SWAGGER_IMPORT__
import { AppModule } from './app.module'
import { ENV, type Env } from './config/env'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true })
  app.useLogger(app.get(Logger))
  app.setGlobalPrefix('api')
  // __SWAGGER_SETUP__
  const env = app.get<Env>(ENV)
  await app.listen(env.PORT)
  return app
}

const app = bootstrap()

// Clean restart under `vite-node --watch`: `accept()` makes vite-node re-execute this module in place
// (a plain change would full-reload without disposing), and `dispose` closes the running server first
// so the next bootstrap() doesn't hit EADDRINUSE on the same port. `import.meta.hot` is undefined in
// the production SSR build, so this whole block is tree-shaken away there.
if (import.meta.hot) {
  import.meta.hot.accept()
  import.meta.hot.dispose(async () => {
    await (await app).close()
  })
}
