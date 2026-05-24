import { describe, it, expect } from 'vitest'
import { promises as fs } from 'fs'
import * as os from 'os'
import * as path from 'path'
import { writeLog, readLogs } from '../../../src/main/ipc/log'
import type { LogEntry } from '../../../src/shared/types/ipc'

const tmpDir = () => fs.mkdtemp(path.join(os.tmpdir(), 'reqstra-log-test-'))

const sampleEntry = (): LogEntry => ({
  timestamp: '2026-05-25T10:00:00.000Z',
  protocol: 'grpc',
  collectionName: 'UserService',
  endpointName: 'GetUser',
  caseName: 'UserA',
  status: 'OK',
  durationMs: 43,
  request: { user_id: 'alice' },
  response: { id: 'alice', name: 'Alice' },
})

describe('writeLog / readLogs', () => {
  it('ログをNDJSONで追記し読み込める', async () => {
    const dir = await tmpDir()
    const entry1 = sampleEntry()
    const entry2 = { ...sampleEntry(), caseName: 'UserB', durationMs: 55 }

    await writeLog(dir, entry1)
    await writeLog(dir, entry2)

    const logs = await readLogs(dir, '2026-05-25')
    expect(logs).toHaveLength(2)
    expect(logs[0].caseName).toBe('UserA')
    expect(logs[1].caseName).toBe('UserB')
  })

  it('存在しない日付のログは空配列を返す', async () => {
    const dir = await tmpDir()
    const logs = await readLogs(dir, '2026-01-01')
    expect(logs).toEqual([])
  })
})
