/* iPad-only Piano Roll pointer gesture bridge. Keeps Mac mouse behavior unchanged. */
(function(root){
  'use strict';

  const SELECTOR='.music-midi-editor-page .music-piano-viewport';
  const EDIT_INTERACTIVE='.music-midi-note,.music-note-resize,.music-pitch-hit,.music-loop-ruler,.music-loop-selection,.music-loop-handle,.music-time-ruler,button,input,select,textarea,summary';
  const coarseLandscape=()=>Boolean(root.matchMedia?.('(orientation: landscape) and (hover: none) and (pointer: coarse)')?.matches);
  const active=new Map();
  let drag=null;
  let pinch=null;
  let touchPinch=null;

  function viewportFor(target){return target?.closest?.(SELECTOR)||null}
  function pianoScroll(viewport){return viewport?.querySelector?.('.music-piano-scroll')||null}
  function rollFor(target){return target?.closest?.('.music-piano-roll')||null}
  function point(event){return{x:Number(event?.clientX)||0,y:Number(event?.clientY)||0}}
  function distance(a,b){return Math.hypot(b.x-a.x,b.y-a.y)}
  function touchPoint(touch){return{x:Number(touch?.clientX)||0,y:Number(touch?.clientY)||0}}
  function remember(viewport,scroll){
    root.MusicStudio?.editorRememberPitchScroll?.(viewport,'vertical');
    if(scroll)root.MusicStudio?.editorRememberPitchScroll?.(scroll,'horizontal');
  }
  function stop(event){event.preventDefault();event.stopImmediatePropagation?.();event.stopPropagation?.()}
  function emptyRollTouch(event){return event.pointerType==='touch'&&rollFor(event.target)&&!event.target?.closest?.(EDIT_INTERACTIVE)}
  function pointsFor(viewport){return[...active.values()].filter(item=>item.viewport===viewport)}
  function startPinch(viewport){
    const points=pointsFor(viewport);if(points.length<2)return false;
    const initial=distance(points[0],points[1]);if(!initial)return false;
    pinch={viewport,startDistance:initial,lastDistance:initial};drag=null;return true;
  }

  function onPointerDown(event){
    if(!coarseLandscape()||event.pointerType!=='touch')return;
    const viewport=viewportFor(event.target);if(!viewport||!emptyRollTouch(event))return;
    const p=point(event),scroll=pianoScroll(viewport);
    active.set(event.pointerId,{...p,viewport});
    event.target?.setPointerCapture?.(event.pointerId);
    if(!startPinch(viewport)&&active.size===1){
      drag={pointerId:event.pointerId,viewport,scroll,startX:p.x,startY:p.y,startTop:viewport.scrollTop,startLeft:Number(scroll?.scrollLeft)||0,axis:'',moved:false};
    }
    stop(event);
  }

  function onPointerMove(event){
    if(!coarseLandscape()||event.pointerType!=='touch'||!active.has(event.pointerId))return;
    if(touchPinch){stop(event);return}
    const p=point(event),entry=active.get(event.pointerId);active.set(event.pointerId,{...entry,...p});
    const viewport=entry.viewport,points=pointsFor(viewport);
    if(points.length>=2){
      if(!pinch)startPinch(viewport);
      if(pinch){pinch.lastDistance=distance(points[0],points[1])||pinch.lastDistance}
      stop(event);return;
    }
    if(!drag||drag.pointerId!==event.pointerId){stop(event);return}
    const dx=p.x-drag.startX,dy=p.y-drag.startY;
    if(!drag.axis&&Math.max(Math.abs(dx),Math.abs(dy))>=4)drag.axis=Math.abs(dy)>=Math.abs(dx)?'vertical':'horizontal';
    if(drag.axis){
      drag.moved=true;
      if(drag.axis==='vertical')drag.viewport.scrollTop=Math.max(0,drag.startTop-dy);
      else if(drag.scroll)drag.scroll.scrollLeft=Math.max(0,drag.startLeft-dx);
    }
    stop(event);
  }

  function finishPinch(){
    if(!pinch)return false;
    const steps=zoomSteps(pinch.startDistance,pinch.lastDistance);
    const viewport=pinch.viewport,scroll=pianoScroll(viewport);pinch=null;
    if(steps)root.MusicStudio?.editorZoom?.(steps);else remember(viewport,scroll);
    return Boolean(steps);
  }

  function zoomSteps(startDistance,lastDistance){
    const ratio=lastDistance/startDistance;
    return ratio>=1.08?Math.max(1,Math.min(6,Math.round((ratio-1)*5))):ratio<=.92?-Math.max(1,Math.min(6,Math.round((1-ratio)*5))):0;
  }

  function onTouchStart(event){
    if(!coarseLandscape()||event.touches?.length<2)return;
    const viewport=viewportFor(event.target);if(!viewport||event.target?.closest?.(EDIT_INTERACTIVE))return;
    const initial=distance(touchPoint(event.touches[0]),touchPoint(event.touches[1]));if(!initial)return;
    touchPinch={viewport,startDistance:initial,lastDistance:initial};
    active.clear();drag=null;pinch=null;stop(event);
  }

  function onTouchMove(event){
    if(!touchPinch||event.touches?.length<2)return;
    touchPinch.lastDistance=distance(touchPoint(event.touches[0]),touchPoint(event.touches[1]))||touchPinch.lastDistance;
    stop(event);
  }

  function onTouchEnd(event){
    if(!touchPinch||event.touches?.length>=2)return;
    const current=touchPinch;touchPinch=null;
    const steps=zoomSteps(current.startDistance,current.lastDistance);
    if(steps)root.MusicStudio?.editorZoom?.(steps);else remember(current.viewport,pianoScroll(current.viewport));
    stop(event);
  }

  function onPointerUp(event){
    if(event.pointerType!=='touch'||!active.has(event.pointerId))return;
    const entry=active.get(event.pointerId),viewport=entry.viewport,scroll=pianoScroll(viewport);
    active.delete(event.pointerId);
    if(!touchPinch&&pinch&&pointsFor(viewport).length<2)finishPinch();
    if(drag?.pointerId===event.pointerId){remember(viewport,scroll);drag=null}
    if(active.size===0){pinch=null;drag=null}
    stop(event);
  }

  function onPointerCancel(event){
    if(event.pointerType!=='touch'||!active.has(event.pointerId))return;
    active.delete(event.pointerId);if(active.size===0){pinch=null;drag=null}stop(event);
  }

  root.document?.addEventListener?.('pointerdown',onPointerDown,{capture:true,passive:false});
  root.document?.addEventListener?.('pointermove',onPointerMove,{capture:true,passive:false});
  root.document?.addEventListener?.('pointerup',onPointerUp,{capture:true,passive:false});
  root.document?.addEventListener?.('pointercancel',onPointerCancel,{capture:true,passive:false});
  root.document?.addEventListener?.('touchstart',onTouchStart,{capture:true,passive:false});
  root.document?.addEventListener?.('touchmove',onTouchMove,{capture:true,passive:false});
  root.document?.addEventListener?.('touchend',onTouchEnd,{capture:true,passive:false});
  root.document?.addEventListener?.('touchcancel',onTouchEnd,{capture:true,passive:false});

  root.MusicStudioIPadTouch={distance,zoomSteps,coarseLandscape};
})(typeof window!=='undefined'?window:globalThis);
