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

// contextBridgeで公開するAPI
export interface IpcApi {
  openProject: () => Promise<ReqstraProject | null>
  saveProject: (project: ReqstraProject) => Promise<void>
  readCase: (absolutePath: string) => Promise<string>
  writeCase: (absolutePath: string, content: string) => Promise<void>
  deleteCase: (absolutePath: string) => Promise<void>
  listCases: (absoluteCasesDir: string) => Promise<string[]>
  grpcReflect: (host: string, secure: boolean) => Promise<GrpcServiceInfo[]>
  grpcDescribeMethod: (host: string, secure: boolean, method: string) => Promise<string>
  grpcRequest: (params: GrpcRequestParams) => Promise<GrpcResponse>
  writeLog: (projectDir: string, entry: LogEntry) => Promise<void>
  readLogs: (projectDir: string, date: string) => Promise<LogEntry[]>
}
