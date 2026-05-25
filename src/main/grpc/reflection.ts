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

export async function reflectServices(
  host: string,
  secure: boolean
): Promise<GrpcServiceInfo[]> {
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
