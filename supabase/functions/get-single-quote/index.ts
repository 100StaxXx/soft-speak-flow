const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QuoteRequest {
  type: 'trigger' | 'category';
  value: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const { type, value } = await req.json() as QuoteRequest;

    console.log('Getting single quote for:', { type, value });

    // Real quotes database
    const realQuotesByCategory: Record<string, Array<{text: string, author: string}>> = {
      discipline: [
        { text: "Discipline is the bridge between goals and accomplishment.", author: "Jim Rohn" },
        { text: "We do today what they won't, so tomorrow we can accomplish what they can't.", author: "Dwayne Johnson" },
        { text: "Discipline is choosing between what you want now and what you want most.", author: "Abraham Lincoln" },
        { text: "Self-discipline is the ability to make yourself do what you should do, when you should do it, whether you feel like it or not.", author: "Elbert Hubbard" },
        { text: "The pain of discipline is far less than the pain of regret.", author: "Sarah Bombell" }
      ],
      confidence: [
        { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
        { text: "Confidence comes not from always being right but from not fearing to be wrong.", author: "Peter T. McIntyre" },
        { text: "You gain strength, courage, and confidence by every experience in which you really stop to look fear in the face.", author: "Eleanor Roosevelt" },
        { text: "With confidence, you have won before you have started.", author: "Marcus Garvey" },
        { text: "No one can make you feel inferior without your consent.", author: "Eleanor Roosevelt" }
      ],
      physique: [
        { text: "Take care of your body. It's the only place you have to live.", author: "Jim Rohn" },
        { text: "The body achieves what the mind believes.", author: "Napoleon Hill" },
        { text: "Strength does not come from physical capacity. It comes from an indomitable will.", author: "Mahatma Gandhi" },
        { text: "Exercise is king. Nutrition is queen. Put them together and you've got a kingdom.", author: "Jack LaLanne" },
        { text: "Your body can stand almost anything. It's your mind that you have to convince.", author: "Andrew Murphy" }
      ],
      focus: [
        { text: "The successful warrior is the average man, with laser-like focus.", author: "Bruce Lee" },
        { text: "Concentrate all your thoughts upon the work in hand. The sun's rays do not burn until brought to a focus.", author: "Alexander Graham Bell" },
        { text: "Focus on being productive instead of busy.", author: "Tim Ferriss" },
        { text: "Where focus goes, energy flows.", author: "Tony Robbins" },
        { text: "The key to success is to focus our conscious mind on things we desire not things we fear.", author: "Brian Tracy" }
      ],
      mindset: [
        { text: "Whether you think you can or you think you can't, you're right.", author: "Henry Ford" },
        { text: "The mind is everything. What you think you become.", author: "Buddha" },
        { text: "Change your thoughts and you change your world.", author: "Norman Vincent Peale" },
        { text: "A positive mindset brings positive things.", author: "Anonymous" },
        { text: "The only limits that exist are the ones in your own mind.", author: "Anonymous" }
      ],
      business: [
        { text: "The way to get started is to quit talking and begin doing.", author: "Walt Disney" },
        { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
        { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
        { text: "Don't be afraid to give up the good to go for the great.", author: "John D. Rockefeller" },
        { text: "Opportunities don't happen. You create them.", author: "Chris Grosser" }
      ]
    };

    const realQuotesByTrigger: Record<string, Array<{text: string, author: string}>> = {
      motivated: [
        { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
        { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
        { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
        { text: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt" },
        { text: "Act as if what you do makes a difference. It does.", author: "William James" }
      ],
      confident: [
        { text: "I am not afraid of storms, for I am learning how to sail my ship.", author: "Louisa May Alcott" },
        { text: "You are braver than you believe, stronger than you seem, and smarter than you think.", author: "A.A. Milne" },
        { text: "Confidence is not 'they will like me'. Confidence is 'I'll be fine if they don't'.", author: "Christina Grimmie" },
        { text: "To be yourself in a world that is constantly trying to make you something else is the greatest accomplishment.", author: "Ralph Waldo Emerson" },
        { text: "Believe in yourself and all that you are.", author: "Christian D. Larson" }
      ],
      determined: [
        { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius" },
        { text: "The difference between a successful person and others is not a lack of strength, not a lack of knowledge, but rather a lack in will.", author: "Vince Lombardi" },
        { text: "I will persist until I succeed.", author: "Og Mandino" },
        { text: "Strength doesn't come from what you can do. It comes from overcoming the things you once thought you couldn't.", author: "Rikki Rogers" },
        { text: "Never give in except to convictions of honor and good sense.", author: "Winston Churchill" }
      ],
      inspired: [
        { text: "The best time to plant a tree was 20 years ago. The second best time is now.", author: "Chinese Proverb" },
        { text: "Your limitation—it's only your imagination.", author: "Anonymous" },
        { text: "Great things never come from comfort zones.", author: "Anonymous" },
        { text: "Dream it. Wish it. Do it.", author: "Anonymous" },
        { text: "Do something today that your future self will thank you for.", author: "Sean Patrick Flanery" }
      ],
      focused: [
        { text: "It's not that I'm so smart, it's just that I stay with problems longer.", author: "Albert Einstein" },
        { text: "Concentration and mental toughness are the margins of victory.", author: "Bill Russell" },
        { text: "Focus is a matter of deciding what things you're not going to do.", author: "John Carmack" },
        { text: "The secret of change is to focus all of your energy not on fighting the old, but on building the new.", author: "Socrates" },
        { text: "Lack of direction, not lack of time, is the problem.", author: "Zig Ziglar" }
      ],
      empowered: [
        { text: "The most common way people give up their power is by thinking they don't have any.", author: "Alice Walker" },
        { text: "You have power over your mind - not outside events. Realize this, and you will find strength.", author: "Marcus Aurelius" },
        { text: "No one can make you feel inferior without your consent.", author: "Eleanor Roosevelt" },
        { text: "The only person you are destined to become is the person you decide to be.", author: "Ralph Waldo Emerson" },
        { text: "I am not a product of my circumstances. I am a product of my decisions.", author: "Stephen Covey" }
      ],
      driven: [
        { text: "The only limit to our realization of tomorrow will be our doubts of today.", author: "Franklin D. Roosevelt" },
        { text: "Don't let yesterday take up too much of today.", author: "Will Rogers" },
        { text: "You learn more from failure than from success.", author: "Unknown" },
        { text: "If you are working on something that you really care about, you don't have to be pushed. The vision pulls you.", author: "Steve Jobs" },
        { text: "People who are crazy enough to think they can change the world, are the ones who do.", author: "Rob Siltanen" }
      ],
      ambitious: [
        { text: "The only impossible journey is the one you never begin.", author: "Tony Robbins" },
        { text: "Dream big and dare to fail.", author: "Norman Vaughan" },
        { text: "I'd rather attempt to do something great and fail than to attempt to do nothing and succeed.", author: "Robert H. Schuller" },
        { text: "The biggest adventure you can take is to live the life of your dreams.", author: "Oprah Winfrey" },
        { text: "If you can dream it, you can do it.", author: "Walt Disney" }
      ]
    };

    // Get random quote based on type
    let quotes;
    if (type === 'category') {
      quotes = realQuotesByCategory[value.toLowerCase()] || [];
    } else {
      quotes = realQuotesByTrigger[value.toLowerCase()] || [];
    }

    if (quotes.length === 0) {
      return new Response(
        JSON.stringify({ quote: null }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    // Get random quote
    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];

    return new Response(
      JSON.stringify({ quote: randomQuote }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in get-single-quote function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
