import { newId, nowIso } from "../lib/id.js";
import type { Chunk, Evidence, SourceRecord } from "../domain/types.js";
import type { MemoryStore } from "../repositories/memory-store.js";

export class IngestionAgent {
  constructor(private readonly store: MemoryStore) {}

  async ingestSourceRecord(sourceRecord: SourceRecord): Promise<{ chunks: Chunk[]; evidence: Evidence[] }> {
    const chunks = chunkText(sourceRecord.text).map((text, ordinal) => ({
      id: newId("chunk"),
      sourceRecordId: sourceRecord.id,
      text,
      ordinal,
      metadata: { sourceType: sourceRecord.sourceType },
      createdAt: nowIso()
    }));

    await this.store.createChunks(chunks);
    const evidence: Evidence[] = [];
    for (const chunk of chunks) {
      evidence.push(
        await this.store.createEvidence({
          id: newId("evidence"),
          type: "chunk",
          sourceId: chunk.id,
          locator: `${sourceRecord.id}#chunk-${chunk.ordinal}`,
          quote: chunk.text.slice(0, 500),
          metadata: { sourceRecordId: sourceRecord.id },
          createdAt: nowIso()
        })
      );
    }

    return { chunks, evidence };
  }
}

export function chunkText(text: string, maxChars = 900): string[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";
  for (const paragraph of paragraphs.length ? paragraphs : [text.trim()]) {
    if (!current) {
      current = paragraph;
      continue;
    }
    if (`${current}\n\n${paragraph}`.length <= maxChars) {
      current = `${current}\n\n${paragraph}`;
    } else {
      chunks.push(current);
      current = paragraph;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

