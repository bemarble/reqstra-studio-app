import { contextBridge, ipcRenderer } from 'electron'
import type { IpcApi } from '../shared/types/ipc'

const api: IpcApi = {
  openProject: () => ipcRenderer.invoke('project:open'),
  saveProject: (project) => ipcRenderer.invoke('project:save', project),
  listCases: (casesDir) => ipcRenderer.invoke('project:listCases', casesDir),
  readCase: (absolutePath) => ipcRenderer.invoke('project:readCase', absolutePath),
  writeCase: (absolutePath, content) =>
    ipcRenderer.invoke('project:writeCase', absolutePath, content),
  deleteCase: (absolutePath) => ipcRenderer.invoke('project:deleteCase', absolutePath),
  scanCaseDirs: (projectDir) => ipcRenderer.invoke('grpc:scanCaseDirs', projectDir),
  grpcReflect: (host, secure) => ipcRenderer.invoke('grpc:reflect', host, secure),
  grpcDescribeMethod: (host, secure, method) =>
    ipcRenderer.invoke('grpc:describeMethod', host, secure, method),
  grpcRequest: (params) => ipcRenderer.invoke('grpc:request', params),
  writeLog: (projectDir, entry) => ipcRenderer.invoke('log:write', projectDir, entry),
  readLogs: (projectDir, date) => ipcRenderer.invoke('log:read', projectDir, date),
}

contextBridge.exposeInMainWorld('reqstraApi', api)
