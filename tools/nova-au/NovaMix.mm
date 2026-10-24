#import <Cocoa/Cocoa.h>
#import <JavaScriptCore/JavaScriptCore.h>
#include "AssistantSource.hpp"
#import <AudioUnit/AUCocoaUIView.h>
#include <AudioUnitSDK/AUEffectBase.h>
#include "Comparison.hpp"
#include <mutex>
#include <optional>
// Non-realtime property commands; never called from the render callback.
constexpr AudioUnitPropertyID NovaCommand=64000, NovaSnapshot=64001;
static NSString* ns(const std::string& s){return [NSString stringWithUTF8String:s.c_str()];}
static std::string str(id v){return [v isKindOfClass:NSString.class]?std::string([v UTF8String]):std::string();}
static NSArray* array(const std::array<float,4>& v){return @[@(v[0]),@(v[1]),@(v[2]),@(v[3])];}
static bool values(id a,std::array<float,4>& v){
 if(![a isKindOfClass:NSArray.class]||[a count]!=4)return false;
 for(unsigned i=0;i<4;++i){if(![a[i] isKindOfClass:NSNumber.class])return false;v[i]=[a[i] floatValue];if(!nova::valid(i,v[i]))return false;}return true;
}
class NovaMix final:public ausdk::AUEffectBase {
 std::atomic<uint64_t> targets{nova::encode({0,0,0,0})};
 nova::DSP dsp;
 nova::Capture capture;
 std::atomic<bool> measuredGuard{false},safetyStop{false};
 nova::Binding captureBinding;
 nova::Measurement inputAnalysis,outputAnalysis;
 uint64_t analysisSettings=0;
 bool collected=false;
 NSString* audioId=@"";
 NSMutableArray* evidence=[NSMutableArray array];
 static NSDictionary* measured(const nova::Measurement& m){return @{@"valid":@(m.valid),@"status":ns(m.status),@"sampleRate":@(m.rate),@"frames":@(m.frames),@"samplePeak":@(m.peak),@"samplePeakDbFS":@(nova::db(m.peak)),@"rms":@(m.rms),@"rmsDbFS":@(nova::db(m.rms)),@"bandPowerFractions":@[@(m.bands[0]),@(m.bands[1]),@(m.bands[2])],@"clippedSamples":@(m.clipped),@"invalidSamples":@(m.invalid),@"lufsMeasured":@NO,@"truePeakMeasured":@NO};}
 void collect(){
  if(collected||capture.state.load(std::memory_order_acquire)!=3)return;
  collected=true;inputAnalysis=nova::measure(capture.samples.data(),capture.frames,capture.rate,4,0);outputAnalysis=nova::measure(capture.samples.data(),capture.frames,capture.rate,4,2);analysisSettings=capture.settings;
  audioId=[NSString stringWithFormat:@"capture-%@-%016llx",ns(binding.instance),(unsigned long long)inputAnalysis.hash];
  if(capture.changed||!(captureBinding==binding)){inputAnalysis.valid=false;inputAnalysis.status="changed-settings-or-target";}
  [evidence addObject:@{@"operation":@"measurement",@"audioId":audioId,@"binding":bindingDictionary(),@"input":measured(inputAnalysis),@"output":measured(outputAnalysis)}];if(evidence.count>32)[evidence removeObjectAtIndex:0];
  status=ns(inputAnalysis.status);
 }

