import { promises as fs } from 'fs'
import * as path from 'path'
import type { LogEntry } from '../../shared/types/ipc'

function logFilePath(projectDir: string, date: string): string {
  return path.join(projectDir, 'logs', `${date}.ndjson`)
}

export async function writeLog(projectDir: string, entry: LogEntry): Promise<void> {
  const date = entry.timestamp.slice(0, 10) // "YYYY-MM-DD"
  const filePath = logFilePath(projectDir, date)
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.appendFile(filePath, JSON.stringify(entry) + '\n', 'utf-8')
}

export async function readLogs(projectDir: string, date: string): Promise<LogEntry[]> {
  const filePath = logFilePath(projectDir, date)
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    return raw
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as unknown as LogEntry)
  } catch {
    return []
  }
}
