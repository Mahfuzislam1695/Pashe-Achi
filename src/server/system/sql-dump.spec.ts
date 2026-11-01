import { quoteIdent, quoteLiteral } from './sql-dump'

describe('quoteIdent', () => {
  it('double-quotes names, doubling any quote inside', () => {
    expect(quoteIdent('Order')).toBe('"Order"')
    expect(quoteIdent('we"ird')).toBe('"we""ird"')
  })
})

describe('quoteLiteral', () => {
  it.each([
    [null, 'NULL'],
    ['', "''"],
    ["Rahim's shop", "'Rahim''s shop'"],
    ['C:\\path\\to', "'C:\\path\\to'"],
    ['line one\nline two', "'line one\nline two'"],
    ['মিরপুর-১০, ঢাকা', "'মিরপুর-১০, ঢাকা'"],
    ['{"a":"it\'s"}', "'{\"a\":\"it''s\"}'"],
  ])('%j → %s', (value, literal) => {
    expect(quoteLiteral(value)).toBe(literal)
  })
})
