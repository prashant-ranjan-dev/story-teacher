import {
  CurriculumTopic,
  ClassGrade,
  InProgressSession,
  Story,
  StudentProfile,
  TopicMasteryRecord,
} from '../types/story';

/**
 * A brand-new student starts with a blank profile and zero progress.
 * (The previous build shipped a fake "Aarav" with 480 XP, a 5-day streak, a 72%-complete lesson and
 * two completed topics, which polluted the progress screens and the guardian report for real users.)
 */
export const INITIAL_STUDENT_PROFILE: StudentProfile = {
  id: 'student-local-01',
  name: '',
  classGrade: 5,
  interests: ['Animals', 'Space', 'Adventure'],
  favoriteSubjects: ['Science', 'Mathematics'],
  avatar: 'explorer-bear',
  xp: 0,
  stars: 0,
  streakDays: 0,
};

export const INITIAL_IN_PROGRESS: InProgressSession[] = [];
export const INITIAL_MASTERY_HISTORY: TopicMasteryRecord[] = [];

/** Sample data for demos and screenshots only. Enable by opening the app with `?demo=1`. */
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

export const DEMO_STUDENT_PROFILE: StudentProfile = {
  ...INITIAL_STUDENT_PROFILE,
  id: 'student-aarav-demo',
  name: 'Aarav',
  xp: 480,
  stars: 14,
  streakDays: 5,
};

export const DEMO_MASTERY_HISTORY: TopicMasteryRecord[] = [
  {
    topicId: 'sci-water-cycle',
    topic: 'The Water Cycle',
    title: 'Where Does Rain Really Come From?',
    subject: 'Science',
    understandingScore: 91,
    timeSpentMinutes: 15,
    completedAt: daysAgo(1),
    concepts: [
      { conceptTag: 'Evaporation & solar heat', status: 'Strong', score: 95 },
      { conceptTag: 'Condensation in clouds', status: 'Strong', score: 90 },
      { conceptTag: 'Precipitation & collection', status: 'Strong', score: 88 },
    ],
    detectedMisconceptions: [],
  },
  {
    topicId: 'sci-plant-lifecycle',
    topic: 'Photosynthesis',
    title: 'How Does a Plant Make Its Own Food?',
    subject: 'Science',
    understandingScore: 76,
    timeSpentMinutes: 14,
    completedAt: daysAgo(3),
    concepts: [
      { conceptTag: 'Inputs of photosynthesis', status: 'Strong', score: 86 },
      { conceptTag: 'Leaf structures & chlorophyll', status: 'Strong', score: 82 },
      { conceptTag: 'Oxygen & energy production', status: 'Practice More', score: 60 },
    ],
    detectedMisconceptions: [
      {
        misconception: 'Plants take in prepared food directly from the soil',
        correctConcept: 'Plants absorb water and minerals from soil, then make their own glucose in leaves using sunlight.',
      },
    ],
  },
];

