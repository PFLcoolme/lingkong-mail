import { describe, expect, it, vi } from 'vitest'

// mail-parse 依赖 db（→ better-sqlite3，为 Electron ABI 编译，Node 下无法加载），故打桩
vi.mock('../electron/main/services/db', () => ({
  generateId: (prefix: string) => `${prefix}_fixed`,
  getAttachmentsDir: () => '/tmp/kongling-test-attachments'
}))

const { addressesToJson, addressesToText, buildSnippet, safeFilename, toAddresses } = await import(
  '../electron/main/services/mail-parse'
)

const addressObject = (items: { name?: string; address: string }[]): never =>
  ({ value: items }) as never

describe('toAddresses', () => {
  it('空输入返回空数组', () => {
    expect(toAddresses(undefined)).toEqual([])
  })

  it('去除姓名与地址两侧空白', () => {
    expect(toAddresses(addressObject([{ name: ' 张三 ', address: ' z@x.com ' }]))).toEqual([
      { name: '张三', address: 'z@x.com' }
    ])
  })

  it('没有姓名时用地址兜底', () => {
    expect(toAddresses(addressObject([{ address: 'a@x.com' }]))).toEqual([
      { name: 'a@x.com', address: 'a@x.com' }
    ])
  })

  it('跳过空地址', () => {
    expect(toAddresses(addressObject([{ name: '无名', address: '   ' }, { address: 'ok@x.com' }]))).toEqual([
      { name: 'ok@x.com', address: 'ok@x.com' }
    ])
  })

  it('支持 AddressObject 数组', () => {
    const list = toAddresses([
      addressObject([{ name: 'A', address: 'a@x.com' }]),
      addressObject([{ name: 'B', address: 'b@x.com' }])
    ] as never)
    expect(list.map((a) => a.address)).toEqual(['a@x.com', 'b@x.com'])
  })
})

describe('addressesToText', () => {
  it('姓名与地址相同时只输出地址', () => {
    expect(addressesToText([{ name: 'a@x.com', address: 'a@x.com' }])).toBe('a@x.com')
  })

  it('有独立姓名时输出 name <address>，多个用逗号分隔', () => {
    expect(
      addressesToText([
        { name: '张三', address: 'z@x.com' },
        { name: 'a@x.com', address: 'a@x.com' }
      ])
    ).toBe('张三 <z@x.com>, a@x.com')
  })
})

describe('addressesToJson', () => {
  it('输出可被解析的 JSON', () => {
    const json = addressesToJson([{ name: '张三', address: 'z@x.com' }])
    expect(JSON.parse(json)).toEqual([{ name: '张三', address: 'z@x.com' }])
  })
})

describe('buildSnippet', () => {
  it('优先使用纯文本正文', () => {
    expect(buildSnippet('纯文本', '<p>HTML</p>')).toBe('纯文本')
  })

  it('无纯文本时剥离 HTML 标签', () => {
    expect(buildSnippet('', '<div><b>你好</b> 世界</div>')).toBe('你好 世界')
  })

  it('折叠连续空白', () => {
    expect(buildSnippet('a   \n\n  b', '')).toBe('a b')
  })

  it('截断到 220 字符', () => {
    expect(buildSnippet('x'.repeat(500), '').length).toBe(220)
  })
})

describe('safeFilename', () => {
  it('替换路径分隔符与非法字符', () => {
    expect(safeFilename('a/b\\c:d*e?f"g<h>i|j')).toBe('a_b_c_d_e_f_g_h_i_j')
  })

  it('空名回退为 attachment', () => {
    expect(safeFilename('')).toBe('attachment')
    expect(safeFilename('///')).toBe('___')
  })

  it('超长名截断到 120 字符', () => {
    expect(safeFilename('x'.repeat(200)).length).toBe(120)
  })
})
