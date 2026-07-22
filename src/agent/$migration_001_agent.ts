// Agent persistence: the transcript and the one durable session row. The db IS
// the transcript — there is no in-memory mirror and no raw protocol log, so a
// message row is the whole record: publish.ts folds each ACP update into it
// (chunks merge by role+kind+messageId on the last row, tool calls upsert by
// toolCallId), messages.ts reads it back in seq order. agent_session replaces
// wmlet's meta.json — only what must survive a restart; status, flags and the
// queue are in-memory and reset at boot.
//
// The message itself is stored as JSON in one column. Everything the UI needs
// already lives in types.agent.Message, so splitting it across columns would
// only mean a migration every time a message grows a field; `id` and `seq` are
// out here because they identify and order the row. The searchable text is
// mirrored into an FTS5 table by triggers.
export default {
    up: (ctx: Context) =>
        ctx.fns.db.exec({
            sql: `
                CREATE TABLE IF NOT EXISTS agent_messages (
                  id         TEXT PRIMARY KEY,
                  seq        INTEGER NOT NULL,
                  message    TEXT NOT NULL,
                  updated_at TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS agent_messages_seq ON agent_messages(seq);

                CREATE VIRTUAL TABLE IF NOT EXISTS agent_messages_fts USING fts5(id UNINDEXED, text);

                CREATE TRIGGER IF NOT EXISTS agent_messages_ai AFTER INSERT ON agent_messages BEGIN
                  INSERT INTO agent_messages_fts (id, text) VALUES (new.id, json_extract(new.message, '$.text'));
                END;
                CREATE TRIGGER IF NOT EXISTS agent_messages_au AFTER UPDATE ON agent_messages BEGIN
                  DELETE FROM agent_messages_fts WHERE id = old.id;
                  INSERT INTO agent_messages_fts (id, text) VALUES (new.id, json_extract(new.message, '$.text'));
                END;
                CREATE TRIGGER IF NOT EXISTS agent_messages_ad AFTER DELETE ON agent_messages BEGIN
                  DELETE FROM agent_messages_fts WHERE id = old.id;
                END;

                CREATE TABLE IF NOT EXISTS agent_session (
                  id       INTEGER PRIMARY KEY CHECK (id = 1),
                  session  TEXT,
                  agent    TEXT,
                  title    TEXT,
                  agent_ms INTEGER NOT NULL DEFAULT 0,
                  at       TEXT
                );
            `,
        }),
    down: (ctx: Context) =>
        ctx.fns.db.exec({
            sql: `
                DROP TRIGGER IF EXISTS agent_messages_ai;
                DROP TRIGGER IF EXISTS agent_messages_au;
                DROP TRIGGER IF EXISTS agent_messages_ad;
                DROP TABLE IF EXISTS agent_messages_fts;
                DROP TABLE IF EXISTS agent_messages;
                DROP TABLE IF EXISTS agent_session;
            `,
        }),
};
