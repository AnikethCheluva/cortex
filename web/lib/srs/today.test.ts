import {expect,it,vi} from 'vitest';
vi.mock('@/lib/storage',()=>({readVaultFile:vi.fn(async()=>({content:'<!-- srs:quiz -->\n<!-- ids: a,b,c,d -->'}))}));
vi.mock('@/lib/day',()=>({todayStem:()=> '10-13-26',todayISO:()=> '2026-10-13'}));
vi.mock('@/lib/srs/store',()=>({
 readCards:async()=>Object.fromEntries(['a','b','c','d'].map(id=>[id,{id,stem:id,type:'conceptual',topic:'test',source_file:'wiki/pages/test.md',difficulty_target:2,reference_answer:'SECRET',required_points:['SECRET'],suspended:id==='d'}])),
 readSubmissions:async()=>[{card_id:'c'}],
 readReviews:async()=>[{card_id:'a',ts:'2026-10-14T02:00:00Z'},{card_id:'b',ts:'2026-10-13T02:00:00Z'}],
}));
import {GET} from '@/app/api/quiz/today/route';
it('keeps graded-today answers completed across ingest, using Eastern dates',async()=>{
 const data=await (await GET()).json();
 expect(data.submittedIds.sort()).toEqual(['a','c']);
 expect(data.cards.map((c:{id:string})=>c.id)).toEqual(['a','b','c']);
 expect(JSON.stringify(data)).not.toContain('SECRET');
});
