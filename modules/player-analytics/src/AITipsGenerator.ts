/**
 * Player Analytics - AI Training Tips Generator
 * Generates personalized training tips based on player statistics using AI
 */

import {
  PlayerAnalyticsConfig,
  PlayerStatistics,
  TrainingTip,
  TipCategory,
  PlayerTrend,
} from './types.js';

interface AIProvider {
  generateTips(prompt: string): Promise<string>;
}

class OpenAIProvider implements AIProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generateTips(prompt: string): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: `You are an expert darts coach with years of experience helping players improve their game.
Analyze the provided statistics and generate personalized, actionable training tips.
Focus on specific areas that need improvement and provide practical exercises.
Be encouraging but honest about areas that need work.
Return your response as a JSON array of tips with this structure:
[{
  "category": "doubles|triples|checkout|consistency|high-scoring|mental|technique|segment-focus",
  "priority": "high|medium|low",
  "title": "Short tip title",
  "description": "Detailed explanation of the tip",
  "practiceExercise": "Specific drill or exercise to improve"
}]
Limit to 3-5 most relevant tips.`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    return data.choices[0].message.content;
  }
}

class AnthropicProvider implements AIProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generateTips(prompt: string): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1500,
        system: `You are an expert darts coach with years of experience helping players improve their game.
Analyze the provided statistics and generate personalized, actionable training tips.
Focus on specific areas that need improvement and provide practical exercises.
Be encouraging but honest about areas that need work.
Return your response as a JSON array of tips with this structure:
[{
  "category": "doubles|triples|checkout|consistency|high-scoring|mental|technique|segment-focus",
  "priority": "high|medium|low",
  "title": "Short tip title",
  "description": "Detailed explanation of the tip",
  "practiceExercise": "Specific drill or exercise to improve"
}]
Limit to 3-5 most relevant tips.`,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      content: Array<{ text: string }>;
    };
    return data.content[0].text;
  }
}

class OllamaProvider implements AIProvider {
  private host: string;
  private model: string;

  constructor(host: string, model: string) {
    this.host = host;
    this.model = model;
  }

