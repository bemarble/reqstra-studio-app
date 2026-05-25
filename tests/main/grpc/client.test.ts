import { describe, it, expect } from 'vitest'
import * as grpc from '@grpc/grpc-js'
import { parseYamlBody, metadataToRecord } from '../../../src/main/grpc/client'

describe('parseYamlBody', () => {
  it('YAMLをJSオブジェクトにパースする', () => {
    const yaml = 'user_id: "alice"\ninclude_deleted: false'
    const result = parseYamlBody(yaml)
    expect(result).toEqual({ user_id: 'alice', include_deleted: false })
  })

  it('空文字は空オブジェクトを返す', () => {
    expect(parseYamlBody('')).toEqual({})
  })

  it('不正なYAMLは空オブジェクトを返す（クラッシュしない）', () => {
    expect(parseYamlBody('{')).toEqual({})
  })
})

describe('metadataToRecord', () => {
  it('Metadataのエントリを文字列Recordに変換する', () => {
    const metadata = new grpc.Metadata()
    metadata.add('key1', 'value1')
    metadata.add('key2', 'value2')
    expect(metadataToRecord(metadata)).toEqual({ key1: 'value1', key2: 'value2' })
  })

  it('空のMetadataは空Recordを返す', () => {
    expect(metadataToRecord(new grpc.Metadata())).toEqual({})
  })

  it('バイナリ値(-binキー)は文字列に変換される', () => {
    const metadata = new grpc.Metadata()
    metadata.add('data-bin', Buffer.from('hello'))
    const result = metadataToRecord(metadata)
    expect(typeof result['data-bin']).toBe('string')
  })
})
