# Bible text and data sources

Faithscroll ships one Bible translation, one cross-reference dataset, a topical index and a Bible dictionary, all
bundled in `assets/bible/bible.db`. Every source is public domain or openly licensed for redistribution in a
commercial app. No text comes
from YouVersion, Bible Gateway, or any scraped or unlicensed source (PRD §13: Scripture licensing is a launch gate).

## World English Bible (WEB): public domain

| | |
|---|---|
| Translation | World English Bible ("Classic" edition with "Yahweh"), 2020 stable text |
| Distributor | eBible.org (official), <https://ebible.org/web/> |
| File used | `https://ebible.org/Scriptures/eng-web_usfm.zip` (USFM) |
| Licence | **Public domain.** Not copyrighted. |
| Trademark | "World English Bible" is a trademark of eBible.org. |

From the copyright page in the source archive (`copr.htm`):

> The World English Bible is in the Public Domain. That means that it is not copyrighted. However, "World English
> Bible" is a Trademark of eBible.org. […] All we ask is that if you CHANGE the actual text of the World English
> Bible in any way, you not call the result the World English Bible any more.

**What we change.** Only presentation, never the wording of a verse. The build keeps the 66 Protestant books and drops
the deuterocanon, front matter and glossary. It removes footnotes, cross-reference notes and Strong's-number word
tags, and it turns paragraph, poetry, stanza and heading markup into flags. Verses that exist only as a footnote in
the WEB (Luke 17:36, Acts 8:37, Acts 15:34, Acts 24:7) are left out, as most modern editions do. Romans 16:25 is also
footnote-only, because the WEB prints that doxology as Romans 14:24–26. Because the wording is unchanged, the app may
call the text the "World English Bible" (WEB).

**Required attribution.** None is legally required. Show the translation name wherever Scripture is displayed
("World English Bible (WEB)"), and on Settings → About add:

> Scripture quotations are from the World English Bible (WEB), which is in the public domain. "World English
> Bible" is a trademark of eBible.org.

In code this is `DEFAULT_TRANSLATION` in `src/features/bible/repository.ts`. The `metadata` table in `bible.db`
also stores it (`translation_*` keys).

## Cross references: OpenBible.info, CC BY

| | |
|---|---|
| Dataset | OpenBible.info Bible cross references (based on the Treasury of Scripture Knowledge plus user votes) |
| Page | <https://www.openbible.info/labs/cross-references/> |
| File used | `https://a.openbible.info/data/cross-references.zip` (`cross_references.txt`) |
| Licence | **Creative Commons Attribution (CC BY)**: <https://creativecommons.org/licenses/by/4.0/> |

**What we change.** The build keeps only positively voted references whose verses exist in the WEB text, and at most
the 15 most-voted references per verse. That is about 279,000 of the roughly 345,000 rows.

**Required attribution.** CC BY requires credit, a link to the licence, and a note that the data was changed. Show
it near "Related verses" or "Find related verses", or on Settings → About:

