if (!process.getBuiltinModule) {
  process.getBuiltinModule = (name) => require(name);
}
if (!globalThis.crypto) {
  globalThis.crypto = require('crypto').webcrypto;
}
