import { describe, it, expect, vi, afterEach } from 'vitest'
import { buildServiceList, reflectServices } from '../../../src/main/grpc/reflection'

const { mockListServices, mockListMethods, mockSocketConnect, mockSocketDestroy } = vi.hoisted(() => ({
  mockListServices: vi.fn(),
  mockListMethods: vi.fn(),
  mockSocketConnect: vi.fn(),
  mockSocketDestroy: vi.fn(),
}))

vi.mock('net', () => {
  const EventEmitter = require('events')
  return {
    Socket: vi.fn(function () {
      const emitter = new EventEmitter()
      emitter.connect = mockSocketConnect
      emitter.destroy = mockSocketDestroy
      return emitter
    }),
  }
})

vi.mock('@grpc/grpc-js', () => ({
  credentials: {
    createInsecure: vi.fn(() => ({})),
    createSsl: vi.fn(() => ({})),
  },
}))

vi.mock('grpc-js-reflection-client', () => ({
  GrpcReflection: vi.fn(function () {
    return {
      listServices: mockListServices,
      listMethods: mockListMethods,
    }
  }),
}))

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

// TCP接続が即時成功するようにモック設定するヘルパー
function setupTcpSuccess(): void {
  mockSocketConnect.mockImplementation(function (this: unknown, _port: number, _host: string, cb: () => void) {
    cb()
  })
}

describe('buildServiceList', () => {
  it('サービス名とメソッド名のリストをフィルタリングして返す', () => {
    const rawServices = [
      'grpc.reflection.v1alpha.ServerReflection',
      'grpc.health.v1.Health',
      'UserService',
      'OrderService',
    ]

    const result = buildServiceList(rawServices)

    expect(result.map((s) => s.name)).toEqual(['UserService', 'OrderService'])
  })

  it('空のリストは空を返す', () => {
    expect(buildServiceList([])).toEqual([])
  })
})

describe('reflectServices', () => {
  it('TCP接続タイムアウト時にエラーになる', async () => {
    // connectを呼んでも何もしない（タイムアウトまで待つ）
    mockSocketConnect.mockImplementation(() => {})

    vi.useFakeTimers()
    const promise = reflectServices('localhost:50051', false)
    const assertion = expect(promise).rejects.toThrow('接続タイムアウト')
    await vi.advanceTimersByTimeAsync(5000)
    await assertion
  })

  it('TCP接続後にgRPCが5秒応答しない場合タイムアウトエラーになる', async () => {
    setupTcpSuccess()
    mockListServices.mockReturnValue(new Promise(() => {}))

    vi.useFakeTimers()
    const promise = reflectServices('localhost:50051', false)
    const assertion = expect(promise).rejects.toThrow('タイムアウト')
    await vi.advanceTimersByTimeAsync(5000)
    await assertion
  })

  it('5秒未満で応答があれば結果を返す', async () => {
    setupTcpSuccess()
    mockListServices.mockResolvedValue(['UserService'])
    mockListMethods.mockResolvedValue([{ name: 'GetUser' }])

    const result = await reflectServices('localhost:50051', false)

    expect(result).toEqual([{ name: 'UserService', methods: ['GetUser'] }])
  })
})