> Cross references from OpenBible.info (https://www.openbible.info/labs/cross-references/), licensed under
> CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Filtered to the most-voted references per verse.

In code this is `CROSS_REFERENCES_ATTRIBUTION` in `src/features/bible/repository.ts`. The `metadata` table in
`bible.db` also stores it (`cross_references_*` keys).

## Topical index: OpenBible.info topics (CC BY) + Nave's Topical Bible (public domain)

The `topics` table merges two sources; topics with the same normalized name become one topic.

| | OpenBible.info topical data | Nave's Topical Bible |
|---|---|---|
| Page | <https://www.openbible.info/topics/> | CrossWire module page: <https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=Nave> |
| File used | `https://a.openbible.info/data/topic-scores.zip` (`topic-scores.txt`, updated weekly) | `https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/Nave.zip` (SWORD zLD, TEI) |
| Licence | **CC BY 4.0** ("Unless otherwise indicated, all content is licensed under a Creative Commons Attribution License"; the file header says "CC-BY License: www.openbible.info/topics") | **Public domain** (module `DistributionLicense=Public Domain`; Orville J. Nave, early 1900s; text from ccel.org) |
| Contents | ~6,700 topics, ~71,000 topic → passage links with a vote-based quality score | 5,322 topics, ~78,000 references grouped under subtopics, plus "See …" links |

**What we change.** OpenBible: only positively scored links whose verses exist in the WEB are kept (score stored as
`weight`). Nave's: the TEI markup is reduced to subtopic labels (the text before the first reference, sentence-cased),
verse ranges and "see also" links; chapter-only references become whole-chapter ranges; references to the
deuterocanon or to verses the WEB omits are dropped. Topic names are title-cased for display.

**Required attribution (OpenBible.info, CC BY 4.0).** Show near topic results / topic pages or on Settings → About:

> Topical data from OpenBible.info (https://www.openbible.info/topics/), licensed under CC BY 4.0
> (https://creativecommons.org/licenses/by/4.0/). Filtered and merged with Nave's Topical Bible (public domain).

In code this is `TOPICS_ATTRIBUTION` in `src/features/bible/study-data/repository.ts`; `bible.db` also stores it
(`topics_*` metadata keys). Nave's needs no attribution; we credit it anyway.

## Easton's Bible Dictionary (1897): public domain

| | |
|---|---|
| Work | M. G. Easton, *Illustrated Bible Dictionary*, 3rd edition, Thomas Nelson, 1897 (illustrations not included) |
| Distributor | CrossWire Bible Society module "Easton" (text source: CCEL), <https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=Easton> |
| File used | `https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/Easton.zip` (SWORD zLD, TEI) |
| Licence | **Public domain** ("Public Domain -- Copy Freely"; module `DistributionLicense=Public Domain`) |

**What we change.** Markup is removed; paragraphs are kept, and Scripture references keep their printed form
("Rom. 11:6") so the app can link them. 3,963 entries. Table `dictionary` (+ `dictionary_fts`).

**Attribution.** Not legally required. We show "Easton's Bible Dictionary (1897), public domain" on dictionary pages.

## Curated content

The Verse of the Day list (`src/features/bible/data/verse-of-the-day.ts`) and the Discover topics
(`src/features/bible/data/discover-topics.ts`) are original to Faithscroll. They hold only references and short,
neutral context sentences. The Scripture text itself always comes from the WEB database.

## Rebuilding `bible.db`

Requires Node 24+ and the installed dev dependency `better-sqlite3`.

```bash
# Downloads all five archives into <os tmp>/faithscroll-bible (outside the repo), then builds.
node scripts/bible/build-bible-db.mjs --download

# Or reuse archives already downloaded into a directory outside the repo:
node scripts/bible/build-bible-db.mjs --sources /path/to/faithscroll-bible

# Options: --out <file> (default assets/bible/bible.db), --max-refs <n> (default 15)
```

The build writes:

- `assets/bible/bible.db` (schema version 2, about 22 MB): tables `verses` (id = book × 1,000,000 + chapter × 1,000 +
  verse), `verses_fts` (FTS5, external content, `porter unicode61 remove_diacritics 2`), `cross_references`,
  `topics` / `topics_fts` / `topic_verses` / `topic_subtopics` / `topic_links`, `dictionary` / `dictionary_fts` and
  `metadata`; then `ANALYZE` and `VACUUM`.
- `src/features/bible/data/verse-counts.ts`: verse counts per chapter and the omitted verse numbers. It is generated,
  so never edit it by hand.

The downloaded archives are untrusted input. They are read in memory and never extracted to disk or executed, and
they must not be committed. The SWORD modules are parsed by `scripts/bible/lib/sword-zld.mjs`, which bounds-checks every
offset and caps decompressed block sizes. After rebuilding, run:

```bash
npx jest src/features/bible --forceExit
```

`data.test.ts` and `data-study.test.ts` check chapter counts against `books.ts`, the total verse count, known verse text, markup leftovers,
the cross-reference integrity, the topical index, the dictionary and the metadata. If the schema or content changes in a way an installed app must
pick up, bump `BIBLE_SCHEMA_VERSION` in `src/features/bible/db/executor.ts` and `SCHEMA_VERSION` in the build
script. The database is copied on device under a versioned file name (`bible-web-v<N>.db`), so a new version
replaces the old copy.
