import { promises as fs } from 'fs'
import * as path from 'path'
import type { ReqstraProject } from '../../shared/types/project'

export async function readProject(projectDir: string): Promise<ReqstraProject> {
  const filePath = path.join(projectDir, 'reqstra-project.json')
  const raw = await fs.readFile(filePath, 'utf-8')
  // JSON.parse は any を返すため unknown 経由でアサートする
  const data = JSON.parse(raw) as unknown as ReqstraProject
  data.projectDir = projectDir
  return data
}

export async function saveProject(project: ReqstraProject): Promise<void> {
  const { projectDir, ...data } = project
  const filePath = path.join(projectDir, 'reqstra-project.json')
  await fs.writeFile(filePath, JSON.stringify(data, null, 2))
}

export async function listCases(casesDir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(casesDir)
    return entries.filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
  } catch {
    return []
  }
}

export async function readCase(absolutePath: string): Promise<string> {
  return fs.readFile(absolutePath, 'utf-8')
}

export async function writeCase(absolutePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(absolutePath), { recursive: true })
  await fs.writeFile(absolutePath, content, 'utf-8')
}

export async function deleteCase(absolutePath: string): Promise<void> {
  await fs.unlink(absolutePath)
}
