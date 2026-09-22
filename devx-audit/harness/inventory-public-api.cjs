/* Reproduce with: node inventory-public-api.cjs (from audit/harness). */
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const audit = path.resolve(__dirname, '..')
const packageJson = require.resolve('xrpl/package.json')
const packageRoot = path.dirname(packageJson)
const manifest = JSON.parse(fs.readFileSync(packageJson, 'utf8'))
const entry = path.resolve(packageRoot, manifest.types || manifest.typings)
const program = ts.createProgram([entry], {
  strict: true, skipLibCheck: true,
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
})
const checker = program.getTypeChecker()
const source = program.getSourceFile(entry)
const root = checker.getSymbolAtLocation(source)
if (!root) throw new Error(`No module symbol: ${entry}`)
const flags = ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope

function resolve(symbol) {
  return symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol
}
function location(declaration) {
  const file = declaration.getSourceFile()
  const pos = file.getLineAndCharacterOfPosition(declaration.getStart(file))
  return { file: path.relative(audit, file.fileName), line: pos.line + 1, column: pos.character + 1 }
}
function documentation(symbol) {
  return {
    description: ts.displayPartsToString(symbol.getDocumentationComment(checker)),
    tags: symbol.getJsDocTags(checker).map(tag => ({ name: tag.name, text: ts.displayPartsToString(tag.text || []) })),
  }
}
function visible(symbol) {
  return !(symbol.declarations || []).some(declaration =>
    ts.getCombinedModifierFlags(declaration) & (ts.ModifierFlags.Private | ts.ModifierFlags.Protected)
    || declaration.name && ts.isPrivateIdentifier(declaration.name))
}
function typeOf(symbol) {
  const declaration = symbol.valueDeclaration || symbol.declarations?.[0] || source
  return checker.getTypeOfSymbolAtLocation(symbol, declaration)
}
function signatureRecords(type) {
  return type.getCallSignatures().map(signature => ({
    signature: checker.signatureToString(signature, undefined, flags),
    documentation: ts.displayPartsToString(signature.getDocumentationComment(checker)),
    parameters: signature.getParameters().map(parameter => ({
      name: parameter.getName(),
      type: checker.typeToString(typeOf(parameter), undefined, flags),
      documentation: documentation(parameter),
    })),
  }))
}
function memberRecord(symbol, ownerFiles = []) {
  const actual = resolve(symbol)
  const type = typeOf(actual)
  const origins = (actual.declarations || []).map(location)
  return {
    name: symbol.getName(),
    kind: [...new Set((actual.declarations || []).map(declaration => ts.SyntaxKind[declaration.kind]))],
    runtime: Boolean(actual.flags & ts.SymbolFlags.Value),
    type: checker.typeToString(type, undefined, flags),
    declarations: origins,
    inherited: origins.length > 0 && origins.every(origin => !ownerFiles.includes(origin.file)),
    optional: Boolean(actual.flags & ts.SymbolFlags.Optional),
    documentation: documentation(actual),
    signatures: signatureRecords(type),
  }
}
function family(name, declarations) {
  const origin = declarations[0]?.file || ''
  if (origin.includes('/confidential/')) return 'Confidential MPT builders'
  if (origin.includes('/client/')) return 'Client and connection'
  if (origin.includes('/Wallet/')) return 'Wallet and signing'
  if (origin.includes('/errors.')) return 'Errors'
  if (origin.includes('/models/transactions/')) {
    if (origin.includes('/metadata.')) return 'Transaction metadata'
    return 'Transactions and validation'
  }
  if (origin.includes('/models/ledger/')) return 'Ledger entry models'
  if (origin.includes('/models/methods/')) {
    if (/Stream|Event|Listener|Snapshot|SubscribeBook/.test(name)) return 'Events and subscriptions'
    if (/Request/.test(name)) return 'Request models and mapping'
    if (/Response/.test(name)) return 'Response models and mapping'
    return 'RPC supporting models'
  }
  if (origin.includes('/models/utils/')) return 'Model helpers and flags'
  if (origin.includes('/models/common')) return 'Common protocol types'
  if (origin.includes('/utils/hashes')) return 'Hash utilities'
  if (origin.includes('/utils/')) return 'Conversion, codec and ledger utilities'
  if (origin.includes('/sugar/')) return 'Convenience helpers'
  if (origin.includes('/ripple-address-codec/')) return 'Address codecs (re-export)'
  if (origin.includes('/ripple-keypairs/')) return 'Keypair utilities (re-export)'
  if (origin.includes('/ripple-binary-codec/')) return 'Binary codecs (re-export)'
  return 'Other public exports'
}
const symbols = checker.getExportsOfModule(root).sort((a,b) => a.getName().localeCompare(b.getName()))
const entries = symbols.map(symbol => {
  const actual = resolve(symbol)
  const declarations = (actual.declarations || []).map(location)
  const valueType = typeOf(actual)
  const declaredType = actual.flags & ts.SymbolFlags.Type ? checker.getDeclaredTypeOfSymbol(actual) : null
  const record = {
    name: symbol.getName(),
    kind: [...new Set((actual.declarations || []).map(declaration => ts.SyntaxKind[declaration.kind]))],
    runtime: Boolean(actual.flags & ts.SymbolFlags.Value),
    family: family(symbol.getName(), declarations),
    declarations,
    documentation: documentation(actual),
    signatures: signatureRecords(valueType),
  }
  if (actual.flags & ts.SymbolFlags.Class) {
    record.members = checker.getPropertiesOfType(declaredType).filter(visible).map(member => memberRecord(member, declarations.map(d => d.file)))
    record.staticMembers = checker.getPropertiesOfType(valueType).filter(member => member.getName() !== 'prototype' && visible(member)).map(member => memberRecord(member, declarations.map(d => d.file)))
    record.constructors = valueType.getConstructSignatures().map(signature => checker.signatureToString(signature, undefined, flags))
  }
  if (actual.flags & (ts.SymbolFlags.NamespaceModule | ts.SymbolFlags.ValueModule)) {
    record.namespaceMembers = checker.getExportsOfModule(actual).map(member => memberRecord(member))
  } else if (symbol.getName() === 'hashes') {
    record.namespaceMembers = checker.getPropertiesOfType(valueType).map(member => memberRecord(member))
  }
  if (declaredType && !(actual.flags & ts.SymbolFlags.Class)) {
    const fields = checker.getPropertiesOfType(declaredType).filter(visible)
    record.modelFields = fields.map(member => ({
      name: member.getName(),
      declarations: (member.declarations || []).map(location),
      optional: Boolean(member.flags & ts.SymbolFlags.Optional),
      description: documentation(member).description,
    }))
  }
  return record
})
// The tarball includes original .ts sources: compare their comments with the
// declarations that ordinary consumers actually load. Do not substitute source
// documentation for the installed declaration's editor experience.
const sourceEntry = path.resolve(packageRoot, 'src/index.ts')
const sourceProgram = ts.createProgram([sourceEntry], program.getCompilerOptions())
const sourceChecker = sourceProgram.getTypeChecker()
const originalModule = sourceChecker.getSymbolAtLocation(sourceProgram.getSourceFile(sourceEntry))
const sourceDocs = new Map(sourceChecker.getExportsOfModule(originalModule).map(symbol => {
  const actual = symbol.flags & ts.SymbolFlags.Alias ? sourceChecker.getAliasedSymbol(symbol) : symbol
  return [symbol.getName(), ts.displayPartsToString(actual.getDocumentationComment(sourceChecker))]
}))
for (const record of entries) record.shippedSourceDescription = sourceDocs.get(record.name) || ''
const families = Object.groupBy ? Object.groupBy(entries, item => item.family) : entries.reduce((acc,item) => ((acc[item.family] ||= []).push(item), acc), {})
const summaries = Object.entries(families).sort(([a],[b]) => a.localeCompare(b)).map(([name, items]) => ({
  family: name,
  exports: items.length,
  runtimeExports: items.filter(item => item.runtime).length,
  exportsWithDescription: items.filter(item => item.documentation.description.trim()).length,
  exportsWithAnyJsDoc: items.filter(item => item.documentation.description.trim() || item.documentation.tags.length).length,
}))
const report = {
  generatedAt: new Date().toISOString(),
  baseline: { package: manifest.name, version: manifest.version, typescript: ts.version, entry: path.relative(audit,entry) },
  method: 'TypeScript checker.getExportsOfModule on the installed published package root. Aliases resolved to declaration origins. Class members include public inherited members; private/protected members excluded. Namespace/object member inventory includes exported TS namespaces and hashes. Documentation coverage means compiler-visible JSDoc prose, not quality or completeness. Model fields include inherited fields; union common-properties only, so field totals are not a complete variant-field inventory.',
  totals: { rootExports: entries.length, runtimeExports: entries.filter(item => item.runtime).length, exportsWithDescription: entries.filter(item => item.documentation.description.trim()).length },
  families: summaries,
  exports: entries,
}
report.totals.exportsWithSourceDescription = entries.filter(item => item.shippedSourceDescription.trim()).length
report.totals.namespaceMembers = entries.reduce((total,item) => total + (item.namespaceMembers?.length || 0),0)
fs.writeFileSync(path.join(audit, 'evidence/api-inventory.json'), JSON.stringify(report, null, 2) + '\n')
const lines = [
  '# Public API inventory and coverage', '',
  `Baseline: npm \`${manifest.name}@${manifest.version}\`, TypeScript \`${ts.version}\`.`, '',
  `The published package root exports **${report.totals.rootExports} named symbols**, of which **${report.totals.runtimeExports}** also have runtime values. The remaining names are compile-time types. This is an inventory count, not a defect count.`, '',
  `The inventory also records **${report.totals.namespaceMembers} namespace/object members**: LedgerEntry (${entries.find(item=>item.name==='LedgerEntry')?.namespaceMembers?.length || 0}) and hashes (${entries.find(item=>item.name==='hashes')?.namespaceMembers?.length || 0}). These are additional qualified members, not additional root exports.`, '',
  `Installed declaration files provide JSDoc prose for **${report.totals.exportsWithDescription}/${report.totals.rootExports} root exports**. The shipped TypeScript source has descriptions for **${report.totals.exportsWithSourceDescription}/${report.totals.rootExports}**; this difference is investigated with real language-service hover probes in the findings report. Inherited EventEmitter members may still show dependency-provided documentation.`, '',
  '## Method and limits', '', report.method, '',
  'The machine-readable inventory records every named root export, declaration origins, kind, public class members (including Client and Wallet), namespace members, compiler-visible documentation and callable signatures. It excludes unsupported deep imports and the independently consumable sibling packages except their root re-exports. Public subpath exports, if declared in the package manifest, are recorded below and require separate inventory.', '',
  '```json', JSON.stringify(manifest.exports || '(No package exports map)', null, 2), '```', '',
  'JSDoc presence is a discovery signal only. A field such as `command` often needs no standalone description. Missing descriptions are not automatically findings, and present descriptions may still be inaccurate. See the separate findings register for verified defects.', '',
  '| API family | Root exports | Runtime exports | With JSDoc prose | Inventory depth |',
  '|---|---:|---:|---:|---|',
  ...summaries.map(item => `| ${item.family} | ${item.exports} | ${item.runtimeExports} | ${item.exportsWithDescription} | Compiler inventory |`), '',
  '## Public Client and Wallet members', '',
  ...entries.filter(item => ['Client','Wallet'].includes(item.name)).flatMap(item => [
    `### ${item.name}`, '',
    '| Member | Surface | Inherited | JSDoc prose |', '|---|---|---|---|',
    ...(item.members || []).map(member => `| \`${member.name}\` | Instance | ${member.inherited ? 'Yes' : 'No'} | ${member.documentation.description.trim() ? 'Yes' : 'No'} |`),
    ...(item.staticMembers || []).map(member => `| \`${member.name}\` | Static | ${member.inherited ? 'Yes' : 'No'} | ${member.documentation.description.trim() ? 'Yes' : 'No'} |`), '',
  ]),
  '## Behavioral review depth', '',
  'Inventory alone is not a behavioral audit. The companion `surface-findings.md` records the selected declaration/source reviews and compiler/runtime probes. No live-ledger correctness or every-variant behavioral coverage is implied.', '',
]
fs.writeFileSync(path.join(audit, 'evidence/api-coverage.md'), lines.join('\n'))
console.log(JSON.stringify({baseline: report.baseline, totals: report.totals, families: summaries},null,2))