export const CURRICULUM_TOPICS: CurriculumTopic[] = [
  {
    id: 'sci-hibernation',
    classGrades: [3, 4, 5, 6, 7],
    subject: 'Science',
    domain: 'Animals',
    topic: 'Hibernation',
    engagingTitle: 'Why Does a Bear Sleep for Months?',
    hookDescription: 'Discover one of nature’s strangest survival tricks before the first winter blizzard hits Pinecrest Ridge.',
    estimatedMinutes: 12,
    imageKey: 'hibernation',
    learningObjectives: [
      { id: 'lo-hib-1', text: 'Understand what hibernation means', conceptTag: 'What hibernation means' },
      { id: 'lo-hib-2', text: 'Understand why some animals hibernate', conceptTag: 'Why animals hibernate' },
      { id: 'lo-hib-3', text: 'Identify examples of hibernating animals', conceptTag: 'Animals that hibernate' },
      { id: 'lo-hib-4', text: 'Explain how body energy conservation works in winter', conceptTag: 'Energy conservation' },
    ],
    nextRecommendedTopicId: 'sci-winter-survival',
  },
  {
    id: 'sci-winter-survival',
    classGrades: [3, 4, 5, 6, 7],
    subject: 'Science',
    domain: 'Animals',
    topic: 'Animal Winter Adaptations & Energy Conservation',
    engagingTitle: 'How Do Animals Survive Winter?',
    hookDescription: 'Discover the incredible strategies animals use to survive freezing temperatures through migration, insulation, and energy conservation.',
    estimatedMinutes: 10,
    imageKey: 'hibernation',
    learningObjectives: [
      { id: 'lo-win-1', text: 'Compare migration, hibernation, and winter adaptation', conceptTag: 'Winter survival strategies' },
      { id: 'lo-win-2', text: 'Understand how fat layers and fur conserve thermal energy', conceptTag: 'Energy conservation' },
      { id: 'lo-win-3', text: 'Identify animals that migrate vs hibernate', conceptTag: 'Animals that hibernate' },
    ],
    nextRecommendedTopicId: 'sci-plant-lifecycle',
  },
  {
    id: 'sci-plant-lifecycle',
    classGrades: [4, 5, 6, 7, 8],
    subject: 'Science',
    domain: 'Plants',
    topic: 'Photosynthesis',
    engagingTitle: 'How Does a Plant Make Its Own Food?',
    hookDescription: 'Step inside a living emerald leaf factory where sunlight, water, and air turn into life-giving fuel.',
    estimatedMinutes: 14,
    imageKey: 'photosynthesis',
    learningObjectives: [
      { id: 'lo-pho-1', text: 'Understand the inputs of photosynthesis (sunlight, water, carbon dioxide)', conceptTag: 'Inputs of photosynthesis' },
      { id: 'lo-pho-2', text: 'Understand the role of chlorophyll and stomata in leaves', conceptTag: 'Leaf structures & chlorophyll' },
      { id: 'lo-pho-3', text: 'Identify glucose and oxygen as key outputs', conceptTag: 'Oxygen & energy production' },
    ],
    nextRecommendedTopicId: 'sci-water-cycle',
  },
  {
    id: 'sci-water-cycle',
    classGrades: [3, 4, 5, 6, 7],
    subject: 'Science',
    domain: 'Earth',
    topic: 'The Water Cycle',
    engagingTitle: 'Where Does Rain Really Come From?',
    hookDescription: 'Follow a single drop of ocean water as it rises into the sky, rides a storm cloud, and returns to the mountains.',
    estimatedMinutes: 12,
    imageKey: 'water_cycle',
    learningObjectives: [
      { id: 'lo-wat-1', text: 'Explain how solar heat drives evaporation', conceptTag: 'Evaporation & solar heat' },
      { id: 'lo-wat-2', text: 'Understand how cooling vapor forms clouds via condensation', conceptTag: 'Condensation in clouds' },
      { id: 'lo-wat-3', text: 'Describe precipitation and collection in rivers and oceans', conceptTag: 'Precipitation & collection' },
    ],
    nextRecommendedTopicId: 'sci-solar-system',
  },
  {
    id: 'sci-solar-system',
    classGrades: [4, 5, 6, 7, 8, 9],
    subject: 'Science',
    domain: 'Space',
    topic: 'Gravity & Planetary Orbits',
    engagingTitle: 'Why Don’t Planets Float Away Into Space?',
    hookDescription: 'Launch from the High Peak Observatory to uncover the invisible gravitational tether keeping eight worlds in motion.',
    estimatedMinutes: 15,
    imageKey: 'solar_system',
    learningObjectives: [
      { id: 'lo-spa-1', text: 'Understand gravity as an attractive force between masses', conceptTag: 'Gravitational pull' },
      { id: 'lo-spa-2', text: 'Distinguish rocky inner planets from gas giants', conceptTag: 'Planetary composition' },
      { id: 'lo-spa-3', text: 'Explain how forward velocity and gravity create a stable orbit', conceptTag: 'Orbital balance' },
    ],
  },
  {
    id: 'math-fractions',
    classGrades: [3, 4, 5, 6],
    subject: 'Mathematics',
    domain: 'Fractions',
    topic: 'Equivalent Fractions & Proportions',
    engagingTitle: 'Who Got the Bigger Slice of the Lantern Pizza?',
    hookDescription: 'Solve the Great Stone-Oven Bakery mystery where 2/4 and 4/8 of a harvest pie spark a friendly debate.',
    estimatedMinutes: 12,
    imageKey: 'fractions',
    learningObjectives: [
      { id: 'lo-fra-1', text: 'Understand numerator and denominator meanings', conceptTag: 'Numerator & denominator' },
      { id: 'lo-fra-2', text: 'Identify equivalent fractions visually and numerically', conceptTag: 'Equivalent fractions' },
      { id: 'lo-fra-3', text: 'Compare fractions with different denominators', conceptTag: 'Comparing proportions' },
    ],
  },
];

