import { describe, it, expect, vi, afterEach } from 'vitest'
import { describeMethod } from '../../../src/main/grpc/describe'

const { mockGetDescriptorBySymbol } = vi.hoisted(() => ({
  mockGetDescriptorBySymbol: vi.fn(),
}))

vi.mock('@grpc/grpc-js', () => ({
  credentials: {
    createInsecure: vi.fn(() => ({})),
    createSsl: vi.fn(() => ({})),
  },
}))

vi.mock('grpc-js-reflection-client', () => ({
  GrpcReflection: vi.fn(function () {
    return { getDescriptorBySymbol: mockGetDescriptorBySymbol }
  }),
}))

afterEach(() => {
  vi.restoreAllMocks()
})

function makeDescriptor(fields: Record<string, { type: string; rule?: string; resolvedType?: unknown }>) {
  const mockMethod = {
    resolvedRequestType: { fields },
  }
  const mockService = { methods: { GetUser: mockMethod } }
  const mockRoot = {
    resolveAll: vi.fn(),
    lookupService: vi.fn(() => mockService),
  }
  return { getProtobufJsRoot: vi.fn(() => mockRoot) }
}

describe('describeMethod', () => {
  it('string と int32 フィールドから JSON テンプレを生成する', async () => {
    mockGetDescriptorBySymbol.mockResolvedValue(
      makeDescriptor({
        user_id: { type: 'string' },
        age: { type: 'int32' },
      }),
    )

    const result = await describeMethod('localhost:50051', false, 'UserService/GetUser')

    expect(JSON.parse(result)).toEqual({ user_id: '', age: 0 })
  })

  it('repeated フィールドは [] になる', async () => {
    mockGetDescriptorBySymbol.mockResolvedValue(
      makeDescriptor({
        tags: { type: 'string', rule: 'repeated' },
      }),
    )

    const result = await describeMethod('localhost:50051', false, 'UserService/GetUser')

    expect(JSON.parse(result)).toEqual({ tags: [] })
  })

  it('ネストされたメッセージを再帰的に展開する', async () => {
    mockGetDescriptorBySymbol.mockResolvedValue(
      makeDescriptor({
        profile: {
          type: 'Profile',
          resolvedType: {
            fields: {
              name: { type: 'string' },
              age: { type: 'int32' },
            },
          },
        },
      }),
    )

    const result = await describeMethod('localhost:50051', false, 'UserService/GetUser')

    expect(JSON.parse(result)).toEqual({ profile: { name: '', age: 0 } })
  })

  it('enum フィールドは 0 になる', async () => {
    mockGetDescriptorBySymbol.mockResolvedValue(
      makeDescriptor({
        status: { type: 'Status', resolvedType: { values: { UNKNOWN: 0, ACTIVE: 1 } } },
      }),
    )

    const result = await describeMethod('localhost:50051', false, 'UserService/GetUser')

    expect(JSON.parse(result)).toEqual({ status: 0 })
  })

  it('メソッドが見つからない場合は空文字列を返す', async () => {
    const mockRoot = {
      resolveAll: vi.fn(),
      lookupService: vi.fn(() => ({ methods: {} })),
    }
    mockGetDescriptorBySymbol.mockResolvedValue({ getProtobufJsRoot: vi.fn(() => mockRoot) })

    const result = await describeMethod('localhost:50051', false, 'UserService/NotFound')

    expect(result).toBe('')
  })

  it('エラー発生時は空文字列を返す', async () => {
    mockGetDescriptorBySymbol.mockRejectedValue(new Error('接続失敗'))

    const result = await describeMethod('localhost:50051', false, 'UserService/GetUser')

    expect(result).toBe('')
  })

  it('bool フィールドは false になる', async () => {
    mockGetDescriptorBySymbol.mockResolvedValue(
      makeDescriptor({
        is_active: { type: 'bool' },
      }),
    )

    const result = await describeMethod('localhost:50051', false, 'UserService/GetUser')

    expect(JSON.parse(result)).toEqual({ is_active: false })
  })
})
