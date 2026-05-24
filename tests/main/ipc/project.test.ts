import { describe, it, expect } from 'vitest'
import { promises as fs } from 'fs'
import * as os from 'os'
import * as path from 'path'
import { readProject, saveProject, listCases, readCase, writeCase } from '../../../src/main/ipc/project'
import type { ReqstraProject } from '../../../src/shared/types/project'

const tmpDir = () => fs.mkdtemp(path.join(os.tmpdir(), 'reqstra-test-'))

describe('readProject', () => {
  it('存在するプロジェクトJSONを読み込む', async () => {
    const dir = await tmpDir()
    const project: ReqstraProject = {
      name: 'Test Project',
      projectDir: dir,
      environments: [],
      collections: [],
    }
    await fs.writeFile(
      path.join(dir, 'reqstra-project.json'),
      JSON.stringify(project, null, 2)
    )

    const result = await readProject(dir)
    expect(result.name).toBe('Test Project')
    expect(result.projectDir).toBe(dir)
  })

  it('ファイル内のprojectDirより引数のprojectDirが優先される', async () => {
    const dir = await tmpDir()
    const project: ReqstraProject = {
      name: 'Override Test',
      projectDir: '/old/path/that/should/be/ignored',
      environments: [],
      collections: [],
    }
    await fs.writeFile(
      path.join(dir, 'reqstra-project.json'),
      JSON.stringify(project, null, 2)
    )

    const result = await readProject(dir)
    expect(result.projectDir).toBe(dir)
  })
})

describe('saveProject', () => {
  it('プロジェクトをJSONに保存する', async () => {
    const dir = await tmpDir()
    const project: ReqstraProject = {
      name: 'Save Test',
      projectDir: dir,
      environments: [],
      collections: [],
    }

    await saveProject(project)

    const raw = await fs.readFile(path.join(dir, 'reqstra-project.json'), 'utf-8')
    const parsed = JSON.parse(raw)
    expect(parsed.name).toBe('Save Test')
  })
})

describe('listCases / readCase / writeCase', () => {
  it('casesディレクトリ内のYAMLファイルを一覧する', async () => {
    const dir = await tmpDir()
    const casesDir = path.join(dir, 'requests', 'grpc', 'UserService', 'GetUser')
    await fs.mkdir(casesDir, { recursive: true })
    await fs.writeFile(path.join(casesDir, 'UserA.yaml'), 'user_id: "alice"')
    await fs.writeFile(path.join(casesDir, 'UserB.yaml'), 'user_id: "bob"')

    const cases = await listCases(casesDir)
    expect(cases).toHaveLength(2)
    expect(cases).toContain('UserA.yaml')
    expect(cases).toContain('UserB.yaml')
  })

  it('YAMLファイルを読み書きする', async () => {
    const dir = await tmpDir()
    const filePath = path.join(dir, 'UserA.yaml')

    await writeCase(filePath, 'user_id: "alice"\nrole: "admin"')
    const content = await readCase(filePath)

    expect(content).toBe('user_id: "alice"\nrole: "admin"')
  })

  it('存在しないディレクトリは空配列を返す', async () => {
    const cases = await listCases('/tmp/non-existent-reqstra-test-dir-xyz')
    expect(cases).toEqual([])
  })

  it('存在しないネスト先ディレクトリも作成して書き込む', async () => {
    const dir = await tmpDir()
    const filePath = path.join(dir, 'nested', 'deep', 'UserA.yaml')

    await writeCase(filePath, 'user_id: "alice"')
    const content = await readCase(filePath)

    expect(content).toBe('user_id: "alice"')
  })
})