function buildHibernationStory(classGrade: ClassGrade, studentName: string): Story {
  const isOlder = classGrade >= 6;
  return {
    id: `story-hibernation-c${classGrade}`,
    topicId: 'sci-hibernation',
    title: 'Why Does a Bear Sleep for Months?',
    topic: 'Hibernation',
    subject: 'Science',
    classGrade,
    protagonist: 'Maya & Barnaby the Brown Bear',
    imageKey: 'hibernation',
    learningObjectives: [
      'Understand what hibernation means',
      'Understand why some animals hibernate',
      'Identify examples of hibernating animals',
      'Explain how body energy conservation works in winter',
    ],
    sections: [
      {
        id: 'sec-1',
        type: 'story',
        chapterHeading: 'Chapter 1: The Vanishing Berry Bushes',
        narrative: isOlder
          ? `Late October had arrived on Pinecrest Ridge, and ${studentName} joined young wildlife tracker Maya along the frost-covered trail. Below them in the clearing stood Barnaby, a 250-kilogram brown bear, foraging with unusual urgency. Every day for the past three weeks, Barnaby had been consuming nearly 30,000 calories of wild blueberries, acorns, and salmon.\n\nSoon, sub-zero temperatures would freeze the streams solid and bury the forest floor under two meters of snow. With photosynthetic plant growth halting for the season, the ecosystem's food supply was rapidly disappearing.`
          : `Crisp autumn leaves crunched under Maya's boots as she walked along Pinecrest Ridge with ${studentName}. Down in the golden clearing, a big brown bear named Barnaby was munching on wild berries, acorns, and fish non-stop!\n\nMaya opened her field notebook. "Look at Barnaby," she whispered. "Every day this week, he has been eating from sunrise to sunset. Soon, freezing winter snow will cover the bushes and freeze the rivers, leaving almost nothing to eat in the forest."`,
        characterName: 'Maya (Field Naturalist)',
        characterDialogue: isOlder
          ? `"Notice how Barnaby is building a thick subcutaneous fat layer before winter sets in. Why do you think he is foraging so intensely right now?"`
          : `"Barnaby is eating way more food than usual before the snow arrives! Why do you think he is doing this?"`,
      },
      {
        id: 'sec-2',
        type: 'question',
        question: {
          id: 'q-hib-1',
          format: 'multiple_choice',
          conceptTag: 'Why animals hibernate',
          prompt: isOlder
            ? 'Maya observes Barnaby rapidly accumulating body fat before winter. Why is this behavioral adaptation critical before winter arrives?'
            : 'Maya notices the bear gathering and eating extra food before winter. Why might the bear be doing this?',
          contextHint: 'Think about what happens to berries, plants, and streams when heavy winter snow covers the forest.',
          options: [
            {
              id: 'opt-a',
              label: 'A',
              text: isOlder
                ? 'Because bears prefer sleeping instead of hunting when they feel lazy in cold weather'
                : 'It wants to play in the leaves and feels lazy',
              isCorrect: false,
              feedback: isOlder
                ? "Let's look at this another way. In biology, animals don't hibernate out of laziness—they are responding to a severe environmental shortage of food and warmth."
                : "Let's look at this another way! Barnaby isn't being lazy or just playing. Something big is changing in the forest around him.",
              misconceptionTag: 'Student associates hibernation with laziness rather than survival during food scarcity.',
              remedialStory: isOlder
                ? `Maya points her binoculars toward the upper mountain slope, where early snow has already buried the shrubs. "See how bare the bushes are up there? In winter, keeping a large mammal's body warm requires huge amounts of fuel, yet the forest offers almost zero food. By storing fat now, Barnaby creates an internal fuel tank to survive the lean months."`
                : `Maya points to the snowy mountain top. "Imagine if your kitchen fridge was locked for four months! In winter, snow covers all the berries and fish freeze under thick ice. Barnaby eats extra food now so his body can store it as tummy fat—like a built-in lunchbox for winter!"`,
              remedialQuestion: {
                prompt: 'When snow covers the forest in winter, what becomes the biggest problem for Barnaby?',
                options: [
                  {
                    id: 'rem-1',
                    label: 'A',
                    text: 'Food becomes very scarce and hard to find in the freezing cold',
                    isCorrect: true,
                    feedback: 'Great discovery! Because food becomes scarce in winter, Barnaby stores extra energy ahead of time.',
                  },
                  {
                    id: 'rem-2',
                    label: 'B',
                    text: 'The forest becomes too noisy with other animals',
                    isCorrect: false,
                    feedback: 'Actually, the forest becomes very quiet in winter—the real challenge is that food is buried under snow and ice.',
                  },
                ],
              },
            },
            {
              id: 'opt-b',
              label: 'B',
              text: isOlder
                ? 'Food availability drops sharply in winter, so stored fat provides essential energy reserves'
                : 'Food may become harder to find in winter, so he stores energy now',
              isCorrect: true,
              feedback: isOlder
                ? 'Great discovery! Storing energy as adipose tissue allows the animal to survive months when foraging would cost more energy than it yields.'
                : 'Great discovery! Food becomes scarce under the winter snow, so Barnaby stores up energy in his body ahead of time.',
            },
            {
              id: 'opt-c',
              label: 'C',
              text: isOlder
                ? 'It is preparing for a long-distance migration across the ocean'
                : 'It is moving to another country across the ocean',
              isCorrect: false,
              feedback: isOlder
                ? "Let's look at this another way. While migratory birds fly thousands of kilometers to warmer latitudes, large terrestrial mammals like bears stay in their home range and use a different survival strategy."
                : "Let's look at this another way! Birds can fly far away to warm places, but heavy bears can't fly across oceans—they stay right here in the forest.",
              misconceptionTag: 'Confuses hibernation with long-distance migration.',
              remedialStory: `Maya opens her map of Pinecrest Ridge. "Arctic terns and monarch butterflies fly south when winter comes—that's called migration. Bears are too heavy to travel thousands of miles quickly, so they stay in their mountain home and prepare a sheltered den instead."`,
            },
          ],
          constructiveExplanation: isOlder
            ? 'Before winter, hibernating animals enter hyperphagia—eating large quantities of food to build fat reserves that sustain their vital organs when external food disappears.'
            : 'Before winter arrives, animals like bears eat extra food to build a layer of body fat. This stored fat gives their body energy when snow covers the forest.',
        },
      },
      {
        id: 'sec-3',
        type: 'interactive_concept',
        chapterHeading: 'Chapter 2: Inside the Winter Den',
        narrative: isOlder
          ? `Two weeks later, the first blizzard swept across Pinecrest Ridge. Barnaby crawled deep inside a dry limestone cave lined with pine needles and dry moss. Curled into a tight sphere to minimize surface-area heat loss, Barnaby entered hibernation.\n\nUnlike an ordinary night's sleep, hibernation is a profound state of dormancy where the bear's metabolic activity decreases dramatically. Use Maya's thermal bio-scanner below to observe what happens to Barnaby's physiology as winter deepens.`
          : `Two weeks later, fluffy white snow blanketed Pinecrest Ridge! Barnaby crawled into a cozy cave tucked under the roots of a giant pine tree. He curled into a warm furry ball and began his long winter hibernation.\n\nHibernation isn't just a normal bedtime nap! During hibernation, the bear's body slows down to save energy. Slide Maya's Forest Scanner below to see how Barnaby's body changes from autumn to deep winter!`,
        interactiveParameter: {
          label: 'Forest Season & Den Temperature',
          unit: '°C',
          min: -10,
          max: 20,
          defaultValue: 15,
        minLabel: 'Deep Winter',
        midLabel: 'First Frost',
        maxLabel: 'Autumn Warmth',
          stages: [
            {
              threshold: 12,
              stateLabel: 'Active Autumn Foraging',
              description: isOlder
                ? 'Nominal active metabolism. Barnaby consumes berries and salmon rapidly, maintaining a standard mammalian core temperature.'
                : 'Barnaby is wide awake and active! His heart beats fast as he explores the forest and munches on berries.',
              metricLabel: 'Heart Rate: 55 bpm · Body Temp: 37.5°C · Energy Use: 100%',
              metricValue: '● ACTIVE STATE',
            },
            {
              threshold: 2,
              stateLabel: 'Entering the Den (Pre-Dormancy)',
              description: isOlder
                ? 'As ambient temperature drops near freezing, Barnaby stops eating and settles into the insulated den. Heart rate and oxygen consumption begin to decline.'
                : 'Frost covers the ground! Barnaby curls up inside his cozy den. His breathing and heartbeat start slowing down.',
              metricLabel: 'Heart Rate: 28 bpm · Body Temp: 35.0°C · Energy Use: 45%',
              metricValue: '◐ TRANSITIONING',
            },
            {
              threshold: -10,
              stateLabel: 'Deep Winter Hibernation',
              description: isOlder
                ? 'Metabolic activity decreases by up to 75%. Heart rate drops to just 8–12 beats per minute, conserving stored lipid reserves until spring.'
                : 'Deep hibernation! Barnaby’s body slows down so much that his heart beats only 10 times a minute, saving his stored energy all winter.',
              metricLabel: 'Heart Rate: 10 bpm · Body Temp: 33.0°C · Energy Use: 18%',
              metricValue: '◆ DEEP DORMANCY',
            },
          ],
        },
      },
      {
        id: 'sec-4',
        type: 'question',
        question: {
          id: 'q-hib-2',
          format: 'short_answer',
          conceptTag: 'Energy conservation',
          prompt: isOlder
            ? 'In your own words, explain why Barnaby’s metabolic activity (heart rate and breathing) decreases during hibernation and how that helps him survive winter.'
            : 'Explain why the bear hibernates and slows its body down in your own words.',
          contextHint: isOlder
            ? 'Think about the relationship between metabolic rate, stored fat reserves, and the lack of food outside.'
            : 'Think about why saving energy matters when there is no food outside in the snow.',
          expectedKeywords: ['energy', 'food', 'winter', 'slow', 'save', 'survive', 'fat', 'scarce', 'cold'],
          sampleIdealAnswer: isOlder
            ? 'Hibernation slows down the bear’s metabolic activity and heart rate so its body conserves energy and can survive on stored fat while food is scarce in winter.'
            : 'The bear hibernates to save energy and survive the cold winter when food like berries is hard to find.',
          constructiveExplanation: isOlder
            ? 'By lowering heart rate, breathing, and metabolic rate, a hibernating mammal drastically reduces its daily caloric expenditure so stored fat lasts until spring.'
            : 'When a bear slows down its heartbeat and breathing in hibernation, its body uses only a tiny bit of energy each day—helping its stored fat last all winter!',
          commonMisconceptions: [
            {
              triggerKeywords: ['lazy', 'bored', 'tired', 'sleepy'],
          analogyYounger:
            "Think of Barnaby's body like a battery in winter! There are no berries in the snow, so he isn't being lazy—he slows his heartbeat way down so his tummy fat battery lasts until spring.",
          analogyOlder:
            'Rather than laziness, hibernation is a regulated metabolic adaptation. Because winter foraging costs more energy than the environment provides, lowering metabolic rate preserves lipid reserves.',
              misconceptionSummary: 'Student associates hibernation with laziness or ordinary tiredness.',
              correctConceptExplanation:
                'Hibernation is not laziness or regular sleep—it is an automatic biological adaptation that helps animals conserve energy when food availability is limited.',
              followUpQuestion: {
                prompt: 'If Barnaby kept running around the snowy forest all winter instead of slowing his body down, what would happen to his stored energy?',
                options: [
                  {
                    id: 'fu-1',
                    label: 'A',
                    text: 'His stored energy would run out quickly while no food is available',
                    isCorrect: true,
                    feedback: 'Exactly right! Slowing down his body is how Barnaby conserves energy so he doesn’t run out of fuel.',
                  },
                  {
                    id: 'fu-2',
                    label: 'B',
                    text: 'His body would automatically make energy out of snow',
                    isCorrect: false,
                    feedback: 'Snow contains water, not food energy! Barnaby must conserve the fat he stored in autumn.',
                  },
                ],
              },
            },
          ],
        },
      },
      {
        id: 'sec-5',
        type: 'story',
        chapterHeading: 'Chapter 3: Neighbours Beneath the Snow',
        narrative: isOlder
          ? `As Maya and ${studentName} hiked back down the trail, Maya pointed to a burrow near an old oak root. "Barnaby isn't the only resident hibernating on Pinecrest Ridge," she noted. "Inside underground burrows below the frost line, woodchucks (groundhogs), chipmunks, hedgehogs, and little brown bats inside limestone caverns are also in deep dormancy—some dropping their body temperatures even more drastically than bears."\n\nMonths later, when April sunlight finally melted the snowpack and green shoots emerged, Barnaby stepped out of his den—slimmer, hungry, and ready for spring.`
          : `As Maya and ${studentName} walked softly past the cave, Maya pointed to a small hole under an oak tree. "Barnaby isn't the only animal hibernating here!" she smiled. "Deep underground where the frost can't reach, groundhogs, hedgehogs, dormice, and bats in caves are also hibernating through the winter."\n\nWhen warm spring sunshine finally melted the snow and fresh green plants sprouted, Barnaby stretched his paws, stepped out of his den, and greeted the spring morning!`,
        characterName: 'Maya (Field Naturalist)',
        characterDialogue: `"You've tracked Barnaby all the way from autumn foraging to spring awakening, ${studentName}! Ready for our Final Knowledge Challenge?"`,
      },
    ],
    finalChallenge: [
      {
        id: 'fc-hib-1',
        format: 'multiple_choice',
        conceptTag: 'What hibernation means',
        prompt: isOlder
          ? 'How does biological hibernation differ from a normal night of sleep?'
          : 'How is hibernation different from taking a normal night’s sleep?',
        options: [
          {
            id: 'fc1-a',
            label: 'A',
            text: isOlder
              ? 'Hibernation is a long-term state of dormancy where metabolic rate, heart rate, and body temperature drop significantly'
              : 'In hibernation, an animal’s heartbeat and breathing slow way down for weeks or months to save energy',
            isCorrect: true,
            feedback: 'Great discovery! Hibernation is a deep winter dormancy where body functions slow down dramatically.',
          },
          {
            id: 'fc1-b',
            label: 'B',
            text: 'Hibernation only lasts for two hours in the afternoon during summer',
            isCorrect: false,
            feedback: "Let's look at this another way. Hibernation happens during winter and lasts for weeks or months, not just an afternoon.",
          },
        ],
        constructiveExplanation:
          'Hibernation is an extended winter dormancy in which an animal’s breathing, heart rate, and temperature drop to conserve energy.',
      },
      {
        id: 'fc-hib-2',
        format: 'true_false',
        conceptTag: 'Animals that hibernate',
        prompt: 'True or False: Besides bears, animals like groundhogs (woodchucks), hedgehogs, and bats also hibernate to survive winter.',
        options: [
          {
            id: 'fc2-true',
            label: 'True',
            text: 'True — Groundhogs, hedgehogs, and bats are classic examples of hibernating animals.',
            isCorrect: true,
            feedback: 'Spot on! Many small mammals and bats hibernate in burrows or caves where temperatures stay stable.',
          },
          {
            id: 'fc2-false',
            label: 'False',
            text: 'False — Only bears hibernate in winter.',
            isCorrect: false,
            feedback: "Let's look at this another way. Many animals—including groundhogs, bats, hedgehogs, and frogs—hibernate through the winter!",
          },
        ],
        constructiveExplanation:
          'Bears, groundhogs, bats, hedgehogs, and several amphibians and reptiles use dormancy or hibernation to survive cold seasons.',
      },
      {
        id: 'fc-hib-3',
        format: 'multiple_choice',
        conceptTag: 'Energy conservation',
        prompt: isOlder
          ? 'What primary fuel source sustains a hibernating mammal’s vital organs while its metabolic rate is reduced?'
          : 'Where does a hibernating bear get the energy to stay alive while it is inside its winter den for months?',
        options: [
          {
            id: 'fc3-a',
            label: 'A',
            text: isOlder
              ? 'Stored body fat accumulated during intensive autumn foraging'
              : 'From the layer of body fat it stored up by eating extra food in autumn',
            isCorrect: true,
            feedback: 'Great discovery! Stored body fat acts as a slow-burning fuel supply all winter long.',
          },
          {
            id: 'fc3-b',
            label: 'B',
            text: 'From sunlight shining through the cave roof like a plant',
            isCorrect: false,
            feedback: "Let's look at this another way. Only plants use sunlight to make food (photosynthesis). Bears use stored body fat for energy!",
          },
        ],
        constructiveExplanation:
          'Even in deep dormancy, vital organs require energy, which is supplied slowly from the body fat accumulated before winter.',
      },
    ],
    nextRecommendedAdventure: {
      topicId: 'sci-winter-survival',
      title: 'How Do Animals Survive Winter?',
      topic: 'Animal Winter Adaptations & Energy Conservation',
      hook: 'Discover the incredible strategies animals use to survive freezing temperatures—from arctic fox insulation to monarch migration.',
    },
  };
}

