declare module 'firebase/app';
declare module 'firebase/auth';

interface ImportMetaEnv {
  readonly API_BASE_VARIABLE?: string;
  readonly [key: string]: any;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

