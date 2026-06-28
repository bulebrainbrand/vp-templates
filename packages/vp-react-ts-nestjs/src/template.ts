import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { patchJson, readTree, toScope, type Tree } from '@pauldvlp/template-kit'
import { createTemplate } from 'bingo'
import { z } from 'zod'

import pkgJson from '../package.json' with { type: 'json' }

const TEMPLATE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'template')

// The api entrypoint ships with two marker comments so Swagger can be wired in (or stripped out)
// without keeping a second copy of main.ts. `apps/api/src/main.ts` is matched by relative path below.
const MAIN_TS = path.join('apps', 'api', 'src', 'main.ts')
const SWAGGER_IMPORT = "import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'"

// app.module.ts carries marker comments so the optional ServeStaticModule (the `--serveWeb` flag, which
// makes the api serve the built web app) can be wired in or stripped without a second copy of the file.
const APP_MODULE = path.join('apps', 'api', 'src', 'app.module.ts')
const SERVEWEB_MODULE = [
  '    ServeStaticModule.forRoot({',
  '      // Serve the built web app. `import.meta.dirname` resolves the same for src/main.ts (dev) and',
  '      // dist/main.js (prod) — both sit two levels under apps/api, so ../../web/dist is apps/web/dist.',
  "      rootPath: join(import.meta.dirname, '..', '..', 'web', 'dist'),",
  "      exclude: ['/api/*path']",
  '    }),'
].join('\n')

// The README documents the optional Swagger/Docker features inside `<!-- TAG:START -->` … `<!-- TAG:END -->`
// blocks. When the feature is enabled we drop just the marker lines (keeping the docs); when disabled we
// drop the whole block, so a project never ships docs for a feature it doesn't have.
function applyDocBlock(text: string, tag: string, keep: boolean): string {
  return keep
    ? text.replace(new RegExp(`^<!-- ${tag}:(START|END) -->\\n`, 'gm'), '')
    : text.replace(new RegExp(`<!-- ${tag}:START -->\\n[\\s\\S]*?<!-- ${tag}:END -->\\n`, 'g'), '')
}

export default createTemplate({
  about: {
    name: pkgJson.name,
    description: pkgJson.description
  },

  options: {
    name: z.string().describe('Root project / package name').default('my-app'),
    scope: z.string().describe('npm scope for workspace packages, e.g. @acme (defaults to @<name>)'),
    // Ports are strings, not z.number(): Bingo's clack prompt renders an option's default as a text
    // placeholder and calls `.slice` on it, which throws for non-string defaults. They're only ever
    // substituted into config files as text anyway.
    apiPort: z.string().describe('Port the NestJS api listens on').default('3000'),
    webPort: z.string().describe('Port the web dev server listens on').default('5173'),
    swagger: z.boolean().describe('Expose Swagger UI at /docs on the api').default(false),
    serveWeb: z.boolean().describe('Have the api serve the built web app (single deployable)').default(false),
    docker: z.boolean().describe('Add a multi-stage Dockerfile for the api').default(false),
    install: z.boolean().describe('Install deps after scaffolding').default(true)
  },

  // Lazily default the package scope to `@<name>` (prefixing `@` unless the name already has one),
  // so it tracks the project name instead of a fixed value. Falls back to `@app` when no name is set.
  prepare({ options }) {
    return {
      scope: () => (options.name ? toScope(options.name) : '@app')
    }
  },

  async produce({ options }) {
    const scope = toScope(options.scope || options.name || 'app')

    const swaggerSetup = [
      `const swaggerConfig = new DocumentBuilder().setTitle('${options.name} API').setVersion('1.0').build()`,
      `SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig), { jsonDocumentUrl: 'docs.json' })`
    ].join('\n  ')

    // Read the static monorepo skeleton, rewriting the @app scope, project name and ports.
    const files = readTree(TEMPLATE_DIR, (rel, content) => {
      let out = content.split('@app').join(scope).split('__PROJECT_NAME__').join(options.name).split('__API_PORT__').join(options.apiPort).split('__WEB_PORT__').join(options.webPort)

      // Wire (or strip) the optional Swagger setup in the api entrypoint.
      if (rel === MAIN_TS) {
        out = options.swagger
          ? out.replace('// __SWAGGER_IMPORT__', SWAGGER_IMPORT).replace('// __SWAGGER_SETUP__', swaggerSetup)
          : out.replace(/^[ \t]*\/\/ __SWAGGER_(IMPORT|SETUP)__\n/gm, '')
      }

      // Wire (or strip) the optional ServeStaticModule that makes the api serve the built web app.
      if (rel === APP_MODULE) {
        out = options.serveWeb
          ? out
              .replace('// __SERVEWEB_PATH_IMPORT__', "import { join } from 'node:path'\n")
              .replace('// __SERVEWEB_MODULE_IMPORT__', "import { ServeStaticModule } from '@nestjs/serve-static'")
              .replace('    // __SERVEWEB_MODULE__', SERVEWEB_MODULE)
          : out.replace(/^[ \t]*\/\/ __SERVEWEB_[A-Z_]+__\n/gm, '')
      }

      // Keep or drop the README's optional feature docs to match the chosen flags.
      if (rel === 'README.md') {
        out = applyDocBlock(out, 'SWAGGER', options.swagger)
        out = applyDocBlock(out, 'SERVEWEB', options.serveWeb)
        out = applyDocBlock(out, 'DOCKER', options.docker)
      }
      return out
    })

    // Pull in the optional Nest packages only when their feature is enabled. Re-sort dependencies so the
    // emitted package.json stays alphabetical (what oxfmt expects) without a formatting pass.
    if (options.swagger || options.serveWeb) {
      patchJson(files, 'apps/api/package.json', (pkg) => {
        const deps = { ...pkg.dependencies }
        if (options.swagger) deps['@nestjs/swagger'] = '^11'
        if (options.serveWeb) deps['@nestjs/serve-static'] = '^5'
        pkg.dependencies = Object.fromEntries(Object.entries(deps).sort(([a], [b]) => a.localeCompare(b)))
      })
    }

    // Drop the Docker assets unless requested. The .dockerignore lives at the project root because the
    // image's build context is the monorepo root (see apps/api/Dockerfile).
    if (!options.docker) {
      delete (files as Tree)['.dockerignore']
      delete ((files.apps as Tree).api as Tree)['Dockerfile']
    }

    const scripts = options.install ? [{ commands: ['pnpm install --silent'], phase: 0 }] : []

    return {
      files,
      scripts,
      suggestions: [
        `cd into the project and run \`vp run -r dev\` to start web + api together.`,
        `The web app proxies \`/api\` to the NestJS server on port ${options.apiPort}.`,
        ...(options.swagger ? [`Swagger UI: http://localhost:${options.apiPort}/docs (OpenAPI JSON at /docs.json).`] : []),
        ...(options.serveWeb ? [`--serveWeb is on: after \`vp run -r build\`, \`node apps/api/dist/main.js\` serves the web app from the api.`] : []),
        options.install ? `Run \`vp check\` to lint, format and type-check the whole workspace.` : `Skipped install. Run \`vp install\`, then \`vp run -r dev\`.`
      ]
    }
  }
})
