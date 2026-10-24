#import <Foundation/Foundation.h>
#import <AudioToolbox/AudioToolbox.h>
#include <dlfcn.h>
#include "../WholeSong.hpp"
#include <iomanip>
#include <chrono>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <vector>
#include <fstream>
#include <thread>
static void check(bool v,const char* m){if(!v){fprintf(stderr,"FAIL: %s\n",m);exit(1);}}
static void ok(OSStatus s,const char* m){if(s){fprintf(stderr,"FAIL %s: %d\n",m,(int)s);exit(1);}}
struct Source{double sr=48000,hz=1000,amplitude=.1;uint64_t frame=0;};
static OSStatus input(void* ref,AudioUnitRenderActionFlags*,const AudioTimeStamp*,UInt32,UInt32 n,AudioBufferList* b){
 auto& s=*(Source*)ref;for(unsigned c=0;c<b->mNumberBuffers;++c){auto* p=(float*)b->mBuffers[c].mData;if(!p)return kAudio_ParamError;for(unsigned f=0;f<n;++f)p[f]=s.amplitude*std::sin(2*3.141592653589793*s.hz*(s.frame+f)/s.sr);}s.frame+=n;return noErr;
}
static NSDictionary* snapshot(AudioUnit u){CFDictionaryRef d=nullptr;UInt32 n=sizeof(d);ok(AudioUnitGetProperty(u,64001,0,0,&d,&n),"snapshot");return CFBridgingRelease(d);}
static OSStatus command(AudioUnit u,NSDictionary* d){CFDictionaryRef cf=(__bridge CFDictionaryRef)d;return AudioUnitSetProperty(u,64000,0,0,&cf,sizeof(cf));}
static NSMutableDictionary* cmd(AudioUnit u,NSString* op){NSMutableDictionary* d=[snapshot(u)[@"binding"]mutableCopy];d[@"operation"]=op;return d;}
static void configure(AudioUnit u,Source* source,double sr,unsigned buffer){
 AudioStreamBasicDescription f={};f.mSampleRate=sr;f.mFormatID=kAudioFormatLinearPCM;f.mFormatFlags=AudioFormatFlags(kAudioFormatFlagsNativeFloatPacked)|AudioFormatFlags(kAudioFormatFlagIsNonInterleaved);f.mBytesPerPacket=4;f.mFramesPerPacket=1;f.mBytesPerFrame=4;f.mChannelsPerFrame=2;f.mBitsPerChannel=32;
 ok(AudioUnitSetProperty(u,kAudioUnitProperty_StreamFormat,kAudioUnitScope_Input,0,&f,sizeof(f)),"input format");ok(AudioUnitSetProperty(u,kAudioUnitProperty_StreamFormat,kAudioUnitScope_Output,0,&f,sizeof(f)),"output format");
 UInt32 max=4096;ok(AudioUnitSetProperty(u,kAudioUnitProperty_MaximumFramesPerSlice,0,0,&max,sizeof(max)),"max frames");
 source->sr=sr;source->frame=0;AURenderCallbackStruct cb{input,source};ok(AudioUnitSetProperty(u,kAudioUnitProperty_SetRenderCallback,kAudioUnitScope_Input,0,&cb,sizeof(cb)),"input callback");ok(AudioUnitInitialize(u),"initialize");
}
static std::vector<float> render(AudioUnit u,unsigned count,unsigned block){
 static thread_local uint64_t clock=0;
 std::vector<float> out;struct Stereo{UInt32 n;AudioBuffer b[2];} buffers;
 std::vector<float> l(block),r(block);for(unsigned pos=0;pos<count;pos+=block){unsigned n=std::min(block,count-pos);buffers.n=2;buffers.b[0]={1,n*4,l.data()};buffers.b[1]={1,n*4,r.data()};AudioTimeStamp t={};t.mSampleTime=clock;clock+=n;t.mFlags=kAudioTimeStampSampleTimeValid;AudioUnitRenderActionFlags flags=0;
  ok(AudioUnitRender(u,&flags,&t,0,n,(AudioBufferList*)&buffers),"actual AU render");for(unsigned f=0;f<n;++f){check(std::isfinite(l[f])&&std::abs(l[f])<=.981,"finite bounded output");check(l[f]==r[f],"stereo identical source");out.push_back(l[f]);}}
 return out;
}
static double rms(const std::vector<float>& a){double x=0;for(size_t i=a.size()/2;i<a.size();++i)x+=a[i]*a[i];return std::sqrt(x/(a.size()-a.size()/2));}
static void wav(const char* path,const std::vector<float>& a){std::ofstream o(path,std::ios::binary);auto u16=[&](uint16_t n){o.write((char*)&n,2);};auto u32=[&](uint32_t n){o.write((char*)&n,4);};o.write("RIFF",4);u32(36+a.size()*8);o.write("WAVEfmt ",8);u32(16);u16(3);u16(2);u32(48000);u32(48000*8);u16(8);u16(32);o.write("data",4);u32(a.size()*8);for(float v:a){o.write((char*)&v,4);o.write((char*)&v,4);}check(o.good(),"WAV written");}
int main(int argc,char** argv){@autoreleasepool{
 check(argc==3,"host BINARY OUTPUT_PREFIX");void* lib=dlopen(argv[1],RTLD_NOW|RTLD_LOCAL);if(!lib){fprintf(stderr,"%s\n",dlerror());return 1;}
 auto factory=(AudioComponentFactoryFunction)dlsym(lib,"NovaMixFactory");check(factory,"factory symbol");AudioComponentDescription desc={'aufx','NvMx','NvSt',0,0};auto c=AudioComponentRegister(&desc,CFSTR("NOVA: Mix"),256,factory);check(c,"register actual AU binary");
 AudioUnit a=nullptr,b=nullptr;ok(AudioComponentInstanceNew(c,&a),"create a");ok(AudioComponentInstanceNew(c,&b),"create b");check(![snapshot(a)[@"binding"][@"instanceId"] isEqual:snapshot(b)[@"binding"][@"instanceId"]],"distinct instance IDs");
 Source source;std::vector<float> flat,changed;
 for(double sr:{22050.,44100.,48000.,96000.,192000.})for(unsigned block:{32u,256u,2048u}){
  configure(a,&source,sr,block);source.hz=1000;ok(AudioUnitSetParameter(a,0,0,0,0,0),"flat gain");ok(AudioUnitSetParameter(a,2,0,0,0,0),"flat EQ");flat=render(a,65536,block);
  ok(AudioUnitSetParameter(a,0,0,0,-6,0),"gain -6");changed=render(a,65536,block);double gain=20*log10(rms(changed)/rms(flat));check(std::abs(gain+6)<.04,"measured gain -6 dB");
  ok(AudioUnitSetParameter(a,0,0,0,0,0),"gain reset");source.hz=10000;flat=render(a,65536,block);ok(AudioUnitSetParameter(a,2,0,0,-6,0),"high EQ");changed=render(a,65536,block);double eq=20*log10(rms(changed)/rms(flat));check(eq < -1.5,"measured high EQ attenuation");
  printf("AU sr=%.0f frames=%u gain=%.5f dB high=%.5f dB\n",sr,block,gain,eq);ok(AudioUnitSetParameter(a,2,0,0,0,0),"high reset");source.hz=80;flat=render(a,65536,block);ok(AudioUnitSetParameter(a,1,0,0,-6,0),"low EQ");changed=render(a,65536,block);check(20*log10(rms(changed)/rms(flat))<-3,"measured low EQ");ok(AudioUnitSetParameter(a,1,0,0,0,0),"low reset");
  UInt32 bypass=1;ok(AudioUnitSetProperty(a,kAudioUnitProperty_BypassEffect,0,0,&bypass,sizeof(bypass)),"host bypass on");changed=render(a,65536,block);check(std::abs(rms(changed)/rms(flat)-1)<.02,"bypass audio");UInt32 read=0,sz=sizeof(read);ok(AudioUnitGetProperty(a,kAudioUnitProperty_BypassEffect,0,0,&read,&sz),"read bypass");check(read==1,"bypass property matches");bypass=0;ok(AudioUnitSetProperty(a,kAudioUnitProperty_BypassEffect,0,0,&bypass,sizeof(bypass)),"host bypass off");
  ok(AudioUnitUninitialize(a),"uninitialize");
 }
 check(AudioUnitSetParameter(a,0,0,0,NAN,0)!=noErr,"reject NaN");check(AudioUnitSetParameter(a,0,0,0,7,0)!=noErr,"reject range");
 ok(command(a,@{@"operation":@"bind",@"projectId":@"song-1",@"trackId":@"piano-1",@"confirmed":@YES}),"bind explicit Track");
 ok(AudioUnitSetParameter(a,0,0,0,0,0),"reset gain");ok(AudioUnitSetParameter(a,2,0,0,0,0),"reset eq");auto d=cmd(a,@"preview");d[@"instruction"]=@"ピアノを柔らかくして";ok(command(a,d),"Japanese preview");check([snapshot(a)[@"current"][2]floatValue]==0,"preview does not apply");
 ok(AudioUnitSetParameter(a,0,0,0,1,0),"host automation after preview");auto stale=cmd(a,@"apply");stale[@"approved"]=@YES;stale[@"choice"]=@1;check(command(a,stale)!=noErr,"reject stale proposal after automation");ok(AudioUnitSetParameter(a,0,0,0,0,0),"return baseline");
 auto aba=cmd(a,@"apply");aba[@"approved"]=@YES;aba[@"choice"]=@1;check(command(a,aba)!=noErr,"reject automation returning to baseline");
 d=cmd(a,@"preview");d[@"instruction"]=@"ピアノを柔らかくして";ok(command(a,d),"refresh after automation");
 float oldQ=0;ok(AudioUnitGetParameter(a,9,0,0,&oldQ),"read Q before automation");ok(AudioUnitSetParameter(a,9,0,0,2,0),"advanced automation change");ok(AudioUnitSetParameter(a,9,0,0,oldQ,0),"advanced automation return");auto advancedStale=cmd(a,@"apply");advancedStale[@"approved"]=@YES;advancedStale[@"choice"]=@1;check(command(a,advancedStale)!=noErr,"advanced automation returning to same values invalidates proposal");d=cmd(a,@"preview");d[@"instruction"]=@"ピアノを柔らかくして";ok(command(a,d),"refresh after advanced automation");
 d=cmd(a,@"apply");d[@"choice"]=@1;check(command(a,d)!=noErr,"approval required");d[@"approved"]=@YES;d[@"instanceId"]=@"wrong-instance";check(command(a,d)!=noErr,"reject wrong AU instance");d[@"instanceId"]=snapshot(a)[@"binding"][@"instanceId"];ok(command(a,d),"approved B applies");check([snapshot(a)[@"current"][2]floatValue]==-2,"actual parameter changed");check([snapshot(b)[@"current"][2]floatValue]==0,"instances isolated");
 configure(a,&source,48000,256);source.hz=10000;auto processed=render(a,96000,256);std::string path=std::string(argv[2])+"-approved.wav";wav(path.c_str(),processed);
 d=cmd(a,@"undo");d[@"approved"]=@YES;ok(command(a,d),"approved undo");check([snapshot(a)[@"current"][2]floatValue]==0,"undo restores");
 ok(AudioUnitSetParameter(a,0,0,0,-3,0),"non-default gain before save");ok(AudioUnitSetParameter(a,2,0,0,-2,0),"non-default EQ before save");
 source.amplitude=0;auto silence=render(a,65536,256);check(rms(silence)<1e-8,"silence settles");source.amplitude=100;render(a,65536,256);source.amplitude=NAN;render(a,65536,256);source.amplitude=.1;
 // Concurrent host automation must not stop or corrupt the real render path.
 std::thread automation([&]{for(unsigned i=0;i<10000;++i)ok(AudioUnitSetParameter(a,0,0,0,i%2?-3:0,0),"concurrent host automation");});
 render(a,96000,256);automation.join();ok(AudioUnitSetParameter(a,0,0,0,-3,0),"restore save target");
 AUPreset named{-1,CFSTR("NOVA CI Preset")};ok(AudioUnitSetProperty(a,kAudioUnitProperty_PresentPreset,0,0,&named,sizeof(named)),"host preset name");
 CFPropertyListRef saved=nullptr;UInt32 size=sizeof(saved);ok(AudioUnitGetProperty(a,kAudioUnitProperty_ClassInfo,0,0,&saved,&size),"host state save");
 check([((__bridge NSDictionary*)saved)[@"name"] isEqual:@"NOVA CI Preset"],"preset name retained in class state");
 ok(AudioUnitSetProperty(b,kAudioUnitProperty_ClassInfo,0,0,&saved,sizeof(saved)),"new AU restore");CFRelease(saved);check([snapshot(b)[@"current"][0]floatValue]==-3&&[snapshot(b)[@"current"][2]floatValue]==-2,"non-default gain/EQ survive restore");check(![snapshot(b)[@"binding"][@"confirmed"]boolValue],"restored binding needs re-confirmation");

 // Actual AU input capture -> control-thread FFT -> measured candidates -> actual render/Undo.
 for(unsigned id=0;id<4;++id)ok(AudioUnitSetParameter(a,id,0,0,0,0),"analysis baseline");
 source.hz=10000;source.frame=0;source.amplitude=.2;ok(AudioUnitReset(a,0,0),"analysis reset");
 d=cmd(a,@"capture");check(command(a,d)!=noErr,"capture consent required");d[@"consent"]=@YES;ok(command(a,d),"explicit capture consent");
 render(a,96000,256);NSDictionary* analysis=snapshot(a);check([analysis[@"audioAnalyzed"]boolValue],"actual input analyzed");check([analysis[@"analysis"][@"input"][@"bandPowerFractions"][2]doubleValue]>.99,"actual FFT high band");
 check(std::abs([analysis[@"analysis"][@"input"][@"rms"]doubleValue]-.2/sqrt(2))<.00001,"actual RMS");
 d=cmd(a,@"preview");d[@"instruction"]=@"全体の音を自然に整えて";ok(command(a,d),"measured Japanese preview");NSDictionary* proposal=snapshot(a);check([proposal[@"proposalAudioAnalyzed"]boolValue],"proposal really measured");NSArray* settings=proposal[@"choices"];
 d=cmd(a,@"compare");d[@"approved"]=@YES;d[@"directory"]=[NSString stringWithUTF8String:argv[2]].stringByDeletingLastPathComponent;ok(command(a,d),"actual capture offline comparison WAVs");
 d=cmd(a,@"apply");d[@"approved"]=@YES;d[@"choice"]=@1;ok(command(a,d),"measured B applies to real AU");check([snapshot(a)[@"current"]isEqual:settings[1]],"measured actual AU values");
 d=cmd(a,@"capture");d[@"consent"]=@YES;ok(command(a,d),"post-apply capture");source.frame=0;auto measuredB=render(a,96000,256);NSDictionary* after=snapshot(a);check([after[@"audioAnalyzed"]boolValue],"post-apply remeasurement");check([after[@"analysis"][@"output"][@"rms"]doubleValue]<[after[@"analysis"][@"input"][@"rms"]doubleValue],"actual output reduced");
 wav((std::string(argv[2])+"-measured-B.wav").c_str(),measuredB);

 CFPropertyListRef measuredSaved=nullptr;UInt32 measuredSize=sizeof(measuredSaved);ok(AudioUnitGetProperty(a,kAudioUnitProperty_ClassInfo,0,0,&measuredSaved,&measuredSize),"measured state save");ok(AudioUnitSetProperty(b,kAudioUnitProperty_ClassInfo,0,0,&measuredSaved,sizeof(measuredSaved)),"measured history restore");CFRelease(measuredSaved);check([snapshot(b)[@"history"]count]>0&&[snapshot(b)[@"undoCount"]unsignedIntValue]>0,"bounded measurements and undo persisted");
 ok(command(b,@{@"operation":@"bind",@"projectId":@"song-1",@"trackId":@"piano-1",@"confirmed":@YES}),"restored target reconfirmation");auto restoredUndo=cmd(b,@"undo");restoredUndo[@"approved"]=@YES;ok(command(b,restoredUndo),"restored undo after reconfirmation");check([snapshot(b)[@"current"][2]floatValue]==0,"restored undo actual parameter");
 source.amplitude=3;auto stopped=render(a,4096,256);check([snapshot(a)[@"safetyStopped"]boolValue],"measured safety level stop");for(float v:stopped)check(v==0,"safety stop mutes output");source.amplitude=.2;
 d=cmd(a,@"undo");d[@"approved"]=@YES;ok(command(a,d),"measured undo");check([snapshot(a)[@"current"][2]floatValue]==0,"measured undo value");
 // A/B/C rendered through the actual AU factory with identical source start/reset.
 NSMutableArray* actualRows=[NSMutableArray array];std::vector<std::vector<float>> actualAudio;
 double common=1;
 for(unsigned k=0;k<4;++k){NSArray* advanced=k?proposal[@"processingChoices"][k-1]:proposal[@"processing"];for(unsigned id=0;id<13;++id)ok(AudioUnitSetParameter(a,id+4,0,0,[advanced[id]floatValue],0),"actual advanced audition parameters");for(unsigned id=0;id<4;++id)ok(AudioUnitSetParameter(a,id,0,0,k?[settings[k-1][id]floatValue]:0,0),"actual audition parameters");source.frame=0;ok(AudioUnitReset(a,0,0),"same audition start");auto audio=render(a,96000,256);double level=rms(audio);common=std::min(common,level);actualAudio.push_back(audio);[actualRows addObject:@{@"choice":@(k),@"rmsLastHalf":@(level),@"settings":k?settings[k-1]:@[@0,@0,@0,@0]}];}
 for(unsigned k=0;k<4;++k){std::string label=k?std::string(1,char('A'+k-1)):"original";wav((std::string(argv[2])+"-"+label+".wav").c_str(),actualAudio[k]);double factor=common/rms(actualAudio[k]);for(float& v:actualAudio[k])v*=factor;wav((std::string(argv[2])+"-"+label+"-rms-matched.wav").c_str(),actualAudio[k]);}
 NSData* report=[NSJSONSerialization dataWithJSONObject:@{@"inputCapture":analysis,@"proposal":proposal,@"postApply":after,@"actualAURenders":actualRows,@"source":@"deterministic 10 kHz signal through real AU; not Logic or an instrument"} options:NSJSONWritingPrettyPrinted error:nil];check([report writeToFile:[[NSString stringWithUTF8String:argv[2]]stringByAppendingString:@"-analysis.json"] atomically:YES],"AU measured evidence saved");
 source.hz=80;for(unsigned id=0;id<4;++id)ok(AudioUnitSetParameter(a,id,0,0,0,0),"low baseline");ok(AudioUnitReset(a,0,0),"low reset");d=cmd(a,@"capture");d[@"consent"]=@YES;ok(command(a,d),"low capture");render(a,96000,2048);check([snapshot(a)[@"analysis"][@"input"][@"bandPowerFractions"][0]doubleValue]>.99,"actual low FFT");d=cmd(a,@"preview");d[@"instruction"]=@"全体の音を自然に整えて";ok(command(a,d),"low measured preview");check(![snapshot(a)[@"choices"]isEqual:settings],"different actual audio different candidates");
 // Simultaneous independent real AU render/capture, not only parameter storage isolation.
 Source secondSource;secondSource.hz=10000;secondSource.amplitude=.05;configure(b,&secondSource,48000,256);
 ok(command(b,@{@"operation":@"bind",@"projectId":@"song-1",@"trackId":@"strings-2",@"confirmed":@YES}),"second independent Track binding");
 source.hz=80;source.amplitude=.1;
 auto captureA=cmd(a,@"capture");captureA[@"consent"]=@YES;ok(command(a,captureA),"parallel a capture");auto captureB=cmd(b,@"capture");captureB[@"consent"]=@YES;ok(command(b,captureB),"parallel b capture");
 std::thread renderA([&]{render(a,96000,256);});std::thread renderB([&]{render(b,96000,256);});renderA.join();renderB.join();
 auto parallelA=snapshot(a),parallelB=snapshot(b);check([parallelA[@"analysis"][@"input"][@"bandPowerFractions"][0]doubleValue]>.99&&[parallelB[@"analysis"][@"input"][@"bandPowerFractions"][2]doubleValue]>.99,"parallel AU spectral isolation");check(![parallelA[@"analysis"][@"audioId"]isEqual:parallelB[@"analysis"][@"audioId"]],"parallel acquisition identity isolation");ok(AudioUnitUninitialize(b),"second instance stop");
 for(double amplitude:{0.,double(NAN)}){source.amplitude=amplitude;d=cmd(a,@"capture");d[@"consent"]=@YES;ok(command(a,d),"invalid signal capture");render(a,96000,256);check(![snapshot(a)[@"audioAnalyzed"]boolValue],"silence/nonfinite never analyzed");}
 source.amplitude=.1;d=cmd(a,@"capture");d[@"consent"]=@YES;ok(command(a,d),"partial capture");render(a,128,32);check(![snapshot(a)[@"audioAnalyzed"]boolValue],"short capture incomplete");ok(AudioUnitReset(a,0,0),"interrupt acquisition");check([snapshot(a)[@"analysis"][@"captureState"]unsignedIntValue]==4,"reset distinguishes incomplete");

 // New processing is exercised through the actual AU entry points, not a surrogate DSP.
 configure(b,&secondSource,48000,256);secondSource.hz=1000;secondSource.amplitude=.1;
 for(unsigned id=0;id<4;++id)ok(AudioUnitSetParameter(b,id,0,0,0,0),"quality core reset");
 const float defaults[]={0,180,4000,1000,0,1,0,-18,2,10,150,6,0};
 for(unsigned id=0;id<13;++id)ok(AudioUnitSetParameter(b,id+4,0,0,defaults[id],0),"quality defaults");
 UInt32 parameterBytes=0;Boolean writable=false;ok(AudioUnitGetPropertyInfo(b,kAudioUnitProperty_ParameterList,0,0,&parameterBytes,&writable),"public parameter list");check(parameterBytes==17*sizeof(AudioUnitParameterID),"append-only seventeen parameters");
 auto beforeQuality=render(b,96000,256);
 ok(AudioUnitSetParameter(b,4,0,0,1,0),"quality EQ enable");ok(AudioUnitSetParameter(b,8,0,0,6,0),"actual mid boost");auto eqAudio=render(b,96000,256);double measuredEq=20*log10(rms(eqAudio)/rms(beforeQuality));check(std::abs(measuredEq-6)<.1,"actual peaking EQ center gain");
 ok(AudioUnitSetParameter(b,8,0,0,0,0),"mid reset");ok(AudioUnitSetParameter(b,10,0,0,1,0),"compressor enable");ok(AudioUnitSetParameter(b,11,0,0,-24,0),"compressor threshold");ok(AudioUnitSetParameter(b,12,0,0,4,0),"compressor ratio");auto compressed=render(b,96000,256);check(rms(compressed)<rms(beforeQuality)*.8,"actual compressor changes audio");check([snapshot(b)[@"gainReductionDb"]doubleValue]>1,"actual gain reduction meter");
 wav((std::string(argv[2])+"-compressor-off.wav").c_str(),beforeQuality);wav((std::string(argv[2])+"-compressor-on.wav").c_str(),compressed);
 CFPropertyListRef qualitySaved=nullptr;UInt32 qualitySize=sizeof(qualitySaved);ok(AudioUnitGetProperty(b,kAudioUnitProperty_ClassInfo,0,0,&qualitySaved,&qualitySize),"quality state save");NSArray* qualityValues=snapshot(b)[@"processing"];
 AudioUnit reopened=nullptr;ok(AudioComponentInstanceNew(c,&reopened),"new quality AU instance");ok(AudioUnitSetProperty(reopened,kAudioUnitProperty_ClassInfo,0,0,&qualitySaved,sizeof(qualitySaved)),"reopen quality state in fresh instance");check([snapshot(reopened)[@"processing"]isEqual:qualityValues],"fresh instance complete quality state");check(![snapshot(reopened)[@"binding"][@"confirmed"]boolValue],"fresh instance requires target reconfirmation");Source reopenedSource;configure(reopened,&reopenedSource,48000,256);auto reopenedAudio=render(reopened,96000,256);check(std::abs(rms(reopenedAudio)-rms(compressed))<.0001,"fresh restored instance renders same compression");ok(AudioUnitUninitialize(reopened),"reopened stop");ok(AudioComponentInstanceDispose(reopened),"reopened dispose");
 ok(AudioUnitSetParameter(b,10,0,0,0,0),"disable before restore");ok(AudioUnitSetProperty(b,kAudioUnitProperty_ClassInfo,0,0,&qualitySaved,sizeof(qualitySaved)),"quality state restore");check([snapshot(b)[@"processing"]isEqual:qualityValues],"all new state values restored");
 NSMutableDictionary* legacy=[(__bridge NSDictionary*)qualitySaved mutableCopy];legacy[@"novaVersion"]=@1;[legacy removeObjectForKey:@"novaProcessing"];legacy[@"novaUndo"]=@[];CFDictionaryRef legacyCF=(__bridge CFDictionaryRef)legacy;ok(AudioUnitSetProperty(b,kAudioUnitProperty_ClassInfo,0,0,&legacyCF,sizeof(legacyCF)),"v1 state migration");check([snapshot(b)[@"processing"][0]floatValue]==0&&[snapshot(b)[@"processing"][6]floatValue]==0,"legacy sound retained");CFRelease(qualitySaved);
 ok(command(b,@{@"operation":@"bind",@"projectId":@"song-1",@"trackId":@"stereo-out",@"confirmed":@YES,@"targetKind":@"stereo-out"}),"master output confirmation");secondSource.frame=0;ok(AudioUnitReset(b,0,0),"master reset");auto masterCapture=cmd(b,@"capture");masterCapture[@"consent"]=@YES;ok(command(b,masterCapture),"master input capture");auto masterBefore=render(b,96000,256);auto masterInput=snapshot(b);check([masterInput[@"analysis"][@"input"][@"lufsMeasured"]boolValue],"actual AU LUFS measured");
 auto masterPreview=cmd(b,@"preview");masterPreview[@"instruction"]=@"マスタリングして";masterPreview[@"targetLufs"]=@(-18);ok(command(b,masterPreview),"measured master target preview");auto masterProposal=snapshot(b);
 auto masterCompare=cmd(b,@"compare");masterCompare[@"approved"]=@YES;masterCompare[@"directory"]=[NSString stringWithUTF8String:argv[2]].stringByDeletingLastPathComponent;ok(command(b,masterCompare),"master A/B/C WAV export");
 auto masterApply=cmd(b,@"apply");masterApply[@"approved"]=@YES;masterApply[@"choice"]=@1;ok(command(b,masterApply),"approved actual mastering");
 auto masterRecapture=cmd(b,@"capture");masterRecapture[@"consent"]=@YES;ok(command(b,masterRecapture),"master output capture");secondSource.frame=0;auto masterAfter=render(b,96000,256);auto masterOutput=snapshot(b);double outputLufs=[masterOutput[@"analysis"][@"output"][@"integratedLufsExcerpt"]doubleValue];check(std::abs(outputLufs+19)<.2,"actual mastered loudness near B target");
 wav((std::string(argv[2])+"-master-before.wav").c_str(),masterBefore);wav((std::string(argv[2])+"-master-after.wav").c_str(),masterAfter);
 NSData* masterReport=[NSJSONSerialization dataWithJSONObject:@{@"before":masterInput,@"proposal":masterProposal,@"after":masterOutput,@"measuredMidGainDb":@(measuredEq)} options:NSJSONWritingPrettyPrinted error:nil];check([masterReport writeToFile:[[NSString stringWithUTF8String:argv[2]]stringByAppendingString:@"-quality.json"]atomically:YES],"quality evidence written");
 auto masterUndo=cmd(b,@"undo");masterUndo[@"approved"]=@YES;ok(command(b,masterUndo),"master full EQ+dynamics+gain undo");check([snapshot(b)[@"processing"][0]floatValue]==0,"master undo returns legacy processing");
 ok(AudioUnitUninitialize(b),"quality instance stop");
 // Full-song actual AU rendering in fixed blocks. No whole-song RAM allocation.
 std::ofstream longReport(std::string(argv[2])+"-whole-song.jsonl");
 for(double sr:{44100.,48000.,96000.})for(unsigned seconds:{30u,240u,480u}){
  Source longSource;longSource.amplitude=.1;configure(b,&longSource,sr,256);
  ok(AudioUnitSetParameter(b,4,0,0,1,0),"long quality chain");
  ok(AudioUnitSetParameter(b,10,0,0,1,0),"long compressor");
  ok(AudioUnitSetParameter(b,11,0,0,-24,0),"long threshold");
  ok(AudioUnitSetParameter(b,12,0,0,2,0),"long ratio");
  ok(AudioUnitReset(b,0,0),"long reset");
  nova::WholeMeter meter(sr);auto started=std::chrono::steady_clock::now();
  for(uint64_t pos=0;pos<uint64_t(sr*seconds);pos+=256){unsigned count=std::min<uint64_t>(256,uint64_t(sr*seconds)-pos);auto block=render(b,count,256);for(float x:block)meter.add(x,x);}
  meter.finish();check(meter.frames==uint64_t(sr*seconds),"actual AU full-song frame count");check(meter.proposalMeasurement().valid,"actual AU full-song loudness");check(meter.clipped==0,"actual AU full-song unclipped");
  longReport<<std::setprecision(15)<<"{\"actualAuFactory\":true,\"logicHostVerified\":false,\"seconds\":"<<seconds<<",\"wallSeconds\":"<<std::chrono::duration<double>(std::chrono::steady_clock::now()-started).count()<<",\"measurement\":";meter.json(longReport);longReport<<"}\n";
  ok(AudioUnitUninitialize(b),"long stop");
 }
 check(longReport.good(),"long AU report saved");
 ok(AudioUnitUninitialize(a),"stop");ok(AudioComponentInstanceDispose(a),"destroy a");ok(AudioComponentInstanceDispose(b),"destroy b");
 puts("Actual AU binary host, stereo, Gain/EQ, Japanese approval/Undo, isolation and state tests PASS. Logic not tested.");
 // Keep the code loaded until process exit: component registry owns its factory pointer.
}}
