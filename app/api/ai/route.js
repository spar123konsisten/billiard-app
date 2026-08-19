import { NextResponse } from 'next/server';
import { parseIntent, mergeWithContext, setContext } from '@/app/lib/ai/intent';
import {
  getRanking, getStatistics, findPlayerByName, clearRankingCache,
} from '@/app/lib/ai/ranking';
import { formatResponse } from '@/app/lib/ai/utils';
import { CITY_GROUPS } from '@/app/lib/ai/config';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ADMIN_USERNAME = 'administrator';

// ===== HELPERS =====
const cityAliases = c => CITY_GROUPS[c] || [(c || '').toLowerCase()];
function fingerprint(q) { return q.toLowerCase().split(' ').filter(w => w.length > 2).sort().join('_'); }
const isDone = s => ['done','selesai','completed','finished'].includes(String(s||'').toLowerCase().trim());
function formatTanggal(d){ if(!d) return ''; const t=new Date(d); return isNaN(t)?d:t.toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'}); }

async function findPlayerById(id){
  if(!id) return null;
  const all = await getRanking({}, null);
  return all.find(p=>p.id===id||p.user_id===id)||null;
}

// ===== LEARNED PATTERNS (cache 60 dtk) =====
let patternsCache=null, patternsTs=0; const PATTERNS_TTL=60*1000;
async function getLearnedPatterns(){
  const now=Date.now();
  if(patternsCache && now-patternsTs<PATTERNS_TTL) return patternsCache;
  try{
    const {data}=await supabaseAdmin.from('learned_patterns').select('*').eq('active',true).order('priority',{ascending:false});
    patternsCache=data||[]; patternsTs=now; return patternsCache;
  }catch(e){ console.error('patterns:',e); return patternsCache||[]; }
}
function matchLearnedPattern(input,patterns){
  const t=input.toLowerCase().trim();
  for(const p of patterns){ const pat=(p.pattern||'').toLowerCase(); if(!pat)continue;
    try{
      if(p.pattern_type==='exact'){ if(t===pat)return p; }
      else if(p.pattern_type==='regex'){ if(new RegExp(pat,'i').test(t))return p; }
      else { if(t.includes(pat))return p; }
    }catch{}
  }
  return null;
}

// ===== RATE LIMIT / GARBAGE / REFRESH =====
const rateMap=new Map();
function isRateLimited(sid){ const now=Date.now(); let a=(rateMap.get(sid)||[]).filter(t=>now-t<60000);
  if(a.length>=10){rateMap.set(sid,a);return true;} a.push(now); rateMap.set(sid,a); return false; }
function isGarbage(t){ t=t.trim(); if(t.length<3)return true; if(/^[^\w\s]+$/.test(t))return true; if(/^\d+$/.test(t))return true;
  if(/(peringkat|ranking|rank|juara|nomor|top|tier|berapa|total|distribusi|banding|rekomendasi|profil|pemain|skor|score|refresh|segarkan|lawan|cari|sparring|partner|cocok|butuh|teman|main|terakhir|riwayat|jadwal|kapan)/i.test(t))return false;
  const c={}; for(const ch of t)c[ch]=(c[ch]||0)+1; let e=0; for(const k in c){const p=c[k]/t.length; e-=p*Math.log2(p);} return e>4.5&&t.length>10; }
const isRefreshCommand=t=>/refresh|segarkan|update data|data terbaru|reload/i.test(t);

// ===== UPSERT UNKNOWN =====
async function upsertUnknownQuery({query,fp,entities,confidence,intentGuess,userId,sessionId}){
  try{
    const {data}=await supabaseAdmin.from('unknown_queries').select('id,count').eq('fingerprint',fp).limit(1);
    if(data?.length){ await supabaseAdmin.from('unknown_queries').update({count:(data[0].count||1)+1,confidence,intent_guess:intentGuess}).eq('id',data[0].id); return data[0].id; }
    const {data:ins}=await supabaseAdmin.from('unknown_queries').insert({query,clean_query:query,fingerprint:fp,entities:entities||{},confidence,intent_guess:intentGuess,user_id:userId||null,session_id:sessionId||null,status:'pending'}).select('id').single();
    return ins?.id||null;
  }catch(e){ console.error('upsert:',e); return null; }
}
function intentLabel(i){ return {get_last_match:'riwayat',get_top_n:'peringkat',get_by_tier:'tier',get_by_city:'kota',get_statistics:'statistik',get_recommendation:'rekomendasi',compare_players:'perbandingan',get_match_score:'skor'}[i]||i; }

// ===== RIWAYAT / SKOR / COMPARE (inline, pakai supabaseAdmin) =====
async function getMatchesFor(uid){
  try{ const {data}=await supabaseAdmin.from('pertandingan').select('*').or(`challenger_id.eq.${uid},challenged_id.eq.${uid}`).order('created_at',{ascending:false}).limit(20); return data||[]; }
  catch(e){ console.error('matches:',e); return []; }
}
function buildMatchResponse(player,entry,match){
  const oppId=match.challenger_id===player.id?match.challenged_id:match.challenger_id;
  const opp={nama:'Tamu',foto_url:'',tier:'',bintang:0,streak:0,kota:'',username:''};
  if(match.guest_name) opp.nama=match.guest_name;
  const s1=Number(entry.skor_sendiri)||0, s2=Number(entry.skor_lawan)||0;
  const winner=s1>s2?player.nama:(s2>s1?opp.nama:'SERI');
  const info=[formatTanggal(match.tanggal),match.waktu,match.lokasi].filter(Boolean).join(' • ');
  return {success:true,message:`Hasil pertandingan ${player.nama}:`,data:[player,opp],extra:{type:'match_result',score1:s1,score2:s2,winner,info}};
}
async function getLastMatch(name){
  if(!name) return {_custom_message:'Sebutkan nama pemainnya.'};
  const player=findPlayerByName(name); if(!player) return {_custom_message:`Pemain "${name}" tidak ditemukan.`};
  const all=await getMatchesFor(player.id); const done=all.find(m=>isDone(m.status));
  if(done){ try{ const {data}=await supabaseAdmin.from('skor').select('*').eq('match_id',done.id).eq('input_by',player.id).limit(1);
    if(data?.length) return buildMatchResponse(player,data[0],done); }catch(e){}
    return {_custom_message:`Pertandingan ${player.nama} selesai tapi skor belum tercatat.`}; }
  if(!all.length) return {_custom_message:`${player.nama} belum punya riwayat pertandingan.`};
  return {_custom_message:`${player.nama} belum punya pertandingan selesai. Status terakhir: ${all[0].status}.`};
}
async function getMatchScore(n1,n2){
  if(n1&&n2){ const p1=findPlayerByName(n1),p2=findPlayerByName(n2); if(!p1||!p2)return{_custom_message:'Salah satu pemain tidak ditemukan.'};
    const all=await getMatchesFor(p1.id); const done=all.find(m=>[m.challenger_id,m.challenged_id].includes(p2.id)&&isDone(m.status));
    if(!done) return {_custom_message:`${p1.nama} dan ${p2.nama} belum punya pertandingan selesai.`};
    try{ const {data}=await supabaseAdmin.from('skor').select('*').eq('match_id',done.id).eq('input_by',p1.id).limit(1);
      if(data?.length) return buildMatchResponse(p1,data[0],done); }catch(e){}
    return {_custom_message:`Pertandingan ${p1.nama} vs ${p2.nama} selesai tapi skor belum tercatat.`}; }
  if(n1) return getLastMatch(n1);
  return {_custom_message:'Sebutkan nama pemainnya.'};
}
async function comparePlayers(n1,n2){
  const p1=findPlayerByName(n1),p2=findPlayerByName(n2);
  if(!p1||!p2) return {_custom_message:'Salah satu pemain tidak ditemukan.'};
  let w='SERI';
  if(p1.tier_order!==p2.tier_order) w=p1.tier_order>p2.tier_order?p1.nama:p2.nama;
  else if(p1.bintang!==p2.bintang) w=p1.bintang>p2.bintang?p1.nama:p2.nama;
  else if(p1.streak!==p2.streak) w=p1.streak>p2.streak?p1.nama:p2.nama;
  return {success:true,message:'Perbandingan pemain:',data:[p1,p2],extra:{winner:w,type:'comparison'}};
}
async function buildRecommendation(ref,city,limit=3){
  const pool=await getRanking(city?{kota_aliases:cityAliases(city)}:{}, null);
  if(!ref) return {message:'Pemain teratas'+(city?` di ${city}`:'')+':',data:pool.slice(0,limit)};
  const cand=[];
  for(const p of pool){ if(p.id===ref.id)continue; let s=0;
    if(p.kota_lower===ref.kota_lower)s+=3;
    const d=Math.abs(p.tier_order-ref.tier_order); if(d===0)s+=3;else if(d===1)s+=2;else if(d===2)s+=1;
    if(Math.abs(p.streak-ref.streak)<=2)s+=1; cand.push({player:p,score:s}); }
  cand.sort((a,b)=>b.score-a.score);
  return {message:`Rekomendasi lawan tanding untuk ${ref.nama}:`,data:cand.slice(0,limit).map(c=>({...c.player,match_score:c.score}))};
}

// ===== EXECUTE QUERY =====
async function executeQuery(parsed, ctx={}){
  const {intent,entities}=parsed; const e=entities;
  switch(intent){
    case 'get_top_rank': return getRanking({},1);
    case 'get_top_n': return getRanking({},e.limit||5);
    case 'get_by_tier': return getRanking({tier:e.tier});
    case 'get_by_city': return getRanking({kota_aliases:cityAliases(e.city)});
    case 'get_by_tier_and_city': return getRanking({tier:e.tier,kota_aliases:cityAliases(e.city)});
    case 'get_top_n_by_tier_and_city': return getRanking({tier:e.tier,kota_aliases:cityAliases(e.city)},e.limit);
    case 'get_top_n_by_tier': return getRanking({tier:e.tier},e.limit);
    case 'get_top_n_by_city': return getRanking({kota_aliases:cityAliases(e.city)},e.limit);
    case 'get_statistics': case 'get_distribution': return getStatistics();
    case 'get_player_profile': { const p=findPlayerByName(e.name); return p?[p]:{_custom_message:`Pemain "${e.name}" tidak ditemukan.`}; }
    case 'compare_players': return comparePlayers(e.name1,e.name2);
    case 'get_last_match': return getLastMatch(e.name);
    case 'get_match_score': return getMatchScore(e.name1||e.name,e.name2);
    case 'get_recommendation': {
      const forMe=/(^|\s)(gue|gw|gua|saya|aku|ane)(\s|$)/i.test(ctx.userInput||'');
      const refName=e.name||(forMe&&ctx.username?ctx.username:null);
      const ref=refName?findPlayerByName(refName):null;
      const result=await buildRecommendation(ref,e.city||null,3);
      if(!ctx.username){ const admin=findPlayerByName(ADMIN_USERNAME);
        return {...result,extra:{...(result.extra||{}),guest:true,admin:admin||null}}; }
      return result;
    }
    default: return [];
  }
}

// ===== POST =====
export async function POST(request){
  try{
    const body=await request.json();
    const userInput=(body.message||'').trim();
    const sessionId=body.session_id||null, userId=body.user_id||null, username=body.username||null;

    if(!userInput) return NextResponse.json({success:false,message:'Pesan kosong.'},{status:400});
    if(sessionId&&isRateLimited(sessionId)) return NextResponse.json({success:false,message:'Terlalu banyak pertanyaan, tunggu sebentar.'});
    if(isRefreshCommand(userInput)){ clearRankingCache(); return NextResponse.json({success:true,message:'Cache dibersihkan. Data terbaru akan diambil berikutnya.',type:'refresh'}); }
    if(isGarbage(userInput)) return NextResponse.json({success:true,message:'Maaf, saya tidak memahami pertanyaan Anda.',data:[],type:'unknown'});

    const patterns=await getLearnedPatterns();
    const matched=matchLearnedPattern(userInput,patterns);
    let parsed = matched
      ? {intent:matched.intent, entities:parseIntent(userInput).entities, confidence:1.0, learned:true}
      : parseIntent(userInput);

    const merged=mergeWithContext(userInput,parsed.entities,parsed.intent);
    parsed.intent=merged.intent; parsed.entities=merged.entities;
    if(merged.usedContext) parsed.confidence=Math.min((parsed.confidence||0)+0.2,1);

    const conf=parsed.confidence??0; const fp=fingerprint(userInput);

    if(!parsed.intent||conf<0.3){
      const qid=await upsertUnknownQuery({query:userInput,fp,entities:parsed.entities,confidence:conf,intentGuess:parsed.intent||null,userId,sessionId});
      return NextResponse.json({success:true,message:'Maaf, saya belum memahami pertanyaan ini. Saya catat untuk dipelajari. 📝',data:[],type:'unknown',query_id:qid,fingerprint:fp});
    }

    setContext(parsed.intent,parsed.entities);
    const result=await executeQuery(parsed,{username,userInput});

    // ✅ UBAHAN: Hapus disclaimer "Apakah maksud Anda tentang..."
    // Tetap log ke unknown_queries untuk learning loop, tapi tidak tampilkan disclaimer ke user
    let qid=null;
    if(conf>=0.3&&conf<0.5){
      qid=await upsertUnknownQuery({query:userInput,fp,entities:parsed.entities,confidence:conf,intentGuess:parsed.intent,userId,sessionId});
    }

    if(result&&result._custom_message){
      return NextResponse.json({success:true,message:result._custom_message,data:[],type:parsed.intent,query_id:qid,fingerprint:fp});
    }

    const response=formatResponse(parsed,result,parsed.intent);
    response.query_id=qid;
    response.fingerprint=fp;
    return NextResponse.json(response);
  }catch(err){
    console.error('AI API error:',err);
    return NextResponse.json({success:false,message:'Terjadi kesalahan: '+err.message,data:[],type:'error'},{status:500});
  }
}