# Office knowledge search

Markdown on R2 is truth. Search is a disposable cache plus an in-memory ranker. The agent calls `knowledge.search` / `read` / `write` inside Code Mode `code` — not top-level chat tools, not this computer.

## What we shipped

- One hidden `{workspaceId}/_search/index.json`: path, title, description, clipped body.
- Fielded BM25 in the Worker (`packages/core/src/knowledge-search.ts`).
- Cap **800** files (`MAX_KNOWLEDGE_ENTRIES`, R2 `LIST_CAP`). Past that, `truncated: true`.
- Rebuild on first miss (one R2 `GET` per note). A write patches the snapshot.
- Leftover `_search/manifest.json` + `_search/s/*.json` shards are read once, then folded into `index.json`.

Library UI still filters the tree client-side. The ranked index is for the agent (and any future RPC search).

## Self-improving office

Search + `knowledge.write` let a playbook compound. v1 office chat is Pi on the home `RoomActor`. Poke / guest / REST turns use the same person. Do not add a second office transcript.

After ~15 settled UI tool parts, the actor appends a hidden user nudge (`metadata.source = office-review`) and runs another turn on the same session. If it files or patches a playbook, it says the path in one short line. If nothing belongs in the office, it replies `Skip` and the thread stays quiet.

Live turns already get the same rule: file, then a short message with the path. Do not announce a write that did not happen. Do not auto-extract chat into notes.

## Ranker

| | |
|---|---|
| Fields | path ×4, title ×6, description ×3, body ×1 |
| BM25 | k1=1.2, b=0.75, term frequency (not unique-only) |
| Body | 24k chars plus all markdown headings |
| Soft AND | coverage² over query tokens |
| Phrases | title/path ×1.2, body ×0.6 when query has ≥2 tokens |
| Tokenizer | Unicode letters/numbers, min length 2 |
| Indonesian | extra tokens for `-nya -ku -mu -lah -kah -pun` (no Sastrawi — CC-BY-NC) |

Do not enable FTS5 Porter on Indonesian. It zeroes titles like `Memperbarui Aplikasimu`.

## Why this shape

An office vault is tens to hundreds of notes (handbook, playbooks, a translated docs set). 283 Kubernetes pages is already large. 800 is past a Worker’s ~1000-subrequest rebuild budget with one `GET` per file.

Shards of the *same* forward index do not scale queries: search still loads every doc. Inverted indexes (Tantivy-on-R2) and D1 FTS5 are the next product if a real workspace hits 800. Not v1.

## Benchmarks (2026-09-02)

Offline, local Node. Not in a Worker. Corpora were cloned under `/tmp/kb-eval` and **deleted after the run** — do not re-check them in.

Same ranker as production vs SQLite FTS5 (`unicode61`, and Porter where noted). Queries are labeled paths (hand + title + body slices), not click logs.

### Office-shaped markdown

| Corpus | Files | Ours Hit@1 / @5 | FTS5 Porter @1/@5 | FTS5 unicode61 @1/@5 |
|---|---:|---:|---:|---:|
| [TypeScript handbook](https://github.com/microsoft/TypeScript-Website) (en) | 133 | hand 92/100, title **100/100**, body 3-gram 48/75 | hand 58/92, title 68/95 | hand 58/100, title 76/97 |
| [Kubernetes docs](https://github.com/kubernetes/website) `content/id` | 283 | hand 92/100, title **99/100**, clitic **100/100** | clitic **0/0**, title 79/98 | clitic **0/0**, title 81/98 |
| [Obsidian Help](https://github.com/obsidianmd/obsidian-help) `en` (ranker A/B) | 175 | title **96–97%** @1; hand 89–100% @1 | title 81% @1; hand 78% @1 | — |

On those vaults, **title / feature-name queries favor us** (field weights). FTS5 Porter **hurts Indonesian possessives**. Body/long-tail improved after dropping a 4k clip for 24k + coverage/phrase; FTS5 still wins some unique body 3-grams.

Obsidian Help variant rollup (Hit@1): `phrase-24k` hand 100% / title 97% / body 45% vs FTS5 hand 78% / title 81% / body 45%. Latency ~12 ms/query in Node on that vault.

### MIRACL Indonesian Wikipedia (dev)

Full corpus is **1,446,315** passages, **~507 MB** text — cannot live in a 128 MB Worker as `index.json`.

What we ranked: **960** native questions, **8,286** judged passages (~6 MB). Easier than full Wikipedia.

| | Hit@1 | Hit@10 | nDCG@10 | ms/q |
|---|---:|---:|---:|---:|
| **Ours** (product ranker) | 56% | 92% | 0.63 | 147 |
| FTS5 AND, full question | ~1% | ~1% | ~0 | ~0 |
| FTS5 AND, drop question words | 27% | — | — | — |
| FTS5 **OR** | 58–60% | 97% | ~0.70 | ~4 |

The agent searches **keywords**, not `Dimana James Hepburn meninggal?`. AND-on-the-whole-question is not a fair FTS5 headline. OR is in the same band as ours on this pool; FTS5 is faster because it is inverted. Ours is the right default for an 800-file office with title-heavy queries.

## Do not

- Put office FTS in home `RoomActor` SQLite.
- Raise the cap to 10k without paged rebuild or D1.
- Check in eval dumps or Sastrawi.
- Silent background `generateText` / a second OpenAI-compatible client for filing.
- Stamp office-review triggers as a human sender.
