import {useEffect,useSyncExternalStore} from 'react';
import {emptyLearning,restoreLearning,updateLearningItem,solveLearningChallenge,type LearningProgress,type LearningStatus} from './learning';
import {learningChallenges,learningPaths} from '../data/learning-paths';
export const learningStorageKey='eln-learning-v1';
type Snapshot={progress:LearningProgress;remember:boolean;ready:boolean;storageError:string};
const initial:Snapshot={progress:emptyLearning(),remember:false,ready:false,storageError:''};
let snapshot=initial,loaded=false,catalogVerified=false,catalogError='';
const listeners=new Set<()=>void>();
const emit=()=>listeners.forEach(listener=>listener());
const known={items:new Set<string>(),challenges:new Set(learningChallenges.map(c=>c.id)),paths:new Set(learningPaths.map(p=>p.id))};
function save(){
 if(typeof window==='undefined'||!snapshot.remember||!catalogVerified)return;
 try{window.localStorage.setItem(learningStorageKey,JSON.stringify({remember:true,progress:snapshot.progress}));}
 catch{snapshot={...snapshot,remember:false,storageError:'This browser could not save progress. Keep learning here, or export a copy before leaving.'};}
}
async function load(){
 if(loaded||typeof window==='undefined')return;loaded=true;
 // The manifest contains public identifiers only. No progress or answers leave this browser.
 // A failed fetch must not overwrite an existing saved copy with an incomplete catalogue.
 const controller=new AbortController(),timeout=window.setTimeout(()=>controller.abort(),5000);
 try{
  const response=await fetch('/learn/catalog.json',{cache:'no-store',credentials:'omit',signal:controller.signal});
  if(!response.ok)throw new Error('Catalogue unavailable');
  const manifest=await response.json();
  if(manifest?.version!==1||!Array.isArray(manifest.items)||!manifest.items.length||manifest.items.length>5000||manifest.items.some((key:unknown)=>typeof key!=='string'||!/^(guide|tool):[A-Za-z0-9/_-]{1,180}$/.test(key))||new Set(manifest.items).size!==manifest.items.length)throw new Error('Invalid catalogue');
  known.items=new Set<string>(manifest.items);catalogVerified=true;
 }catch{
  catalogError='The learning catalogue could not be checked. You can still read, practise and track activity on this page. Saving is unavailable; your existing saved copy has not been changed. Reload to retry.';
 }finally{window.clearTimeout(timeout);}
 try{const raw=window.localStorage.getItem(learningStorageKey),saved=raw?JSON.parse(raw):null;snapshot={progress:saved?.remember===true?restoreLearning(saved.progress,known):emptyLearning(),remember:saved?.remember===true,ready:true,storageError:''};}
 catch{snapshot={...initial,ready:true,storageError:'Saved progress could not be read. You can still use the learning hub.'};}
 if(!catalogVerified)snapshot={progress:emptyLearning(),remember:false,ready:true,storageError:catalogError};
 window.addEventListener('storage',event=>{if(event.key!==learningStorageKey&&event.key!==null)return;if(!catalogVerified){if(event.newValue===null){snapshot={progress:emptyLearning(),remember:false,ready:true,storageError:catalogError};emit();}return;}try{const saved=event.newValue?JSON.parse(event.newValue):null;snapshot={progress:saved?.remember===true?restoreLearning(saved.progress,known):emptyLearning(),remember:saved?.remember===true,ready:true,storageError:''};emit();}catch{/* Ignore corrupt updates; never execute or display saved free text. */}});
 emit();
}
function change(progress:LearningProgress){snapshot={...snapshot,progress,storageError:catalogError};save();emit();}
export function useLearning(){const current=useSyncExternalStore(listener=>{listeners.add(listener);return()=>{listeners.delete(listener);};},()=>snapshot,()=>initial);useEffect(()=>{void load();},[]);return current;}
export const learningActions={
 mark(key:string,status:LearningStatus){if(!catalogVerified||known.items.has(key))change(updateLearningItem(snapshot.progress,key,{status}));},
 bookmark(key:string){if(!catalogVerified||known.items.has(key))change(updateLearningItem(snapshot.progress,key,{bookmarked:!snapshot.progress.items[key]?.bookmarked}));},
 start(key:string){if(catalogVerified&&!known.items.has(key))return;const entry=snapshot.progress.items[key];change(updateLearningItem(snapshot.progress,key,{status:entry?.status==='complete'?'complete':'reading'}));},
 path(id:string){if(known.paths.has(id))change({...snapshot.progress,activePath:id});},
 solve(id:string,version:string){if(known.challenges.has(id))change(solveLearningChallenge(snapshot.progress,id,version));},
 remember(value:boolean){
  if(value&&!catalogVerified){snapshot={...snapshot,remember:false,storageError:catalogError};emit();return;}
  snapshot={...snapshot,remember:value,storageError:''};
  if(value)save();else try{window.localStorage.removeItem(learningStorageKey);}catch{snapshot={...snapshot,storageError:'Saved progress could not be removed. Clear this site’s browser storage to remove that copy.'};}
  emit();
 },
 reset(){
  snapshot={progress:emptyLearning(),remember:false,ready:true,storageError:''};
  try{window.localStorage.removeItem(learningStorageKey);}catch{snapshot={...snapshot,storageError:'Saved progress could not be removed. Clear this site’s browser storage to remove that copy.'};}
  emit();
 },
 export(){
  const data={title:'ELN learning progress',privacy:'Public content identifiers and self-reported learning only. No plan inputs or contact details.',...snapshot.progress};
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),anchor=document.createElement('a');anchor.href=url;anchor.download='eln-learning-progress.json';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 },
};
