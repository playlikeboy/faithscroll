/**
 * Builds the merged topical index from two sources:
 *   - OpenBible.info topical data (CC BY 4.0): "Topic <TAB> OSIS <TAB> score" (score = net votes)
 *   - Nave's Topical Bible (public domain), CrossWire SWORD "Nave" module (TEI entries)
 * Topics with the same normalized name are merged into one topic.
 */
import { parseOsisRange } from './osis.mjs';
import { normalizeName, stripTags, titleCase } from './text.mjs';

export const SOURCE_OPENBIBLE = 1;
export const SOURCE_NAVE = 2;
const MAX_LABEL_LENGTH = 160;
const MAX_NAME_LENGTH = 80;

/**
 * @typedef {{ start: number, end: number, weight: number, source: number, subtopic: number }} TopicVerse
 * @typedef {{ name: string, normalized: string, subtopics: string[], verses: TopicVerse[], seeAlso: Set<string> }} Topic
 */

function topicFor(topics, rawName) {
  const name = rawName.trim().slice(0, MAX_NAME_LENGTH);
  const normalized = normalizeName(name);
  if (!normalized) return null;
  let topic = topics.get(normalized);
  if (!topic) {
    topic = { name: titleCase(name), normalized, subtopics: [], verses: [], seeAlso: new Set() };
    topics.set(normalized, topic);
  }
  return topic;
}

/**
 * @param {Map<string, Topic>} topics merged into (mutated: this is a build-time accumulator)
 * @param {string} text topic-scores.txt
 * @param {import('./osis.mjs').OsisContext} context
 */
export function addOpenBibleTopics(topics, text, context) {
  const stats = { lines: 0, malformed: 0, nonPositive: 0, missingVerse: 0, duplicate: 0, kept: 0 };
  const seen = new Set();
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('Topic\t') || line.startsWith('#')) continue;
    stats.lines += 1;
    const [name, osis, scoreRaw] = line.split('\t');
    const score = Number.parseInt(scoreRaw ?? '', 10);
    if (!name || !osis || !Number.isFinite(score)) {
      stats.malformed += 1;
      continue;
    }
    if (score <= 0) {
      stats.nonPositive += 1;
      continue;
    }
    const range = parseOsisRange(context, osis);
    if (!range) {
      stats.missingVerse += 1;
      continue;
    }
    const topic = topicFor(topics, name);
    if (!topic) {
      stats.malformed += 1;
      continue;
    }
    const key = `${topic.normalized}|${range.start}|${range.end}`;
    if (seen.has(key)) {
      stats.duplicate += 1;
      continue;
    }
    seen.add(key);
    topic.verses.push({ ...range, weight: score, source: SOURCE_OPENBIBLE, subtopic: 0 });
    stats.kept += 1;
  }
  return stats;
}

