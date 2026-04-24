import type { ArtifactKind } from "@opendesign/contracts";
import {
  ChatMessageSchema,
  ChatThreadSchema,
  type ChatMessage,
  type ChatRole,
  type ChatSelectedNode,
  type ChatThread
} from "@opendesign/contracts/src/chat";

// -----------------------------------------------------------------------------
// Chat repository — persistence for Studio chat threads keyed by artifactId.
//
// Memory is primary (matches the rest of the app's in-memory mode). Postgres
// is stubbed with SQL comments so a future migration can adopt it without
// redesigning the interface. Schema when it lands (sketch):
//
//   create table chat_threads (
//     id text primary key,
//     artifact_id text not null unique references artifacts(id) on delete cascade,
//     artifact_kind text not null,
//     scene_summary text not null,
//     created_at timestamptz not null default now(),
//     updated_at timestamptz not null default now()
//   );
//   create table chat_messages (
//     id text primary key,
//     thread_id text not null references chat_threads(id) on delete cascade,
//     role text not null,
//     content text not null,
//     selected_node jsonb,
//     created_at timestamptz not null default now()
//   );
// -----------------------------------------------------------------------------

interface Queryable {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[]
  ): Promise<{ rows: Row[] }>;
}

export interface EnsureThreadInput {
  artifactId: string;
  artifactKind: ArtifactKind;
  sceneSummary: string;
}

export interface AppendMessageInput {
  artifactId: string;
  role: ChatRole;
  content: string;
  selectedNode?: ChatSelectedNode | null;
}

export interface ChatRepository {
  threadByArtifactId(artifactId: string): Promise<ChatThread | null>;
  /**
   * Fetch the thread, creating it (with a seeded `system` message carrying
   * `sceneSummary`) if one does not yet exist for this artifact.
   */
  ensureThread(input: EnsureThreadInput): Promise<ChatThread>;
  appendMessage(input: AppendMessageInput): Promise<ChatMessage>;
}

function freezeThread(thread: ChatThread): ChatThread {
  return ChatThreadSchema.parse({
    ...thread,
    messages: thread.messages.map((message) => ChatMessageSchema.parse(message))
  });
}

export class InMemoryChatRepository implements ChatRepository {
  private threadsByArtifact = new Map<string, ChatThread>();

  async threadByArtifactId(artifactId: string): Promise<ChatThread | null> {
    const thread = this.threadsByArtifact.get(artifactId);
    return thread ? freezeThread(thread) : null;
  }

  async ensureThread(input: EnsureThreadInput): Promise<ChatThread> {
    const existing = this.threadsByArtifact.get(input.artifactId);
    if (existing) {
      // If the scene summary has drifted (e.g. after a big generation pass)
      // the seeded system message will lag. That's acceptable for v1 — the
      // main thread can explicitly reset the thread when it wants a refresh.
      return freezeThread(existing);
    }

    const threadId = `chat_${crypto.randomUUID()}`;
    const timestamp = new Date().toISOString();
    const systemMessage: ChatMessage = ChatMessageSchema.parse({
      id: `msg_${crypto.randomUUID()}`,
      threadId,
      role: "system",
      content: input.sceneSummary,
      selectedNode: null,
      createdAt: timestamp
    });

    const thread: ChatThread = ChatThreadSchema.parse({
      id: threadId,
      artifactId: input.artifactId,
      artifactKind: input.artifactKind,
      sceneSummary: input.sceneSummary,
      messages: [systemMessage],
      createdAt: timestamp,
      updatedAt: timestamp
    });

    this.threadsByArtifact.set(input.artifactId, thread);
    return freezeThread(thread);
  }

  async appendMessage(input: AppendMessageInput): Promise<ChatMessage> {
    const thread = this.threadsByArtifact.get(input.artifactId);
    if (!thread) {
      throw new Error(
        `Cannot append chat message: no thread exists for artifact ${input.artifactId}. Call ensureThread first.`
      );
    }

    const message: ChatMessage = ChatMessageSchema.parse({
      id: `msg_${crypto.randomUUID()}`,
      threadId: thread.id,
      role: input.role,
      content: input.content,
      selectedNode: input.selectedNode ?? null,
      createdAt: new Date().toISOString()
    });

    const updated: ChatThread = ChatThreadSchema.parse({
      ...thread,
      messages: [...thread.messages, message],
      updatedAt: message.createdAt
    });
    this.threadsByArtifact.set(input.artifactId, updated);
    return message;
  }
}

/**
 * Postgres implementation is intentionally not wired yet. The SQL comments
 * below represent the migration we'd need to adopt durable chat storage.
 * Keeping this class compilable (as an unused stub) prevents the primary
 * in-memory repo from having to own the Postgres type surface later.
 */
export class PostgresChatRepository implements ChatRepository {
  constructor(private readonly database: Queryable) {}

  async threadByArtifactId(_artifactId: string): Promise<ChatThread | null> {
    // SELECT thread + messages JOIN, parse rows through ChatMessageSchema.
    // Example (not yet implemented):
    //   select t.*, json_agg(m order by m.created_at asc) as messages
    //   from chat_threads t left join chat_messages m on m.thread_id = t.id
    //   where t.artifact_id = $1 group by t.id;
    void this.database;
    throw new Error("PostgresChatRepository.threadByArtifactId is not yet implemented.");
  }

  async ensureThread(_input: EnsureThreadInput): Promise<ChatThread> {
    // INSERT INTO chat_threads (...) ON CONFLICT (artifact_id) DO NOTHING
    // RETURNING *; then seed the system message if the row was newly created.
    void this.database;
    throw new Error("PostgresChatRepository.ensureThread is not yet implemented.");
  }

  async appendMessage(_input: AppendMessageInput): Promise<ChatMessage> {
    // INSERT INTO chat_messages (id, thread_id, role, content, selected_node)
    //   VALUES (...) RETURNING *;
    // Plus an UPDATE chat_threads SET updated_at = now() WHERE id = ...
    void this.database;
    throw new Error("PostgresChatRepository.appendMessage is not yet implemented.");
  }
}
