import { create } from 'zustand'
import type {
  ReqstraProject,
  Collection,
  Environment,
  GrpcTarget,
  HttpTarget,
  GraphQLTarget,
  GrpcEndpoint,
  GraphQLEndpoint,
} from '../../../shared/types/project'

interface ProjectState {
  project: ReqstraProject | null
  activeCaseDirs: Set<string>
  casesByEndpoint: Record<string, string[]>
  setProject: (project: ReqstraProject) => void
  setActiveCaseDirs: (dirs: string[]) => void
  addActiveCasesDir: (dir: string) => void
  setCasesForEndpoint: (endpointId: string, cases: string[]) => void
  updateCollection: (collection: Collection) => void
  addCollection: (collection: Collection) => void
  updateEnvironment: (env: Environment) => void
  addEnvironment: (env: Environment) => void
  deleteEnvironment: (id: string) => void
  addProtocolTarget: (
    envId: string,
    protocol: 'grpc' | 'http' | 'graphql',
    target: GrpcTarget | HttpTarget | GraphQLTarget,
  ) => void
  updateProtocolTarget: (
    envId: string,
    protocol: 'grpc' | 'http' | 'graphql',
    target: GrpcTarget | HttpTarget | GraphQLTarget,
  ) => void
  deleteProtocolTarget: (envId: string, protocol: 'grpc' | 'http' | 'graphql', targetId: string) => void
  deleteCollection: (id: string) => void
  addEndpoint: (collectionId: string, endpoint: GrpcEndpoint | GraphQLEndpoint) => void
  updateEndpoint: (collectionId: string, endpoint: GrpcEndpoint | GraphQLEndpoint) => void
  deleteEndpoint: (collectionId: string, endpointId: string) => void
}

export const useProjectStore = create<ProjectState>((set) => ({
  project: null,
  activeCaseDirs: new Set<string>(),
  casesByEndpoint: {},
  setProject: (project) => set({ project }),
  setActiveCaseDirs: (dirs) => set({ activeCaseDirs: new Set(dirs) }),
  addActiveCasesDir: (dir) =>
    set((s) => ({ activeCaseDirs: new Set([...s.activeCaseDirs, dir]) })),
  setCasesForEndpoint: (endpointId, cases) =>
    set((s) => ({ casesByEndpoint: { ...s.casesByEndpoint, [endpointId]: cases } })),
  updateCollection: (collection) =>
    set((state) => {
      if (!state.project) return state
      return {
        project: {
          ...state.project,
          collections: state.project.collections.map((c) => (c.id === collection.id ? collection : c)),
        },
      }
    }),
  addCollection: (collection) =>
    set((state) => {
      if (!state.project) return state
      return {
        project: {
          ...state.project,
          collections: [...state.project.collections, collection],
        },
      }
    }),
  updateEnvironment: (env) =>
    set((state) => {
      if (!state.project) return state
      return {
        project: {
          ...state.project,
          environments: state.project.environments.map((e) => (e.id === env.id ? env : e)),
        },
      }
    }),
  addEnvironment: (env) =>
    set((state) => {
      if (!state.project) return state
      return {
        project: {
          ...state.project,
          environments: [...state.project.environments, env],
        },
      }
    }),
  deleteEnvironment: (id) =>
    set((state) => {
      if (!state.project) return state
      return {
        project: {
          ...state.project,
          environments: state.project.environments.filter((e) => e.id !== id),
        },
      }
    }),
  addProtocolTarget: (envId, protocol, target) =>
    set((state) => {
      if (!state.project) return state
      const environments = state.project.environments.map((env) => {
        if (env.id !== envId) return env
        const current = (env.protocols[protocol] ?? []) as (GrpcTarget | HttpTarget | GraphQLTarget)[]
        return { ...env, protocols: { ...env.protocols, [protocol]: [...current, target] } }
      })
      return { project: { ...state.project, environments } }
    }),
  updateProtocolTarget: (envId, protocol, target) =>
    set((state) => {
      if (!state.project) return state
      const environments = state.project.environments.map((env) => {
        if (env.id !== envId) return env
        const current = (env.protocols[protocol] ?? []) as (GrpcTarget | HttpTarget | GraphQLTarget)[]
        return {
          ...env,
          protocols: {
            ...env.protocols,
            [protocol]: current.map((t) => (t.id === target.id ? target : t)),
          },
        }
      })
      return { project: { ...state.project, environments } }
    }),
  deleteProtocolTarget: (envId, protocol, targetId) =>
    set((state) => {
      if (!state.project) return state
      const environments = state.project.environments.map((env) => {
        if (env.id !== envId) return env
        const current = (env.protocols[protocol] ?? []) as (GrpcTarget | HttpTarget | GraphQLTarget)[]
        return {
          ...env,
          protocols: {
            ...env.protocols,
            [protocol]: current.filter((t) => t.id !== targetId),
          },
        }
      })
      return { project: { ...state.project, environments } }
    }),
  deleteCollection: (id) =>
    set((state) => {
      if (!state.project) return state
      return {
        project: {
          ...state.project,
          collections: state.project.collections.filter((c) => c.id !== id),
        },
      }
    }),
  addEndpoint: (collectionId, endpoint) =>
    set((state) => {
      if (!state.project) return state
      return {
        project: {
          ...state.project,
          collections: state.project.collections.map((c) =>
            c.id === collectionId ? { ...c, endpoints: [...c.endpoints, endpoint] } : c,
          ),
        },
      }
    }),
  updateEndpoint: (collectionId, endpoint) =>
    set((state) => {
      if (!state.project) return state
      return {
        project: {
          ...state.project,
          collections: state.project.collections.map((c) =>
            c.id === collectionId
              ? { ...c, endpoints: c.endpoints.map((ep) => (ep.id === endpoint.id ? endpoint : ep)) }
              : c,
          ),
        },
      }
    }),
  deleteEndpoint: (collectionId, endpointId) =>
    set((state) => {
      if (!state.project) return state
      return {
        project: {
          ...state.project,
          collections: state.project.collections.map((c) =>
            c.id === collectionId
              ? { ...c, endpoints: c.endpoints.filter((ep) => ep.id !== endpointId) }
              : c,
          ),
        },
      }
    }),
}))
