export type GraphQLAuthType = 'none' | 'bearer' | 'basic' | 'oauth2'

export interface GraphQLAuth {
  type: GraphQLAuthType
  token?: string     // bearer / oauth2
  username?: string  // basic
  password?: string  // basic
}

export interface GrpcTarget {
  id: string
  name: string
  host: string
  secure: boolean
}

export interface GraphQLTarget {
  id: string
  name: string
  url: string  // "http://localhost:8080/graphql"（フルエンドポイントURL）
}

export interface HttpTarget {
  id: string
  name: string
  baseUrl: string
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
export type HttpBodyType = 'json' | 'query'

export interface HttpEndpoint {
  id: string
  name: string
  method: HttpMethod
  path: string
  bodyType: HttpBodyType
  casesDir: string
  headers?: Record<string, string>
  auth?: GraphQLAuth
}

export interface EnvironmentProtocols {
  grpc?: GrpcTarget[]
  graphql?: GraphQLTarget[]
  http?: HttpTarget[]
}

export interface Environment {
  id: string
  name: string
  protocols: EnvironmentProtocols
}

export interface GrpcEndpoint {
  id: string
  name: string
  method: string // "ServiceName/MethodName" e.g. "UserService/GetUser"
  casesDir: string // "requests/grpc/UserService/GetUser"
}

export interface GraphQLEndpoint {
  id: string
  name: string      // 操作名 e.g. "GetUser"
  casesDir: string  // "requests/graphql/GetUser"
  query?: string    // GraphQLクエリ文字列（コレクション単位で保持）
  headers?: Record<string, string>
  auth?: GraphQLAuth
}

export interface Collection {
  id: string
  protocol: 'grpc' | 'graphql' | 'http'
  name: string
  protocolTargetId: string
  endpoints: GrpcEndpoint[] | GraphQLEndpoint[] | HttpEndpoint[]
}

export interface ReqstraProject {
  name: string
  projectDir: string // プロジェクトフォルダの絶対パス（保存時に付与）
  environments: Environment[]
  collections: Collection[]
}
