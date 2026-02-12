import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QuoteRequest {
  type: 'trigger' | 'category';
  value: string;
  includeImage?: boolean;
}

interface Quote {
  text: string;
  author: string;
  imageUrl?: string;
  fontFamily?: string;
  bgEffect?: string;
}

// Font mapping based on emotional tone
const fontByTrigger: Record<string, string> = {
  "Exhausted": "cormorant",
  "Avoiding Action": "righteous",
  "Anxious & Overthinking": "cormorant",
  "Self-Doubt": "cinzel",
  "Feeling Stuck": "abril",
  "Frustrated": "righteous",
  "Heavy or Low": "cormorant",
  "Emotionally Hurt": "cormorant",
  "Unmotivated": "fredoka",
  "In Transition": "cinzel",
  "Needing Discipline": "righteous",
  "Motivated & Ready": "monoton",
};

const fontByCategory: Record<string, string> = {
  "discipline": "cinzel",
  "confidence": "righteous",
  "physique": "abril",
  "focus": "monoton",
  "mindset": "cormorant",
  "business": "cinzel",
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, value, includeImage = false } = await req.json() as QuoteRequest;

    console.log('Getting single quote for:', { type, value, includeImage });

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
      "Exhausted": [
        { text: "Rest when you're weary. Refresh and renew yourself, your body, your mind, your spirit. Then get back to work.", author: "Ralph Marston" },
        { text: "Almost everything will work again if you unplug it for a few minutes, including you.", author: "Anne Lamott" },
        { text: "Take rest; a field that has rested gives a bountiful crop.", author: "Ovid" },
        { text: "Sometimes the most productive thing you can do is relax.", author: "Mark Black" },
        { text: "Your mind will answer most questions if you learn to relax and wait for the answer.", author: "William S. Burroughs" }
      ],
      "Avoiding Action": [
        { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
        { text: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
        { text: "Action is the foundational key to all success.", author: "Pablo Picasso" },
        { text: "Do not wait; the time will never be just right. Start where you stand.", author: "Napoleon Hill" },
        { text: "The way to get started is to quit talking and begin doing.", author: "Walt Disney" }
      ],
      "Anxious & Overthinking": [
        { text: "You don't have to control your thoughts. You just have to stop letting them control you.", author: "Dan Millman" },
        { text: "Worry does not empty tomorrow of its sorrow, it empties today of its strength.", author: "Corrie Ten Boom" },
        { text: "Nothing can harm you as much as your own thoughts unguarded.", author: "Buddha" },
        { text: "The more you overthink the less you will understand.", author: "Habeeb Akande" },
        { text: "Peace is the result of retraining your mind to process life as it is, rather than as you think it should be.", author: "Wayne Dyer" }
      ],
      "Self-Doubt": [
        { text: "Doubt kills more dreams than failure ever will.", author: "Suzy Kassem" },
        { text: "You are braver than you believe, stronger than you seem, and smarter than you think.", author: "A.A. Milne" },
        { text: "Trust yourself. You know more than you think you do.", author: "Benjamin Spock" },
        { text: "As soon as you trust yourself, you will know how to live.", author: "Johann Wolfgang von Goethe" },
        { text: "Believe in yourself. You are braver than you think, more talented than you know, and capable of more than you imagine.", author: "Roy T. Bennett" }
      ],
      "Feeling Stuck": [
        { text: "If you can't fly then run, if you can't run then walk, if you can't walk then crawl, but whatever you do you have to keep moving forward.", author: "Martin Luther King Jr." },
        { text: "The only way out is through.", author: "Robert Frost" },
        { text: "Sometimes when you're in a dark place you think you've been buried, but you've actually been planted.", author: "Christine Caine" },
        { text: "When you come to the end of your rope, tie a knot and hang on.", author: "Franklin D. Roosevelt" },
        { text: "Rock bottom became the solid foundation on which I rebuilt my life.", author: "J.K. Rowling" }
      ],
      "Frustrated": [
        { text: "Frustration is the first step towards improvement.", author: "Tony Robbins" },
        { text: "Every problem is a gift—without problems we would not grow.", author: "Tony Robbins" },
        { text: "The greatest glory in living lies not in never falling, but in rising every time we fall.", author: "Nelson Mandela" },
        { text: "I have not failed. I've just found 10,000 ways that won't work.", author: "Thomas Edison" },
        { text: "Strength and growth come only through continuous effort and struggle.", author: "Napoleon Hill" }
      ],
      "Heavy or Low": [
        { text: "Even the darkest night will end and the sun will rise.", author: "Victor Hugo" },
        { text: "You are never too old to set another goal or to dream a new dream.", author: "C.S. Lewis" },
        { text: "Hope is being able to see that there is light despite all of the darkness.", author: "Desmond Tutu" },
        { text: "The only way out is through.", author: "Robert Frost" },
        { text: "This too shall pass.", author: "Persian Proverb" }
      ],
      "Emotionally Hurt": [
        { text: "The wound is the place where the Light enters you.", author: "Rumi" },
        { text: "What hurts you today makes you stronger tomorrow.", author: "Jay Cutler" },
        { text: "Healing doesn't mean the damage never existed. It means the damage no longer controls our lives.", author: "Akshay Dubey" },
        { text: "Sometimes good things fall apart so better things can fall together.", author: "Marilyn Monroe" },
        { text: "You may have to fight a battle more than once to win it.", author: "Margaret Thatcher" }
      ],
      "Unmotivated": [
        { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
        { text: "Motivation is what gets you started. Habit is what keeps you going.", author: "Jim Ryun" },
        { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
        { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
        { text: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" }
      ],
      "In Transition": [
        { text: "Change is the law of life. And those who look only to the past or present are certain to miss the future.", author: "John F. Kennedy" },
        { text: "The only way to make sense out of change is to plunge into it, move with it, and join the dance.", author: "Alan Watts" },
        { text: "Life is a series of natural and spontaneous changes. Don't resist them; that only creates sorrow.", author: "Lao Tzu" },
        { text: "Every new beginning comes from some other beginning's end.", author: "Seneca" },
        { text: "It is not the strongest of the species that survives, nor the most intelligent, but the one most responsive to change.", author: "Charles Darwin" }
      ],
      "Needing Discipline": [
        { text: "Discipline is the bridge between goals and accomplishment.", author: "Jim Rohn" },
        { text: "We do today what they won't, so tomorrow we can accomplish what they can't.", author: "Dwayne Johnson" },
        { text: "Discipline is choosing between what you want now and what you want most.", author: "Abraham Lincoln" },
        { text: "Self-discipline is the ability to make yourself do what you should do, when you should do it, whether you feel like it or not.", author: "Elbert Hubbard" },
        { text: "The pain of discipline is far less than the pain of regret.", author: "Sarah Bombell" }
      ],
      "Motivated & Ready": [
        { text: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt" },
        { text: "Success is not the key to happiness. Happiness is the key to success.", author: "Albert Schweitzer" },
        { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
        { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
        { text: "Everything you've ever wanted is on the other side of fear.", author: "George Addair" }
      ]
    };

    let quotes: Array<{text: string, author: string}> = [];
    
    if (type === 'category') {
      quotes = realQuotesByCategory[value.toLowerCase()] || [];
    } else {
      quotes = realQuotesByTrigger[value] || [];
    }

    if (quotes.length === 0) {
      console.log('No quotes found for:', { type, value });
      return new Response(
        JSON.stringify({ quote: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];

    // Only generate AI image if explicitly requested
    let imageUrl = '';
    
    if (includeImage) {
      console.log('Generating AI image for quote...');
      const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
      
      if (openAIApiKey) {
      try {
        const bgTheme = type === 'category' ? value : 'motivation';
        const emotion = type === 'trigger' ? value : '';
        
        // CRITICAL: Use strong emphasis and repetition to ensure accurate text rendering
        const imagePrompt = `CRITICAL INSTRUCTION: You MUST spell every word EXACTLY as written below. DO NOT change any letters, words, or spelling.

Create a vertical 9:16 portrait inspirational quote image (1080x1920) with this EXACT TEXT:

QUOTE TEXT (spell EXACTLY as written):
"${randomQuote.text}"

AUTHOR (spell EXACTLY as written):
— ${randomQuote.author}

REQUIREMENTS:
- CRITICAL: Spell every single word EXACTLY as shown above
- CRITICAL: Double-check spelling matches the quote text PERFECTLY
- CRITICAL: The text must be CLEARLY READABLE with high contrast
- Make it cinematic, elegant, and inspiring
- Theme: ${bgTheme}
${emotion ? `- Emotional tone: ${emotion}` : ''}
- Use dramatic lighting and rich colors
- Professional typography with excellent readability
- Vertical portrait format optimized for mobile (9:16 ratio)
- Modern, high-quality design

REMEMBER: Spell the quote text EXACTLY as provided above. Every word must match PERFECTLY.`;
        
        const imageResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash-image',
            messages: [
              { role: 'user', content: imagePrompt }
            ],
            modalities: ['image', 'text']
          })
        });

        if (!imageResponse.ok) {
          const errorText = await imageResponse.text();
          console.error('AI gateway error:', imageResponse.status, errorText);
          
          // If it's a 402 (payment required), log it but don't throw - use fallback
          if (imageResponse.status === 402) {
            console.log('AI credits exhausted, using gradient fallback');
            imageUrl = ''; // Will trigger gradient fallback in UI
          } else {
            throw new Error(`AI image generation failed: ${imageResponse.status}`);
          }
        } else {
          const imageData = await imageResponse.json();
          const generatedUrl = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
          
          if (!generatedUrl) {
            console.error('No image URL in AI response:', JSON.stringify(imageData));
            imageUrl = ''; // Use gradient fallback
          } else {
            imageUrl = generatedUrl;
            console.log('Image generated successfully with embedded text');
          }
        }
      } catch (error) {
        console.error('Error generating image:', error);
        // Use gradient fallback on any error
        imageUrl = '';
      }
    }
    } else {
      console.log('Using gradient fallback (includeImage: false)');
    }

    const quoteWithImage: Quote = {
      ...randomQuote,
      imageUrl,
      fontFamily: type === 'category' 
        ? fontByCategory[value.toLowerCase()] || 'quote'
        : fontByTrigger[value] || 'quote',
      bgEffect: type === 'trigger' ? 'dark' : 'light'
    };

    return new Response(
      JSON.stringify({ quote: quoteWithImage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fetching quote:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
