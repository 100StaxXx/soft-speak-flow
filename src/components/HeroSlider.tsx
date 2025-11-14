import { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";

const heroSlides = [
  {
    text: "RISE AGAIN",
    gradient: "from-obsidian/40 via-obsidian/60 to-obsidian/90",
  },
  {
    text: "STAY HUNGRY",
    gradient: "from-obsidian/40 via-obsidian/60 to-obsidian/90",
  },
  {
    text: "BUILD DISCIPLINE",
    gradient: "from-obsidian/40 via-obsidian/60 to-obsidian/90",
  },
];

export const HeroSlider = () => {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [
    Autoplay({ delay: 5000, stopOnInteraction: false }),
  ]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (!emblaApi) return;

    emblaApi.on("select", () => {
      setSelectedIndex(emblaApi.selectedScrollSnap());
    });
  }, [emblaApi]);

  const scrollToContent = () => {
    window.scrollTo({ top: window.innerHeight, behavior: "smooth" });
  };

  return (
    <div className="relative w-full h-screen overflow-hidden">
      <div ref={emblaRef} className="h-full">
        <div className="flex h-full">
          {heroSlides.map((slide, index) => (
            <div key={index} className="flex-[0_0_100%] min-w-0 relative h-full">
              <div className="absolute inset-0 bg-gradient-to-b from-graphite via-obsidian to-obsidian" />
              <div className={`absolute inset-0 bg-gradient-to-b ${slide.gradient}`} />
              
              <div className="absolute inset-0 flex items-center justify-center">
                <h1 className="font-heading text-6xl md:text-8xl font-black text-pure-white tracking-tighter text-center px-6 uppercase">
                  {slide.text}
                </h1>
              </div>

              <div className="absolute bottom-0 left-0 right-0 h-1 bg-royal-gold/20">
                <div 
                  className="h-full bg-royal-gold transition-all duration-300"
                  style={{ width: selectedIndex === index ? "100%" : "0%" }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 animate-bounce cursor-pointer" onClick={scrollToContent}>
        <span className="text-pure-white text-sm font-bold uppercase tracking-wider">Scroll to begin</span>
        <ChevronDown className="h-6 w-6 text-royal-gold" strokeWidth={3} />
      </div>

      <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex gap-2">
        {heroSlides.map((_, index) => (
          <button
            key={index}
            onClick={() => emblaApi?.scrollTo(index)}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              selectedIndex === index ? "w-8 bg-royal-gold" : "w-1.5 bg-steel/40"
            }`}
          />
        ))}
      </div>
    </div>
  );
};
