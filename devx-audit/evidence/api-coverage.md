# Public API inventory and coverage

Baseline: npm `xrpl@5.3.0`, TypeScript `5.9.3`.

The published package root exports **447 named symbols**, of which **137** also have runtime values. The remaining names are compile-time types. This is an inventory count, not a defect count.

The inventory also records **69 namespace/object members**: LedgerEntry (54) and hashes (15). These are additional qualified members, not additional root exports.

Installed declaration files provide JSDoc prose for **0/447 root exports**. The shipped TypeScript source has descriptions for **344/447**; this difference is investigated with real language-service hover probes in the findings report. Inherited EventEmitter members may still show dependency-provided documentation.

## Method and limits

TypeScript checker.getExportsOfModule on the installed published package root. Aliases resolved to declaration origins. Class members include public inherited members; private/protected members excluded. Namespace/object member inventory includes exported TS namespaces and hashes. Documentation coverage means compiler-visible JSDoc prose, not quality or completeness. Model fields include inherited fields; union common-properties only, so field totals are not a complete variant-field inventory.

The machine-readable inventory records every named root export, declaration origins, kind, public class members (including Client and Wallet), namespace members, compiler-visible documentation and callable signatures. It excludes unsupported deep imports and the independently consumable sibling packages except their root re-exports. Public subpath exports, if declared in the package manifest, are recorded below and require separate inventory.

```json
"(No package exports map)"
```

JSDoc presence is a discovery signal only. A field such as `command` often needs no standalone description. Missing descriptions are not automatically findings, and present descriptions may still be inaccurate. See the separate findings register for verified defects.

| API family | Root exports | Runtime exports | With JSDoc prose | Inventory depth |
|---|---:|---:|---:|---|
| Address codecs (re-export) | 14 | 14 | 0 | Compiler inventory |
| Client and connection | 2 | 1 | 0 | Compiler inventory |
| Common protocol types | 30 | 3 | 0 | Compiler inventory |
| Confidential MPT builders | 24 | 13 | 0 | Compiler inventory |
| Convenience helpers | 2 | 1 | 0 | Compiler inventory |
| Conversion, codec and ledger utilities | 31 | 31 | 0 | Compiler inventory |
| Errors | 12 | 12 | 0 | Compiler inventory |
| Events and subscriptions | 12 | 0 | 0 | Compiler inventory |
| Keypair utilities (re-export) | 3 | 3 | 0 | Compiler inventory |
| Ledger entry models | 1 | 1 | 0 | Compiler inventory |
| Model helpers and flags | 9 | 9 | 0 | Compiler inventory |
| Other public exports | 1 | 1 | 0 | Compiler inventory |
| Request models and mapping | 54 | 0 | 0 | Compiler inventory |
| Response models and mapping | 56 | 0 | 0 | Compiler inventory |
| RPC supporting models | 28 | 0 | 0 | Compiler inventory |
| Transaction metadata | 9 | 3 | 0 | Compiler inventory |
| Transactions and validation | 144 | 31 | 0 | Compiler inventory |
| Wallet and signing | 15 | 14 | 0 | Compiler inventory |

## Public Client and Wallet members

### Client

| Member | Surface | Inherited | JSDoc prose |
|---|---|---|---|
| `connection` | Instance | No | No |
| `feeCushion` | Instance | No | No |
| `maxFeeXRP` | Instance | No | No |
| `networkID` | Instance | No | No |
| `buildVersion` | Instance | No | No |
| `apiVersion` | Instance | No | No |
| `url` | Instance | No | No |
| `request` | Instance | No | No |
| `requestNextPage` | Instance | No | No |
| `on` | Instance | No | Yes |
| `requestAll` | Instance | No | No |
| `getServerInfo` | Instance | No | No |
| `connect` | Instance | No | No |
| `disconnect` | Instance | No | No |
| `isConnected` | Instance | No | No |
| `autofill` | Instance | No | No |
| `simulate` | Instance | No | No |
| `submit` | Instance | No | No |
| `submitAndWait` | Instance | No | No |
| `prepareTransaction` | Instance | No | No |
| `getXrpBalance` | Instance | No | No |
| `getBalances` | Instance | No | No |
| `getOrderbook` | Instance | No | No |
| `getLedgerIndex` | Instance | No | No |
| `fundWallet` | Instance | No | No |
| `eventNames` | Instance | Yes | Yes |
| `listeners` | Instance | Yes | Yes |
| `listenerCount` | Instance | Yes | Yes |
| `emit` | Instance | Yes | Yes |
| `addListener` | Instance | Yes | No |
| `once` | Instance | Yes | Yes |
| `removeListener` | Instance | Yes | Yes |
| `off` | Instance | Yes | No |
| `removeAllListeners` | Instance | Yes | Yes |
| `prefixed` | Static | Yes | No |
| `EventEmitter` | Static | Yes | No |

### Wallet

| Member | Surface | Inherited | JSDoc prose |
|---|---|---|---|
| `publicKey` | Instance | No | No |
| `privateKey` | Instance | No | No |
| `classicAddress` | Instance | No | No |
| `seed` | Instance | No | No |
| `address` | Instance | No | No |
| `sign` | Instance | No | No |
| `verifyTransaction` | Instance | No | No |
| `getXAddress` | Instance | No | No |
| `generate` | Static | No | No |
| `fromSeed` | Static | No | No |
| `fromSecret` | Static | No | No |
| `fromEntropy` | Static | No | No |
| `fromMnemonic` | Static | No | No |

## Behavioral review depth

Inventory alone is not a behavioral audit. The companion `surface-findings.md` records the selected declaration/source reviews and compiler/runtime probes. No live-ledger correctness or every-variant behavioral coverage is implied.
