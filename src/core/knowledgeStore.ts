import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export type KnowledgeDocId = 'user-story-structure' | 'gherkin-structure' | 'mapping-guidelines';

const knowledgeFiles: Record<KnowledgeDocId, string> = {
  'user-story-structure': 'user-story-structure.md',
  'gherkin-structure': 'gherkin-structure.md',
  'mapping-guidelines': 'mapping-guidelines.md'
};

export class KnowledgeStore {
  constructor(private readonly knowledgeRootDir: string) {}

  listDocs(): KnowledgeDocId[] {
    return Object.keys(knowledgeFiles) as KnowledgeDocId[];
  }

  async readDoc(docId: KnowledgeDocId): Promise<{ docId: KnowledgeDocId; markdown: string }> {
    const p = join(this.knowledgeRootDir, knowledgeFiles[docId]);
    const markdown = await readFile(p, 'utf8');
    return { docId, markdown };
  }

  async readAll(): Promise<{ userStory: string; gherkin: string; mapping: string }> {
    const [userStory, gherkin, mapping] = await Promise.all([
      this.readDoc('user-story-structure'),
      this.readDoc('gherkin-structure'),
      this.readDoc('mapping-guidelines')
    ]);

    return { userStory: userStory.markdown, gherkin: gherkin.markdown, mapping: mapping.markdown };
  }
}
