// Progressive Direct-to-Disk Streaming Engine for AirStream
// Eliminates receiver-side RAM ceilings by piping 64KB WebRTC chunks directly to disk
// Supports:
// 1. File System Access API (Chromium showSaveFilePicker -> createWritable)
// 2. Origin Private File System (OPFS navigator.storage.getDirectory -> sandboxed disk)
// 3. Graceful in-memory fallback for small files or legacy environments

export type StorageMode = 'fsa' | 'opfs' | 'ram'

export interface DiskWriter {
  storageMode: StorageMode
  write(chunk: Uint8Array): Promise<void>
  close(): Promise<{ downloadUrl?: string; savedToDisk: boolean }>
  abort(): Promise<void>
}

// Check feature availability
export function isFsaSupported(): boolean {
  return typeof window !== 'undefined' && 'showSaveFilePicker' in window
}

export function isOpfsSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.storage &&
    typeof navigator.storage.getDirectory === 'function'
  )
}

/**
 * Creates a stream writer that writes incoming chunks directly to disk
 * @param fileId Unique file identifier
 * @param fileName Suggested file name
 * @param fileType MIME type
 * @param fileSize Total file size in bytes
 * @param preferredFsaHandle Optional FileSystemFileHandle if user picked location in advance
 */
export async function createDiskStreamWriter(
  fileId: string,
  _fileName: string,
  fileType: string,
  fileSize: number,
  preferredFsaHandle?: any
): Promise<DiskWriter> {
  // 1. If explicit FSA handle is provided (user chose save location)
  if (preferredFsaHandle && typeof preferredFsaHandle.createWritable === 'function') {
    try {
      const writable = await preferredFsaHandle.createWritable()
      return {
        storageMode: 'fsa',
        async write(chunk: Uint8Array) {
          await writable.write(chunk)
        },
        async close() {
          await writable.close()
          return { savedToDisk: true }
        },
        async abort() {
          try {
            await writable.abort()
          } catch {
            // ignore
          }
        },
      }
    } catch (err) {
      console.warn('Failed to initialize FSA stream writer, falling back:', err)
    }
  }

  // 2. OPFS (Origin Private File System) - Supported in Chrome, Firefox, and Safari 15.2+ / iOS
  // Automatically writes chunks to device sandbox disk without prompt
  if (isOpfsSupported() && fileSize >= 50 * 1024 * 1024) {
    try {
      const root = await navigator.storage.getDirectory()
      const safeId = fileId.replace(/[^a-zA-Z0-9_-]/g, '_')
      const tempFileName = `airstream_${safeId}.tmp`
      const fileHandle = await root.getFileHandle(tempFileName, { create: true })

      if (typeof (fileHandle as any).createWritable === 'function') {
        const writable = await (fileHandle as any).createWritable()

        return {
          storageMode: 'opfs',
          async write(chunk: Uint8Array) {
            await writable.write(chunk)
          },
          async close() {
            await writable.close()
            const file = await fileHandle.getFile()
            const downloadUrl = URL.createObjectURL(file)
            return { downloadUrl, savedToDisk: false }
          },
          async abort() {
            try {
              await writable.abort()
            } catch {
              // ignore
            }
            try {
              await root.removeEntry(tempFileName)
            } catch {
              // ignore
            }
          },
        }
      }
    } catch (err) {
      console.warn('OPFS initialization failed or not fully supported in this context, falling back:', err)
    }
  }

  // 3. Tier 3: In-Memory Chunk Accumulator (Fallback for small files or unsupported browsers)
  const chunks: Uint8Array[] = []
  return {
    storageMode: 'ram',
    async write(chunk: Uint8Array) {
      chunks.push(chunk)
    },
    async close() {
      const blob = new Blob(chunks as unknown as BlobPart[], {
        type: fileType || 'application/octet-stream',
      })
      // Clear chunk references
      chunks.length = 0
      const downloadUrl = URL.createObjectURL(blob)
      return { downloadUrl, savedToDisk: false }
    },
    async abort() {
      chunks.length = 0
    },
  }
}
