import { readFile } from 'fs/promises'
import { join } from 'path'

import ts from 'typescript'

const PKG = join(__dirname, '..', '..')
const SRC = join(PKG, 'src')

/**
 * Doc-comment `@example` blocks that must type-check as written, because they
 * are the first thing a developer copies. Each entry names the source file and
 * the declaration whose preceding JSDoc block holds the example.
 */
const EXAMPLES: Array<[string, string]> = [
  ['client/index.ts', 'public async submitAndWait<'],
  ['Wallet/index.ts', 'public sign('],
]

/**
 * Extracts the fenced TypeScript code blocks from the JSDoc block that
 * immediately precedes `declaration` in `source`.
 *
 * @param source - Contents of the source file.
 * @param declaration - Text of the declaration the doc block belongs to.
 * @returns The code of every TypeScript fence in that block, comment prefix stripped.
 * @throws Error when `declaration` does not occur in `source`.
 */
function exampleSnippets(source: string, declaration: string): string[] {
  const declIndex = source.indexOf(declaration)
  if (declIndex < 0) {
    throw new Error(`declaration not found: ${declaration}`)
  }
  const docEnd = source.lastIndexOf('*/', declIndex)
  const docStart = source.lastIndexOf('/**', docEnd)
  const doc = source
    .slice(docStart, docEnd)
    .split('\n')
    .map((line) => line.replace(/^\s*\* ?/u, ''))
    .join('\n')
  return Array.from(
    doc.matchAll(/```ts\n(?<code>[\s\S]*?)```/gu),
    (match) => match.groups?.code ?? '',
  )
}

/**
 * Type-checks the given snippets as standalone modules that import from
 * 'xrpl', resolving that specifier to this package's `src/index.ts`.
 *
 * @param snippets - Map of virtual file name to snippet source.
 * @returns Formatted diagnostics, one string per problem.
 */
function typeCheck(snippets: Map<string, string>): string[] {
  const configPath = join(PKG, 'tsconfig.json')
  const config = ts.readConfigFile(configPath, (path) => ts.sys.readFile(path))
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, PKG)
  const options: ts.CompilerOptions = {
    ...parsed.options,
    noEmit: true,
    composite: false,
    declaration: false,
    declarationMap: false,
    noUnusedLocals: false,
    skipLibCheck: true,
    baseUrl: PKG,
    paths: { xrpl: [join(SRC, 'index.ts')] },
  }
  const base = ts.createCompilerHost(options)
  const host: ts.CompilerHost = {
    ...base,
    fileExists: (fileName) =>
      snippets.has(fileName) || base.fileExists(fileName),
    readFile: (fileName) => snippets.get(fileName) ?? base.readFile(fileName),
    getSourceFile(fileName, languageVersion, ...rest) {
      const snippet = snippets.get(fileName)
      if (snippet == null) {
        return base.getSourceFile(fileName, languageVersion, ...rest)
      }
      return ts.createSourceFile(fileName, snippet, languageVersion, true)
    },
  }
  const program = ts.createProgram(Array.from(snippets.keys()), options, host)
  return Array.from(snippets.keys()).flatMap((fileName) => {
    const sourceFile = program.getSourceFile(fileName)
    return [
      ...program.getSyntacticDiagnostics(sourceFile),
      ...program.getSemanticDiagnostics(sourceFile),
    ].map((diagnostic) =>
      ts.formatDiagnostic(diagnostic, {
        getCanonicalFileName: (name) => name,
        getCurrentDirectory: () => PKG,
        getNewLine: () => '\n',
      }),
    )
  })
}

describe('doc @example blocks', function () {
  it('type-check against the public API', async function () {
    const snippets = new Map<string, string>()
    for (const [file, declaration] of EXAMPLES) {
      // eslint-disable-next-line no-await-in-loop -- a handful of small files
      const source = await readFile(join(SRC, file), 'utf8')
      const blocks = exampleSnippets(source, declaration)
      expect(blocks.length).toBeGreaterThan(0)
      blocks.forEach((code, index) => {
        const name = `${file.replace(/[/.]/gu, '_')}_${index}.ts`
        snippets.set(join(PKG, 'test', 'docs', '__examples__', name), code)
      })
    }
    expect(typeCheck(snippets)).toEqual([])
  }, 120000)
})
