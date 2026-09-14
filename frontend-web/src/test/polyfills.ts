import { TextDecoder, TextEncoder } from 'util';

Object.assign(globalThis, {
  TextDecoder,
  TextEncoder,
  fetch: globalThis.fetch || (() => Promise.reject(new Error('fetch is not mocked'))),
  Response: globalThis.Response || class Response {},
});
