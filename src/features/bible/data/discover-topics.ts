/**
 * Discover topics (PRD §6.2 D). Each card pairs a short passage with one or two sentences of neutral,
 * factual context: book, speaker or author as traditionally identified, setting and audience.
 * No doctrinal claims, no devotional pressure, no quotations beyond the passage itself.
 * Every reference must parse and exist in the bundled WEB text (see curated.test.ts).
 */
export interface CuratedCardSource {
  ref: string;
  context: string;
}

export interface CuratedTopicSource {
  id: string;
  title: string;
  description: string;
  cards: readonly CuratedCardSource[];
}

export const DISCOVER_TOPIC_SOURCES: readonly CuratedTopicSource[] = [
  {
    id: 'faith',
    title: 'Faith',
    description: 'Passages about trust and belief.',
    cards: [
      {
        ref: 'Hebrews 11:1',
        context:
          'From the Letter to the Hebrews, written to early Christians by an author the text does not name. Chapter 11 opens a list of figures from Israel’s history remembered for their faith.',
      },
      {
        ref: 'Genesis 15:5-6',
        context:
          'God promises Abram, later called Abraham, descendants as numerous as the stars. Paul later quotes verse 6 in his letters to the Romans and the Galatians.',
      },
      {
        ref: 'Mark 9:23-24',
        context:
          'In Mark’s Gospel, a father brings his son, troubled by a spirit that throws him to the ground, to Jesus. These verses record their brief exchange about belief.',
      },
      {
        ref: 'Habakkuk 2:4',
        context:
          'The prophet Habakkuk records a dialogue with God about injustice, set as Babylon was rising in power. This verse is part of God’s reply.',
      },
      {
        ref: 'Romans 10:17',
        context:
          'From Paul’s letter to the church in Rome, usually dated to the late 50s AD. In this section he discusses how the message about Jesus is heard and received.',
      },
      {
        ref: 'Matthew 17:20',
        context:
          'Jesus answers his disciples after they were unable to heal a boy. He uses the image of a mustard seed, known to his hearers as a very small seed.',
      },
      {
        ref: 'James 2:17-18',
        context:
          'A letter traditionally attributed to James, a leader of the church in Jerusalem, written to scattered believers. Here he discusses how faith relates to actions.',
      },
      {
        ref: '2 Corinthians 5:7',
        context:
          'Paul writes to the church in Corinth, a Greek port city, in a passage contrasting present hardship with future hope.',
      },
      {
        ref: 'Ephesians 2:8-9',
        context:
          'A letter to believers in Ephesus, traditionally attributed to Paul. In this passage the writer describes salvation as a gift rather than an achievement.',
      },
    ],
  },
  {
    id: 'hope',
    title: 'Hope',
    description: 'Passages about expectation and endurance in hard times.',
    cards: [
      {
        ref: 'Romans 15:13',
        context:
          'Paul closes a section of his letter to the church in Rome, whose members came from Jewish and Gentile backgrounds, with this blessing.',
      },
      {
        ref: 'Jeremiah 29:11',
        context:
          'Part of a letter the prophet Jeremiah sent to people of Judah taken into exile in Babylon in the early sixth century BC. In it he tells them the exile will last seventy years.',
      },
      {
        ref: 'Lamentations 3:22-23',
        context:
          'Lamentations is a set of five poems mourning the destruction of Jerusalem in 587/586 BC, traditionally attributed to Jeremiah. These lines come from the middle of the third poem.',
      },
      {
        ref: 'Psalm 42:11',
        context:
          'A psalm attributed to the sons of Korah, a family of temple musicians. The speaker questions their own soul in a refrain that also appears in Psalm 43.',
      },
      {
        ref: 'Isaiah 40:31',
        context:
          'From the section of Isaiah that opens with a message of comfort for Jerusalem (chapter 40). The chapter contrasts human weakness with God’s strength.',
      },
      {
        ref: 'Romans 5:3-5',
        context:
          'Paul writes to the church in Rome about suffering, describing a sequence that runs from suffering to perseverance, proven character and hope.',
      },
      {
        ref: 'Hebrews 6:19',
        context:
          'The writer of Hebrews uses the image of a ship’s anchor in a passage about God’s promise to Abraham.',
      },
      {
        ref: '1 Peter 1:3',
        context:
          'The opening blessing of a letter attributed to the apostle Peter, written to Christians scattered across several provinces of Asia Minor.',
      },
      {
        ref: 'Psalm 71:5',
        context:
          'A psalm without a title, spoken in the voice of someone growing old who recalls trusting God since youth.',
      },
      {
        ref: 'Revelation 21:4',
        context:
          'Near the end of Revelation, a prophet named John, writing from the island of Patmos, describes a vision of a new heaven and a new earth.',
      },
    ],
  },
  {
    id: 'love',
    title: 'Love',
    description: 'Passages about God’s love and love for others.',
    cards: [
      {
        ref: '1 Corinthians 13:4-7',
        context:
          'Paul writes to the church in Corinth, which was divided over status and spiritual gifts. This chapter describes love and is often read at weddings.',
      },
      {
        ref: 'John 3:16',
        context:
          'From John’s Gospel, in the account of Jesus’ night-time conversation with Nicodemus, a Pharisee and member of the Jewish ruling council.',
      },
      {
        ref: '1 John 4:7-8',
        context:
          'A letter traditionally attributed to the apostle John, written to Christian communities. Love is one of its recurring themes.',
      },
      {
        ref: 'Matthew 22:37-39',
        context:
          'In Jerusalem, an expert in the law asks Jesus which commandment is the greatest. Jesus answers by quoting Deuteronomy 6:5 and Leviticus 19:18.',
      },
      {
        ref: 'Romans 8:38-39',
        context:
          'Paul ends a long section of his letter to the church in Rome with this list of things he says cannot separate believers from God’s love.',
      },
      {
        ref: 'John 15:12-13',
        context:
          'Jesus speaks to his disciples during their last meal together before his arrest, in the farewell discourse of John’s Gospel.',
      },
      {
        ref: 'Ruth 1:16',
        context:
          'Ruth, a widow from Moab, speaks to her mother-in-law Naomi, who is returning to Bethlehem after both women lost their husbands.',
      },
      {
        ref: 'Matthew 5:43-44',
        context:
          'From the Sermon on the Mount (Matthew 5–7), where Jesus teaches his disciples and a crowd on a hillside in Galilee.',
      },
      {
        ref: 'Song of Songs 8:6-7',
        context:
          'The Song of Songs is a collection of love poetry traditionally associated with Solomon. These lines near its end speak of the strength of love.',
      },
      {
        ref: '1 John 3:18',
        context: 'From the first letter traditionally attributed to John, urging readers to show love in action.',
      },
    ],
  },
  {
    id: 'forgiveness',
    title: 'Forgiveness',
    description: 'Passages about forgiving and being forgiven.',
    cards: [
      {
        ref: 'Ephesians 4:32',
        context:
          'From a letter to believers in Ephesus, traditionally attributed to Paul, in a passage about how members of the community should treat one another.',
      },
      {
        ref: 'Matthew 18:21-22',
        context:
          'Peter asks Jesus how many times he should forgive someone. Jesus’ answer is followed by a parable about an unforgiving servant.',
      },
      {
        ref: 'Colossians 3:13',
        context:
          'From a letter to believers in Colossae, a town in Asia Minor, traditionally attributed to Paul. The passage lists qualities for life together.',
      },
      {
        ref: 'Luke 15:20',
        context:
          'From Jesus’ parable of a father and his two sons, often called the parable of the prodigal son, told in the hearing of tax collectors, Pharisees and scribes.',
      },
      {
        ref: 'Psalm 103:10-12',
        context:
          'A psalm attributed to David in which the speaker calls on their own soul to praise God. These verses use images of height and distance.',
      },
      {
        ref: 'Genesis 50:19-21',
        context:
          'Joseph speaks to his brothers in Egypt after the death of their father Jacob. Years earlier they had sold him into slavery.',
      },
      {
        ref: 'Matthew 6:14-15',
        context:
          'In the Sermon on the Mount, Jesus comments on one line of the prayer he has just taught his disciples, known as the Lord’s Prayer.',
      },
      {
        ref: '1 John 1:9',
        context:
          'From the first letter traditionally attributed to the apostle John, in a passage about honesty concerning wrongdoing.',
      },
      {
        ref: 'Micah 7:18',
        context:
          'The book of the prophet Micah, from the eighth century BC, closes with a hymn-like passage that begins with this question.',
      },
      {
        ref: 'Luke 23:34',
        context:
          'Luke’s account of the crucifixion records these words of Jesus. Some early manuscripts do not include the first sentence.',
      },
    ],
  },
  {
    id: 'wisdom',
    title: 'Wisdom',
    description: 'Passages about understanding, insight and good judgment.',
    cards: [
      {
        ref: 'Proverbs 3:5-6',
        context:
          'Proverbs collects instruction traditionally associated with King Solomon. Its first nine chapters are framed as a parent’s advice to a son.',
      },
      {
        ref: 'James 1:5',
        context: 'James writes to scattered believers facing trials and speaks here about asking God for wisdom.',
      },
      {
        ref: 'Psalm 90:12',
        context:
          'Psalm 90 is the only psalm whose title attributes it to Moses. It reflects on the shortness of human life.',
      },
      {
        ref: 'Ecclesiastes 3:1',
        context:
          'Ecclesiastes presents the reflections of “the Preacher”, traditionally identified with Solomon. This poem lists contrasting seasons of life.',
      },
      {
        ref: 'Proverbs 9:10',
        context:
          'From the opening section of Proverbs, where wisdom is pictured as a woman calling out to people passing by.',
      },
      {
        ref: '1 Kings 3:9',
        context:
          'Early in his reign, King Solomon asks God for an understanding heart in a dream at Gibeon.',
      },
      {
        ref: 'James 3:17',
        context: 'James contrasts two kinds of wisdom in a chapter that also discusses the power of speech.',
      },
      {
        ref: 'Matthew 7:24',
        context:
          'Jesus closes the Sermon on the Mount with a short parable about two builders, one who builds on rock and one on sand.',
      },
      {
        ref: 'Proverbs 15:1',
        context:
          'One of the short sayings in the central collection of Proverbs, where many sayings set two contrasting lines side by side.',
      },
    ],
  },
  {
    id: 'patience',
    title: 'Patience',
    description: 'Passages about waiting, endurance and gentleness.',
    cards: [
      {
        ref: 'Galatians 5:22-23',
        context:
          'Paul writes to churches in the Roman province of Galatia and lists qualities he calls “the fruit of the Spirit”.',
      },
      {
        ref: 'James 5:7-8',
        context: 'James uses the example of a farmer waiting for the seasonal rains to encourage his readers to be patient.',
      },
      {
        ref: 'Psalm 27:14',
        context:
          'The closing line of a psalm attributed to David that moves between confidence and urgent prayer.',
      },
      {
        ref: 'Romans 12:12',
        context: 'One line in a series of practical instructions Paul gives to the church in Rome.',
      },
      {
        ref: 'Psalm 37:7',
        context:
          'A psalm attributed to David, arranged in Hebrew as an alphabetic acrostic, that addresses why wrongdoers sometimes seem to prosper.',
      },
      {
        ref: 'Ecclesiastes 7:8',
        context: 'The Preacher compares the end of a matter with its beginning, and patience with pride.',
      },
      {
        ref: 'Lamentations 3:25-26',
        context: 'From the third poem of Lamentations, written in the aftermath of Jerusalem’s fall.',
      },
      {
        ref: '2 Peter 3:9',
        context:
          'A letter attributed to the apostle Peter, responding to people who asked why the promised return of Jesus had not yet come.',
      },
      {
        ref: 'Ephesians 4:2',
        context:
          'From a letter to believers in Ephesus, traditionally attributed to Paul, in a passage urging unity in the church.',
      },
      {
        ref: 'Hebrews 12:1',
        context:
          'After listing figures of faith in chapter 11, the writer of Hebrews uses the image of a long race watched by a crowd.',
      },
    ],
  },
  {
    id: 'courage',
    title: 'Courage',
    description: 'Passages about strength in fear and uncertainty.',
    cards: [
      {
        ref: 'Joshua 1:9',
        context:
          'God speaks to Joshua after the death of Moses, as Joshua prepares to lead Israel across the Jordan River.',
      },
      {
        ref: 'Deuteronomy 31:6',
        context:
          'Near the end of his life, Moses addresses the people of Israel before they enter the land without him.',
      },
      {
        ref: 'Psalm 27:1',
        context: 'The opening of a psalm attributed to David, written as a statement of confidence in the face of enemies.',
      },
      {
        ref: 'Isaiah 41:10',
        context:
          'Addressed to Israel, called God’s servant, in a section of Isaiah that repeatedly tells the people not to be afraid.',
      },
      {
        ref: '2 Timothy 1:7',
        context:
          'A letter attributed to Paul, written to his co-worker Timothy and traditionally dated to Paul’s final imprisonment.',
      },
      {
        ref: 'Esther 4:14',
        context:
          'Mordecai sends a message to his cousin Queen Esther, urging her to approach the Persian king about a decree against the Jewish people.',
      },
      {
        ref: 'Daniel 3:17-18',
        context:
          'Three young Judeans in Babylon, Shadrach, Meshach and Abednego, answer King Nebuchadnezzar, who has ordered them to worship a golden image.',
      },
      {
        ref: '1 Corinthians 16:13-14',
        context: 'Brief instructions near the close of Paul’s first letter to the church in Corinth.',
      },
      {
        ref: 'John 16:33',
        context:
          'Jesus speaks to his disciples on the night before his crucifixion, at the end of his farewell words in John’s Gospel.',
      },
      {
        ref: 'Psalm 31:24',
        context: 'The final verse of a psalm attributed to David, addressed to everyone who hopes in God.',
      },
    ],
  },
  {
    id: 'peace',
    title: 'Peace',
    description: 'Passages about peace with God and with others.',
    cards: [
      {
        ref: 'Philippians 4:6-7',
        context:
          'Paul writes to the church in Philippi, a city in Macedonia, while he is imprisoned. Joy is a recurring theme of the letter.',
      },
      {
        ref: 'John 14:27',
        context:
          'Jesus speaks to his disciples at their last meal before his arrest, in the farewell discourse of John’s Gospel.',
      },
      {
        ref: 'Isaiah 26:3',
        context: 'Part of a song in Isaiah introduced as one to be sung in the land of Judah “in that day”.',
      },
      {
        ref: 'Numbers 6:24-26',
        context:
          'The blessing God gives Moses for Aaron and his sons, the priests, to speak over the people of Israel.',
      },
      {
        ref: 'Matthew 5:9',
        context: 'One of the Beatitudes, the sayings that open the Sermon on the Mount in Matthew’s Gospel.',
      },
      {
        ref: 'Romans 12:18',
        context:
          'From Paul’s instructions to the church in Rome about living with others, including people who oppose them.',
      },
      {
        ref: 'Psalm 4:8',
        context: 'The last verse of a psalm attributed to David, ending with the image of lying down to sleep.',
      },
      {
        ref: 'Colossians 3:15',
        context:
          'From a letter to believers in Colossae, traditionally attributed to Paul, in a passage about life in the Christian community.',
      },
      {
        ref: '2 Thessalonians 3:16',
        context:
          'A closing blessing from a letter to the church in Thessalonica, sent in the names of Paul, Silvanus and Timothy.',
      },
      {
        ref: 'Psalm 46:10',
        context:
          'A psalm attributed to the sons of Korah that pictures natural upheaval and war. God speaks in this verse near its end.',
      },
    ],
  },
  {
    id: 'gratitude',
    title: 'Gratitude',
    description: 'Passages about thankfulness.',
    cards: [
      {
        ref: '1 Thessalonians 5:16-18',
        context:
          'Short instructions near the end of Paul’s first letter to the church in Thessalonica, generally dated among the earliest New Testament writings.',
      },
      {
        ref: 'Psalm 100:4-5',
        context: 'A short psalm titled “A Psalm of thanksgiving”, calling all the earth to worship.',
      },
      {
        ref: 'Psalm 107:1',
        context:
          'The opening of a psalm that describes several groups of people rescued from trouble and calls each to give thanks.',
      },
      {
        ref: 'Colossians 3:17',
        context:
          'From a letter to believers in Colossae, traditionally attributed to Paul. The surrounding verses also speak of being thankful.',
      },
      {
        ref: 'Luke 17:15-16',
        context:
          'On the way to Jerusalem, Jesus heals ten men with leprosy. One of them, a Samaritan, comes back to thank him.',
      },
      {
        ref: '1 Chronicles 16:34',
        context:
          'Part of a song of thanks that David appointed when the ark of the covenant was brought to Jerusalem.',
      },
      {
        ref: 'Philippians 4:11-12',
        context:
          'Paul thanks the church in Philippi for a gift they sent him while he was in prison, and speaks of having learned contentment.',
      },
      {
        ref: 'Psalm 9:1',
        context: 'The opening of a psalm attributed to David, beginning with wholehearted thanks.',
      },
      {
        ref: 'James 1:17',
        context: 'James describes God as the source of every good gift, in a chapter about trials and temptation.',
      },
      {
        ref: 'Ephesians 5:19-20',
        context:
          'From a letter traditionally attributed to Paul, describing worship in the community with psalms, hymns, songs and thanks.',
      },
    ],
  },
  {
    id: 'purpose',
    title: 'Purpose',
    description: 'Passages about calling, work and meaning.',
    cards: [
      {
        ref: 'Jeremiah 1:5',
        context: 'God speaks to Jeremiah when calling him to be a prophet, during the reign of King Josiah of Judah.',
      },
      {
        ref: 'Ephesians 2:10',
        context:
          'From a letter to believers in Ephesus, traditionally attributed to Paul, describing people as created for good works.',
      },
      {
        ref: 'Romans 8:28',
        context: 'Paul writes to the church in Rome in a chapter about life in the Spirit, suffering and hope.',
      },
      {
        ref: 'Micah 6:8',
        context:
          'The prophet Micah answers a question about what offering God requires, in a passage framed as a court case between God and Israel.',
      },
      {
        ref: 'Matthew 5:14-16',
        context: 'From the Sermon on the Mount, where Jesus uses the images of a lamp and a city on a hill.',
      },
      {
        ref: 'Proverbs 19:21',
        context: 'A saying from the central collection of Proverbs that contrasts human plans with God’s purpose.',
      },
      {
        ref: 'Colossians 3:23-24',
        context:
          'In instructions to households in Colossae, the writer addresses people who worked as servants.',
      },
      {
        ref: 'Ecclesiastes 12:13',
        context:
          'Near the close of Ecclesiastes, after the Preacher’s reflections on work, wealth and the meaning of life.',
      },
      {
        ref: 'Philippians 1:6',
        context: 'Paul opens his letter to the church in Philippi with thanks for their partnership with him.',
      },
      {
        ref: 'Acts 20:24',
        context:
          'At Miletus, Paul speaks to the elders of the church in Ephesus before travelling on to Jerusalem.',
      },
    ],
  },
];
