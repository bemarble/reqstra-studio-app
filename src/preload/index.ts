import { contextBridge, ipcRenderer } from 'electron'
import type { IpcApi } from '../shared/types/ipc'

const api: IpcApi = {
  openProject: () => ipcRenderer.invoke('project:open'),
  saveProject: (project) => ipcRenderer.invoke('project:save', project),
  listCases: (casesDir) => ipcRenderer.invoke('project:listCases', casesDir),
  readCase: (absolutePath) => ipcRenderer.invoke('project:readCase', absolutePath),
  writeCase: (absolutePath, content) =>
    ipcRenderer.invoke('project:writeCase', absolutePath, content),
  grpcReflect: (host, secure) => ipcRenderer.invoke('grpc:reflect', host, secure),
  grpcRequest: (params) => ipcRenderer.invoke('grpc:request', params),
  writeLog: (projectDir, entry) => ipcRenderer.invoke('log:write', projectDir, entry),
  readLogs: (projectDir, date) => ipcRenderer.invoke('log:read', projectDir, date),
}

contextBridge.exposeInMainWorld('reqstraApi', api)
