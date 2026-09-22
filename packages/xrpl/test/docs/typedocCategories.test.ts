import { readFile } from 'fs/promises'
import { join } from 'path'

const SRC = join(__dirname, '..', '..', 'src')

/**
 * `typedoc.json` uses `categorizeByGroup: false`, so an exported interface
 * without a `@category` tag drops out of the categorised navigation of the
 * generated docs. These interfaces were shipped without one; keep them tagged.
 */
const EXPECTED_CATEGORIES: Array<[string, string, string]> = [
  [
    'models/transactions/MPTokenIssuanceCreate.ts',
    'MPTokenIssuanceCreate',
    'Transaction Models',
  ],
  [
    'models/transactions/MPTokenIssuanceSet.ts',
    'MPTokenIssuanceSet',
    'Transaction Models',
  ],
  [
    'models/transactions/MPTokenAuthorize.ts',
    'MPTokenAuthorize',
    'Transaction Models',
  ],
  [
    'models/transactions/MPTokenIssuanceDestroy.ts',
    'MPTokenIssuanceDestroy',
    'Transaction Models',
  ],
  ['models/transactions/clawback.ts', 'Clawback', 'Transaction Models'],
  ['models/ledger/MPTokenIssuance.ts', 'MPTokenIssuance', 'Ledger Entries'],
  ['models/ledger/MPToken.ts', 'MPToken', 'Ledger Entries'],
]

/**
 * Finds the JSDoc block that immediately precedes `export interface <name>`.
 *
 * @param source - Contents of the source file.
 * @param name - Name of the exported interface.
 * @returns The doc block text without its comment delimiters, or undefined
 * when the interface has no doc block.
 */
function docBlockFor(source: string, name: string): string | undefined {
  const pattern = new RegExp(
    `/\\*\\*(?<doc>[\\s\\S]*?)\\*/\\s*export (?:default )?interface ${name}\\b`,
    'u',
  )
  return pattern.exec(source)?.groups?.doc
}

describe('typedoc categories', function () {
  it.each(EXPECTED_CATEGORIES)(
    '%s: %s is tagged @category %s',
    async function (file, name, category) {
      const source = await readFile(join(SRC, file), 'utf8')
      const doc = docBlockFor(source, name)
      expect(doc).toBeDefined()
      expect(doc).toContain(`@category ${category}`)
    },
  )
})