/**
 * Hand-authored stories. Returns null for topics that do not have one yet; the app then asks the
 * AI service to generate a story from the topic's learning objectives (and falls back to an
 * objective-based offline story if that fails).
 */
export function getCuratedStoryForTopic(
  topicId: string,
  classGrade: ClassGrade,
  studentName: string
): Story | null {
  if (topicId === 'sci-hibernation') return buildHibernationStory(classGrade, studentName);
  return null;
}

/**
 * Picks the next recommended adventure: the topic's declared successor if it suits the class,
 * otherwise the first unfinished topic for that class, otherwise any other topic for the class.
 */
export function pickNextAdventure(
  classGrade: ClassGrade,
  currentTopicId?: string,
  preferredNextId?: string,
  completedTopicIds: string[] = []
): Story['nextRecommendedAdventure'] {
  const forClass = CURRICULUM_TOPICS.filter((t) => t.classGrades.includes(classGrade));
  const pool = forClass.length > 0 ? forClass : CURRICULUM_TOPICS;
  const preferred = pool.find((t) => t.id === preferredNextId && t.id !== currentTopicId);
  const unfinished = pool.find((t) => t.id !== currentTopicId && !completedTopicIds.includes(t.id));
  const any = pool.find((t) => t.id !== currentTopicId) ?? pool[0];
  const next = preferred ?? unfinished ?? any;
  return {
    topicId: next.id,
    title: next.engagingTitle,
    topic: next.topic,
    hook: next.hookDescription,
  };
}
