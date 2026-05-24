import * as grpc from '@grpc/grpc-js'
import { GrpcReflection } from 'grpc-js-reflection-client'
import * as yaml from 'yaml'
import type { GrpcRequestParams, GrpcResponse } from '../../shared/types/ipc'

export function parseYamlBody(raw: string): Record<string, unknown> {
  if (!raw.trim()) return {}
  try {
    const parsed: unknown = yaml.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

export async function executeGrpcRequest(
  params: GrpcRequestParams
): Promise<GrpcResponse> {
  const { host, secure, method, body, metadata } = params
  const [serviceName, methodName] = method.split('/')

  if (!serviceName || !methodName) {
    return {
      status: 'ERROR',
      body: null,
      trailers: {},
      durationMs: 0,
      error: `メソッド形式が不正です: "${method}" （"ServiceName/MethodName" 形式で指定してください）`,
    }
  }

  const credentials = secure
    ? grpc.credentials.createSsl()
    : grpc.credentials.createInsecure()

  const start = Date.now()

  try {
    const reflectionClient = new GrpcReflection(host, credentials)
    // getDescriptorBySymbol でサービスのDescriptorを取得し、packageDefinitionに変換する
    const descriptor = await reflectionClient.getDescriptorBySymbol(serviceName)
    const packageDefinition = descriptor.getPackageDefinition()
    const grpcObject = grpc.loadPackageDefinition(packageDefinition)

    const ServiceClient = resolveService(grpcObject, serviceName)
    if (!ServiceClient) {
      throw new Error(`サービス "${serviceName}" が見つかりません`)
    }

    const client = new ServiceClient(host, credentials)
    const requestBody = parseYamlBody(body)
    const grpcMetadata = new grpc.Metadata()
    for (const [k, v] of Object.entries(metadata)) {
      grpcMetadata.add(k, v)
    }

    return await new Promise<GrpcResponse>((resolve) => {
      // grpcクライアントの動的メソッド呼び出し（型定義が静的に解決できないため unknown 経由でキャスト）
      ;(client as unknown as Record<string, (...args: unknown[]) => void>)[methodName](
        requestBody,
        grpcMetadata,
        (err: grpc.ServiceError | null, response: unknown, trailers?: grpc.Metadata) => {
          const durationMs = Date.now() - start
          if (err) {
            resolve({
              status: 'ERROR',
              body: null,
              trailers: {},
              durationMs,
              error: err.message,
            })
          } else {
            const rawTrailers = trailers?.getMap() ?? {}
            const stringTrailers: Record<string, string> = Object.fromEntries(
              Object.entries(rawTrailers).map(([k, v]) => [k, String(v)])
            )
            resolve({
              status: 'OK',
              body: response,
              trailers: stringTrailers,
              durationMs,
            })
          }
        }
      )
    })
  } catch (e) {
    return {
      status: 'ERROR',
      body: null,
      trailers: {},
      durationMs: Date.now() - start,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

function resolveService(
  grpcObject: grpc.GrpcObject,
  serviceName: string
): grpc.ServiceClientConstructor | null {
  const parts = serviceName.split('.')
  let current: grpc.GrpcObject | grpc.ServiceClientConstructor = grpcObject
  for (const part of parts) {
    if (typeof current !== 'object' || current === null) return null
    current = (current as grpc.GrpcObject)[part] as
      | grpc.GrpcObject
      | grpc.ServiceClientConstructor
  }
  if (typeof current === 'function') {
    return current as grpc.ServiceClientConstructor
  }
  return null
}
