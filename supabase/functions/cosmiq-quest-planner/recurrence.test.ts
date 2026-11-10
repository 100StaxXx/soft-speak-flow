import {assertEquals} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {hasExplicitRecurrence} from './recurrence.ts';
Deno.test('recognizes natural weekly counts without inventing repetition',()=>{
 for(const text of ['Cook twice a week','Read three times per week','Train 4x/week','Practice on Tuesdays and Thursdays'])assertEquals(hasExplicitRecurrence(text),true,text);
 for(const text of ['Read four chapters tonight','Cook dinner tomorrow','I have two appointments this week'])assertEquals(hasExplicitRecurrence(text),false,text);
});
