export interface PlannedRecurrence { pattern: 'daily'|'weekdays'|'weekends'|'weekly'|'biweekly'|'monthly'; days: number[]; month_days: number[]; end_date: string|null }
const validDate=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
export function validateRecurrence(value:PlannedRecurrence, start:string) {
 if(!value||!['daily','weekdays','weekends','weekly','biweekly','monthly'].includes(value.pattern)||!validDate(start))throw Error('Invalid recurring schedule');
 for(const [days,min,max] of [[value.days,0,6],[value.month_days,1,31]] as const)if(!Array.isArray(days)||days.some(d=>!Number.isInteger(d)||d<min||d>max)||new Set(days).size!==days.length)throw Error('Invalid repeat days');
 if(['weekly','biweekly'].includes(value.pattern)&&(!value.days.length||(value.pattern==='biweekly'&&value.days.length!==1)))throw Error('Choose repeat weekdays; biweekly supports one weekday');
 if(value.pattern==='monthly'&&!value.month_days.length)throw Error('Choose the days of the month');
 if(!['weekly','biweekly'].includes(value.pattern)&&value.days.length||value.pattern!=='monthly'&&value.month_days.length)throw Error('Repeat days do not match pattern');
 if(value.end_date!==null&&(!validDate(value.end_date)||value.end_date<start))throw Error('Repeat end date precedes its start');
}
export function firstRecurrenceDate(rule:PlannedRecurrence,start:string):string {
 validateRecurrence(rule,start);
 for(let offset=0;offset<32;offset++){
  const d=new Date(Date.parse(start+'T12:00:00Z')+offset*86400000),day=(d.getUTCDay()+6)%7,key=d.toISOString().slice(0,10);
  const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();
  const matches=rule.pattern==='daily'||rule.pattern==='weekdays'&&day<5||rule.pattern==='weekends'&&day>=5||['weekly','biweekly'].includes(rule.pattern)&&rule.days.includes(day)||rule.pattern==='monthly'&&rule.month_days.some(n=>Math.min(n,last)===d.getUTCDate());
  if(matches){if(rule.end_date&&key>rule.end_date)throw Error('No occurrence before the repeat end date');return key;}
 }
 throw Error('No repeat date found');
}
export function recurrenceLabel(rule:PlannedRecurrence):string {
 const names=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
 const label=rule.pattern==='weekly'?`Every ${rule.days.map(d=>names[d]).join(', ')}`:rule.pattern==='biweekly'?`Every other ${names[rule.days[0]]}`:rule.pattern==='monthly'?`Monthly on ${rule.month_days.join(', ')} (short months use the last day)`:rule.pattern==='weekdays'?'Every weekday':rule.pattern==='weekends'?'Every weekend day':'Every day';
 return label+(rule.end_date?` · through ${rule.end_date}`:' · no end date');
}
export function recurrenceFields(rule?:PlannedRecurrence|null){return rule?{recurrence_pattern:rule.pattern,recurrence_days:rule.days,recurrence_month_days:rule.month_days,recurrence_end_date:rule.end_date,is_recurring:true}:{};}

/** Counts such as “twice a week” are explicit recurrence, not one-off requests. */
export function hasExplicitRecurrence(message:string):boolean {
 return /\b(every|daily|weekly|biweekly|weekdays|weekends|monthly|recurring|repeat|mondays|tuesdays|wednesdays|thursdays|fridays|saturdays|sundays)\b/i.test(message)
  || /\b(?:[1-7]|one|two|three|four|five|six|seven|once|twice|thrice)\s*(?:x|times?|days?)?\s*(?:a|per|\/)?\s*week\b/i.test(message);
}
