/**
 * Runtime configuration. Everything is overridable through the environment so
 * the modules can be pointed at a different standalone node.
 */
export const SERVER_URL = process.env['XRPL_URL'] ?? 'ws://localhost:6006'

/** How often the background closer calls `ledger_accept` (standalone mode never closes on its own). */
export const LEDGER_TICK_MS = Number(process.env['LEDGER_TICK_MS'] ?? '400')

/** Standalone genesis account; funds every wallet the modules create. */
export const GENESIS_SEED = 'snoPBrXtMeMyMHUVTgbuqAfg1SUTb'
export const GENESIS_ADDRESS = 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh'

/** XRP funded into each fresh wallet. */
export const FUND_XRP = process.env['FUND_XRP'] ?? '1000'
