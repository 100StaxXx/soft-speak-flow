import { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface HeroSlide {
  id: string;
  text: string;
  media_url?: string;
  media_type?: 'image' | 'video';
  gradient: string;
}

const defaultSlides: HeroSlide[] = [
  {
    id: "1",
    text: "RISE AGAIN",
    gradient: "from-obsidian/40 via-obsidian/60 to-obsidian/90",
  },
  {
    id: "2",
    text: "STAY HUNGRY",
    gradient: "from-obsidian/40 via-obsidian/60 to-obsidian/90",
  },
  {
    id: "3",
    text: "BUILD DISCIPLINE",
    gradient: "from-obsidian/40 via-obsidian/60 to-obsidian/90",
  },
];

export const HeroSlider = ({ mentorId }: { mentorId?: string }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [slides, setSlides] = useState<HeroSlide[]>(defaultSlides);

  useEffect(() => {
    const fetchSlides = async () => {
      try {
        let query = supabase
          .from("hero_slides")
          .select("*")
          .eq("is_active", true)
          .order("position");

        if (mentorId) {
          query = query.eq("mentor_id", mentorId);
        } else {
          query = query.is("mentor_id", null);
        }

        const { data } = await query;

        if (data && data.length > 0) {
          const formattedSlides = data.map((slide) => ({
            id: slide.id,
            text: slide.text,
            media_url: slide.media_url || undefined,
            media_type: (slide.media_type as 'image' | 'video') || undefined,
            gradient: "from-obsidian/40 via-obsidian/60 to-obsidian/90",
          }));
          setSlides(formattedSlides);
        }
      } catch (error) {
        console.error("Error fetching hero slides:", error);
      }
    };

    fetchSlides();
  }, [mentorId]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSelectedIndex((current) => (current + 1) % slides.length);
    }, 5000);

    return () => clearInterval(timer);
  }, [slides.length]);

  const scrollToContent = () => {
    window.scrollTo({ top: window.innerHeight, behavior: "smooth" });
  };

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {slides.map((slide, index) => (
        <div 
          key={slide.id} 
          className={`absolute inset-0 transition-opacity duration-1000 ${
            selectedIndex === index ? "opacity-100" : "opacity-0"
          }`}
        >
          {slide.media_url && slide.media_type === 'image' && (
            <img 
              src={slide.media_url} 
              alt={slide.text}
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          {slide.media_url && slide.media_type === 'video' && (
            <video 
              src={slide.media_url} 
              className="absolute inset-0 w-full h-full object-cover"
              autoPlay
              muted
              loop
              playsInline
            />
          )}
          {!slide.media_url && (
            <div className="absolute inset-0 bg-gradient-to-b from-graphite via-obsidian to-obsidian" />
          )}
          <div className={`absolute inset-0 bg-gradient-to-b ${slide.gradient}`} />
          
          <div className="absolute inset-0 flex items-center justify-center px-4">
            <h1 className="font-heading text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-black text-pure-white tracking-tighter text-center uppercase drop-shadow-2xl break-words max-w-[90vw]">
              {slide.text}
            </h1>
          </div>
        </div>
      ))}

      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 animate-bounce cursor-pointer" onClick={scrollToContent}>
        <ChevronDown className="h-8 w-8 text-royal-purple" strokeWidth={3} />
      </div>

    </div>
  );
};
