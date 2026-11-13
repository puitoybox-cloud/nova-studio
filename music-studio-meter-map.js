/* Read-only meter timeline. Time Signature event ticks are exact boundaries. */
(function(root){
  'use strict';
  const MAX_TICK=0x0fffffff;
  function integer(value,min,max,label){if(!Number.isSafeInteger(value)||value<min||value>max)throw new RangeError(label);return value}
  function signature(value){const numerator=integer(value?.numerator,1,255,'invalid-meter-numerator'),denominator=value?.denominator;if(![1,2,4,8,16,32,64,128].includes(denominator))throw new RangeError('invalid-meter-denominator');return{numerator,denominator}}
  function createTimeline(data={}){
    const ppq=integer(data.ppq??480,1,32767,'invalid-ppq'),initial=signature(data.timeSignature??{numerator:4,denominator:4});
    if(data.timeSignatureMap!=null&&!Array.isArray(data.timeSignatureMap))throw new TypeError('invalid-meter-map');
    const entries=(data.timeSignatureMap??[]).map(item=>({tick:integer(item?.tick,0,MAX_TICK,'invalid-meter-tick'),...signature(item),explicit:true})).sort((a,b)=>a.tick-b.tick);
    if(!entries.length||entries[0].tick!==0)entries.unshift({tick:0,...initial,explicit:false});
    const segments=[];
    for(const item of entries){
      const previous=segments[segments.length-1];
      if(previous?.tick===item.tick){if(previous.numerator!==item.numerator||previous.denominator!==item.denominator)throw new RangeError('conflicting-meter-events');continue}
      const ticksPerBeat=ppq*4/item.denominator,ticksPerMeasure=ticksPerBeat*item.numerator;
      const firstMeasure=previous?previous.firstMeasure+Math.ceil((item.tick-previous.tick)/previous.ticksPerMeasure):1;
      if(previous)previous.endTick=item.tick;
      segments.push({...item,firstMeasure,ticksPerBeat,ticksPerMeasure,endTick:null});
    }
    return{ppq,segments};
  }
  function positionAtTick(data,tick){
    integer(tick,0,MAX_TICK,'invalid-position-tick');
    const {segments}=createTimeline(data),segment=[...segments].reverse().find(item=>item.tick<=tick),offset=tick-segment.tick,index=Math.floor(offset/segment.ticksPerMeasure),measureStartTick=segment.tick+index*segment.ticksPerMeasure,measureEndTick=Math.min(measureStartTick+segment.ticksPerMeasure,segment.endTick??Infinity);
    return{measure:segment.firstMeasure+index,beat:(tick-measureStartTick)/segment.ticksPerBeat+1,measureStartTick,measureEndTick,ticksPerBeat:segment.ticksPerBeat,ticksPerMeasure:segment.ticksPerMeasure,numerator:segment.numerator,denominator:segment.denominator};
  }
  function tickAtMeasure(data,measure){
    integer(measure,1,MAX_TICK,'invalid-measure');
    const {segments}=createTimeline(data),segment=[...segments].reverse().find(item=>item.firstMeasure<=measure),tick=segment.tick+(measure-segment.firstMeasure)*segment.ticksPerMeasure;
    if(!Number.isFinite(tick)||tick>MAX_TICK)throw new RangeError('measure-out-of-tick-range');
    return tick;
  }
  function rangeToTicks(data,startMeasure,endMeasure=startMeasure){
    integer(startMeasure,1,MAX_TICK,'invalid-start-measure');integer(endMeasure,startMeasure,MAX_TICK,'invalid-end-measure');
    return{startMeasure,endMeasure,startTick:tickAtMeasure(data,startMeasure),endTick:tickAtMeasure(data,endMeasure+1)};
  }
  root.MusicStudioMeterMap=Object.freeze({createTimeline,positionAtTick,tickAtMeasure,rangeToTicks});
})(typeof window!=='undefined'?window:globalThis);
