import { app } from 'electron'
import type { AppUpdater } from 'electron-updater'
import type { MainEvent, UpdateState } from '@shared/types'

let sink: ((event: MainEvent) => void) | null = null
let state: UpdateState = { status: 'idle' }
let wired = false
let updaterRef: AppUpdater | null = null

/** 由主进程注入事件推送函数 */
export function setUpdateSink(next: (event: MainEvent) => void): void {
  sink = next
}

function publish(patch: Partial<UpdateState>): void {
  state = { ...state, ...patch }
  sink?.({ type: 'update-state', payload: state })
}

export function getUpdateState(): UpdateState {
  return state
}

function describe(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  // electron-updater 的原始报错对普通用户没有意义，换成可读提示
  if (/ENOTFOUND|ETIMEDOUT|ECONNREFUSED|network|socket hang up/i.test(message)) {
    return '网络连接失败，请检查网络后重试'
  }
  if (/404|Cannot find|no published versions/i.test(message)) {
    return '未找到已发布的版本信息'
  }
  return message
}

/** 懒加载 electron-updater：开发模式下没必要加载，也避免打包配置缺失时报错 */
async function getUpdater(): Promise<AppUpdater> {
  const { autoUpdater } = await import('electron-updater')
  updaterRef = autoUpdater
  if (!wired) {
    wired = true
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.on('checking-for-update', () =>
      publish({ status: 'checking', message: undefined })
    )
    autoUpdater.on('update-available', (info) =>
      publish({ status: 'available', version: info.version, message: undefined })
    )
    autoUpdater.on('update-not-available', (info) =>
      publish({ status: 'not-available', version: info.version, message: undefined })
    )
    autoUpdater.on('download-progress', (progress) =>
      publish({ status: 'downloading', percent: Math.round(progress.percent) })
    )
    autoUpdater.on('update-downloaded', (info) =>
      publish({ status: 'downloaded', version: info.version, percent: 100 })
    )
    autoUpdater.on('error', (error) => publish({ status: 'error', message: describe(error) }))
  }
  return autoUpdater
}

/** 检查更新；开发模式下直接返回提示，不发起网络请求 */
export async function checkForUpdates(): Promise<UpdateState> {
  if (!app.isPackaged) {
    publish({ status: 'error', message: '开发模式下不检查更新' })
    return state
  }
  publish({ status: 'checking', message: undefined })
  try {
    const updater = await getUpdater()
    await updater.checkForUpdates()
  } catch (error) {
    publish({ status: 'error', message: describe(error) })
  }
  return state
}

export async function downloadUpdate(): Promise<UpdateState> {
  if (state.status !== 'available') return state
  publish({ status: 'downloading', percent: 0, message: undefined })
  try {
    const updater = await getUpdater()
    await updater.downloadUpdate()
  } catch (error) {
    publish({ status: 'error', message: describe(error) })
  }
  return state
}

/** 退出并安装已下载的更新 */
export function installUpdate(): boolean {
  if (state.status !== 'downloaded' || !updaterRef) return false
  // 先让 IPC 返回，再重启应用，避免界面卡在请求中
  setTimeout(() => {
    try {
      updaterRef?.quitAndInstall()
    } catch {
      app.relaunch()
      app.exit(0)
    }
  }, 400)
  return true
}

/** 启动后静默检查一次（仅打包环境） */
export function scheduleUpdateCheck(delayMs = 8000): void {
  if (!app.isPackaged) return
  setTimeout(() => {
    void checkForUpdates()
  }, delayMs)
}
