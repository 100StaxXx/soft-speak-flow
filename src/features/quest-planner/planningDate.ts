import {addDays,format,isValid,parseISO} from 'date-fns';
/** Resolve explicit simple dates locally before reading that day's bookings. Never guess an ambiguous numeric date. */
export function requestedPlanningDate(message:string,today:string):string|null{
 const base=parseISO(today),text=message.toLowerCase().replace(/\b(?:tmrw|tmr)\b/g,'tomorrow');
 if (/\b(?:every|daily|weekly|biweekly|monthly|weekdays|weekends|recurring|repeat|mondays|tuesdays|wednesdays|thursdays|fridays|saturdays|sundays)\b/.test(text) || (/\b(today|tonight)\b/.test(text)&&/\btomorrow\b/.test(text))) return null;
 const distinctISO=new Set(text.match(/\b\d{4}-\d{2}-\d{2}\b/g)||[]);
 if(distinctISO.size>1)return null;
 const named=text.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/);
 if(named){const months=['january','february','march','april','may','june','july','august','september','october','november','december'];const candidate=`${named[3]||today.slice(0,4)}-${String(months.indexOf(named[1])+1).padStart(2,'0')}-${named[2].padStart(2,'0')}`;return isValid(parseISO(candidate))&&format(parseISO(candidate),'yyyy-MM-dd')===candidate?candidate:null;}
 const iso=text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
 if(iso&&isValid(parseISO(iso[1]))&&format(parseISO(iso[1]),'yyyy-MM-dd')===iso[1])return iso[1];
 if(/\bday after tomorrow\b/.test(text))return format(addDays(base,2),'yyyy-MM-dd');
 if(/\btomorrow\b/.test(text))return format(addDays(base,1),'yyyy-MM-dd');
 if(/\b(today|tonight)\b/.test(text))return today;
 const days=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
 const match=text.match(/\b(?:(next|this|on)\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
 if(match){let offset=(days.indexOf(match[2])-base.getDay()+7)%7;if(match[1]==='next'&&offset===0)offset=7;return format(addDays(base,offset),'yyyy-MM-dd');}
 return null;
}
