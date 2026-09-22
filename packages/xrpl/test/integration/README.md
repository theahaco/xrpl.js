# Integration tests

These tests run against a standalone `xrpld` node started from the config in
`.ci-config/xrpld.cfg` at the top level of this repository. CI starts that node from the
`rippleci/xrpld:develop` image (see `.github/workflows/nodejs.yml`), so running the same
image locally is what reproduces a CI failure.

From the top level of the repo (one level above `packages`):

```bash
npm install
docker run \
  --detach \
  --publish 6006:6006 \
  --volume "$PWD/.ci-config:/etc/xrpld/" \
  --name xrpld-service \
  rippleci/xrpld:develop --standalone
npm run build
npm run test:integration
```

When you are done: `docker rm -f xrpld-service`.

`CONTRIBUTING.md` explains each flag of the `docker run` command, how to point CI at a
private image, and how to add newly supported amendments to `.ci-config/xrpld.cfg`.

## Notes on the standalone node

- **Ledgers only close when asked.** A standalone node closes a ledger on the admin
  `ledger_accept` RPC and never on its own. `setupClient` starts a ticker that calls it
  every second for the lifetime of the test context, so `submitAndWait` and anything else
  that waits for validation makes progress; `ledgerAccept` in `utils.ts` closes one
  on demand.
- **`feature` cannot tell you what is active.** The `[features]` stanza of `xrpld.cfg` is
  applied as a set of rules in force from the genesis ledger rather than written to the
  ledger's `Amendments` object, so the `feature` RPC reports *every* amendment as
  `enabled: false`. Use `isAmendmentEnabled` from `utils.ts`, which probes the behaviour
  with `simulate`, and never the `enabled` flag.
- **The amendment list is checked for you.** `setupClient` fails with the missing names if
  the node supports a non-retired amendment that `xrpld.cfg` does not list.

## Choosing a port

`PORT` overrides the port the tests connect to on `localhost` (default `6006`), which is
how you run against a container of your own:

```bash
docker run --detach --publish 6124:6006 \
  --volume "$PWD/.ci-config/:/etc/xrpld/" \
  --name my-xrpld rippleci/xrpld:develop --standalone
cd packages/xrpl && PORT=6124 npm run test:integration
```

`HOST` (default `0.0.0.0`) is honoured too; see `test/integration/serverUrl.ts`.
