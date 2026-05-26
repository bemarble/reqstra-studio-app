import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CollectionTree } from '../../../../src/renderer/src/components/Sidebar/CollectionTree'
import { useProjectStore } from '../../../../src/renderer/src/store/projectStore'
import { useAppStore } from '../../../../src/renderer/src/store/appStore'

const mockApi = {
  saveProject: vi.fn(),
  listCases: vi.fn(),
  readCase: vi.fn(),
  writeCase: vi.fn(),
  deleteCase: vi.fn(),
}

Object.defineProperty(window, 'reqstraApi', { value: mockApi, writable: true })

const baseProject = {
  name: 'test',
  projectDir: '/tmp/test',
  environments: [
    {
      id: 'env-1',
      name: 'dev',
      protocols: {
        graphql: [{ id: 'gql-1', name: 'Countries API', url: 'https://countries.trevorblades.com/' }],
        grpc: [{ id: 'grpc-1', name: 'Local', host: 'localhost:50051', secure: false }],
      },
    },
  ],
  collections: [],
}

describe('CollectionTree — GraphQLコレクション表示', () => {
  beforeEach(() => {
    mockApi.saveProject.mockResolvedValue(undefined)
    mockApi.listCases.mockResolvedValue([])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('エンドポイントが0件のGraphQLコレクションでも表示される', () => {
    useProjectStore.setState({
      project: {
        ...baseProject,
        collections: [
          {
            id: 'col-1',
            protocol: 'graphql',
            name: 'Countries',
            protocolTargetId: 'gql-1',
            endpoints: [],
          },
        ],
      },
    })
    useAppStore.setState({
      activeProtocol: 'graphql',
      activeEnvironmentId: 'env-1',
      activeProtocolTargetId: 'gql-1',
      openTabs: [],
      activeTabId: null,
    })

    render(<CollectionTree />)

    expect(screen.getByText('Countries')).toBeInTheDocument()
  })

  it('エンドポイントが1件以上あるGraphQLコレクションも表示される', () => {
    useProjectStore.setState({
      project: {
        ...baseProject,
        collections: [
          {
            id: 'col-1',
            protocol: 'graphql',
            name: 'Countries',
            protocolTargetId: 'gql-1',
            endpoints: [
              { id: 'ep-1', name: 'GetCountries', casesDir: 'requests/graphql/GetCountries' },
            ],
          },
        ],
      },
    })
    useAppStore.setState({
      activeProtocol: 'graphql',
      activeEnvironmentId: 'env-1',
      activeProtocolTargetId: 'gql-1',
      openTabs: [],
      activeTabId: null,
    })

    render(<CollectionTree />)

    expect(screen.getByText('Countries')).toBeInTheDocument()
  })

  it('別のprotocolTargetIdを持つGraphQLコレクションは表示されない', () => {
    useProjectStore.setState({
      project: {
        ...baseProject,
        collections: [
          {
            id: 'col-1',
            protocol: 'graphql',
            name: 'OtherAPI',
            protocolTargetId: 'gql-other',
            endpoints: [],
          },
        ],
      },
    })
    useAppStore.setState({
      activeProtocol: 'graphql',
      activeEnvironmentId: 'env-1',
      activeProtocolTargetId: 'gql-1',
      openTabs: [],
      activeTabId: null,
    })

    render(<CollectionTree />)

    expect(screen.queryByText('OtherAPI')).not.toBeInTheDocument()
  })

  it('gRPCコレクションはエンドポイントが0件のとき表示されない（既存挙動の保護）', () => {
    useProjectStore.setState({
      project: {
        ...baseProject,
        collections: [
          {
            id: 'col-1',
            protocol: 'grpc',
            name: 'UserService',
            protocolTargetId: 'grpc-1',
            endpoints: [],
          },
        ],
      },
    })
    useAppStore.setState({
      activeProtocol: 'grpc',
      activeEnvironmentId: 'env-1',
      activeProtocolTargetId: 'grpc-1',
      openTabs: [],
      activeTabId: null,
    })

    render(<CollectionTree />)

    expect(screen.queryByText('UserService')).not.toBeInTheDocument()
  })
})
