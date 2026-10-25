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
static NSArray* processingArray(const nova::Processing& p){NSMutableArray* a=[NSMutableArray array];for(float x:p)[a addObject:@(x)];return a;}
static bool processingValues(id a,nova::Processing& p){if(![a isKindOfClass:NSArray.class]||[a count]!=nova::ExtraCount)return false;for(unsigned i=0;i<nova::ExtraCount;++i){if(![a[i] isKindOfClass:NSNumber.class])return false;p[i]=[a[i] floatValue];if(!nova::extraValid(i,p[i]))return false;}p=nova::unpack(nova::pack(p));return true;}
class NovaMix final:public ausdk::AUEffectBase {
 std::atomic<uint64_t> targets{nova::encode({0,0,0,0})};
 std::atomic<uint64_t> processing{nova::pack(nova::defaults())},sequence{0};
 std::atomic_flag writer=ATOMIC_FLAG_INIT;
 uint64_t renderTargets=nova::encode({0,0,0,0}),renderProcessing=nova::pack(nova::defaults());
 // Writers try once, never wait on the render thread. Render retains the previous coherent pair
 // if publication overlaps a block boundary. All payload words are themselves lock-free atomics.
 bool publish(uint64_t expected,uint64_t next,uint64_t extra){
  if(writer.test_and_set(std::memory_order_acquire))return false;
  if(targets.load()!=expected){writer.clear(std::memory_order_release);return false;}
  sequence.fetch_add(1);processing.store(extra);targets.store(next);sequence.fetch_add(1);writer.clear(std::memory_order_release);return true;
 }
 bool readPair(uint64_t& core,uint64_t& extra)const{
  for(unsigned attempt=0;attempt<4;++attempt){auto before=sequence.load();if(before&1)continue;core=targets.load();extra=processing.load();if(sequence.load()==before)return true;}return false;
 }
 nova::DSP dsp;
 nova::Capture capture;
 std::atomic<bool> measuredGuard{false},safetyStop{false};
 nova::Binding captureBinding;
 nova::Measurement inputAnalysis,outputAnalysis;
 uint64_t analysisSettings=0,captureProcessing=0,pendingProcessing=0;
 bool collected=false;
 NSString* audioId=@"";
 NSMutableArray* evidence=[NSMutableArray array];
 static NSDictionary* measured(const nova::Measurement& m){return @{@"valid":@(m.valid),@"status":ns(m.status),@"sampleRate":@(m.rate),@"frames":@(m.frames),@"samplePeak":@(m.peak),@"samplePeakDbFS":@(nova::db(m.peak)),@"rms":@(m.rms),@"rmsDbFS":@(nova::db(m.rms)),@"bandPowerFractions":@[@(m.bands[0]),@(m.bands[1]),@(m.bands[2])],@"crestFactorDb":@(nova::db(m.peak/std::max(m.rms,1e-20))),@"clippedSamples":@(m.clipped),@"invalidSamples":@(m.invalid),@"lufsMeasured":@(m.loudness.valid),@"truePeakMeasured":@(m.loudness.valid),@"integratedLufsExcerpt":@(m.loudness.integrated),@"momentaryLufsLast400ms":@(m.loudness.momentary),@"shortTermMeasured":@(m.loudness.shortTermValid),@"truePeakEstimate":@(m.loudness.truePeak),@"truePeakEstimateDbTP":@(nova::db(m.loudness.truePeak)),@"loudnessScope":@"captured excerpt only; 48 kHz; gated BS.1770; Annex 2 4x FIR estimate, not certified"};}
 void collect(){
  if(collected||capture.state.load(std::memory_order_acquire)!=3)return;
  collected=true;inputAnalysis=nova::measure(capture.samples.data(),capture.frames,capture.rate,4,0);outputAnalysis=nova::measure(capture.samples.data(),capture.frames,capture.rate,4,2);analysisSettings=capture.settings;
  if(!audioId.length)audioId=[@"capture-" stringByAppendingString:NSUUID.UUID.UUIDString];
  if(captureProcessing!=processing.load()||capture.changed||!(captureBinding==binding)){inputAnalysis.valid=false;inputAnalysis.status="changed-settings-or-target";}
  [evidence addObject:@{@"operation":@"measurement",@"audioId":audioId,@"binding":bindingInfo(captureBinding),@"input":measured(inputAnalysis),@"output":measured(outputAnalysis)}];if(evidence.count>32)[evidence removeObjectAtIndex:0];
  status=ns(inputAnalysis.status);
 }

