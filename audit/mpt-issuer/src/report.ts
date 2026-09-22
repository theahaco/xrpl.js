export interface Row {
  step: string
  expected: string
  actual: string
  pass: boolean
  note?: string
}

export class Report {
  private readonly rows: Row[] = []

  check(step: string, expected: string, actual: string, note?: string): boolean {
    const pass = expected === actual
    this.rows.push({ step, expected, actual, pass, ...(note === undefined ? {} : { note }) })
    // eslint-disable-next-line no-console
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${step}: expected ${expected}, got ${actual}${note ? `  (${note})` : ''}`)
    return pass
  }

  /** Assert-style: throws on mismatch so the scenario stops at the first broken invariant. */
  expect(step: string, expected: string, actual: string, note?: string): void {
    if (!this.check(step, expected, actual, note)) {
      throw new Error(`${step}: expected ${expected}, got ${actual}`)
    }
  }

  get failures(): Row[] {
    return this.rows.filter((row) => !row.pass)
  }

  print(): void {
    const width = (key: keyof Row): number =>
      Math.max(key.length, ...this.rows.map((row) => String(row[key] ?? '').length))
    const cols: Array<keyof Row> = ['step', 'expected', 'actual', 'pass']
    const line = (values: string[]): string =>
      values.map((value, i) => value.padEnd(width(cols[i] ?? 'step'))).join(' | ')
    // eslint-disable-next-line no-console
    console.log(`\n${line(cols.map(String))}`)
    // eslint-disable-next-line no-console
    console.log(cols.map((col) => '-'.repeat(width(col))).join('-+-'))
    for (const row of this.rows) {
      // eslint-disable-next-line no-console
      console.log(line([row.step, row.expected, row.actual, row.pass ? 'PASS' : 'FAIL']))
    }
    // eslint-disable-next-line no-console
    console.log(`\n${this.rows.length - this.failures.length}/${this.rows.length} passed`)
  }
}
