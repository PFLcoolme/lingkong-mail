import { connect as netConnect, type Socket } from 'node:net'
import { connect as tlsConnect, type TLSSocket } from 'node:tls'
import type { SecurityType } from '@shared/types'

export interface Pop3Config {
  host: string
  port: number
  security: SecurityType
  username: string
  password: string
  timeout?: number
}

export interface Pop3MessageRef {
  index: number
  uid: string
  size: number
}

export class Pop3Error extends Error {}

/** 轻量 POP3 客户端（RFC 1939，支持 STLS / UIDL / TOP） */
export class Pop3Client {
  private socket: Socket | TLSSocket | null = null
  private buffer = ''
  private waiting: ((line: string) => void) | null = null
  private ready: (() => void) | null = null
  private error: ((err: Error) => void) | null = null
  private readonly timeout: number

  constructor(private readonly config: Pop3Config) {
    this.timeout = config.timeout ?? 30000
  }

  private attach(socket: Socket | TLSSocket): void {
    this.socket = socket
    socket.setEncoding('latin1')
    socket.setTimeout(this.timeout)
    socket.on('data', (chunk: string) => {
      this.buffer += chunk
      let idx = this.buffer.indexOf('\r\n')
      while (idx >= 0) {
        const line = this.buffer.slice(0, idx)
        this.buffer = this.buffer.slice(idx + 2)
        idx = this.buffer.indexOf('\r\n')
        const waiter = this.waiting
        if (waiter) {
          this.waiting = null
          waiter(line)
        }
      }
    })
    socket.on('error', (err: Error) => this.error?.(err))
    socket.on('close', () => this.error?.(new Pop3Error('连接已关闭')))
  }

  private nextLine(): Promise<string> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Pop3Error('POP3 响应超时')), this.timeout)
      this.waiting = (line: string) => {
        clearTimeout(timer)
        resolve(line)
      }
      this.error = (err: Error) => {
        clearTimeout(timer)
        reject(err)
      }
      const idx = this.buffer.indexOf('\r\n')
      if (idx >= 0) {
        const line = this.buffer.slice(0, idx)
        this.buffer = this.buffer.slice(idx + 2)
        const waiter = this.waiting
        this.waiting = null
        waiter(line)
      }
    })
  }

  private async expectOk(promise: Promise<string>): Promise<string> {
    const line = await promise
    if (!line.startsWith('+OK')) throw new Pop3Error(line.replace('+OK', '').trim() || line)
    return line
  }

  private async command(cmd: string): Promise<string> {
    if (!this.socket) throw new Pop3Error('未连接')
    const p = this.nextLine()
    this.socket.write(`${cmd}\r\n`, 'latin1')
    return p
  }

  private async commandMultiline(cmd: string): Promise<string[]> {
    if (!this.socket) throw new Pop3Error('未连接')
    const lines: string[] = []
    const done = (async () => {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const line = await this.nextLine()
        if (line === '.') break
        lines.push(line.startsWith('..') ? line.slice(1) : line)
      }
    })()
    this.socket.write(`${cmd}\r\n`, 'latin1')
    await done
    return lines
  }

  async connect(): Promise<void> {
    const { host, port, security } = this.config
    if (security === 'ssl') {
      await new Promise<void>((resolve, reject) => {
        const socket = tlsConnect({ host, port, servername: host }, () => resolve())
        socket.once('error', reject)
        this.attach(socket)
      })
    } else {
      await new Promise<void>((resolve, reject) => {
        const socket = netConnect({ host, port }, () => resolve())
        socket.once('error', reject)
        this.attach(socket)
      })
    }
    await this.expectOk(this.nextLine())
    if (security === 'starttls') {
      await this.expectOk(this.command('STLS'))
      const plain = this.socket as Socket
      await new Promise<void>((resolve, reject) => {
        this.ready = () => resolve()
        const tlsSocket = tlsConnect({ socket: plain, servername: host }, () => resolve())
        tlsSocket.once('error', reject)
        this.attach(tlsSocket)
      })
      this.ready?.()
    }
    await this.expectOk(this.command(`USER ${this.config.username}`))
    await this.expectOk(this.command(`PASS ${this.config.password}`))
  }

  async stat(): Promise<{ count: number; size: number }> {
    const line = await this.expectOk(this.command('STAT'))
    const [count, size] = line.split(' ').slice(1)
    return { count: Number(count) || 0, size: Number(size) || 0 }
  }

  async uidl(): Promise<Pop3MessageRef[]> {
    try {
      const lines = await this.commandMultiline('UIDL')
      return lines.map((line) => {
        const [index, uid] = line.split(' ')
        return { index: Number(index), uid: uid ?? String(index), size: 0 }
      })
    } catch {
      const { count } = await this.stat()
      return Array.from({ length: count }, (_, i) => ({ index: i + 1, uid: `pop3-${i + 1}`, size: 0 }))
    }
  }

  async list(): Promise<Pop3MessageRef[]> {
    try {
      const lines = await this.commandMultiline('LIST')
      return lines.map((line) => {
        const [index, size] = line.split(' ')
        return { index: Number(index), uid: String(index), size: Number(size) || 0 }
      })
    } catch {
      return []
    }
  }

  /** 检索整封邮件原文 */
  async retr(index: number): Promise<Buffer> {
    const lines = await this.commandMultiline(`RETR ${index}`)
    return Buffer.from(lines.join('\r\n') + '\r\n', 'latin1')
  }

  async top(index: number, lines = 0): Promise<Buffer> {
    const result = await this.commandMultiline(`TOP ${index} ${lines}`)
    return Buffer.from(result.join('\r\n') + '\r\n', 'latin1')
  }

  async dele(index: number): Promise<void> {
    await this.expectOk(this.command(`DELE ${index}`))
  }

  async rset(): Promise<void> {
    await this.expectOk(this.command('RSET'))
  }

  async quit(): Promise<void> {
    try {
      await this.command('QUIT')
    } catch {
      /* 忽略退出错误 */
    }
    this.socket?.destroy()
    this.socket = null
  }
}

export async function testPop3(config: Pop3Config): Promise<void> {
  const client = new Pop3Client({ ...config, timeout: 15000 })
  await client.connect()
  await client.stat()
  await client.quit()
}
