import { describe, it, expect } from 'vitest'
import { parseYamlBody } from '../../../src/main/grpc/client'

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
