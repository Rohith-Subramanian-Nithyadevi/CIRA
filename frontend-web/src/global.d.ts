interface ImportMetaEnv {
  readonly API_BASE_VARIABLE?: string;
  readonly [key: string]: any;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

