/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BUGBOND_CONTRACT?: `0x${string}`;
  readonly VITE_GENLAYER_ENDPOINT?: string;
}
