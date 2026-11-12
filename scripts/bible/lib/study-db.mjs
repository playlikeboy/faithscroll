/**
 * Schema and inserts for the study data bundled next to the Bible text: the topical index
 * (OpenBible.info + Nave's) and Easton's Bible Dictionary. Used by build-bible-db.mjs.
 */

export function createStudySchema(db) {
  db.exec(`
    CREATE TABLE topics (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      normalized TEXT NOT NULL,
      verse_count INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX topics_normalized ON topics (normalized);
    CREATE VIRTUAL TABLE topics_fts USING fts5(
      name,
      content = 'topics',
      content_rowid = 'id',
      tokenize = 'porter unicode61 remove_diacritics 2'
    );
    -- source: 1 = OpenBible.info (weight = net votes), 2 = Nave's (weight 0, grouped by subtopic)
    CREATE TABLE topic_verses (
      topic_id INTEGER NOT NULL,
      source INTEGER NOT NULL,
      subtopic INTEGER NOT NULL,
      start_verse_id INTEGER NOT NULL,
      end_verse_id INTEGER NOT NULL,
      weight INTEGER NOT NULL,
      PRIMARY KEY (topic_id, source, subtopic, start_verse_id, end_verse_id)
    ) WITHOUT ROWID;
    CREATE TABLE topic_subtopics (
      topic_id INTEGER NOT NULL,
      subtopic INTEGER NOT NULL,
      label TEXT NOT NULL,
      PRIMARY KEY (topic_id, subtopic)
    ) WITHOUT ROWID;
    CREATE TABLE topic_links (
      topic_id INTEGER NOT NULL,
      target_topic_id INTEGER NOT NULL,
      PRIMARY KEY (topic_id, target_topic_id)
    ) WITHOUT ROWID;
    CREATE TABLE dictionary (
      id INTEGER PRIMARY KEY,
      term TEXT NOT NULL,
      normalized TEXT NOT NULL,
      definition TEXT NOT NULL
    );
    CREATE INDEX dictionary_normalized ON dictionary (normalized);
    CREATE VIRTUAL TABLE dictionary_fts USING fts5(
      term,
      definition,
      content = 'dictionary',
      content_rowid = 'id',
      tokenize = 'porter unicode61 remove_diacritics 2'
    );
  `);
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {ReturnType<typeof import('./topics.mjs').toTopicRows>} topics
 * @param {{ id: number, term: string, normalized: string, definition: string }[]} dictionary
 */
export function insertStudyData(db, topics, dictionary) {
  const insertTopic = db.prepare('INSERT INTO topics (id, name, normalized, verse_count) VALUES (@id, @name, @normalized, @verseCount)');
  const insertSubtopic = db.prepare('INSERT INTO topic_subtopics (topic_id, subtopic, label) VALUES (@topicId, @subtopic, @label)');
  const insertVerse = db.prepare(
    `INSERT OR IGNORE INTO topic_verses (topic_id, source, subtopic, start_verse_id, end_verse_id, weight)
     VALUES (@topicId, @source, @subtopic, @start, @end, @weight)`,
  );
  const insertLink = db.prepare('INSERT OR IGNORE INTO topic_links (topic_id, target_topic_id) VALUES (@topicId, @targetId)');
  const insertEntry = db.prepare(
    'INSERT INTO dictionary (id, term, normalized, definition) VALUES (@id, @term, @normalized, @definition)',
  );
  db.transaction(() => {
    for (const row of topics.topicRows) insertTopic.run(row);
    for (const row of topics.subtopicRows) insertSubtopic.run(row);
    for (const row of topics.verseRows) insertVerse.run(row);
    for (const row of topics.linkRows) insertLink.run(row);
    for (const row of dictionary) insertEntry.run(row);
  })();
  db.exec(`
    INSERT INTO topics_fts (topics_fts) VALUES ('rebuild');
    INSERT INTO topics_fts (topics_fts) VALUES ('optimize');
    INSERT INTO dictionary_fts (dictionary_fts) VALUES ('rebuild');
    INSERT INTO dictionary_fts (dictionary_fts) VALUES ('optimize');
  `);
}