 std::atomic<float> outputPeak{0},outputRms{0},gainReduction{0};
 static_assert(std::atomic<float>::is_always_lock_free);
 std::mutex controlMutex; // UI/state only; render never acquires it.
 nova::Binding binding;
 std::optional<nova::Proposal> pending;
 uint64_t pendingWord=0,controlEpoch=0;
 NSString* settingsToken(uint64_t core,uint64_t extra)const{return [NSString stringWithFormat:@"%llu:%llu:%llu",(unsigned long long)core,(unsigned long long)extra,(unsigned long long)controlEpoch];}
 struct Undo {std::array<float,4> first,second;uint64_t appliedWord=0;uint64_t extraBefore=nova::pack(nova::defaults()),extraAfter=nova::pack(nova::defaults());};
 std::vector<Undo> history;
 NSString* status=@"音声未解析";
 static NSDictionary* bindingInfo(const nova::Binding& b){return @{@"projectId":ns(b.project),@"trackId":ns(b.track),@"instanceId":ns(b.instance),@"confirmed":@(b.confirmed),@"role":ns(b.role),@"targetKind":ns(b.kind),@"inputSource":ns(b.source)};}
 NSDictionary* bindingDictionary()const{return bindingInfo(binding);}
 NSDictionary* snapshot(){
  collect();uint64_t core=targets.load(),extra=processing.load();bool consistent=readPair(core,extra);
  NSMutableDictionary* s=[@{@"version":@1,@"binding":bindingDictionary(),@"current":array(nova::decode(core)),@"parameterSnapshotConsistent":@(consistent),@"audioAnalyzed":@(inputAnalysis.valid),@"analysis":@{@"audioId":audioId,@"binding":bindingInfo(captureBinding),@"input":measured(inputAnalysis),@"output":measured(outputAnalysis),@"captureState":@(capture.state.load()),@"capturedFrames":@(capture.progress.load()),@"complete":@(capture.state.load()==3),@"source":@"user-confirmed AU input; host Track not auto-discovered"},@"history":evidence,@"safetyStopped":@(safetyStop.load()),@"status":safetyStop.load()?@"出力過大のため停止中。Undo承認で解除してください":status,@"undoCount":@(history.size()),@"meter":@{@"outputPeak":@(outputPeak.load()),@"outputRms":@(outputRms.load()),@"scope":@"last-render-block",@"lufsMeasured":@NO,@"truePeakMeasured":@NO}} mutableCopy];
  s[@"settingsToken"]=settingsToken(core,extra);s[@"processing"]=processingArray(nova::unpack(extra));s[@"gainReductionDb"]=@(gainReduction.load());
  if(pending&&consistent){s[@"processingChoices"]=@[processingArray(pending->processingChoices[0]),processingArray(pending->processingChoices[1]),processingArray(pending->processingChoices[2])];s[@"proposalAudioAnalyzed"]=@(pending->audioAnalyzed);s[@"before"]=array(pending->before);s[@"choices"]=@[array(pending->choices[0]),array(pending->choices[1]),array(pending->choices[2])];s[@"reason"]=ns(pending->reason);}return s;
 }
 OSStatus command(NSDictionary* c){
  const auto op=str(c[@"operation"]);
  if(op=="bind"){
   ++controlEpoch;
   const auto p=str(c[@"projectId"]),t=str(c[@"trackId"]);
   if(![c[@"confirmed"] isEqual:@YES]||p.empty()||t.empty()||p.size()>256||t.size()>256)return kAudioUnitErr_InvalidPropertyValue;
   auto role=str(c[@"role"]),kind=str(c[@"targetKind"]),source=str(c[@"inputSource"]);
   if(kind.empty())kind="track";if(role.empty())role="unspecified";if(source.empty())source="user-confirmed AU input";
   if(role.size()>256||source.size()>512||(kind!="track"&&kind!="bus"&&kind!="stereo-out"))return kAudioUnitErr_InvalidPropertyValue;
   if(p!=binding.project||t!=binding.track||kind!=binding.kind||source!=binding.source)history.clear();binding.role=role;binding.kind=kind;binding.source=source;inputAnalysis={};outputAnalysis={};audioId=@"";binding.project=p;binding.track=t;binding.confirmed=true;collected=true;pending.reset();status=@"対象確認済み・音声未解析";return noErr;
  }
  if(str(c[@"instanceId"])!=binding.instance||str(c[@"projectId"])!=binding.project||str(c[@"trackId"])!=binding.track||!binding.confirmed)return kAudioUnitErr_InvalidPropertyValue;
  collect();
  uint64_t nowWord=0,nowProcessing=0;if(!readPair(nowWord,nowProcessing))return kAudioUnitErr_CannotDoInCurrentContext;auto now=nova::decode(nowWord);
  if(op=="apply-whole-song"){
   // The control UI revalidates source and every output hash immediately before this command.
   // No filesystem, subprocess, FFT or whole-song buffers enter this command or render.
   id reply=c[@"result"];if(![reply isKindOfClass:NSDictionary.class])return kAudioUnitErr_InvalidPropertyValue;id q=reply[@"request"];id rows=reply[@"renders"];
   if(![c[@"approved"]isEqual:@YES]||![reply isKindOfClass:NSDictionary.class]||![reply[@"format"]isEqual:@"nova-au-whole-reply-v1"]||![q isKindOfClass:NSDictionary.class]||![rows isKindOfClass:NSArray.class]||[rows count]!=4||![q[@"settingsToken"]isEqual:settingsToken(nowWord,nowProcessing)]||![q[@"instanceId"]isEqual:ns(binding.instance)]||![q[@"projectId"]isEqual:ns(binding.project)]||![q[@"trackId"]isEqual:ns(binding.track)]||![q[@"kind"]isEqual:ns(binding.kind)]||![q[@"role"]isEqual:ns(binding.role)]||![q[@"inputSource"]isEqual:ns(binding.source)]||![c[@"choice"]isKindOfClass:NSNumber.class])return kAudioUnitErr_InvalidPropertyValue;
   NSInteger index=[c[@"choice"]integerValue];if(index<0||index>2)return kAudioUnitErr_InvalidPropertyValue;
   id row=rows[index+1];std::array<float,4> next;nova::Processing extra;
   if(![row isKindOfClass:NSDictionary.class]||![row[@"label"]isEqual:@[@"A",@"B",@"C"][index]]||!values(row[@"values"],next)||!processingValues(row[@"processing"],extra)||extra[0]!=1||next[3]!=0)return kAudioUnitErr_InvalidPropertyValue;
   // Only the shared live EQ/compressor/base Gain map. Offline final gain, lookahead and TP attenuation do NOT.
   next=nova::decode(nova::encode(next));auto nextExtra=nova::pack(extra);auto nextWord=nova::revised(nowWord,next);
   history.push_back({now,next,nextWord,nowProcessing,nextExtra});if(!publish(nowWord,nextWord,nextExtra)){history.pop_back();return kAudioUnitErr_CannotDoInCurrentContext;}if(history.size()>32)history.erase(history.begin());
   [evidence addObject:@{@"operation":@"apply-whole-song",@"binding":bindingDictionary(),@"request":q,@"manifestSha256":reply[@"manifestSha256"]?:@"",@"choice":@(index),@"before":array(now),@"after":array(next),@"processing":processingArray(extra),@"offlineLimiterApplied":@NO,@"offlineFinalGainApplied":@NO,@"liveRemeasurementRequired":@YES}];if(evidence.count>32)[evidence removeObjectAtIndex:0];
   ++controlEpoch;pending.reset();inputAnalysis.valid=false;measuredGuard.store(true);safetyStop.store(false);status=@"全曲実測EQ/Comp/base Gainを適用。オフラインLimiter/追加Gainは未適用。Logic再出力で全曲再測定が必要";return noErr;
  }
  if(op=="capture"){
   if(![c[@"consent"] isEqual:@YES])return kAudioUnitErr_InvalidPropertyValue;
   if(!capture.arm())return kAudioUnitErr_CannotDoInCurrentContext;
   captureProcessing=nowProcessing;captureBinding=binding;collected=false;inputAnalysis={};outputAnalysis={};pending.reset();audioId=[@"capture-" stringByAppendingString:NSUUID.UUID.UUIDString];status=@"入力・出力の2秒をローカルRAMに取得中。外部送信なし";return noErr;
  }

  if(op=="preview"){
   pending.reset();pendingWord=nowWord;pendingProcessing=nowProcessing;
   JSContext* js=[[JSContext alloc]init];[js evaluateScript:[NSString stringWithUTF8String:NovaAssistantSource]];
   JSValue* routed=[js[@"NovaLogicInstruments"] invokeMethod:@"parseAudioCommand" withArguments:@[c[@"instruction"]?:@""]];
   if(js.exception){status=@"未対応の指示です";return kAudioUnitErr_InvalidPropertyValue;}
   NSDictionary* intent=[routed toDictionary];
   auto request=str(intent[@"instruction"]);
   if([intent[@"operation"] isEqual:@"undo"])request="前の設定に戻して";
   if(request=="前の設定に戻して"){status=@"Undoボタンで明示的に承認してください";pending.reset();return noErr;}
   try{if(inputAnalysis.valid){if(analysisSettings!=targets.load())throw std::runtime_error("設定変更後は音声を再解析してください");if(request=="マスタリングして"){id t=c[@"targetLufs"];if(![t isKindOfClass:NSNumber.class])throw std::runtime_error("目標LUFSの指定が必要です");pending=nova::proposeMaster(binding,now,nova::unpack(pendingProcessing),capture.samples.data(),capture.frames,capture.rate,4,0,[t doubleValue]);}else pending=nova::proposeMeasured(binding,now,request,inputAnalysis,nova::unpack(pendingProcessing));}else {if(capture.state.load()!=0)throw std::runtime_error("音声の取得・解析を完了し、有効な入力を再取得してください");pending=nova::propose(binding,now,request);}if(!pending->audioAnalyzed){pending->processingBefore=nova::unpack(pendingProcessing);pending->processingChoices={pending->processingBefore,pending->processingBefore,pending->processingBefore};}[evidence addObject:@{@"operation":@"proposal",@"instruction":ns(request),@"audioId":audioId,@"binding":bindingDictionary(),@"audioAnalyzed":@(pending->audioAnalyzed),@"input":measured(inputAnalysis),@"choices":@[array(pending->choices[0]),array(pending->choices[1]),array(pending->choices[2])],@"processingChoices":@[processingArray(pending->processingChoices[0]),processingArray(pending->processingChoices[1]),processingArray(pending->processingChoices[2])],@"reason":ns(pending->reason)}];if(evidence.count>32)[evidence removeObjectAtIndex:0];status=ns(pending->reason);return noErr;}catch(const std::exception& e){status=ns(e.what());return kAudioUnitErr_InvalidPropertyValue;}
  }
  if(op=="compare"){
   if(!pending||!pending->audioAnalyzed||pending->before!=now||pendingWord!=nowWord||pendingProcessing!=processing.load()||!(pending->binding==binding)||!inputAnalysis.valid||![c[@"approved"] isEqual:@YES])return kAudioUnitErr_InvalidPropertyValue;
   NSString* destination=c[@"directory"];if(![destination isKindOfClass:NSString.class]||![destination isAbsolutePath])return kAudioUnitErr_InvalidPropertyValue;
   try{
    auto comparison=nova::compare(capture.samples.data(),capture.frames,capture.rate,4,0,*pending);
    NSString* directory=[destination stringByAppendingPathComponent:[@"NOVA-comparison-" stringByAppendingString:NSUUID.UUID.UUIDString]];
    if(![NSFileManager.defaultManager createDirectoryAtPath:directory withIntermediateDirectories:NO attributes:nil error:nil])return kAudioUnitErr_InvalidPropertyValue;
    NSMutableArray* rows=[NSMutableArray array];NSArray* labels=@[@"original",@"A",@"B",@"C"];
    for(unsigned k=0;k<4;++k){NSString* raw=[labels[k] stringByAppendingString:@".wav"],*matched=[labels[k] stringByAppendingString:@"-rms-matched.wav"];
     nova::writeWave(str([directory stringByAppendingPathComponent:raw]),comparison.audio[k],capture.rate);
     nova::writeWave(str([directory stringByAppendingPathComponent:matched]),comparison.audio[k],capture.rate,comparison.matching[k]);
     [rows addObject:@{@"label":labels[k],@"wav":raw,@"rmsMatchedWav":matched,@"rmsMatchGain":@(comparison.matching[k]),@"measurement":measured(comparison.measurements[k]),@"settings":k?array(pending->choices[k-1]):@[],@"processing":k?processingArray(pending->processingChoices[k-1]):@[]}];
    }
    NSDictionary* report=@{@"format":@"nova-au-comparison-v1",@"audioId":audioId,@"binding":bindingDictionary(),@"input":measured(inputAnalysis),@"startFrame":@0,@"frames":@(capture.frames),@"renders":rows,@"method":@"same NOVA DSP offline; zero filter state, identical source start; RMS attenuation matching, not LUFS",@"originalIsReferenceOnly":@YES};
    NSData* bytes=[NSJSONSerialization dataWithJSONObject:report options:NSJSONWritingPrettyPrinted error:nil];if(!bytes||![bytes writeToFile:[directory stringByAppendingPathComponent:@"manifest.json"] atomically:YES])throw std::runtime_error("比較manifest保存失敗");status=[@"比較WAV保存: " stringByAppendingString:directory];return noErr;
   }catch(const std::exception& e){status=ns(e.what());return kAudioUnitErr_InvalidPropertyValue;}
  }
  if(op=="cancel"){pending.reset();status=@"候補をキャンセルしました";return noErr;}
  if(op=="apply"){
   if(![c[@"approved"] isEqual:@YES]||!pending||!(pending->binding==binding)||pending->before!=now||pendingWord!=nowWord||pendingProcessing!=processing.load()||![c[@"choice"] isKindOfClass:NSNumber.class])return kAudioUnitErr_InvalidPropertyValue;
   NSInteger i=[c[@"choice"] integerValue];if(i<0||i>2)return kAudioUnitErr_InvalidPropertyValue;
   if(pending->audioAnalyzed){try{auto trial=nova::compare(capture.samples.data(),capture.frames,capture.rate,4,0,*pending);if(trial.measurements[i+1].peak>.975||(binding.kind=="stereo-out"&&trial.measurements[i+1].loudness.valid&&trial.measurements[i+1].loudness.truePeak>std::pow(10.,-1./20)))return kAudioUnitErr_InvalidPropertyValue;}catch(...){return kAudioUnitErr_InvalidPropertyValue;}}
   auto next=nova::decode(nova::encode(pending->choices[i]));bool usedAnalysis=pending->audioAnalyzed;const auto nextWord=nova::revised(nowWord,next);auto nextExtra=nova::pack(pending->processingChoices[i]);history.push_back({now,next,nextWord,pendingProcessing,nextExtra});if(!publish(nowWord,nextWord,nextExtra)){history.pop_back();return kAudioUnitErr_InvalidPropertyValue;}if(history.size()>32)history.erase(history.begin());
   [evidence addObject:@{@"operation":@"apply",@"audioId":audioId,@"binding":bindingDictionary(),@"audioAnalyzed":@(usedAnalysis),@"choice":@(i),@"before":array(now),@"after":array(next),@"input":measured(inputAnalysis),@"outputBefore":measured(outputAnalysis)}];if(evidence.count>32)[evidence removeObjectAtIndex:0];
   measuredGuard.store(usedAnalysis);safetyStop.store(false);inputAnalysis.valid=false;pending.reset();status=@"再測定は2秒音声取得に同意してください。承認した値をNOVA AU自身へ適用";return noErr;
  }
  if(op=="undo"){
   if(![c[@"approved"] isEqual:@YES]||history.empty()||history.back().second!=now||history.back().appliedWord!=nowWord||history.back().extraAfter!=processing.load())return kAudioUnitErr_InvalidPropertyValue;
   const auto undoWord=nova::revised(nowWord,history.back().first);if(!publish(nowWord,undoWord,history.back().extraBefore))return kAudioUnitErr_InvalidPropertyValue;[evidence addObject:@{@"operation":@"undo",@"before":array(now),@"after":array(history.back().first)}];if(evidence.count>32)[evidence removeObjectAtIndex:0];history.pop_back();if(!history.empty())history.back().appliedWord=undoWord;measuredGuard.store(false);safetyStop.store(false);inputAnalysis.valid=false;pending.reset();status=@"前のNOVA AU設定に戻しました";return noErr;
  }
  return kAudioUnitErr_InvalidPropertyValue;
 }
public:
 explicit NovaMix(AudioComponentInstance ci):AUEffectBase(ci,true){
  history.reserve(33);CreateElements();Globals()->UseIndexedParameters(4+nova::ExtraCount);for(unsigned i=0;i<4;++i)AUEffectBase::SetParameter(i,0);
  binding.instance=str(NSUUID.UUID.UUIDString);
 }
 bool SupportsTail()override{return true;}
 Float64 GetTailTime()override{return .05;}
 bool CanScheduleParameters()const noexcept override{return false;} // immediate host automation, 20 ms DSP smoothing
 UInt32 SupportedNumChannels(const AUChannelInfo** info)override{static const AUChannelInfo channels={2,2};if(info)*info=&channels;return 1;}
 bool ValidFormat(AudioUnitScope s,AudioUnitElement e,const AudioStreamBasicDescription& f)override{
  return e==0&&(s==kAudioUnitScope_Input||s==kAudioUnitScope_Output)&&f.mChannelsPerFrame==2&&f.mSampleRate>=22050&&f.mSampleRate<=192000&&AUEffectBase::ValidFormat(s,e,f);
 }
 OSStatus Initialize()override{capture.invalidate();auto err=AUEffectBase::Initialize();if(!err)dsp.reset(GetSampleRate(),nova::decode(targets.load()),nova::unpack(processing.load()));return err;}
 OSStatus Reset(AudioUnitScope s,AudioUnitElement e)override{capture.invalidate();dsp.reset(GetSampleRate(),nova::decode(targets.load()),nova::unpack(processing.load()));return AUEffectBase::Reset(s,e);}
 OSStatus GetParameterInfo(AudioUnitScope s,AudioUnitParameterID i,AudioUnitParameterInfo& p)override{
  if(s!=kAudioUnitScope_Global||i>=4+nova::ExtraCount)return kAudioUnitErr_InvalidParameter;
  if(i>=4){unsigned j=i-4;const char* names[]={"Quality EQ enabled","Low shelf frequency","High shelf frequency","Mid frequency","Mid gain","Mid Q","Compressor enabled","Threshold","Ratio","Attack","Release","Knee","Makeup gain"};p={};strlcpy(p.name,names[j],sizeof(p.name));p.minValue=nova::extraMin[j];p.maxValue=nova::extraMax[j];p.defaultValue=nova::defaults()[j];p.flags=kAudioUnitParameterFlag_IsReadable|kAudioUnitParameterFlag_IsWritable;p.unit=(j==0||j==6)?kAudioUnitParameterUnit_Boolean:(j==1||j==2||j==3)?kAudioUnitParameterUnit_Hertz:(j==9||j==10)?kAudioUnitParameterUnit_Milliseconds:(j==4||j==7||j==11||j==12)?kAudioUnitParameterUnit_Decibels:kAudioUnitParameterUnit_Generic;return noErr;}
  p={};const char* names[]={"Gain","Low band (180 Hz)","High band (4 kHz)","Bypass"};strlcpy(p.name,names[i],sizeof(p.name));
  static const CFStringRef cfNames[]={CFSTR("Gain"),CFSTR("Low band (180 Hz)"),CFSTR("High band (4 kHz)"),CFSTR("Bypass")};p.cfNameString=cfNames[i];
  p.unit=i==3?kAudioUnitParameterUnit_Boolean:kAudioUnitParameterUnit_Decibels;p.minValue=nova::minimum[i];p.maxValue=nova::maximum[i];p.defaultValue=0;p.flags=kAudioUnitParameterFlag_IsReadable|kAudioUnitParameterFlag_IsWritable|kAudioUnitParameterFlag_HasCFNameString;return noErr;
 }
 OSStatus SetParameter(AudioUnitParameterID i,AudioUnitScope s,AudioUnitElement e,AudioUnitParameterValue v,UInt32)override{
  if(s!=kAudioUnitScope_Global||e||i>=4+nova::ExtraCount||!(i<4?nova::valid(i,v):nova::extraValid(i-4,v)))return kAudioUnitErr_InvalidParameter;
  if(writer.test_and_set(std::memory_order_acquire))return kAudioUnitErr_CannotDoInCurrentContext;
  auto old=targets.load();auto p=nova::decode(old);auto extra=nova::unpack(processing.load());if(i<4)p[i]=v;else extra[i-4]=v;
  sequence.fetch_add(1);processing.store(nova::pack(extra));targets.store(nova::revised(old,p));sequence.fetch_add(1);writer.clear(std::memory_order_release);return noErr;
 }
 OSStatus GetParameter(AudioUnitParameterID i,AudioUnitScope s,AudioUnitElement e,AudioUnitParameterValue& v)override{
  if(s!=kAudioUnitScope_Global||e||i>=4+nova::ExtraCount)return kAudioUnitErr_InvalidParameter;v=i<4?nova::decode(targets.load())[i]:nova::unpack(processing.load())[i-4];return noErr;
 }

