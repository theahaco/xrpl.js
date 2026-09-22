/*
 * Reports amendments that the xrpld build CI runs against supports but that
 * `.ci-config/xrpld.cfg` does not list in its [features] stanza.
 *
 * CI starts the image named in .github/workflows/nodejs.yml (rippleci/xrpld:develop
 * by default) in standalone mode with this directory mounted at /etc/xrpld/, so the
 * authoritative list of amendments available to the integration tests is the one that
 * node reports - not the set enabled on a public network.
 *
 * Usage (after `npm run build`, with the container from CONTRIBUTING.md running):
 *   node .ci-config/getNewAmendments.js
 *   XRPLD_WS_URL=ws://localhost:6124 node .ci-config/getNewAmendments.js
 *
 * Amendments reported as `vetoed: "Obsolete"` are retired: they are baked into the
 * protocol permanently and cannot be named in [features], so they are ignored here.
 */

const fs = require('fs')
const path = require('path')
const xrpl = require('xrpl')

// The admin WebSocket port that .ci-config/xrpld.cfg exposes and that CI publishes.
const wsUrl = process.env.XRPLD_WS_URL ?? 'ws://localhost:6006'
const configPath = path.resolve(__dirname, './xrpld.cfg')

/**
 * Reads the amendment names listed in the [features] stanza of an xrpld config.
 *
 * @param configText - The full text of an xrpld.cfg file.
 * @returns The amendment names listed under [features].
 */
function parseFeaturesStanza(configText) {
  const lines = configText.split('\n')
  const start = lines.findIndex((line) => line.trim() === '[features]')
  if (start === -1) {
    return []
  }
  const names = []
  for (const line of lines.slice(start + 1)) {
    const trimmed = line.trim()
    if (trimmed.startsWith('[')) {
      break
    }
    if (trimmed !== '' && !trimmed.startsWith('#')) {
      names.push(trimmed)
    }
  }
  return names
}

async function main() {
  const configText = fs.readFileSync(configPath, 'utf-8')
  const listed = new Set(parseFeaturesStanza(configText))

  const client = new xrpl.Client(wsUrl)
  await client.connect()
  let features
  try {
    const response = await client.request({ command: 'feature' })
    features = response.result.features
  } finally {
    await client.disconnect()
  }
  if (features == null) {
    throw new Error(`${wsUrl} did not answer the admin \`feature\` command.`)
  }

  const missing = Object.values(features)
    .filter(
      (feature) =>
        feature.supported &&
        // "Obsolete" marks a retired amendment, which is always in force.
        feature.vetoed !== 'Obsolete' &&
        !listed.has(feature.name),
    )
    .map((feature) => feature.name)
    .sort()

  if (missing.length === 0) {
    console.log(
      `No new amendments to add!
Node: ${wsUrl}
Path to config: ${configPath}`,
    )
    return
  }

  console.log(
    `${missing.length} amendment(s) supported by ${wsUrl} are missing from ${configPath}.
Add them to the [features] stanza:
`,
  )
  missing.forEach((name) => console.log(name))
}

main().catch((error) => {
  console.error(error.message ?? error)
  console.error(
    `\nHas the package been built (\`npm run build\`) and is a standalone xrpld
running on ${wsUrl}? See CONTRIBUTING.md, "Running Tests".`,
  )
  process.exitCode = 1
})
