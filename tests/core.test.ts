import test from "node:test";
import assert from "node:assert/strict";
import { affinity, haversine, matchConcert, rankConcerts } from "../lib/matching";
import { parseHistory } from "../lib/history-import";
import { calendarContent } from "../lib/calendar";
import { ARTISTS, defaultPreferences } from "../lib/catalog";
import type { Concert, Member } from "../lib/types";
const indie=ARTISTS.find(a=>a.name==="Provinz")!;
const rap=ARTISTS.find(a=>a.name==="K.I.Z")!;
const members:Member[]=[{id:"a",name:"A",artists:[indie],genres:[]},{id:"b",name:"B",artists:[rap],genres:[]}];
const date=new Date();date.setDate(date.getDate()+10);
const concert:Concert={id:"test",title:"Provinz",artists:[indie],date:date.toISOString().slice(0,10),venue:"Test Venue",city:"Hamburg",lat:53.5511,lng:9.9937,url:"https://www.ticketmaster.de/event/test",genres:indie.genres,source:"Test fixture",checkedAt:new Date().toISOString(),status:"onsale"};
test("one enthusiastic member cannot outweigh a complete mismatch",()=>{
 const match=matchConcert(concert,members,defaultPreferences());
 assert.equal(match.members[0].score,100);assert.equal(match.members[1].score,0);assert.equal(match.score,18);
});
test("artist spelling differences are normalized, unrelated substring names are not",()=>{
 const member={...members[0],artists:[{id:"manual:x",name:"Die Arzte",genres:[]}]};
 assert.equal(affinity(member,{...concert,artists:[{id:"tm:other",name:"Die Ärzte",genres:[]}]}).score,100);
 assert.notEqual(affinity(member,{...concert,artists:[{id:"tm:other",name:"Die Ärzte Tribute",genres:[]}]}).score,100);
});
test("genre resemblance never claims a known favorite",()=>{
 const match=matchConcert({...concert,artists:[{id:"unknown",name:"New band",genres:["Indie"]}],genres:["Indie"]},[members[0]],defaultPreferences());
 assert.equal(match.discovery,true);assert.equal(match.score,75);
});
test("rank filtering respects exact distance, dates, prices, and cancellation",()=>{
 const p=defaultPreferences();
 const all=[concert,{...concert,id:"cancel",status:"cancelled"},{...concert,id:"old",date:"2020-01-01"},{...concert,id:"far",lat:48.1351,lng:11.582},{...concert,id:"price",price:70,currency:"EUR"},{...concert,id:"usd",price:20,currency:"USD"}];
 assert.deepEqual(rankConcerts(all,members,{...p,budget:50}),[]);
 assert.equal(rankConcerts([{...concert,price:40,currency:"EUR"}],members,{...p,budget:50}).length,1);
 assert.deepEqual(rankConcerts(all,members,p).map(m=>m.concert.id),["test","price","usd"]);
});
test("a one-person or empty round remains finite",()=>{
 assert.equal(matchConcert(concert,[],defaultPreferences()).score,0);
 assert.equal(matchConcert(concert,[members[0]],defaultPreferences()).score,100);
});
test("adding duplicate favorites does not inflate inferred preference",()=>{
 const candidate={...concert,artists:[{id:"unknown",name:"Another band",genres:["Indie"]}],genres:["Indie"]};
 assert.equal(affinity(members[0],candidate).score,affinity({...members[0],artists:Array(30).fill(indie)},candidate).score);
});
test("geographic calculation is stable for the same position and distant points",()=>{
 assert.equal(haversine(concert,concert),0);
 assert.ok(haversine(concert,{lat:52.52,lng:13.405})>250);
});
test("Spotify standard history ranks by listening time and ignores skips",()=>{
 const data=[{artistName:"Provinz",msPlayed:60000},{artistName:"K.I.Z",msPlayed:180000},{artistName:"Provinz",msPlayed:150000},{artistName:"Other",msPlayed:1000}];
 const result=parseHistory([JSON.stringify(data)]);
 assert.equal(result.plays,3);assert.equal(result.skipped,1);assert.equal(result.artists[0].name,"Provinz");assert.ok(result.artists[0].genres.includes("Indie"));
});
test("extended Spotify history ignores podcasts and unrelated personal fields",()=>{
 const result=parseHistory([JSON.stringify([{master_metadata_album_artist_name:"Test Artist",ms_played:200000,ip_addr:"private",ts:"2026-01-01",platform:"private"},{episode_name:"Podcast",master_metadata_album_artist_name:"Podcast Artist",ms_played:500000}])]);
 assert.equal(result.artists.length,1);assert.equal(result.plays,1);assert.ok(!JSON.stringify(result).includes("private"));assert.deepEqual(Object.keys(result.artists[0]),["id","name","genres"]);
});
test("multiple history files aggregate and malformed exports fail clearly",()=>{
 const file=JSON.stringify([{artistName:"Provinz",msPlayed:60000}]);
 assert.equal(parseHistory([file,file]).plays,2);
 assert.throws(()=>parseHistory(["{}"]),/kein Spotify-Hörverlauf/);
 assert.throws(()=>parseHistory(["not json"]),/gültiges JSON/);
 assert.throws(()=>parseHistory(["[]"]),/Keine Musikwiedergaben/);
});
test("calendar output escapes text, folds UTF-8 lines and keeps dates all-day",()=>{
 const result=calendarContent({...concert,title:"A, B; C\n"+ "Ä".repeat(100)});
 assert.match(result,/DTSTART;VALUE=DATE:/);
 assert.ok(result.includes("A\\, B\\; C\\n"));
 for(const line of result.split("\r\n"))assert.ok(Buffer.byteLength(line)<=75);
 assert.ok(result.endsWith("END:VCALENDAR\r\n"));
});
