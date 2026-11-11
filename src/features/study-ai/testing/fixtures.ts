/** Test fixtures shaped exactly like the server's structured outputs (see `_shared/ai-schemas.ts`). */

const section = (body: string, kind: 'text' | 'interpretation' = 'text') => ({
  body,
  kind,
  sources: [{ type: 'passage', reference: 'John 3:16', label: 'The passage' }],
});

export function deepStudyFixture() {
  return {
    passage: 'John 3:16',
    overview: section('Jesus speaks with Nicodemus.'),
    historical_background: section('Nicodemus was a Pharisee.'),
    literary_context: section('Part of the dialogue in John 3.'),
    simple_explanation: section('God loves the world and gives his Son.'),
    key_words: { kind: 'text', sources: [], items: [{ term: 'world', explanation: 'Humanity.' }] },
    original_language: {
      kind: 'text',
      sources: [{ type: 'lexical_data', reference: null, label: 'Supplied lexicon' }],
      items: [{ term: 'loved', original: 'ἠγάπησεν', transliteration: 'ēgapēsen', language: 'greek', gloss: 'loved' }],
    },
    related_scripture: { kind: 'text', sources: [], items: [{ reference: 'Romans 5:8', connection: 'God’s love shown.' }] },
    theological_significance: {
      ...section('Many traditions read this as…', 'interpretation'),
      perspectives: [{ tradition: 'Reformed', view: 'Emphasises…' }],
    },
    practical_application: section('Receive and share this love.', 'interpretation'),
    reflection_questions: ['How have you experienced God’s love?'],
    uncertainty_note: null as string | null,
  };
}

export function askAnswerFixture() {
  return {
    answer: 'Jesus is explaining new birth.',
    kind: 'mixed',
    citations: [{ reference: 'John 3:3', note: 'born again' as string | null }],
    uncertainty: null as string | null,
    suggest_pastor: false,
  };
}

export function recapFixture() {
  return {
    title: 'The Power of Forgiveness',
    summary: 'The sermon walked through Peter’s question about forgiveness.',
    main_points: [{ heading: 'Forgiveness is limitless', description: 'Seventy times seven.', timestamps: [65, 300.5] }],
    scripture_references: [{ reference: 'Matthew 18:21-22', timestamp: 120 as number | null, context: 'Peter asks Jesus' as string | null }],
    important_moments: [{ description: 'The parable begins', timestamp: 410 as number | null }],
    discussion_questions: ['Who do you find hard to forgive?'],
    action_items: [{ title: 'Write down one name to pray for', description: null as string | null }],
    reflection_questions: ['Where have I received mercy this week?'],
  };
}
