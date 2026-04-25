import type { Memory } from './types.js'
import { MemoryManager } from './memory-manager.js'
import { FileBlobStorage } from './file-store.js'

/**
 * ChatMemoryService — high-level wrapper for conversation memory
 * Handles storing turns and retrieving relevant context
 */
export class ChatMemoryService {
  private manager: MemoryManager
  private store: FileBlobStorage
  private initialized = false
  private turnCounter = 0

  constructor(private baseDir: string) {
    this.store = new FileBlobStorage(baseDir)
    this.manager = new MemoryManager(this.store)
  }

  async initialize(): Promise<void> {
    if (this.initialized) return
    await this.store.initialize()
    this.initialized = true
  }

  async storeTurn(
    sessionId: string,
    role: 'user' | 'assistant',
    content: string,
    extraTags?: string[],
  ): Promise<Memory> {
    await this.initialize()
    this.turnCounter++

    const tags = [...(extraTags ?? [])]
    if (role === 'user') tags.push('user-message')
    else tags.push('assistant-message')

    return this.manager.create({
      content,
      tags,
      metadata: {
        source: role,
        role,
        sessionId,
        turnIndex: this.turnCounter,
      },
    })
  }

  async findRelevantMemories(query: string, limit = 5): Promise<Memory[]> {
    await this.initialize()
    return this.manager.search(query, limit)
  }

  async getRecentMemories(sessionId?: string, limit = 10): Promise<Memory[]> {
    await this.initialize()
    return this.manager.list({
      sessionId,
      limit,
    })
  }

  async getStats(): Promise<{ totalMemories: number; totalSize: number }> {
    await this.initialize()
    const all = await this.manager.list()
    let totalSize = 0
    for (const mem of all) {
      totalSize += Buffer.byteLength(JSON.stringify(mem))
    }
    return { totalMemories: all.length, totalSize }
  }

  async clear(): Promise<void> {
    await this.store.clear()
  }
}
