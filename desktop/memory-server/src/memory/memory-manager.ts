import { randomBytes } from 'node:crypto'
import type { Memory, CreateMemoryInput, UpdateMemoryInput, ListMemoriesOptions } from './types.js'
import { FileBlobStorage } from './file-store.js'

/**
 * MemoryManager — CRUD for conversation memories
 * Stores each turn as a JSON blob with metadata
 */
export class MemoryManager {
  private static readonly PREFIX = 'memory-'
  private static readonly ID_LEN = 12

  constructor(private store: FileBlobStorage) {}

  async create(input: CreateMemoryInput): Promise<Memory> {
    const id = randomBytes(MemoryManager.ID_LEN).toString('hex').slice(0, MemoryManager.ID_LEN)
    const now = Date.now()

    const memory: Memory = {
      id,
      content: input.content,
      createdAt: now,
      updatedAt: now,
      tags: input.tags,
      metadata: input.metadata,
    }

    await this.save(memory)
    return memory
  }

  async get(id: string): Promise<Memory | undefined> {
    const blob = await this.store.retrieve(`${MemoryManager.PREFIX}${id}`)
    if (!blob) return undefined
    try {
      return JSON.parse(blob.content.toString('utf-8')) as Memory
    } catch {
      return undefined
    }
  }

  async update(id: string, input: UpdateMemoryInput): Promise<Memory | undefined> {
    const existing = await this.get(id)
    if (!existing) return undefined

    const updated: Memory = {
      ...existing,
      content: input.content ?? existing.content,
      updatedAt: Date.now(),
      metadata: input.metadata ? { ...existing.metadata, ...input.metadata } : existing.metadata,
    }

    await this.save(updated)
    return updated
  }

  async delete(id: string): Promise<boolean> {
    const exists = await this.store.exists(`${MemoryManager.PREFIX}${id}`)
    if (!exists) return false
    await this.store.delete(`${MemoryManager.PREFIX}${id}`)
    return true
  }

  async list(options: ListMemoriesOptions = {}): Promise<Memory[]> {
    const keys = await this.store.list(MemoryManager.PREFIX)
    const memories: Memory[] = []

    for (const key of keys) {
      const id = key.slice(MemoryManager.PREFIX.length)
      if (id.length !== MemoryManager.ID_LEN) continue // skip attachments
      const mem = await this.get(id)
      if (mem) memories.push(mem)
    }

    // Apply filters
    let filtered = memories
    if (options.source) {
      filtered = filtered.filter((m) => m.metadata?.source === options.source)
    }
    if (options.pinned !== undefined) {
      filtered = filtered.filter((m) => m.metadata?.pinned === options.pinned)
    }
    if (options.sessionId) {
      filtered = filtered.filter((m) => m.metadata?.sessionId === options.sessionId)
    }

    // Sort by recency
    filtered.sort((a, b) => b.updatedAt - a.updatedAt)

    // Pagination
    const start = options.offset ?? 0
    const end = options.limit ? start + options.limit : undefined
    return filtered.slice(start, end)
  }

  async count(options?: ListMemoriesOptions): Promise<number> {
    const all = await this.list(options)
    return all.length
  }

  async search(query: string, limit = 5): Promise<Memory[]> {
    const all = await this.list()
    const queryWords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2)
    if (queryWords.length === 0) return all.slice(0, limit)

    const scored = all.map((memory) => {
      const text = (memory.content + ' ' + (memory.tags?.join(' ') ?? '')).toLowerCase()
      let score = 0
      for (const word of queryWords) {
        if (text.includes(word)) score += 1
      }
      return { memory, score }
    })

    scored.sort((a, b) => b.score - a.score)
    return scored.filter((s) => s.score > 0).slice(0, limit).map((s) => s.memory)
  }

  private async save(memory: Memory): Promise<void> {
    const key = `${MemoryManager.PREFIX}${memory.id}`
    await this.store.store(key, JSON.stringify(memory, null, 2), {
      contentType: 'application/json',
      tags: {
        memoryId: memory.id,
        source: memory.metadata?.source ?? 'unknown',
        sessionId: memory.metadata?.sessionId ?? 'none',
      },
    })
  }
}
