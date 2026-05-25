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

export async function reflectServices(
  host: string,
  secure: boolean
): Promise<GrpcServiceInfo[]> {
  const credentials = secure
    ? grpc.credentials.createSsl()
    : grpc.credentials.createInsecure()

  const client = new GrpcReflection(host, credentials)

  const rawServices = await new Promise<string[]>((resolve, reject) => {
    const timerId = setTimeout(() => reject(new Error('タイムアウト')), REFLECT_TIMEOUT_MS)
    client.listServices().then(
      (result) => { clearTimeout(timerId); resolve(result) },
      (err: unknown) => { clearTimeout(timerId); reject(err) },
    )
  })

  const serviceList = buildServiceList(rawServices)

  const results: GrpcServiceInfo[] = []
  for (const svc of serviceList) {
    try {
      const methodList = await client.listMethods(svc.name)
      results.push({ name: svc.name, methods: methodList.map((m) => m.name) })
    } catch {
      results.push({ name: svc.name, methods: [] })
    }
  }

  return results
}
