// Add custom serializer for BigInt
expect.addSnapshotSerializer({
  test: (val) => typeof val === 'bigint',
  print: (val) => val.toString(),
})

// Mock console.log to avoid noisy output
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}
