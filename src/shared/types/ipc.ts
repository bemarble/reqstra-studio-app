import type { ReqstraProject } from './project'

export interface GrpcServiceInfo {
  name: string
  methods: string[]
}

export interface GrpcRequestParams {
  host: string
  secure: boolean
  method: string // "ServiceName/MethodName"
  body: string   // YAMLの生文字列
  metadata: Record<string, string>
}

export interface GrpcResponse {
  status: 'OK' | 'ERROR'
  body: unknown
  trailers: Record<string, string>
  durationMs: number
  error?: string
  grpcCode?: number
}

export interface LogEntry {
  timestamp: string
  protocol: 'grpc' | 'graphql' | 'http'
  collectionName: string
  endpointName: string
  caseName: string
  status: string
  durationMs: number
  request: unknown
  response: unknown
}

export type GraphQLAuthType = 'none' | 'bearer' | 'basic' | 'oauth2'

export interface GraphQLAuth {
  type: GraphQLAuthType
  token?: string     // bearer / oauth2
  username?: string  // basic
  password?: string  // basic
}

export interface GraphQLRequestParams {
  url: string
  query: string
  variables: string              // YAML文字列（Main Processでパース）
  headers: Record<string, string>
  auth: GraphQLAuth
}

export interface GraphQLResponse {
  status: 'OK' | 'ERROR'
  data: unknown
  errors: unknown[]
  httpStatus: number
  durationMs: number
  error?: string
}

// contextBridgeで公開するAPI
export interface IpcApi {
  openProject: () => Promise<ReqstraProject | null>
  saveProject: (project: ReqstraProject) => Promise<void>
  readCase: (absolutePath: string) => Promise<string>
  writeCase: (absolutePath: string, content: string) => Promise<void>
  deleteCase: (absolutePath: string) => Promise<void>
  listCases: (absoluteCasesDir: string) => Promise<string[]>
  scanCaseDirs: (projectDir: string) => Promise<string[]>
  grpcReflect: (host: string, secure: boolean) => Promise<GrpcServiceInfo[]>
  grpcDescribeMethod: (host: string, secure: boolean, method: string) => Promise<string>
  grpcRequest: (params: GrpcRequestParams) => Promise<GrpcResponse>
  graphqlRequest: (params: GraphQLRequestParams) => Promise<GraphQLResponse>
  graphqlIntrospect: (url: string, headers: Record<string, string>, auth: GraphQLAuth) => Promise<string>
  writeLog: (projectDir: string, entry: LogEntry) => Promise<void>
  readLogs: (projectDir: string, date: string) => Promise<LogEntry[]>
}
