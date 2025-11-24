export type ZodiacSign = 
  | 'aries' | 'taurus' | 'gemini' | 'cancer' 
  | 'leo' | 'virgo' | 'libra' | 'scorpio'
  | 'sagittarius' | 'capricorn' | 'aquarius' | 'pisces';

interface ZodiacInfo {
  sign: ZodiacSign;
  symbol: string;
  element: 'fire' | 'earth' | 'air' | 'water';
  dates: string;
  constellation: string;
  strengths: string[];
  color: string;
  gradient: string;
}

export const zodiacData: Record<ZodiacSign, ZodiacInfo> = {
  aries: {
    sign: 'aries',
    symbol: '♈',
    element: 'fire',
    dates: 'Mar 21 - Apr 19',
    constellation: 'The Ram',
    strengths: ['courageous', 'determined', 'confident', 'passionate'],
    color: 'hsl(0, 85%, 60%)',
    gradient: 'from-red-500 to-orange-500'
  },
  taurus: {
    sign: 'taurus',
    symbol: '♉',
    element: 'earth',
    dates: 'Apr 20 - May 20',
    constellation: 'The Bull',
    strengths: ['reliable', 'patient', 'devoted', 'responsible'],
    color: 'hsl(120, 60%, 45%)',
    gradient: 'from-green-600 to-emerald-500'
  },
  gemini: {
    sign: 'gemini',
    symbol: '♊',
    element: 'air',
    dates: 'May 21 - Jun 20',
    constellation: 'The Twins',
    strengths: ['adaptable', 'outgoing', 'intelligent', 'curious'],
    color: 'hsl(45, 90%, 60%)',
    gradient: 'from-yellow-400 to-amber-400'
  },
  cancer: {
    sign: 'cancer',
    symbol: '♋',
    element: 'water',
    dates: 'Jun 21 - Jul 22',
    constellation: 'The Crab',
    strengths: ['intuitive', 'protective', 'compassionate', 'creative'],
    color: 'hsl(200, 80%, 65%)',
    gradient: 'from-cyan-400 to-blue-400'
  },
  leo: {
    sign: 'leo',
    symbol: '♌',
    element: 'fire',
    dates: 'Jul 23 - Aug 22',
    constellation: 'The Lion',
    strengths: ['creative', 'passionate', 'generous', 'warm-hearted'],
    color: 'hsl(30, 95%, 55%)',
    gradient: 'from-orange-500 to-amber-600'
  },
  virgo: {
    sign: 'virgo',
    symbol: '♍',
    element: 'earth',
    dates: 'Aug 23 - Sep 22',
    constellation: 'The Maiden',
    strengths: ['analytical', 'kind', 'hardworking', 'practical'],
    color: 'hsl(150, 50%, 50%)',
    gradient: 'from-emerald-500 to-teal-500'
  },
  libra: {
    sign: 'libra',
    symbol: '♎',
    element: 'air',
    dates: 'Sep 23 - Oct 22',
    constellation: 'The Scales',
    strengths: ['diplomatic', 'gracious', 'fair-minded', 'social'],
    color: 'hsl(300, 70%, 65%)',
    gradient: 'from-pink-400 to-rose-400'
  },
  scorpio: {
    sign: 'scorpio',
    symbol: '♏',
    element: 'water',
    dates: 'Oct 23 - Nov 21',
    constellation: 'The Scorpion',
    strengths: ['resourceful', 'brave', 'passionate', 'determined'],
    color: 'hsl(320, 80%, 45%)',
    gradient: 'from-fuchsia-600 to-purple-600'
  },
  sagittarius: {
    sign: 'sagittarius',
    symbol: '♐',
    element: 'fire',
    dates: 'Nov 22 - Dec 21',
    constellation: 'The Archer',
    strengths: ['optimistic', 'adventurous', 'honest', 'philosophical'],
    color: 'hsl(270, 75%, 60%)',
    gradient: 'from-purple-500 to-indigo-500'
  },
  capricorn: {
    sign: 'capricorn',
    symbol: '♑',
    element: 'earth',
    dates: 'Dec 22 - Jan 19',
    constellation: 'The Goat',
    strengths: ['disciplined', 'responsible', 'ambitious', 'patient'],
    color: 'hsl(220, 60%, 50%)',
    gradient: 'from-blue-600 to-indigo-600'
  },
  aquarius: {
    sign: 'aquarius',
    symbol: '♒',
    element: 'air',
    dates: 'Jan 20 - Feb 18',
    constellation: 'The Water Bearer',
    strengths: ['progressive', 'original', 'independent', 'humanitarian'],
    color: 'hsl(190, 75%, 55%)',
    gradient: 'from-cyan-500 to-sky-500'
  },
  pisces: {
    sign: 'pisces',
    symbol: '♓',
    element: 'water',
    dates: 'Feb 19 - Mar 20',
    constellation: 'The Fish',
    strengths: ['compassionate', 'artistic', 'intuitive', 'gentle'],
    color: 'hsl(260, 70%, 65%)',
    gradient: 'from-violet-400 to-purple-400'
  }
};

export function calculateZodiacSign(birthdate: Date): ZodiacSign {
  const month = birthdate.getMonth() + 1; // 1-12
  const day = birthdate.getDate();

  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return 'aries';
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return 'taurus';
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return 'gemini';
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return 'cancer';
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return 'leo';
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return 'virgo';
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return 'libra';
  if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return 'scorpio';
  if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return 'sagittarius';
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return 'capricorn';
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return 'aquarius';
  return 'pisces';
}

export function getZodiacInfo(sign: ZodiacSign): ZodiacInfo {
  return zodiacData[sign];
}