  async generateTips(prompt: string): Promise<string> {
    const systemPrompt = `You are an expert darts coach with years of experience helping players improve their game.
Analyze the provided statistics and generate personalized, actionable training tips.
Focus on specific areas that need improvement and provide practical exercises.
Be encouraging but honest about areas that need work.
Return your response as a JSON array of tips with this structure:
[{
  "category": "doubles|triples|checkout|consistency|high-scoring|mental|technique|segment-focus",
  "priority": "high|medium|low",
  "title": "Short tip title",
  "description": "Detailed explanation of the tip",
  "practiceExercise": "Specific drill or exercise to improve"
}]
Limit to 3-5 most relevant tips. ONLY output valid JSON, no other text.`;

    const response = await fetch(`${this.host}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        prompt: `${systemPrompt}\n\nPlayer Statistics:\n${prompt}`,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = (await response.json()) as { response: string };
    return data.response;
  }
}

export class AITipsGenerator {
  private config: PlayerAnalyticsConfig;
  private provider: AIProvider | null = null;

  constructor(config: PlayerAnalyticsConfig) {
    this.config = config;
    this.initializeProvider();
  }

  updateConfig(config: PlayerAnalyticsConfig): void {
    this.config = config;
    this.initializeProvider();
  }

  private initializeProvider(): void {
    switch (this.config.aiProvider) {
      case 'openai':
        if (this.config.aiApiKey) {
          this.provider = new OpenAIProvider(this.config.aiApiKey);
        }
        break;
      case 'anthropic':
        if (this.config.aiApiKey) {
          this.provider = new AnthropicProvider(this.config.aiApiKey);
        }
        break;
      case 'ollama':
        this.provider = new OllamaProvider(
          this.config.ollamaHost || 'http://localhost:11434',
          this.config.ollamaModel || 'llama3'
        );
        break;
      default:
        this.provider = null;
    }
  }

  isEnabled(): boolean {
    return this.provider !== null;
  }

  async generateTips(
    stats: PlayerStatistics,
    trends?: PlayerTrend[],
    focusArea?: TipCategory
  ): Promise<TrainingTip[]> {
    if (!this.provider) {
      return this.generateRuleBasedTips(stats);
    }

    try {
      const prompt = this.buildPrompt(stats, trends, focusArea);
      const response = await this.provider.generateTips(prompt);
      return this.parseAIResponse(response, stats.playerId);
    } catch (error) {
      console.error('AI tips generation failed, falling back to rule-based:', error);
      return this.generateRuleBasedTips(stats);
    }
  }

  private buildPrompt(
    stats: PlayerStatistics,
    trends?: PlayerTrend[],
    focusArea?: TipCategory
  ): string {
    let prompt = `Player: ${stats.playerName}

## Overall Performance
- Matches Played: ${stats.totalMatches}
- Match Win Rate: ${stats.matchWinRate.toFixed(1)}%
- Total Darts Thrown: ${stats.totalDartsThrown}

## Scoring
- 3-Dart Average: ${stats.averagePerTurn.toFixed(2)}
- Highest Turn Score: ${stats.highestTurnScore}
- 180s: ${stats.count180s}
- 140+: ${stats.count140Plus}
- 100+: ${stats.count100Plus}

## Accuracy
- Doubles Hit Rate: ${stats.doublesHitRate.toFixed(1)}% (${stats.doublesHit}/${stats.doublesAttempted})
- Triples Hit Rate: ${stats.triplesHitRate.toFixed(1)}% (${stats.triplesHit}/${stats.triplesAttempted})
- Checkout Rate: ${stats.checkoutRate.toFixed(1)}% (${stats.successfulCheckouts}/${stats.checkoutAttempts})
- Highest Checkout: ${stats.highestCheckout}

## Leg Statistics
- Average Darts per Leg: ${stats.averageDartsPerLeg.toFixed(1)}
- Fastest Leg: ${stats.fastestLeg} darts

## Segment Analysis (Top 5 most thrown at)
`;

    // Add top 5 segments by attempts
    const segments = Array.from(stats.segmentAccuracy.entries())
      .sort((a, b) => b[1].attempts - a[1].attempts)
      .slice(0, 5);

    for (const [segNum, segStats] of segments) {
      prompt += `- ${segNum === 0 ? 'Bull' : segNum}: ${segStats.accuracy.toFixed(1)}% accuracy (${segStats.attempts} attempts)\n`;
    }

    // Add trend data if available
    if (trends && trends.length > 0) {
      const weeklyTrend = trends.find((t) => t.period === 'weekly');
      if (weeklyTrend && weeklyTrend.dataPoints.length >= 2) {
        prompt += `\n## Recent Trend (Weekly)
`;
        const recent = weeklyTrend.dataPoints.slice(-4);
        for (const dp of recent) {
          prompt += `- ${dp.date.toISOString().split('T')[0]}: Avg ${dp.averagePerTurn.toFixed(1)}, Checkout ${dp.checkoutRate.toFixed(1)}%, W/L ${dp.matchesWon}/${dp.matchesPlayed}\n`;
        }
      }
    }

    if (focusArea) {
      prompt += `\n## Focus Request
The player wants specific tips for: ${focusArea}
`;
    }

    prompt += `
Based on these statistics, provide personalized training tips to help this player improve.`;

    return prompt;
  }

  private parseAIResponse(response: string, playerId: string): TrainingTip[] {
    try {
      // Extract JSON from response (handle markdown code blocks)
      let jsonStr = response;
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }

      const parsed = JSON.parse(jsonStr);

      return parsed.map(
        (tip: {
          category: TipCategory;
          priority: 'high' | 'medium' | 'low';
          title: string;
          description: string;
          practiceExercise?: string;
        }) => ({
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          playerId,
          category: tip.category as TipCategory,
          priority: tip.priority || 'medium',
          title: tip.title,
          description: tip.description,
          practiceExercise: tip.practiceExercise,
          basedOnData: 'AI analysis of player statistics',
          generatedAt: new Date(),
          acknowledged: false,
        })
      );
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      return [];
    }
  }

  private generateRuleBasedTips(stats: PlayerStatistics): TrainingTip[] {
    const tips: TrainingTip[] = [];
    const now = new Date();

    // Checkout rate analysis
    if (stats.checkoutAttempts >= 10 && stats.checkoutRate < 30) {
      tips.push({
        id: `${Date.now()}-checkout-${Math.random().toString(36).substr(2, 9)}`,
        playerId: stats.playerId,
        category: 'checkout',
        priority: 'high',
        title: 'Improve Your Checkout Percentage',
        description: `Your checkout rate is ${stats.checkoutRate.toFixed(1)}%, which is below the 30% target for club-level players. Focus on consistent double practice.`,
        practiceExercise:
          'Around the Clock Doubles: Hit each double from D1 to D20 in order. Track how many darts it takes. Target: under 60 darts.',
        basedOnData: `Checkout rate: ${stats.checkoutRate.toFixed(1)}% from ${stats.checkoutAttempts} attempts`,
        generatedAt: now,
        acknowledged: false,
      });
    }

    // Low 3-dart average
    if (stats.totalTurns >= 50 && stats.averagePerTurn < 45) {
      tips.push({
        id: `${Date.now()}-average-${Math.random().toString(36).substr(2, 9)}`,
        playerId: stats.playerId,
        category: 'high-scoring',
        priority: 'high',
        title: 'Build Your Scoring Foundation',
        description: `Your 3-dart average is ${stats.averagePerTurn.toFixed(1)}. Focus on consistent T20 targeting to improve overall scoring.`,
        practiceExercise:
          'T20 Practice: Throw 10 sets of 3 darts at T20. Track your total score. Target: 400+ points (40 average per turn).',
        basedOnData: `3-dart average: ${stats.averagePerTurn.toFixed(1)} from ${stats.totalTurns} turns`,
        generatedAt: now,
        acknowledged: false,
      });
    }

    // Good average but low 180 count
    if (stats.averagePerTurn >= 60 && stats.count180s < stats.totalTurns / 50) {
      tips.push({
        id: `${Date.now()}-180s-${Math.random().toString(36).substr(2, 9)}`,
        playerId: stats.playerId,
        category: 'high-scoring',
        priority: 'medium',
        title: 'Convert High Scores to 180s',
        description: `You have a solid ${stats.averagePerTurn.toFixed(1)} average but only ${stats.count180s} 180s. Work on grouping your darts tighter in the T20.`,
        practiceExercise:
          '180 Attempts: Focus sessions purely on T20. Count consecutive T20 hits. Target: 3 in a row consistently.',
        basedOnData: `180 count: ${stats.count180s} with average: ${stats.averagePerTurn.toFixed(1)}`,
        generatedAt: now,
        acknowledged: false,
      });
    }

    // Low doubles hit rate
    if (stats.doublesAttempted >= 20 && stats.doublesHitRate < 25) {
      tips.push({
        id: `${Date.now()}-doubles-${Math.random().toString(36).substr(2, 9)}`,
        playerId: stats.playerId,
        category: 'doubles',
        priority: 'high',
        title: 'Master Your Doubles',
        description: `Your doubles hit rate is ${stats.doublesHitRate.toFixed(1)}%. Doubles are crucial for checkouts and must be a practice priority.`,
        practiceExercise:
          'Double Practice: Pick 3 favorite doubles (e.g., D16, D8, D4). Throw 9 darts at each, rotating through. Track hits. Target: 50%+ hit rate.',
        basedOnData: `Doubles rate: ${stats.doublesHitRate.toFixed(1)}% from ${stats.doublesAttempted} attempts`,
        generatedAt: now,
        acknowledged: false,
      });
    }

    // Inconsistency (high variance suggested by low 100+ with okay average)
    if (stats.averagePerTurn >= 50 && stats.count100Plus < stats.totalTurns * 0.3) {
      tips.push({
        id: `${Date.now()}-consistency-${Math.random().toString(36).substr(2, 9)}`,
        playerId: stats.playerId,
        category: 'consistency',
        priority: 'medium',
        title: 'Improve Consistency',
        description:
          'Your average is decent but you have fewer 100+ scores than expected. This suggests inconsistency - some great turns mixed with poor ones.',
        practiceExercise:
          'Consistency Game: Play 10 legs against yourself. Goal: score 60+ every turn. Count how many turns you achieve this.',
        basedOnData: `100+ turns: ${stats.count100Plus} of ${stats.totalTurns} (${((stats.count100Plus / stats.totalTurns) * 100).toFixed(1)}%)`,
        generatedAt: now,
        acknowledged: false,
      });
    }

    // Many misses
    const totalThrows =
      stats.singlesHit +
      stats.doublesHit +
      stats.triplesHit +
      stats.bullsHit +
      stats.misses;
    if (totalThrows > 100 && stats.misses / totalThrows > 0.1) {
      tips.push({
        id: `${Date.now()}-misses-${Math.random().toString(36).substr(2, 9)}`,
        playerId: stats.playerId,
        category: 'technique',
        priority: 'medium',
        title: 'Reduce Off-Board Misses',
        description: `${((stats.misses / totalThrows) * 100).toFixed(1)}% of your throws miss the scoring area. Focus on your release point and follow-through.`,
        practiceExercise:
          'Board Coverage: Throw 3 darts at each number 1-20 in order. Focus on hitting the board, not specific beds. Target: 0 misses.',
        basedOnData: `Misses: ${stats.misses} of ${totalThrows} throws`,
        generatedAt: now,
        acknowledged: false,
      });
    }

    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    tips.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return tips.slice(0, 5);
  }
}
