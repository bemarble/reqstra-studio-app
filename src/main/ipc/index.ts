import { ipcMain, dialog } from 'electron'
import * as path from 'path'
import { readProject, saveProject, listCases, readCase, writeCase, deleteCase } from './project'
import { writeLog, readLogs } from './log'
import { registerGrpcHandlers } from './grpc'
import type { ReqstraProject } from '../../shared/types/project'
import type { LogEntry } from '../../shared/types/ipc'

export function registerAllHandlers(): void {
  ipcMain.handle('project:open', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'プロジェクトフォルダを選択',
    })
    if (result.canceled || !result.filePaths[0]) return null

    const projectDir = result.filePaths[0]
    try {
      return await readProject(projectDir)
    } catch (e) {
      if (!(e instanceof Error && 'code' in e && (e as NodeJS.ErrnoException).code === 'ENOENT')) {
        throw e
      }
      const newProject: ReqstraProject = {
        name: path.basename(projectDir),
        projectDir,
        environments: [],
        collections: [],
      }
      await saveProject(newProject)
      return newProject
    }
  })

  ipcMain.handle('project:save', async (_event, project: ReqstraProject) => {
    await saveProject(project)
  })

  ipcMain.handle('project:listCases', async (_event, casesDir: string) => {
    return listCases(casesDir)
  })

  ipcMain.handle('project:readCase', async (_event, absolutePath: string) => {
    return readCase(absolutePath)
  })

  ipcMain.handle('project:writeCase', async (_event, absolutePath: string, content: string) => {
    await writeCase(absolutePath, content)
  })

  ipcMain.handle('project:deleteCase', async (_event, absolutePath: string) => {
    await deleteCase(absolutePath)
  })

  ipcMain.handle('log:write', async (_event, projectDir: string, entry: LogEntry) => {
    await writeLog(projectDir, entry)
  })

  ipcMain.handle('log:read', async (_event, projectDir: string, date: string) => {
    return readLogs(projectDir, date)
  })

  registerGrpcHandlers()
}
