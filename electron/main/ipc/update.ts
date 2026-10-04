import { handle } from './common'
import {
  checkForUpdates,
  downloadUpdate,
  getUpdateState,
  installUpdate
} from '../services/update'

export function registerUpdateHandlers(): void {
  handle('update:state', () => getUpdateState())
  handle('update:check', () => checkForUpdates())
  handle('update:download', () => downloadUpdate())
  handle('update:install', () => installUpdate())
}
