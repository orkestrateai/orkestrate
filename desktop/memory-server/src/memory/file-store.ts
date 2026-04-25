import { readFile, writeFile, mkdir, unlink, readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { BlobMetadata, StoredBlob } from './types.js'

/**
 * Simple file-based blob storage for local chat memory.
 * Each blob is a file + .meta.json companion.
 */
export class FileBlobStorage {
  private readonly baseDir: string
  private initialized = false

  constructor(baseDir: string) {
    this.baseDir = baseDir
  }

  async initialize(): Promise<void> {
    await mkdir(this.baseDir, { recursive: true })
    this.initialized = true
  }

  close(): void {
    this.initialized = false
  }

  async store(key: string, content: Buffer | string, metadata?: Partial<BlobMetadata>): Promise<StoredBlob> {
    this.ensureInitialized()

    const now = Date.now()
    const data = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf-8')

    const fullMeta: BlobMetadata = {
      createdAt: metadata?.createdAt ?? now,
      updatedAt: metadata?.updatedAt ?? now,
      size: data.length,
      contentType: metadata?.contentType,
      originalName: metadata?.originalName,
      tags: metadata?.tags,
    }

    await writeFile(join(this.baseDir, `${key}.blob`), data)
    await writeFile(join(this.baseDir, `${key}.meta.json`), JSON.stringify(fullMeta, null, 2))

    return { key, content: data, metadata: fullMeta }
  }

  async retrieve(key: string): Promise<StoredBlob | undefined> {
    this.ensureInitialized()
    try {
      const content = await readFile(join(this.baseDir, `${key}.blob`))
      const metaRaw = await readFile(join(this.baseDir, `${key}.meta.json`), 'utf-8')
      const metadata = JSON.parse(metaRaw) as BlobMetadata
      return { key, content, metadata }
    } catch {
      return undefined
    }
  }

  async delete(key: string): Promise<void> {
    this.ensureInitialized()
    try { await unlink(join(this.baseDir, `${key}.blob`)) } catch { /* ignore */ }
    try { await unlink(join(this.baseDir, `${key}.meta.json`)) } catch { /* ignore */ }
  }

  async exists(key: string): Promise<boolean> {
    this.ensureInitialized()
    try {
      await stat(join(this.baseDir, `${key}.blob`))
      return true
    } catch {
      return false
    }
  }

  async list(prefix?: string): Promise<string[]> {
    this.ensureInitialized()
    const files = await readdir(this.baseDir)
    const keys = files.filter((f) => f.endsWith('.blob')).map((f) => f.replace('.blob', ''))
    return prefix ? keys.filter((k) => k.startsWith(prefix)) : keys
  }

  async clear(): Promise<void> {
    this.ensureInitialized()
    const keys = await this.list()
    await Promise.all(keys.map((k) => this.delete(k)))
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('FileBlobStorage not initialized. Call initialize() first.')
    }
  }
}
