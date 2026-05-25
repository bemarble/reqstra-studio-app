import { describe, it, expect, vi, afterEach } from 'vitest'
import { buildServiceList, reflectServices } from '../../../src/main/grpc/reflection'

const { mockListServices, mockListMethods } = vi.hoisted(() => ({
  mockListServices: vi.fn(),
  mockListMethods: vi.fn(),
}))

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
  it('5秒応答がない場合タイムアウトエラーになる', async () => {
    mockListServices.mockReturnValue(new Promise(() => {}))

    vi.useFakeTimers()
    const promise = reflectServices('localhost:50051', false)
    const assertion = expect(promise).rejects.toThrow('タイムアウト')
    await vi.advanceTimersByTimeAsync(5000)
    await assertion
  })

  it('5秒未満で応答があれば結果を返す', async () => {
    mockListServices.mockResolvedValue(['UserService'])
    mockListMethods.mockResolvedValue([{ name: 'GetUser' }])

    const result = await reflectServices('localhost:50051', false)

    expect(result).toEqual([{ name: 'UserService', methods: ['GetUser'] }])
  })
})
