/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_SERVIDOR_API: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}