import { build } from 'esbuild'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import fs from 'node:fs/promises'

const root = process.cwd()
const outdir = path.join(root, 'node_modules', '.tmp', 'unit-tests')
const outfile = path.join(outdir, 'workstation-tests.cjs')
const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '.json']

async function resolveLocalImport(importPath) {
  for (const extension of extensions) {
    const candidate = `${importPath}${extension}`
    try {
      const stat = await fs.stat(candidate)
      if (stat.isFile()) return candidate
    } catch {
      // Try the next extension.
    }
  }

  for (const extension of extensions.slice(1)) {
    const candidate = path.join(importPath, `index${extension}`)
    try {
      const stat = await fs.stat(candidate)
      if (stat.isFile()) return candidate
    } catch {
      // Try the next extension.
    }
  }

  return importPath
}

await fs.mkdir(outdir, { recursive: true })

await build({
  entryPoints: [path.join(root, 'src', 'test', 'workstation.test.tsx')],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  jsx: 'automatic',
  sourcemap: 'inline',
  logLevel: 'silent',
  plugins: [
    {
      name: 'local-alias',
      setup(buildApi) {
        buildApi.onResolve({ filter: /^@\// }, async args => ({
          path: await resolveLocalImport(path.join(root, 'src', args.path.slice(2))),
        }))
      },
    },
  ],
})

await import(pathToFileURL(outfile).href)