 // Let our parameter handle bypass so both directions crossfade rather than hard-switch.
 bool ShouldBypassEffect()override{return false;}
 void SetBypassEffect(bool b)override{SetParameter(3,kAudioUnitScope_Global,0,b?1:0,0);}
 OSStatus ProcessBufferLists(AudioUnitRenderActionFlags& flags,const AudioBufferList& in,AudioBufferList& out,UInt32 n)override{
  if(in.mNumberBuffers!=2||out.mNumberBuffers!=2)return kAudioUnitErr_FormatNotSupported;
  for(unsigned c=0;c<2;++c)if(!in.mBuffers[c].mData||!out.mBuffers[c].mData||in.mBuffers[c].mDataByteSize<n*sizeof(float)||out.mBuffers[c].mDataByteSize<n*sizeof(float))return kAudio_ParamError;
  auto seq=sequence.load();auto candidateTargets=targets.load(),candidateProcessing=processing.load();
  if(!(seq&1)&&sequence.load()==seq){renderTargets=candidateTargets;renderProcessing=candidateProcessing;}
  const auto blockTargets=renderTargets;dsp.processing=nova::unpack(renderProcessing);dsp.quality.maximumReduction=0;
  unsigned captured=capture.input((float*)in.mBuffers[0].mData,(float*)in.mBuffers[1].mData,n,dsp.rate,blockTargets);
  dsp.process((float*)in.mBuffers[0].mData,(float*)in.mBuffers[1].mData,(float*)out.mBuffers[0].mData,(float*)out.mBuffers[1].mData,n,nova::decode(blockTargets));
  if(measuredGuard.load()){bool unsafe=false;for(unsigned c=0;c<2;++c){const float* x=(float*)out.mBuffers[c].mData;for(UInt32 f=0;f<n;++f)if(std::abs(x[f])>.975f)unsafe=true;}if(unsafe)safetyStop.store(true);if(safetyStop.load())for(unsigned c=0;c<2;++c)std::fill_n((float*)out.mBuffers[c].mData,n,0.f);}
  capture.output((float*)out.mBuffers[0].mData,(float*)out.mBuffers[1].mData,captured);
  double sum=0;float peak=0;for(unsigned c=0;c<2;++c){const float* x=(const float*)out.mBuffers[c].mData;for(UInt32 f=0;f<n;++f){peak=std::max(peak,std::abs(x[f]));sum+=double(x[f])*x[f];}}
  gainReduction.store(dsp.quality.maximumReduction*dsp.quality.modern*(1-dsp.current[3]));outputPeak.store(peak);outputRms.store(n?float(std::sqrt(sum/(2*n))):0);
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
  uint64_t savedCore=0,savedExtra=0;if(!readPair(savedCore,savedExtra))return kAudioUnitErr_CannotDoInCurrentContext;
  // Full host-owned state; contains no Music Studio files or Logic project edits.
  AUPreset preset{};OSStatus presetStatus=DispatchGetProperty(kAudioUnitProperty_PresentPreset,kAudioUnitScope_Global,0,&preset);if(presetStatus)return presetStatus;
  NSString* presetName=CFBridgingRelease(preset.presetName);
  NSMutableArray* undo=[NSMutableArray array];for(const auto& h:history)[undo addObject:@[array(h.first),array(h.second),@(h.extraBefore),@(h.extraAfter)]];
  *data=(__bridge_retained CFPropertyListRef)@{@"version":@0,@"type":@((UInt32)'aufx'),@"subtype":@((UInt32)'NvMx'),@"manufacturer":@((UInt32)'NvSt'),@"name":presetName?:@"NOVA Mix",@"novaVersion":@2,@"novaProcessing":processingArray(nova::unpack(savedExtra)),@"novaValues":array(nova::decode(savedCore)),@"novaBinding":bindingDictionary(),@"novaEvidence":evidence,@"novaUndo":undo,@"novaMeasuredGuard":@(measuredGuard.load())};return noErr;
 }
 OSStatus RestoreState(CFPropertyListRef data)override{
  if(!data||CFGetTypeID(data)!=CFDictionaryGetTypeID())return kAudioUnitErr_InvalidPropertyValue;
  NSDictionary* d=(__bridge NSDictionary*)data;std::array<float,4> v;
  if((![d[@"novaVersion"] isEqual:@1]&&![d[@"novaVersion"] isEqual:@2])||![d[@"type"] isEqual:@((UInt32)'aufx')]||![d[@"subtype"] isEqual:@((UInt32)'NvMx')]||![d[@"manufacturer"] isEqual:@((UInt32)'NvSt')]||!values(d[@"novaValues"],v))return kAudioUnitErr_InvalidPropertyValue;
  nova::Processing restoredProcessing=nova::defaults();if([d[@"novaVersion"]isEqual:@2]&&!processingValues(d[@"novaProcessing"],restoredProcessing))return kAudioUnitErr_InvalidPropertyValue;
  id b=d[@"novaBinding"];if(![b isKindOfClass:NSDictionary.class])return kAudioUnitErr_InvalidPropertyValue;
  auto p=str(b[@"projectId"]),t=str(b[@"trackId"]);if(p.size()>256||t.size()>256)return kAudioUnitErr_InvalidPropertyValue;
  auto role=str(b[@"role"]),kind=str(b[@"targetKind"]),source=str(b[@"inputSource"]);if(role.empty())role="unspecified";if(kind.empty())kind="track";if(source.empty())source="user-confirmed AU input";
  if(role.size()>256||source.size()>512||(kind!="track"&&kind!="bus"&&kind!="stereo-out"))return kAudioUnitErr_InvalidPropertyValue;
  id presetName=d[@"name"];if(presetName&&(![presetName isKindOfClass:NSString.class]||[presetName length]>1024))return kAudioUnitErr_InvalidPropertyValue;
  std::vector<Undo> restoredUndo;
  id u=d[@"novaUndo"];if(u){if(![u isKindOfClass:NSArray.class]||[u count]>32)return kAudioUnitErr_InvalidPropertyValue;for(id row in u){std::array<float,4> a,b;if(![row isKindOfClass:NSArray.class]||([row count]!=2&&[row count]!=4)||!values(row[0],a)||!values(row[1],b))return kAudioUnitErr_InvalidPropertyValue;uint64_t eb=nova::pack(nova::defaults()),ea=eb;if([row count]==4){if(![row[2]isKindOfClass:NSNumber.class]||![row[3]isKindOfClass:NSNumber.class])return kAudioUnitErr_InvalidPropertyValue;eb=[row[2]unsignedLongLongValue];ea=[row[3]unsignedLongLongValue];if(nova::pack(nova::unpack(eb))!=eb||nova::pack(nova::unpack(ea))!=ea)return kAudioUnitErr_InvalidPropertyValue;}restoredUndo.push_back({a,b,0,eb,ea});}}
  id restored=d[@"novaEvidence"];if(restored){if(![restored isKindOfClass:NSArray.class]||[restored count]>32||![NSJSONSerialization isValidJSONObject:restored])return kAudioUnitErr_InvalidPropertyValue;NSData* bytes=[NSJSONSerialization dataWithJSONObject:restored options:0 error:nil];if(!bytes||bytes.length>262144)return kAudioUnitErr_InvalidPropertyValue;}
  std::lock_guard lock(controlMutex);
  if(presetName){AUPreset preset{-1,(__bridge CFStringRef)presetName};OSStatus err=AUEffectBase::NewCustomPresetSet(preset);if(err)return err;}
  if(!publish(targets.load(),nova::encode(v),nova::pack(restoredProcessing)))return kAudioUnitErr_CannotDoInCurrentContext;
  evidence=restored?[restored mutableCopy]:[NSMutableArray array];
  collected=true;measuredGuard.store([d[@"novaMeasuredGuard"]isEqual:@YES]);safetyStop.store(false);
  inputAnalysis={};outputAnalysis={};audioId=@"";
  binding.project=p;binding.track=t;binding.role=role;binding.kind=kind;binding.source=source;
  // A duplicated Logic insert must explicitly re-confirm its Track; keep a fresh runtime instance UUID.
  ++controlEpoch;binding.confirmed=false;pending.reset();history=std::move(restoredUndo);if(!history.empty())history.back().appliedWord=nova::encode(v);status=@"設定復元済み。曲・Trackの対応を再確認してください";return noErr;
 }
};
AUSDK_COMPONENT_ENTRY(ausdk::AUBaseFactory,NovaMix)
