import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PromotionOpportunity {
  type: 'quest_to_epic' | 'habit_cluster' | 'recurring_pattern';
  confidence: number;
  title: string;
  description: string;
  reasoning: string;
  sourceIds: string[];
  suggestedEpicTitle?: string;
  suggestedHabits?: Array<{ title: string; frequency: string; difficulty: string }>;
  suggestedDuration?: number;
  category?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;
    console.log(`Detecting promotion opportunities for user: ${userId}`);

    // Fetch recent tasks, habits, and quests
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const [tasksResult, habitsResult, questsResult, epicsResult] = await Promise.all([
      // Recent completed tasks
      supabase
        .from('daily_tasks')
        .select('id, task_text, category, completed, task_date, difficulty, is_recurring, recurrence_pattern')
        .eq('user_id', userId)
        .gte('task_date', thirtyDaysAgo)
        .order('task_date', { ascending: false })
        .limit(100),
      
      // Active habits
      supabase
        .from('habits')
        .select('id, title, category, current_streak, difficulty, frequency')
        .eq('user_id', userId)
        .eq('is_active', true),
      
      // Active quests
      supabase
        .from('quests')
        .select('id, title, description, status, created_at, category')
        .eq('user_id', userId)
        .eq('status', 'active'),
      
      // Current active epics (to avoid suggesting duplicates)
      supabase
        .from('epics')
        .select('id, title, story_type_slug')
        .eq('user_id', userId)
        .eq('status', 'active'),
    ]);

    const tasks = tasksResult.data || [];
    const habits = habitsResult.data || [];
    const quests = questsResult.data || [];
    const activeEpics = epicsResult.data || [];

    console.log(`Found: ${tasks.length} tasks, ${habits.length} habits, ${quests.length} quests, ${activeEpics.length} active epics`);

    // Pattern detection without AI (fast checks)
    const opportunities: PromotionOpportunity[] = [];

    // 1. Detect recurring task patterns (same category, multiple days)
    const categoryTaskCounts: Record<string, { count: number; tasks: typeof tasks }> = {};
    for (const task of tasks) {
      if (task.category) {
        if (!categoryTaskCounts[task.category]) {
          categoryTaskCounts[task.category] = { count: 0, tasks: [] };
        }
        categoryTaskCounts[task.category].count++;
        categoryTaskCounts[task.category].tasks.push(task);
      }
    }

    // Find categories with 5+ tasks in last 30 days that aren't already epics
    for (const [category, data] of Object.entries(categoryTaskCounts)) {
      if (data.count >= 5) {
        const alreadyHasEpic = activeEpics.some(e => 
          e.title.toLowerCase().includes(category.toLowerCase())
        );
        
        if (!alreadyHasEpic) {
          opportunities.push({
            type: 'recurring_pattern',
            confidence: Math.min(0.5 + (data.count / 20), 0.9),
            title: `${category} Focus Area`,
            description: `You've worked on ${data.count} ${category} tasks in the last 30 days`,
            reasoning: `Consistent activity in this category suggests it could become a structured epic`,
            sourceIds: data.tasks.slice(0, 5).map(t => t.id),
            suggestedEpicTitle: `Master ${category}`,
            suggestedDuration: 30,
            category,
          });
        }
      }
    }

    // 2. Detect habit clusters (multiple related habits)
    const habitCategories: Record<string, typeof habits> = {};
    for (const habit of habits) {
      const cat = habit.category || 'general';
      if (!habitCategories[cat]) {
        habitCategories[cat] = [];
      }
      habitCategories[cat].push(habit);
    }

    for (const [category, categoryHabits] of Object.entries(habitCategories)) {
      if (categoryHabits.length >= 3) {
        const alreadyHasEpic = activeEpics.some(e => 
          e.title.toLowerCase().includes(category.toLowerCase())
        );
        
        if (!alreadyHasEpic) {
          opportunities.push({
            type: 'habit_cluster',
            confidence: 0.7 + (categoryHabits.length / 20),
            title: `${category} Habit System`,
            description: `You have ${categoryHabits.length} active ${category} habits that could work together`,
            reasoning: `Grouping related habits into an epic can increase motivation and track overall progress`,
            sourceIds: categoryHabits.map(h => h.id),
            suggestedEpicTitle: `${category} Transformation`,
            suggestedHabits: categoryHabits.map(h => ({
              title: h.title,
              frequency: h.frequency || 'daily',
              difficulty: h.difficulty || 'medium',
            })),
            suggestedDuration: 30,
            category,
          });
        }
      }
    }

    // 3. AI-powered quest analysis (if we have quests and API key)
    if (quests.length > 0 && openAIApiKey) {
      try {
        const questSummary = quests.map(q => `- ${q.title}${q.description ? `: ${q.description}` : ''}`).join('\n');
        const existingEpicTitles = activeEpics.map(e => e.title).join(', ');

        const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'system',
                content: `You analyze user quests to identify opportunities for epic creation. An epic is a 21-60 day journey with habits and milestones. Return JSON only.`
              },
              {
                role: 'user',
                content: `Analyze these active quests and identify any that could be promoted to epics:

Quests:
${questSummary}

Existing epics (avoid duplicates): ${existingEpicTitles || 'None'}

Return a JSON array of promotion opportunities (max 2). Each should have:
- questIndices: number[] (0-indexed positions of related quests)
- suggestedTitle: string (epic title)
- reasoning: string (why this should be an epic)
- suggestedDuration: number (21-60 days)
- suggestedHabits: Array<{title: string, frequency: 'daily'|'weekly', difficulty: 'easy'|'medium'|'hard'}>

Only suggest promotions for quests that represent multi-week commitments or skill development. Return [] if none qualify.`
              }
            ],
            temperature: 0.3,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices?.[0]?.message?.content || '';
          
          // Parse JSON from response
          const jsonMatch = content.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const suggestions = JSON.parse(jsonMatch[0]);
            
            for (const suggestion of suggestions) {
              if (suggestion.questIndices?.length > 0) {
                const relatedQuests = suggestion.questIndices
                  .filter((i: number) => i < quests.length)
                  .map((i: number) => quests[i]);
                
                if (relatedQuests.length > 0) {
                  opportunities.push({
                    type: 'quest_to_epic',
                    confidence: 0.75,
                    title: suggestion.suggestedTitle || relatedQuests[0].title,
                    description: `Promote ${relatedQuests.length} quest(s) to a structured epic journey`,
                    reasoning: suggestion.reasoning || 'This quest represents a significant commitment',
                    sourceIds: relatedQuests.map((q: any) => q.id),
                    suggestedEpicTitle: suggestion.suggestedTitle,
                    suggestedHabits: suggestion.suggestedHabits,
                    suggestedDuration: suggestion.suggestedDuration || 30,
                    category: relatedQuests[0].category,
                  });
                }
              }
            }
          }
        }
      } catch (aiError) {
        console.warn('AI analysis failed, continuing with pattern-based detection:', aiError);
      }
    }

    // Sort by confidence
    opportunities.sort((a, b) => b.confidence - a.confidence);

    console.log(`Detected ${opportunities.length} promotion opportunities`);

    return new Response(
      JSON.stringify({
        opportunities: opportunities.slice(0, 5), // Max 5 opportunities
        analyzedCounts: {
          tasks: tasks.length,
          habits: habits.length,
          quests: quests.length,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error detecting promotion opportunities:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
