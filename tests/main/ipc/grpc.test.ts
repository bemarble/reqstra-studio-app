import { describe, it, expect } from 'vitest'
import { promises as fs } from 'fs'
import * as os from 'os'
import * as path from 'path'
import { scanCaseDirs } from '../../../src/main/ipc/grpc'

const tmpDir = () => fs.mkdtemp(path.join(os.tmpdir(), 'reqstra-test-grpc-'))

describe('scanCaseDirs', () => {
  it('ケースファイルがあるエンドポイントのcasesDirを返す', async () => {
    const dir = await tmpDir()
    const caseDir = path.join(dir, 'requests', 'grpc', 'UserService', 'GetUser')
    await fs.mkdir(caseDir, { recursive: true })
    await fs.writeFile(path.join(caseDir, 'case1.yaml'), 'id: 1')

    const result = await scanCaseDirs(dir)

    expect(result).toContain('requests/grpc/UserService/GetUser')
  })

  it('ケースファイルがないエンドポイントは含まれない', async () => {
    const dir = await tmpDir()
    const caseDir = path.join(dir, 'requests', 'grpc', 'EmptyService', 'EmptyMethod')
    await fs.mkdir(caseDir, { recursive: true })

    const result = await scanCaseDirs(dir)

    expect(result).not.toContain('requests/grpc/EmptyService/EmptyMethod')
  })

  it('requests/grpcディレクトリが存在しない場合は空配列を返す', async () => {
    const dir = await tmpDir()

    const result = await scanCaseDirs(dir)

    expect(result).toEqual([])
  })

  it('.ymlファイルもケースファイルとして認識する', async () => {
    const dir = await tmpDir()
    const caseDir = path.join(dir, 'requests', 'grpc', 'OrderService', 'GetOrder')
    await fs.mkdir(caseDir, { recursive: true })
    await fs.writeFile(path.join(caseDir, 'case.yml'), 'id: 2')

    const result = await scanCaseDirs(dir)

    expect(result).toContain('requests/grpc/OrderService/GetOrder')
  })

  it('複数のサービス・メソッドを正しく列挙する', async () => {
    const dir = await tmpDir()
    await fs.mkdir(path.join(dir, 'requests', 'grpc', 'UserService', 'GetUser'), { recursive: true })
    await fs.mkdir(path.join(dir, 'requests', 'grpc', 'UserService', 'CreateUser'), { recursive: true })
    await fs.writeFile(path.join(dir, 'requests', 'grpc', 'UserService', 'GetUser', 'a.yaml'), '')
    await fs.writeFile(path.join(dir, 'requests', 'grpc', 'UserService', 'CreateUser', 'b.yaml'), '')

    const result = await scanCaseDirs(dir)

    expect(result).toContain('requests/grpc/UserService/GetUser')
    expect(result).toContain('requests/grpc/UserService/CreateUser')
    expect(result).toHaveLength(2)
  })
})
