interface Mentor {
  id: string;
  name: string;
  tags: string[];
}

export const findBestMentor = (userTags: string[], mentors: Mentor[]): Mentor | null => {
  if (!mentors || mentors.length === 0) return null;

  let bestMatch = mentors[0];
  let highestScore = 0;

  mentors.forEach((mentor) => {
    const mentorTags = mentor.tags || [];
    
    // Count overlapping tags
    const overlaps = userTags.filter(tag => 
      mentorTags.some(mentorTag => 
        mentorTag.toLowerCase() === tag.toLowerCase()
      )
    );
    
    const score = overlaps.length;

    if (score > highestScore) {
      highestScore = score;
      bestMatch = mentor;
    }
  });

  return bestMatch;
};
