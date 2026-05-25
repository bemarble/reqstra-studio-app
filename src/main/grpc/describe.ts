import * as grpc from '@grpc/grpc-js'
import { GrpcReflection } from 'grpc-js-reflection-client'

interface ProtoField {
  type: string
  rule?: string
  resolvedType?: ProtoType | ProtoEnum
}
interface ProtoType {
  fields: Record<string, ProtoField>
}
interface ProtoEnum {
  values: Record<string, number>
}

const PRIMITIVE_DEFAULTS: Record<string, unknown> = {
  string: '',
  int32: 0,
  int64: 0,
  uint32: 0,
  uint64: 0,
  sint32: 0,
  sint64: 0,
  fixed32: 0,
  fixed64: 0,
  sfixed32: 0,
  sfixed64: 0,
  float: 0,
  double: 0,
  bool: false,
  bytes: '',
}

function buildTemplate(
  fields: Record<string, ProtoField>,
  visited: Set<object> = new Set(),
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [name, field] of Object.entries(fields)) {
    if (field.rule === 'repeated') {
      result[name] = []
    } else if (field.resolvedType && 'fields' in field.resolvedType) {
      const nested = field.resolvedType as ProtoType
      if (visited.has(nested)) {
        result[name] = {}
      } else {
        visited.add(nested)
        result[name] = buildTemplate(nested.fields, visited)
      }
    } else if (field.resolvedType) {
      result[name] = 0
    } else {
      result[name] = PRIMITIVE_DEFAULTS[field.type] ?? ''
    }
  }
  return result
}

export async function describeMethod(
  host: string,
  secure: boolean,
  method: string,
): Promise<string> {
  const parts = method.split('/')
  if (parts.length !== 2) return ''
  const [serviceName, methodName] = parts
  if (!serviceName || !methodName) return ''

  const credentials = secure
    ? grpc.credentials.createSsl()
    : grpc.credentials.createInsecure()

  try {
    const client = new GrpcReflection(host, credentials)
    const descriptor = await client.getDescriptorBySymbol(serviceName)
    const root = descriptor.getProtobufJsRoot()
    root.resolveAll()

    const service = root.lookupService(serviceName)
    // protobufjs の Method 型は resolvedRequestType を静的に型付けしないため構造的にキャスト
    const methodDef = service.methods[methodName] as { resolvedRequestType: ProtoType | null } | undefined
    if (!methodDef?.resolvedRequestType) return ''

    const template = buildTemplate(methodDef.resolvedRequestType.fields)
    return JSON.stringify(template, null, 2)
  } catch {
    return ''
  }
}
