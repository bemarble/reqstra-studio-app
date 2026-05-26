import { ipcMain } from 'electron'
import { executeHttpRequest } from '../http/client'
import type { HttpRequestParams } from '../../shared/types/ipc'

export function registerHttpHandlers(): void {
  ipcMain.handle('http:request', async (_event, params: HttpRequestParams) => {
    return executeHttpRequest(params)
  })
}
