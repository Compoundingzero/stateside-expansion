import React from 'react';
import {learningKey,type LearningKind} from '../lib/learning';
import {useLearning,learningActions} from '../lib/learning-session';
import './Learning.css';
export interface LearningControlsProps {itemId:string;path:string;title:string;type:LearningKind;}
export default function LearningControls({itemId,path,title,type}:LearningControlsProps){
 const {progress,remember,ready,storageError}=useLearning(),key=learningKey(type,itemId),entry=progress.items[key];
 const complete=entry?.status==='complete',bookmarked=entry?.bookmarked===true;
 return <section className="learning-controls" aria-label="Optional learning progress" data-learning-item={key}>
  <div><span className="learning-kicker">Your learning</span><p>{type==='tool'?'Keep track of the tools you have explored.':'Keep this reading in your learning library.'}</p></div>
  <div className="learning-controls-actions">
   <button type="button" className="learning-quiet" disabled={!ready} aria-pressed={complete} onClick={()=>learningActions.mark(key,complete?'not-started':'complete')}>{complete?(type==='tool'?'Tool marked as tried':'Marked as read'):(type==='tool'?'Mark tool as tried':'Mark as read')}</button>
   <button type="button" className="learning-quiet" disabled={!ready} aria-pressed={bookmarked} aria-label={(bookmarked?'Remove bookmark: ':'Bookmark: ')+title} onClick={()=>learningActions.bookmark(key)}>{bookmarked?'Bookmarked':'Bookmark'}</button>
   <a href="/learn/">Open learning hub <span className="arrow-icon" aria-hidden="true"/></a>
  </div>
  <details className="learning-privacy"><summary>Progress privacy</summary><div><label><input type="checkbox" checked={remember} disabled={!ready} onChange={event=>learningActions.remember(event.target.checked)}/> Remember learning progress on this device</label><p>Off by default. Without remembering, changes last on this page. If enabled, only public content identifiers and self-reported progress are stored in this browser profile. Anyone using the same profile could see them. No plan inputs or contact details are included. Reset or export in <a href="/learn/#learning-settings">learning settings</a>.</p><p>This is a reading aid, not evidence of disclosure delivery, expertise or legal approval.</p></div></details>
  {storageError&&<p role="alert" className="learning-message">{storageError}</p>}
  <noscript><p>Progress controls need JavaScript. This article or tool’s public reading links remain available. <a href="/learn/">Browse learning paths</a>.</p></noscript>
 </section>;
}
