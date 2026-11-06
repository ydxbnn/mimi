// Re-export the native module. On web, it will be resolved to FloatingMemoModule.web.ts
// and on native platforms to FloatingMemoModule.ts
export { default } from './src/FloatingMemoModule';
export * from './src/FloatingMemo.types';
