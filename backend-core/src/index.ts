// Polyfills for Electron Node 18 environment
if (!(process as any).getBuiltinModule) {
  (process as any).getBuiltinModule = (name: string) => require(name);
}
if (!globalThis.crypto) {
  globalThis.crypto = require('crypto').webcrypto;
}

import * as dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { connectDB } from './config/db';

const PORT = process.env.PORT || 3000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`[Server] Core backend running on port ${PORT}`);
  });
});
