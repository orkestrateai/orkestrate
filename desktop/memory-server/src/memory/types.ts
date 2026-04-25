/**
 * Core types for Orkestrate chat memory system
 * Adapted from ByteRover for personal conversation memory
 */

export interface Memory {
  id: string
  content: string
  createdAt: number
  updatedAt: number
  tags?: string[]
  metadata?: {
    source?: 'user' | 'assistant' | 'system'
    sessionId?: string
    role?: 'user' | 'assistant'
    pinned?: boolean
    turnIndex?: number
    [key: string]: unknown
  }
}

export interface CreateMemoryInput {
  content: string
  tags?: string[]
  metadata?: Memory['metadata']
}

export interface UpdateMemoryInput {
  content?: string
  metadata?: Memory['metadata']
}

export interface ListMemoriesOptions {
  source?: 'user' | 'assistant' | 'system'
  pinned?: boolean
  sessionId?: string
  limit?: number
  offset?: number
}

export interface StoredBlob {
  key: string
  content: Buffer
  metadata: BlobMetadata
}

export interface BlobMetadata {
  createdAt: number
  updatedAt: number
  size: number
  contentType?: string
  originalName?: string
  tags?: Record<string, string>
}
