import { ipcMain } from 'electron'
import { reflectServices } from '../grpc/reflection'
import { executeGrpcRequest } from '../grpc/client'
import type { GrpcRequestParams } from '../../shared/types/ipc'

export function registerGrpcHandlers(): void {
  ipcMain.handle('grpc:reflect', async (_event, host: string, secure: boolean) => {
    return reflectServices(host, secure)
  })

  ipcMain.handle('grpc:request', async (_event, params: GrpcRequestParams) => {
    return executeGrpcRequest(params)
  })
}
