/* iPad-only Piano Roll touch bridge. Keeps Mac pointer/mouse behavior unchanged. */
(function(root){
  'use strict';

  const SELECTOR='.music-midi-editor-page .music-piano-viewport';
  const EDIT_INTERACTIVE='.music-midi-note,.music-note-resize,.music-pitch-hit,.music-loop-ruler,.music-loop-selection,.music-loop-handle,.music-time-ruler,button,input,select,textarea,summary';
  const coarseLandscape=()=>Boolean(root.matchMedia?.('(orientation: landscape) and (hover: none) and (pointer: coarse)')?.matches);
  const point=touch=>({x:Number(touch?.clientX)||0,y:Number(touch?.clientY)||0});
  const distance=touches=>{
    if(!touches||touches.length<2)return 0;
    const a=point(touches[0]),b=point(touches[1]);
    return Math.hypot(b.x-a.x,b.y-a.y);
  };

  let oneFinger=null;
  let pinch=null;
  let suppressPointerUntil=0;

  function viewportFor(target){return target?.closest?.(SELECTOR)||null}
  function pianoScroll(viewport){return viewport?.querySelector?.('.music-piano-scroll')||null}
  function rollFor(target){return target?.closest?.('.music-piano-roll')||null}
  function remember(viewport,scroll){
    root.MusicStudio?.editorRememberPitchScroll?.(viewport,'vertical');
    if(scroll)root.MusicStudio?.editorRememberPitchScroll?.(scroll,'horizontal');
  }
  function markTouchGesture(){suppressPointerUntil=Date.now()+500}

  function onPointerDown(event){
    if(!coarseLandscape()||event.pointerType!=='touch'||Date.now()>suppressPointerUntil)return;
    const viewport=viewportFor(event.target);if(!viewport)return;
    if(rollFor(event.target)&&!event.target?.closest?.('.music-midi-note,.music-note-resize')){
      event.preventDefault();
      event.stopImmediatePropagation?.();
      event.stopPropagation?.();
    }
  }

  function onTouchStart(event){
    if(!coarseLandscape())return;
    const viewport=viewportFor(event.target);if(!viewport)return;
    if(event.touches?.length>=2){
      const initial=distance(event.touches);if(!initial)return;
      pinch={viewport,startDistance:initial,lastDistance:initial};oneFinger=null;markTouchGesture();
      event.preventDefault();event.stopImmediatePropagation?.();event.stopPropagation();return;
    }
    if(event.touches?.length!==1||event.target?.closest?.(EDIT_INTERACTIVE)){oneFinger=null;return}
    const p=point(event.touches[0]),scroll=pianoScroll(viewport);
    oneFinger={viewport,scroll,startX:p.x,startY:p.y,startTop:viewport.scrollTop,startLeft:Number(scroll?.scrollLeft)||0,axis:'',moved:false};
    markTouchGesture();
    event.preventDefault();event.stopImmediatePropagation?.();event.stopPropagation();
  }

  function onTouchMove(event){
    if(!coarseLandscape())return;
    if(pinch&&event.touches?.length>=2){
      pinch.lastDistance=distance(event.touches)||pinch.lastDistance;markTouchGesture();
      event.preventDefault();event.stopImmediatePropagation?.();event.stopPropagation();return;
    }
    const drag=oneFinger;if(!drag||event.touches?.length!==1)return;
    const p=point(event.touches[0]),dx=p.x-drag.startX,dy=p.y-drag.startY;
    if(!drag.axis&&Math.max(Math.abs(dx),Math.abs(dy))>=4)drag.axis=Math.abs(dy)>=Math.abs(dx)?'vertical':'horizontal';
    if(drag.axis){
      drag.moved=true;
      if(drag.axis==='vertical')drag.viewport.scrollTop=Math.max(0,drag.startTop-dy);
      else if(drag.scroll)drag.scroll.scrollLeft=Math.max(0,drag.startLeft-dx);
    }
    markTouchGesture();
    event.preventDefault();event.stopImmediatePropagation?.();event.stopPropagation();
  }

  function finishPinch(event){
    if(!pinch)return false;
    const current=event.touches?.length>=2?distance(event.touches):pinch.lastDistance,ratio=current/pinch.startDistance;
    const steps=ratio>=1.12?Math.max(1,Math.min(4,Math.round((ratio-1)*3))):ratio<=.88?-Math.max(1,Math.min(4,Math.round((1-ratio)*3))):0;
    const viewport=pinch.viewport,scroll=pianoScroll(viewport);pinch=null;
    if(steps)root.MusicStudio?.editorZoom?.(steps);
    else remember(viewport,scroll);
    return Boolean(steps);
  }

  function onTouchEnd(event){
    if(pinch){markTouchGesture();event.preventDefault();event.stopImmediatePropagation?.();event.stopPropagation();finishPinch(event);return}
    if(oneFinger){
      remember(oneFinger.viewport,oneFinger.scroll);markTouchGesture();oneFinger=null;
      event.preventDefault();event.stopImmediatePropagation?.();event.stopPropagation();
    }
  }
  function onTouchCancel(event){pinch=null;oneFinger=null;markTouchGesture();event?.preventDefault?.();event?.stopImmediatePropagation?.();event?.stopPropagation?.()}

  root.document?.addEventListener?.('pointerdown',onPointerDown,{capture:true,passive:false});
  root.document?.addEventListener?.('touchstart',onTouchStart,{capture:true,passive:false});
  root.document?.addEventListener?.('touchmove',onTouchMove,{capture:true,passive:false});
  root.document?.addEventListener?.('touchend',onTouchEnd,{capture:true,passive:false});
  root.document?.addEventListener?.('touchcancel',onTouchCancel,{capture:true,passive:false});

  root.MusicStudioIPadTouch={distance,coarseLandscape};
})(typeof window!=='undefined'?window:globalThis);
