const GOOGLE_ENDPOINT = 'https://translate.googleapis.com/translate_a/single'
const MYMEMORY_ENDPOINT = 'https://api.mymemory.translated.net/get'
const CHUNK_LIMIT = 450
const MAX_TOTAL_CHARS = 9000
const TIMEOUT_MS = 12000
const GOOGLE_TIMEOUT_MS = 7000


export interface TranslateInput {
  text: string
  target: string
  source?: string
  endpoint?: string
}

type Segment = [string, string, unknown, unknown, unknown]

async function fetchJson(url: string, timeout = TIMEOUT_MS): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

/** Google 免费 gtx 接口（或与之兼容的自建接口） */
async function translateGoogle(
  text: string,
  target: string,
  source: string,
  endpoint: string
): Promise<string> {
  const url = `${endpoint}?client=gtx&sl=${encodeURIComponent(source)}&tl=${encodeURIComponent(
    target
  )}&dt=t&q=${encodeURIComponent(text)}`
  const json = (await fetchJson(url, GOOGLE_TIMEOUT_MS)) as Segment[][]
  const segments = json?.[0] ?? []
  const result = segments.map((seg) => (typeof seg[0] === 'string' ? seg[0] : '')).join('')
  if (!result.trim()) throw new Error('empty result')
  return result
}

/** MyMemory 免费接口（无需密钥，作为备选） */
async function translateMyMemory(text: string, target: string, source: string): Promise<string> {
  const langpair =
    source && source !== 'auto' ? `${source}|${target}` : `autodetect|${target}`
  const url = `${MYMEMORY_ENDPOINT}?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(langpair)}`
  const json = (await fetchJson(url)) as {
    responseData?: { translatedText?: string }
    responseStatus?: number | string
    responseDetails?: string
  }
  const status = Number(json?.responseStatus ?? 200)
  if (status && status !== 200) {
    throw new Error(String(json?.responseDetails ?? `status ${status}`).slice(0, 120))
  }
  const result = (json?.responseData?.translatedText ?? '').trim()
  if (!result) throw new Error('empty result')
  // 免费接口在超限时会把警告信息放进译文里，需要识别出来而不是展示给用户
  if (/MYMEMORY WARNING|QUERY LENGTH LIMIT|QUOTA|TOO MANY REQUESTS|INVALID/i.test(result)) {
    throw new Error(result.slice(0, 120))
  }
  return result
}

/** 按段落切分，尽量不切断句子 */
function splitText(text: string, limit: number): string[] {
  const chunks: string[] = []
  let current = ''
  for (const paragraph of text.split(/\n+/)) {
    if (paragraph.length > limit) {
      for (let i = 0; i < paragraph.length; i += limit) {
        chunks.push(paragraph.slice(i, i + limit))
      }
      continue
    }
    if ((current + '\n' + paragraph).length > limit) {
      if (current) chunks.push(current)
      current = paragraph
    } else {
      current = current ? `${current}\n${paragraph}` : paragraph
    }
  }
  if (current) chunks.push(current)
  return chunks.length ? chunks : ['']
}

async function translateChunk(
  text: string,
  target: string,
  source: string,
  customEndpoint: string
): Promise<string> {
  if (customEndpoint) {
    try {
      return await translateGoogle(text, target, source, customEndpoint)
    } catch {
      /* 自定义接口失败则回退到内置通道 */
    }
  }
  // 并发竞速：任一通道先返回结果就采用，避免干等不可达的通道
  try {
    return await Promise.any([
      translateGoogle(text, target, source, GOOGLE_ENDPOINT),
      translateMyMemory(text, target, source)
    ])
  } catch (error) {
    const aggregate = error as AggregateError
    const first = Array.isArray(aggregate?.errors) ? aggregate.errors[0] : undefined
    throw first instanceof Error ? first : new Error('翻译失败')
  }
}

export async function translateText(input: TranslateInput): Promise<string> {
  let text = (input.text ?? '').trim()
  if (!text) return ''
  const truncated = text.length > MAX_TOTAL_CHARS
  if (truncated) text = text.slice(0, MAX_TOTAL_CHARS)
  const target = (input.target || 'zh-CN').replace('_', '-')
  const source = input.source || 'auto'
  const customEndpoint = input.endpoint?.trim() ?? ''
  const chunks = splitText(text, CHUNK_LIMIT)
  const results: string[] = []
  for (const chunk of chunks) {
    try {
      results.push(await translateChunk(chunk, target, source, customEndpoint))
    } catch (error) {
      if (results.length === 0) {
        throw new Error(
          '翻译失败：免费接口有长度与配额限制。请检查网络，或在「设置 → 常规 → 邮件翻译」中填写自建翻译接口（如 LibreTranslate）'
        )
      }
      results.push(chunk)
      console.warn('[翻译] 部分内容翻译失败', error)
    }
  }
  const output = results.join('\n')
  return truncated
    ? `${output}\n\n（正文过长，仅翻译了前 ${MAX_TOTAL_CHARS} 字）`
    : output
}
