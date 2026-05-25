import { ipcMain } from 'electron'
import { promises as fs } from 'fs'
import * as path from 'path'
import { reflectServices } from '../grpc/reflection'
import { describeMethod } from '../grpc/describe'
import { executeGrpcRequest } from '../grpc/client'
import type { GrpcRequestParams } from '../../shared/types/ipc'

export async function scanCaseDirs(projectDir: string): Promise<string[]> {
  const grpcDir = path.join(projectDir, 'requests', 'grpc')
  const result: string[] = []

  let serviceNames: string[]
  try {
    serviceNames = await fs.readdir(grpcDir)
  } catch {
    return []
  }

  for (const serviceName of serviceNames) {
    const serviceDir = path.join(grpcDir, serviceName)
    try {
      const stat = await fs.stat(serviceDir)
      if (!stat.isDirectory()) continue
    } catch {
      continue
    }

    let methodNames: string[]
    try {
      methodNames = await fs.readdir(serviceDir)
    } catch {
      continue
    }

    for (const methodName of methodNames) {
      const methodDir = path.join(serviceDir, methodName)
      try {
        const stat = await fs.stat(methodDir)
        if (!stat.isDirectory()) continue
      } catch {
        continue
      }

      let files: string[]
      try {
        files = await fs.readdir(methodDir)
      } catch {
        continue
      }

      const hasCase = files.some((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
      if (hasCase) {
        result.push(`requests/grpc/${serviceName}/${methodName}`)
      }
    }
  }

  return result
}

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

  ipcMain.handle('grpc:scanCaseDirs', async (_event, projectDir: string) => {
    return scanCaseDirs(projectDir)
  })
}
