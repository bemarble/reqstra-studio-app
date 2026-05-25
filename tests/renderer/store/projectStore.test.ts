import { describe, it, expect, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useProjectStore } from '../../../src/renderer/src/store/projectStore'
import type { ReqstraProject, GrpcTarget, GrpcEndpoint } from '../../../src/shared/types/project'

const createMockProject = (): ReqstraProject => ({
  name: 'test',
  projectDir: '/tmp/test',
  environments: [
    {
      id: 'env-1',
      name: 'dev',
      protocols: {
        grpc: [{ id: 'grpc-1', name: 'Local', host: 'localhost:50051', secure: false }],
      },
    },
  ],
  collections: [
    {
      id: 'col-1',
      protocol: 'grpc',
      name: 'UserService',
      protocolTargetId: 'grpc-1',
      endpoints: [
        {
          id: 'ep-1',
          name: 'GetUser',
          method: 'UserService/GetUser',
          casesDir: 'requests/grpc/UserService/GetUser',
        },
      ],
    },
  ],
})

describe('useProjectStore — 新アクション', () => {
  beforeEach(() => {
    useProjectStore.setState({ project: createMockProject() })
  })

  describe('deleteEnvironment', () => {
    it('指定IDの環境を削除する', () => {
      const { result } = renderHook(() => useProjectStore())
      act(() => result.current.deleteEnvironment('env-1'))
      expect(result.current.project?.environments).toHaveLength(0)
    })

    it('projectがnullの時は何もしない', () => {
      useProjectStore.setState({ project: null })
      const { result } = renderHook(() => useProjectStore())
      act(() => result.current.deleteEnvironment('env-1'))
      expect(result.current.project).toBeNull()
    })
  })

  describe('addProtocolTarget', () => {
    it('指定環境にgRPCターゲットを追加する', () => {
      const { result } = renderHook(() => useProjectStore())
      const newTarget: GrpcTarget = { id: 'grpc-2', name: 'Staging', host: 'staging:50051', secure: true }
      act(() => result.current.addProtocolTarget('env-1', 'grpc', newTarget))
      expect(result.current.project?.environments[0].protocols.grpc).toHaveLength(2)
      expect(result.current.project?.environments[0].protocols.grpc?.[1].id).toBe('grpc-2')
    })

    it('httpプロトコルが未定義の環境にターゲットを追加する', () => {
      const { result } = renderHook(() => useProjectStore())
      const newTarget = { id: 'http-1', name: 'REST', baseUrl: 'http://localhost:3000' }
      act(() => result.current.addProtocolTarget('env-1', 'http', newTarget))
      expect(result.current.project?.environments[0].protocols.http).toHaveLength(1)
    })
  })

  describe('updateProtocolTarget', () => {
    it('指定環境のgRPCターゲットを更新する', () => {
      const { result } = renderHook(() => useProjectStore())
      const updated: GrpcTarget = { id: 'grpc-1', name: 'Updated', host: 'new-host:50051', secure: true }
      act(() => result.current.updateProtocolTarget('env-1', 'grpc', updated))
      expect(result.current.project?.environments[0].protocols.grpc?.[0].name).toBe('Updated')
      expect(result.current.project?.environments[0].protocols.grpc?.[0].host).toBe('new-host:50051')
    })
  })

  describe('deleteProtocolTarget', () => {
    it('指定環境のgRPCターゲットを削除する', () => {
      const { result } = renderHook(() => useProjectStore())
      act(() => result.current.deleteProtocolTarget('env-1', 'grpc', 'grpc-1'))
      expect(result.current.project?.environments[0].protocols.grpc).toHaveLength(0)
    })
  })

  describe('deleteCollection', () => {
    it('指定IDのコレクションを削除する', () => {
      const { result } = renderHook(() => useProjectStore())
      act(() => result.current.deleteCollection('col-1'))
      expect(result.current.project?.collections).toHaveLength(0)
    })

    it('projectがnullの時は何もしない', () => {
      useProjectStore.setState({ project: null })
      const { result } = renderHook(() => useProjectStore())
      act(() => result.current.deleteCollection('col-1'))
      expect(result.current.project).toBeNull()
    })
  })

  describe('addEndpoint', () => {
    it('指定コレクションにエンドポイントを追加する', () => {
      const { result } = renderHook(() => useProjectStore())
      const ep: GrpcEndpoint = {
        id: 'ep-2',
        name: 'ListUsers',
        method: 'UserService/ListUsers',
        casesDir: 'requests/grpc/UserService/ListUsers',
      }
      act(() => result.current.addEndpoint('col-1', ep))
      expect(result.current.project?.collections[0].endpoints).toHaveLength(2)
      expect(result.current.project?.collections[0].endpoints[1].id).toBe('ep-2')
    })
  })

  describe('updateEndpoint', () => {
    it('指定コレクションのエンドポイントを更新する', () => {
      const { result } = renderHook(() => useProjectStore())
      const updated: GrpcEndpoint = {
        id: 'ep-1',
        name: 'GetUserV2',
        method: 'UserService/GetUserV2',
        casesDir: 'requests/grpc/UserService/GetUserV2',
      }
      act(() => result.current.updateEndpoint('col-1', updated))
      expect(result.current.project?.collections[0].endpoints[0].name).toBe('GetUserV2')
      expect(result.current.project?.collections[0].endpoints[0].method).toBe('UserService/GetUserV2')
    })
  })

  describe('deleteEndpoint', () => {
    it('指定コレクションのエンドポイントを削除する', () => {
      const { result } = renderHook(() => useProjectStore())
      act(() => result.current.deleteEndpoint('col-1', 'ep-1'))
      expect(result.current.project?.collections[0].endpoints).toHaveLength(0)
    })
  })
})
