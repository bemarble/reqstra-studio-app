import * as net from 'net'
import * as grpc from '@grpc/grpc-js'
import { GrpcReflection } from 'grpc-js-reflection-client'
import type { GrpcServiceInfo } from '../../shared/types/ipc'

const INTERNAL_SERVICE_PREFIXES = ['grpc.reflection', 'grpc.health']

export function buildServiceList(rawServiceNames: string[]): GrpcServiceInfo[] {
  return rawServiceNames
    .filter((name) => !INTERNAL_SERVICE_PREFIXES.some((prefix) => name.startsWith(prefix)))
    .map((name) => ({ name, methods: [] }))
}

const REFLECT_TIMEOUT_MS = 5000

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timerId = setTimeout(() => reject(new Error('タイムアウト')), ms)
    promise.then(
      (result) => { clearTimeout(timerId); resolve(result) },
      (err: unknown) => { clearTimeout(timerId); reject(err) },
    )
  })
}

// gRPCクライアント作成前にTCPレベルで接続確認する。
// @grpc/grpc-jsの接続リトライがNode.jsイベントループを占有してsetTimeoutを
// ブロックするため、独立したnet.Socketで先にタイムアウトを確保する。
function checkTcpConnection(host: string, timeoutMs: number): Promise<void> {
  const lastColon = host.lastIndexOf(':')
  const hostname = lastColon !== -1 ? host.slice(0, lastColon) : host
  const port = lastColon !== -1 ? parseInt(host.slice(lastColon + 1), 10) : 50051

  return new Promise((resolve, reject) => {
    const socket = new net.Socket()
    const timer = setTimeout(() => {
      socket.destroy()
      reject(new Error(`接続タイムアウト: ${host} に ${timeoutMs}ms 以内に接続できませんでした`))
    }, timeoutMs)

    socket.connect(port, hostname, () => {
      clearTimeout(timer)
      socket.destroy()
      resolve()
    })

    socket.on('error', (err) => {
      clearTimeout(timer)
      reject(new Error(`接続失敗: ${(err as NodeJS.ErrnoException).message}`))
    })
  })
}

export async function reflectServices(
  host: string,
  secure: boolean
): Promise<GrpcServiceInfo[]> {
  await checkTcpConnection(host, REFLECT_TIMEOUT_MS)

  const credentials = secure
    ? grpc.credentials.createSsl()
    : grpc.credentials.createInsecure()

  const client = new GrpcReflection(host, credentials)
  const deadline = new Date(Date.now() + REFLECT_TIMEOUT_MS)

  const rawServices = await withTimeout(
    client.listServices('*', { deadline }),
    REFLECT_TIMEOUT_MS,
  )

  const serviceList = buildServiceList(rawServices)

  const results: GrpcServiceInfo[] = []
  for (const svc of serviceList) {
    try {
      const methodList = await withTimeout(
        client.listMethods(svc.name, { deadline }),
        REFLECT_TIMEOUT_MS,
      )
      results.push({ name: svc.name, methods: methodList.map((m) => m.name) })
    } catch {
      results.push({ name: svc.name, methods: [] })
    }
  }

  return results
}
