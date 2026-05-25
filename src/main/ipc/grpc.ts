import { ipcMain } from 'electron'
import { reflectServices } from '../grpc/reflection'
import { describeMethod } from '../grpc/describe'
import { executeGrpcRequest } from '../grpc/client'
import type { GrpcRequestParams } from '../../shared/types/ipc'

export function registerGrpcHandlers(): void {
  ipcMain.handle('grpc:reflect', async (_event, host: string, secure: boolean) => {
    return reflectServices(host, secure)
  })

  ipcMain.handle('grpc:describeMethod', async (_event, host: string, secure: boolean, method: string) => {
    return describeMethod(host, secure, method)
  })

  ipcMain.handle('grpc:request', async (_event, params: GrpcRequestParams) => {
    return executeGrpcRequest(params)
  })
}
