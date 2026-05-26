import { ipcMain } from 'electron'
import { executeGraphQLRequest, introspectSchema } from '../graphql/client'
import type { GraphQLRequestParams, GraphQLAuth } from '../../shared/types/ipc'

export function registerGraphQLHandlers(): void {
  ipcMain.handle('graphql:request', async (_event, params: GraphQLRequestParams) => {
    return executeGraphQLRequest(params)
  })

  ipcMain.handle(
    'graphql:introspect',
    async (
      _event,
      url: string,
      headers: Record<string, string>,
      auth: GraphQLAuth,
    ) => {
      return introspectSchema(url, headers, auth)
    },
  )
}