function truncate(text) {
  if (text.length <= MAX_LABEL_LENGTH) return text;
  const cut = text.slice(0, MAX_LABEL_LENGTH);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), MAX_LABEL_LENGTH / 2)).replace(/[\s;,.:]+$/, '')}…`;
}

/** The subtopic label is the text before the first Scripture reference ("→ Of man for God <ref…"). */
function cleanLabel(markup) {
  const firstRef = markup.search(/<ref\s+osisRef=/);
  const prefix = firstRef >= 0 ? markup.slice(0, firstRef) : markup;
  const text = stripTags(prefix)
    .replace(/^[→\s]+/, '')
    .replace(/[\s;,.:(-]+$/, '')
    .replace(/^[\s;,.:)]+/, '')
    .trim();
  const sentence = text === text.toUpperCase() ? text.charAt(0) + text.slice(1).toLowerCase() : text;
  const fixed = sentence.replace(/^0f\b/i, 'Of').replace(/(\w)['’] s\b/g, '$1’s');
  return truncate(fixed.replace(/\bgod\b/g, 'God').replace(/\bjesus\b/g, 'Jesus'));
}

/** Splits one Nave TEI entry into labelled segments with their OSIS refs and "See …" targets. */
export function parseNaveEntry(markup) {
  const body = markup.replace(/<\/?(?:entryFree|def)[^>]*>/g, '').replace(/<\/?list>/g, '');
  const segments = [];
  let previousLabel = '';
  for (const part of body.split(/<lb\/>|<item>/)) {
    const content = part.replace(/<\/item>/g, '');
    if (!stripTags(content)) continue;
    const refs = [...content.matchAll(/osisRef="([^"]+)"/g)].map((match) => match[1]);
    const seeAlso = [...content.matchAll(/target="Nave:([^"]+)"/g)].map((match) => match[1]);
    let label = cleanLabel(content);
    if (/^see\b/i.test(label) && refs.length === 0) label = '';
    if (!label && refs.length > 0) label = previousLabel;
    if (label) previousLabel = label;
    segments.push({ label, refs, seeAlso });
  }
  return segments;
}

/**
 * @param {Map<string, Topic>} topics merged into
 * @param {{ key: string, text: string }[]} entries Nave module entries
 * @param {import('./osis.mjs').OsisContext} context
 */
export function addNaveTopics(topics, entries, context) {
  const stats = { entries: 0, refs: 0, badRefs: 0, kept: 0, seeAlso: 0 };
  for (const entry of entries) {
    if (!entry.text) continue;
    const topic = topicFor(topics, entry.key);
    if (!topic) continue;
    stats.entries += 1;
    const seen = new Set();
    for (const segment of parseNaveEntry(entry.text)) {
      for (const target of segment.seeAlso) {
        const normalized = normalizeName(target);
        if (normalized && normalized !== topic.normalized) topic.seeAlso.add(normalized);
      }
      if (segment.refs.length === 0) continue;
      let subtopic = 0;
      if (segment.label) {
        const existing = topic.subtopics.indexOf(segment.label);
        subtopic = existing >= 0 ? existing + 1 : topic.subtopics.push(segment.label);
      }
      for (const osis of segment.refs) {
        stats.refs += 1;
        const range = parseOsisRange(context, osis);
        if (!range) {
          stats.badRefs += 1;
          continue;
        }
        const key = `${subtopic}|${range.start}|${range.end}`;
        if (seen.has(key)) continue;
        seen.add(key);
        topic.verses.push({ ...range, weight: 0, source: SOURCE_NAVE, subtopic });
        stats.kept += 1;
      }
    }
  }
  for (const topic of topics.values()) {
    for (const target of topic.seeAlso) if (!topics.has(target)) topic.seeAlso.delete(target);
    stats.seeAlso += topic.seeAlso.size;
  }
  return stats;
}

/**
 * Final rows, ids assigned in alphabetical order of the normalized name. Topics without verses
 * and without "see also" links are dropped.
 */
export function toTopicRows(topics) {
  const kept = [...topics.values()]
    .filter((topic) => topic.verses.length > 0 || topic.seeAlso.size > 0)
    .sort((a, b) => a.normalized.localeCompare(b.normalized));
  const idOf = new Map(kept.map((topic, index) => [topic.normalized, index + 1]));
  const topicRows = [];
  const subtopicRows = [];
  const verseRows = [];
  const linkRows = [];
  for (const topic of kept) {
    const id = idOf.get(topic.normalized);
    const distinct = new Set(topic.verses.map((verse) => `${verse.start}-${verse.end}`));
    topicRows.push({ id, name: topic.name, normalized: topic.normalized, verseCount: distinct.size });
    topic.subtopics.forEach((label, index) => subtopicRows.push({ topicId: id, subtopic: index + 1, label }));
    for (const verse of topic.verses) verseRows.push({ topicId: id, ...verse });
    for (const target of topic.seeAlso) {
      const targetId = idOf.get(target);
      if (targetId) linkRows.push({ topicId: id, targetId });
    }
  }
  return { topicRows, subtopicRows, verseRows, linkRows };
}
