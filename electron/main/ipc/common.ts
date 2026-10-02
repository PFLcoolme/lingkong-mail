import { ipcMain, type IpcMainInvokeEvent } from 'electron'

const registered = new Set<string>()

/** 注册 IPC 处理函数（重复注册时忽略，兼容热重载） */
export function handle<Args extends unknown[]>(
  channel: string,
  handler: (event: IpcMainInvokeEvent, ...args: Args) => unknown
): void {
  if (registered.has(channel)) return
  registered.add(channel)
  ipcMain.handle(channel, async (event, ...args: unknown[]) => handler(event, ...(args as Args)))
}

export function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}
