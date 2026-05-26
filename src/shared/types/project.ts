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
}

export interface Collection {
  id: string
  protocol: 'grpc' | 'graphql' | 'http'
  name: string
  protocolTargetId: string
  endpoints: GrpcEndpoint[] | GraphQLEndpoint[]
}

export interface ReqstraProject {
  name: string
  projectDir: string // プロジェクトフォルダの絶対パス（保存時に付与）
  environments: Environment[]
  collections: Collection[]
}