 std::atomic<float> outputPeak{0},outputRms{0};
 static_assert(std::atomic<float>::is_always_lock_free);
 std::mutex controlMutex; // UI/state only; render never acquires it.
 nova::Binding binding;
 std::optional<nova::Proposal> pending;
 std::vector<std::pair<std::array<float,4>,std::array<float,4>>> history;
 NSString* status=@"音声未解析";
 NSDictionary* bindingDictionary()const{return @{ @"projectId":ns(binding.project),@"trackId":ns(binding.track),@"instanceId":ns(binding.instance),@"confirmed":@(binding.confirmed)};}
 NSDictionary* snapshot(){
  collect();
  NSMutableDictionary* s=[@{@"version":@1,@"binding":bindingDictionary(),@"current":array(nova::decode(targets.load())),@"audioAnalyzed":@(inputAnalysis.valid),@"analysis":@{@"audioId":audioId,@"binding":bindingDictionary(),@"input":measured(inputAnalysis),@"output":measured(outputAnalysis),@"captureState":@(capture.state.load()),@"source":@"user-confirmed AU input; host Track not auto-discovered"},@"history":evidence,@"safetyStopped":@(safetyStop.load()),@"status":status,@"undoCount":@(history.size()),@"meter":@{@"outputPeak":@(outputPeak.load()),@"outputRms":@(outputRms.load()),@"scope":@"last-render-block",@"lufsMeasured":@NO,@"truePeakMeasured":@NO}} mutableCopy];
  if(pending){s[@"proposalAudioAnalyzed"]=@(pending->audioAnalyzed);s[@"before"]=array(pending->before);s[@"choices"]=@[array(pending->choices[0]),array(pending->choices[1]),array(pending->choices[2])];s[@"reason"]=ns(pending->reason);}return s;
 }
 OSStatus command(NSDictionary* c){
  const auto op=str(c[@"operation"]);
  if(op=="bind"){
   const auto p=str(c[@"projectId"]),t=str(c[@"trackId"]);
   if(![c[@"confirmed"] isEqual:@YES]||p.empty()||t.empty()||p.size()>256||t.size()>256)return kAudioUnitErr_InvalidPropertyValue;
   if(p!=binding.project||t!=binding.track)history.clear();inputAnalysis={};outputAnalysis={};audioId=@"";binding.project=p;binding.track=t;binding.confirmed=true;pending.reset();status=@"対象確認済み・音声未解析";return noErr;
  }
  if(str(c[@"instanceId"])!=binding.instance||str(c[@"projectId"])!=binding.project||str(c[@"trackId"])!=binding.track||!binding.confirmed)return kAudioUnitErr_InvalidPropertyValue;
  collect();
  auto now=nova::decode(targets.load());
  if(op=="capture"){
   if(![c[@"consent"] isEqual:@YES])return kAudioUnitErr_InvalidPropertyValue;
   if(!capture.arm())return kAudioUnitErr_CannotDoInCurrentContext;
   captureBinding=binding;collected=false;inputAnalysis={};outputAnalysis={};pending.reset();audioId=@"";status=@"入力・出力の2秒をローカルRAMに取得中。外部送信なし";return noErr;
  }

  if(op=="preview"){
   pending.reset();
   JSContext* js=[[JSContext alloc]init];[js evaluateScript:[NSString stringWithUTF8String:NovaAssistantSource]];
   JSValue* routed=[js[@"NovaLogicInstruments"] invokeMethod:@"parseAudioCommand" withArguments:@[c[@"instruction"]?:@""]];
   if(js.exception){status=@"未対応の指示です";return kAudioUnitErr_InvalidPropertyValue;}
   NSDictionary* intent=[routed toDictionary];
   auto request=str(intent[@"instruction"]);
   if([intent[@"operation"] isEqual:@"undo"])request="前の設定に戻して";
   if(request=="前の設定に戻して"){status=@"Undoボタンで明示的に承認してください";pending.reset();return noErr;}
   try{if(inputAnalysis.valid){if(analysisSettings!=targets.load())throw std::runtime_error("設定変更後は音声を再解析してください");pending=nova::proposeMeasured(binding,now,request,inputAnalysis);}else {if(capture.state.load()!=0)throw std::runtime_error("音声の取得・解析を完了し、有効な入力を再取得してください");pending=nova::propose(binding,now,request);}status=ns(pending->reason);return noErr;}catch(const std::exception& e){status=ns(e.what());return kAudioUnitErr_InvalidPropertyValue;}
  }
  if(op=="compare"){
   if(!pending||!pending->audioAnalyzed||pending->before!=now||!(pending->binding==binding)||!inputAnalysis.valid||![c[@"approved"] isEqual:@YES])return kAudioUnitErr_InvalidPropertyValue;
   NSString* destination=c[@"directory"];if(![destination isKindOfClass:NSString.class]||![destination isAbsolutePath])return kAudioUnitErr_InvalidPropertyValue;
   try{
    auto comparison=nova::compare(capture.samples.data(),capture.frames,capture.rate,4,0,*pending);
    NSString* directory=[destination stringByAppendingPathComponent:[@"NOVA-comparison-" stringByAppendingString:NSUUID.UUID.UUIDString]];
    if(![NSFileManager.defaultManager createDirectoryAtPath:directory withIntermediateDirectories:NO attributes:nil error:nil])return kAudioUnitErr_InvalidPropertyValue;
    NSMutableArray* rows=[NSMutableArray array];NSArray* labels=@[@"original",@"A",@"B",@"C"];
    for(unsigned k=0;k<4;++k){NSString* raw=[labels[k] stringByAppendingString:@".wav"],*matched=[labels[k] stringByAppendingString:@"-rms-matched.wav"];
     nova::writeWave(str([directory stringByAppendingPathComponent:raw]),comparison.audio[k],capture.rate);
     nova::writeWave(str([directory stringByAppendingPathComponent:matched]),comparison.audio[k],capture.rate,comparison.matching[k]);
     [rows addObject:@{@"label":labels[k],@"wav":raw,@"rmsMatchedWav":matched,@"rmsMatchGain":@(comparison.matching[k]),@"measurement":measured(comparison.measurements[k]),@"settings":k?array(pending->choices[k-1]):@[]}];
    }
    NSDictionary* report=@{@"format":@"nova-au-comparison-v1",@"audioId":audioId,@"binding":bindingDictionary(),@"input":measured(inputAnalysis),@"startFrame":@0,@"frames":@(capture.frames),@"renders":rows,@"method":@"same NOVA DSP offline; zero filter state, identical source start; RMS attenuation matching, not LUFS",@"originalIsReferenceOnly":@YES};
    NSData* bytes=[NSJSONSerialization dataWithJSONObject:report options:NSJSONWritingPrettyPrinted error:nil];if(!bytes||![bytes writeToFile:[directory stringByAppendingPathComponent:@"manifest.json"] atomically:YES])throw std::runtime_error("比較manifest保存失敗");status=[@"比較WAV保存: " stringByAppendingString:directory];return noErr;
   }catch(const std::exception& e){status=ns(e.what());return kAudioUnitErr_InvalidPropertyValue;}
  }
  if(op=="cancel"){pending.reset();status=@"候補をキャンセルしました";return noErr;}
  if(op=="apply"){
   if(![c[@"approved"] isEqual:@YES]||!pending||!(pending->binding==binding)||pending->before!=now||![c[@"choice"] isKindOfClass:NSNumber.class])return kAudioUnitErr_InvalidPropertyValue;
   NSInteger i=[c[@"choice"] integerValue];if(i<0||i>2)return kAudioUnitErr_InvalidPropertyValue;
   if(pending->audioAnalyzed){try{auto trial=nova::compare(capture.samples.data(),capture.frames,capture.rate,4,0,*pending);if(trial.measurements[i+1].peak>.975)return kAudioUnitErr_InvalidPropertyValue;}catch(...){return kAudioUnitErr_InvalidPropertyValue;}}
   auto next=nova::decode(nova::encode(pending->choices[i]));bool usedAnalysis=pending->audioAnalyzed;history.push_back({now,next});auto expected=nova::encode(now);if(!targets.compare_exchange_strong(expected,nova::encode(next))){history.pop_back();return kAudioUnitErr_InvalidPropertyValue;}if(history.size()>32)history.erase(history.begin());
   [evidence addObject:@{@"operation":@"apply",@"audioId":audioId,@"binding":bindingDictionary(),@"audioAnalyzed":@(usedAnalysis),@"choice":@(i),@"before":array(now),@"after":array(next),@"input":measured(inputAnalysis),@"outputBefore":measured(outputAnalysis)}];if(evidence.count>32)[evidence removeObjectAtIndex:0];
   measuredGuard.store(usedAnalysis);safetyStop.store(false);inputAnalysis.valid=false;pending.reset();status=@"再測定は2秒音声取得に同意してください。承認した値をNOVA AU自身へ適用";return noErr;
  }
  if(op=="undo"){
   if(![c[@"approved"] isEqual:@YES]||history.empty()||history.back().second!=now)return kAudioUnitErr_InvalidPropertyValue;
   auto expected=nova::encode(now);if(!targets.compare_exchange_strong(expected,nova::encode(history.back().first)))return kAudioUnitErr_InvalidPropertyValue;[evidence addObject:@{@"operation":@"undo",@"before":array(now),@"after":array(history.back().first)}];if(evidence.count>32)[evidence removeObjectAtIndex:0];history.pop_back();measuredGuard.store(false);safetyStop.store(false);inputAnalysis.valid=false;pending.reset();status=@"前のNOVA AU設定に戻しました";return noErr;
  }
  return kAudioUnitErr_InvalidPropertyValue;
 }
public:
 explicit NovaMix(AudioComponentInstance ci):AUEffectBase(ci,true){
  history.reserve(33);CreateElements();Globals()->UseIndexedParameters(4);for(unsigned i=0;i<4;++i)AUEffectBase::SetParameter(i,0);
  binding.instance=str(NSUUID.UUID.UUIDString);
 }
 bool SupportsTail()override{return true;}
 Float64 GetTailTime()override{return .05;}
 bool CanScheduleParameters()const noexcept override{return false;} // immediate host automation, 20 ms DSP smoothing
 UInt32 SupportedNumChannels(const AUChannelInfo** info)override{static const AUChannelInfo channels={2,2};if(info)*info=&channels;return 1;}
 bool ValidFormat(AudioUnitScope s,AudioUnitElement e,const AudioStreamBasicDescription& f)override{
  return e==0&&(s==kAudioUnitScope_Input||s==kAudioUnitScope_Output)&&f.mChannelsPerFrame==2&&f.mSampleRate>=22050&&f.mSampleRate<=192000&&AUEffectBase::ValidFormat(s,e,f);
 }
 OSStatus Initialize()override{auto err=AUEffectBase::Initialize();if(!err)dsp.reset(GetSampleRate(),nova::decode(targets.load()));return err;}
 OSStatus Reset(AudioUnitScope s,AudioUnitElement e)override{dsp.reset(GetSampleRate(),nova::decode(targets.load()));return AUEffectBase::Reset(s,e);}
 OSStatus GetParameterInfo(AudioUnitScope s,AudioUnitParameterID i,AudioUnitParameterInfo& p)override{
  if(s!=kAudioUnitScope_Global||i>=4)return kAudioUnitErr_InvalidParameter;
  p={};const char* names[]={"Gain","Low band (180 Hz)","High band (4 kHz)","Bypass"};strlcpy(p.name,names[i],sizeof(p.name));
  static const CFStringRef cfNames[]={CFSTR("Gain"),CFSTR("Low band (180 Hz)"),CFSTR("High band (4 kHz)"),CFSTR("Bypass")};p.cfNameString=cfNames[i];
  p.unit=i==3?kAudioUnitParameterUnit_Boolean:kAudioUnitParameterUnit_Decibels;p.minValue=nova::minimum[i];p.maxValue=nova::maximum[i];p.defaultValue=0;p.flags=kAudioUnitParameterFlag_IsReadable|kAudioUnitParameterFlag_IsWritable|kAudioUnitParameterFlag_HasCFNameString;return noErr;
 }
 OSStatus SetParameter(AudioUnitParameterID i,AudioUnitScope s,AudioUnitElement e,AudioUnitParameterValue v,UInt32)override{
  if(s!=kAudioUnitScope_Global||e!=0||!nova::valid(i,v))return kAudioUnitErr_InvalidParameter;
  auto old=targets.load();for(;;){auto p=nova::decode(old);p[i]=v;if(targets.compare_exchange_weak(old,nova::encode(p)))return noErr;}
 }
 OSStatus GetParameter(AudioUnitParameterID i,AudioUnitScope s,AudioUnitElement e,AudioUnitParameterValue& v)override{
  if(s!=kAudioUnitScope_Global||e||i>=4)return kAudioUnitErr_InvalidParameter;v=nova::decode(targets.load())[i];return noErr;
 }
 // Let our parameter handle bypass so both directions crossfade rather than hard-switch.
 bool ShouldBypassEffect()override{return false;}
 void SetBypassEffect(bool b)override{SetParameter(3,kAudioUnitScope_Global,0,b?1:0,0);}
 OSStatus ProcessBufferLists(AudioUnitRenderActionFlags& flags,const AudioBufferList& in,AudioBufferList& out,UInt32 n)override{
  if(in.mNumberBuffers!=2||out.mNumberBuffers!=2)return kAudioUnitErr_FormatNotSupported;
  for(unsigned c=0;c<2;++c)if(!in.mBuffers[c].mData||!out.mBuffers[c].mData||in.mBuffers[c].mDataByteSize<n*sizeof(float)||out.mBuffers[c].mDataByteSize<n*sizeof(float))return kAudio_ParamError;
  const auto blockTargets=targets.load();
  unsigned captured=capture.input((float*)in.mBuffers[0].mData,(float*)in.mBuffers[1].mData,n,dsp.rate,blockTargets);
  dsp.process((float*)in.mBuffers[0].mData,(float*)in.mBuffers[1].mData,(float*)out.mBuffers[0].mData,(float*)out.mBuffers[1].mData,n,nova::decode(blockTargets));
  if(measuredGuard.load()){bool unsafe=false;for(unsigned c=0;c<2;++c){const float* x=(float*)out.mBuffers[c].mData;for(UInt32 f=0;f<n;++f)if(std::abs(x[f])>.975f)unsafe=true;}if(unsafe)safetyStop.store(true);if(safetyStop.load())for(unsigned c=0;c<2;++c)std::fill_n((float*)out.mBuffers[c].mData,n,0.f);}
  capture.output((float*)out.mBuffers[0].mData,(float*)out.mBuffers[1].mData,captured);
  double sum=0;float peak=0;for(unsigned c=0;c<2;++c){const float* x=(const float*)out.mBuffers[c].mData;for(UInt32 f=0;f<n;++f){peak=std::max(peak,std::abs(x[f]));sum+=double(x[f])*x[f];}}
  outputPeak.store(peak);outputRms.store(n?float(std::sqrt(sum/(2*n))):0);
  flags&=~kAudioUnitRenderAction_OutputIsSilence;return noErr;
 }
 OSStatus GetPropertyInfo(AudioUnitPropertyID i,AudioUnitScope s,AudioUnitElement e,UInt32& size,bool& writable)override{
  if(s==kAudioUnitScope_Global&&e==0&&(i==NovaCommand||i==NovaSnapshot)){size=sizeof(CFDictionaryRef);writable=i==NovaCommand;return noErr;}
  if(i==kAudioUnitProperty_CocoaUI&&s==kAudioUnitScope_Global&&e==0){size=sizeof(AudioUnitCocoaViewInfo);writable=false;return noErr;}
  return AUEffectBase::GetPropertyInfo(i,s,e,size,writable);
 }
 OSStatus GetProperty(AudioUnitPropertyID i,AudioUnitScope s,AudioUnitElement e,void* data)override{
  if(i==kAudioUnitProperty_BypassEffect&&s==kAudioUnitScope_Global&&e==0){*(UInt32*)data=nova::decode(targets.load())[3]>=.5f;return noErr;}
  if(i==NovaSnapshot&&s==kAudioUnitScope_Global&&e==0){std::lock_guard lock(controlMutex);*(CFDictionaryRef*)data=(__bridge_retained CFDictionaryRef)snapshot();return noErr;}
  if(i==kAudioUnitProperty_CocoaUI&&s==kAudioUnitScope_Global&&e==0){
   auto* info=(AudioUnitCocoaViewInfo*)data;NSBundle* bundle=[NSBundle bundleWithIdentifier:@"studio.nova.audio.NovaMix"];
   if(!bundle)return kAudioUnitErr_InvalidProperty;info->mCocoaAUViewBundleLocation=(__bridge_retained CFURLRef)bundle.bundleURL;info->mCocoaAUViewClass[0]=CFSTR("NovaMixViewFactory");return noErr;
  }
  return AUEffectBase::GetProperty(i,s,e,data);
 }
 OSStatus SetProperty(AudioUnitPropertyID i,AudioUnitScope s,AudioUnitElement e,const void* data,UInt32 size)override{
  if(i==kAudioUnitProperty_BypassEffect&&s==kAudioUnitScope_Global&&e==0){if(!data||size!=sizeof(UInt32))return kAudioUnitErr_InvalidPropertyValue;return SetParameter(3,s,e,*(const UInt32*)data?1:0,0);}
  if(i==NovaCommand&&s==kAudioUnitScope_Global&&e==0){
   if(size!=sizeof(CFDictionaryRef)||!data)return kAudioUnitErr_InvalidPropertyValue;
   CFDictionaryRef d=*(CFDictionaryRef const*)data;if(!d||CFGetTypeID(d)!=CFDictionaryGetTypeID())return kAudioUnitErr_InvalidPropertyValue;
   std::lock_guard lock(controlMutex);return command((__bridge NSDictionary*)d);
  }
  return AUEffectBase::SetProperty(i,s,e,data,size);
 }
 OSStatus SaveState(CFPropertyListRef* data)override{
  if(!data)return kAudio_ParamError;std::lock_guard lock(controlMutex);
  // Full host-owned state; contains no Music Studio files or Logic project edits.
  AUPreset preset{};OSStatus presetStatus=DispatchGetProperty(kAudioUnitProperty_PresentPreset,kAudioUnitScope_Global,0,&preset);if(presetStatus)return presetStatus;
  NSString* presetName=CFBridgingRelease(preset.presetName);
  NSMutableArray* undo=[NSMutableArray array];for(const auto& h:history)[undo addObject:@[array(h.first),array(h.second)]];
  *data=(__bridge_retained CFPropertyListRef)@{@"version":@0,@"type":@((UInt32)'aufx'),@"subtype":@((UInt32)'NvMx'),@"manufacturer":@((UInt32)'NvSt'),@"name":presetName?:@"NOVA Mix",@"novaVersion":@1,@"novaValues":array(nova::decode(targets.load())),@"novaBinding":bindingDictionary(),@"novaEvidence":evidence,@"novaUndo":undo};return noErr;
 }
 OSStatus RestoreState(CFPropertyListRef data)override{
  if(!data||CFGetTypeID(data)!=CFDictionaryGetTypeID())return kAudioUnitErr_InvalidPropertyValue;
  NSDictionary* d=(__bridge NSDictionary*)data;std::array<float,4> v;
  if(![d[@"novaVersion"] isEqual:@1]||![d[@"type"] isEqual:@((UInt32)'aufx')]||![d[@"subtype"] isEqual:@((UInt32)'NvMx')]||![d[@"manufacturer"] isEqual:@((UInt32)'NvSt')]||!values(d[@"novaValues"],v))return kAudioUnitErr_InvalidPropertyValue;
  id b=d[@"novaBinding"];if(![b isKindOfClass:NSDictionary.class])return kAudioUnitErr_InvalidPropertyValue;
  auto p=str(b[@"projectId"]),t=str(b[@"trackId"]);if(p.size()>256||t.size()>256)return kAudioUnitErr_InvalidPropertyValue;
  id presetName=d[@"name"];if(presetName&&(![presetName isKindOfClass:NSString.class]||[presetName length]>1024))return kAudioUnitErr_InvalidPropertyValue;
  std::vector<std::pair<std::array<float,4>,std::array<float,4>>> restoredUndo;
  id u=d[@"novaUndo"];if(u){if(![u isKindOfClass:NSArray.class]||[u count]>32)return kAudioUnitErr_InvalidPropertyValue;for(id row in u){std::array<float,4> a,b;if(![row isKindOfClass:NSArray.class]||[row count]!=2||!values(row[0],a)||!values(row[1],b))return kAudioUnitErr_InvalidPropertyValue;restoredUndo.push_back({a,b});}}
  std::lock_guard lock(controlMutex);
  if(presetName){AUPreset preset{-1,(__bridge CFStringRef)presetName};OSStatus err=AUEffectBase::NewCustomPresetSet(preset);if(err)return err;}
  id restored=d[@"novaEvidence"];if(restored){if(![restored isKindOfClass:NSArray.class]||[restored count]>32)return kAudioUnitErr_InvalidPropertyValue;NSData* bytes=[NSJSONSerialization dataWithJSONObject:restored options:0 error:nil];if(!bytes||bytes.length>262144)return kAudioUnitErr_InvalidPropertyValue;evidence=[restored mutableCopy];}else evidence=[NSMutableArray array];
  inputAnalysis={};outputAnalysis={};audioId=@"";
  targets.store(nova::encode(v));binding.project=p;binding.track=t;
  // A duplicated Logic insert must explicitly re-confirm its Track; keep a fresh runtime instance UUID.
  binding.confirmed=false;pending.reset();history=std::move(restoredUndo);status=@"設定復元済み。曲・Trackの対応を再確認してください";return noErr;
 }
};
AUSDK_COMPONENT_ENTRY(ausdk::AUBaseFactory,NovaMix)
