import { describe, it, expect } from 'vitest'
import { buildServiceList } from '../../../src/main/grpc/reflection'

describe('buildServiceList', () => {
  it('サービス名とメソッド名のリストをフィルタリングして返す', () => {
    // サーバーリフレクション自体のサービスは除外する
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
