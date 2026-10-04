import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'shared'),
      '@': resolve(__dirname, 'src')
    }
  },
  test: {
    // 纯逻辑单元测试，不需要 DOM；依赖 Electron / 原生 sqlite 的模块在用例里 mock
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    reporters: ['default']
  }
})
