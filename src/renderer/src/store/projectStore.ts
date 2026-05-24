import { create } from 'zustand'
import type { ReqstraProject, Collection, Environment } from '../../../shared/types/project'

interface ProjectState {
  project: ReqstraProject | null
  setProject: (project: ReqstraProject) => void
  updateCollection: (collection: Collection) => void
  addCollection: (collection: Collection) => void
  updateEnvironment: (env: Environment) => void
  addEnvironment: (env: Environment) => void
}

export const useProjectStore = create<ProjectState>((set) => ({
  project: null,
  setProject: (project) => set({ project }),
  updateCollection: (collection) =>
    set((state) => {
      if (!state.project) return state
      return {
        project: {
          ...state.project,
          collections: state.project.collections.map((c) =>
            c.id === collection.id ? collection : c
          ),
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
          environments: state.project.environments.map((e) =>
            e.id === env.id ? env : e
          ),
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
}))
