// Add BigInt serialization support
expect.addSnapshotSerializer({
  test: (val) => typeof val === 'bigint',
  print: (val) => val.toString(),
})

// Add BigInt serialization for worker threads
if (typeof BigInt !== 'undefined') {
  BigInt.prototype.toJSON = function() {
    return this.toString()
  }
}

// Mock console.log to avoid noisy output
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}
