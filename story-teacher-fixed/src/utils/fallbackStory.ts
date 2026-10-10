import type { Story, StoryGenerationRequest } from '../types/story';
import { pickNextAdventure } from '../data/curriculumData';
import { extractKeywords } from './answerAnalysis';
import { cleanTopicName, inferImageKey, slugifyTopic } from './topic';

/**
 * Offline story used when the AI service is unavailable or returns something unusable.
 * Shared by the browser and the server so both produce identical fallbacks.
 * It is deliberately generic and flagged `source: 'offline'` so the UI can say so.
 */
export function buildFallbackStory(request: StoryGenerationRequest): Story {
  const isOlder = request.classGrade >= 6;
  const cleanTopic = cleanTopicName(request.topic);
  const title = request.topic.trim().endsWith('?')
    ? request.topic.trim()
    : `How Does "${cleanTopic}" Really Work?`;
  const topicId = request.topicId ?? slugifyTopic(request.topic);
  const interest = request.interests[0] || (isOlder ? 'ecosystems' : 'nature');
  const name = request.studentName || 'Explorer';

  const objectives = request.learningObjectives?.length
    ? request.learningObjectives
    : [
        `Understand the core mechanism behind ${cleanTopic}`,
        `Identify why ${cleanTopic} happens in nature or everyday life`,
        `Apply the concept of ${cleanTopic} to solve a real-world puzzle`,
      ];

  const primaryObjective = objectives[0];
  const keywords = extractKeywords(cleanTopic, ...objectives);

  return {
    id: `story-offline-${Date.now()}`,
    topicId,
    title,
    topic: cleanTopic,
    subject: request.subject || 'Science',
    classGrade: request.classGrade,
    protagonist: `${name} & Field Explorer Zara`,
    imageKey: request.imageKey ?? inferImageKey(cleanTopic),
    isAiGenerated: false,
    source: 'offline',
    learningObjectives: objectives,
    sections: [
      {
        id: 'off-1',
        type: 'story',
        chapterHeading: `Chapter 1: A Curious Question About ${cleanTopic}`,
        narrative: isOlder
          ? `At the Horizon Research Outpost, ${name} and Field Explorer Zara calibrated their instruments to investigate a phenomenon that had intrigued people for generations: ${title}\n\n"Every system leaves clues," Zara explained as she projected a model onto the table. "Whether we're looking at ${interest} or physical forces, ${cleanTopic} is driven by cause, energy transfer, and structure."`
          : `Inside the Explorer Treehouse, ${name} opened the Golden Field Guide next to Explorer Zara. Right on the glowing map was today's big mystery: ${title}\n\n"Come look at this!" Zara smiled. "Just like in ${interest}, ${cleanTopic} doesn't happen by magic—it happens step by step!"`,
        characterName: 'Explorer Zara',
        characterDialogue: `"Let's test our first idea together, ${name}!"`,
      },
      {
        id: 'off-2',
        type: 'question',
        question: {
          id: 'off-q1',
          format: 'multiple_choice',
          conceptTag: `Core idea of ${cleanTopic}`,
          prompt: isOlder
            ? `Which statement best matches this learning goal: "${primaryObjective}"?`
            : `Zara says today's goal is: "${primaryObjective}". Which idea fits best?`,
          contextHint: 'Think about how causes, patterns, or energy connect the steps.',
          options: [
            {
              id: 'off-q1-a',
              label: 'A',
              text: `${cleanTopic} can be understood by following its causes and steps one at a time`,
              isCorrect: true,
              feedback: 'Great discovery! Breaking a topic into causes and steps is how scientists and mathematicians make sense of it.',
            },
            {
              id: 'off-q1-b',
              label: 'B',
              text: `${cleanTopic} happens randomly, with no cause or pattern behind it`,
              isCorrect: false,
              feedback: "Let's look at this another way. There is almost always a reliable cause or pattern behind what we observe.",
            },
          ],
          constructiveExplanation: `${cleanTopic} follows clear cause-and-effect relationships. Today's goal: ${primaryObjective}.`,
        },
      },
      {
        id: 'off-3',
        type: 'question',
        question: {
          id: 'off-q2',
          format: 'short_answer',
          conceptTag: `Explaining ${cleanTopic}`,
          prompt: `In your own words, what is the most interesting thing about "${cleanTopic}", and why does it happen?`,
          contextHint: 'Write one or two sentences explaining the cause or purpose.',
          expectedKeywords: keywords,
          sampleIdealAnswer: `It happens because of a chain of causes. ${primaryObjective}.`,
          constructiveExplanation: `Putting ${cleanTopic} into your own words helps connect the story to real-world understanding. ${primaryObjective}.`,
        },
      },
    ],
    finalChallenge: [
      {
        id: 'off-fc1',
        format: 'true_false',
        conceptTag: `Core idea of ${cleanTopic}`,
        prompt: `True or False: Understanding "${cleanTopic}" helps us predict how similar things behave.`,
        options: [
          { id: 'off-fc1-t', label: 'True', text: 'True', isCorrect: true, feedback: 'Spot on! Once you understand a pattern, you can spot it everywhere.' },
          { id: 'off-fc1-f', label: 'False', text: 'False', isCorrect: false, feedback: "Let's look at this another way. Patterns are exactly what let us make predictions." },
        ],
        constructiveExplanation: `Recognising patterns is the key to mastering ${cleanTopic}.`,
      },
    ],
    nextRecommendedAdventure: pickNextAdventure(request.classGrade, topicId, request.nextTopicId),
  };
}
