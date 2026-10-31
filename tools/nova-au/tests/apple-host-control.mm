#import <Foundation/Foundation.h>
#import <AudioToolbox/AudioToolbox.h>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <vector>
#include <string>
#include <algorithm>
static void require(bool condition,const char* reason){if(!condition){fprintf(stderr,"UNVERIFIED / FAIL: %s\n",reason);exit(1);}}
static void ok(OSStatus status,const char* reason){require(status==noErr,reason);}
// This host owns its own Apple LowPass instance. It cannot address a Logic insert.
// The only allowlisted component is the OS-supplied Apple AU; no installed vendor AU is touched.
int main(int argc,char** argv){@autoreleasepool{
 require(argc==2&&std::string(argv[1])=="--approved-ci-fixture","explicit disposable CI fixture approval required");
 AudioComponentDescription requested={kAudioUnitType_Effect,kAudioUnitSubType_LowPassFilter,kAudioUnitManufacturer_Apple,0,0};
 auto component=AudioComponentFindNext(nullptr,&requested);require(component,"Apple LowPass component available");AudioComponentDescription identity={};ok(AudioComponentGetDescription(component,&identity),"read component identity");require(identity.componentType==requested.componentType&&identity.componentSubType==requested.componentSubType&&identity.componentManufacturer==requested.componentManufacturer,"allowlisted component identity");
 UInt32 version=0;ok(AudioComponentGetVersion(component,&version),"read actual component version");CFStringRef componentName=nullptr;ok(AudioComponentCopyName(component,&componentName),"read product name");NSString* name=CFBridgingRelease(componentName);
 AudioUnit unit=nullptr;ok(AudioComponentInstanceNew(component,&unit),"own standalone AU instance");
 UInt32 size=0;Boolean writable=false;ok(AudioUnitGetPropertyInfo(unit,kAudioUnitProperty_ParameterList,0,0,&size,&writable),"public parameter IDs");require(size>0&&size<=4096&&size%sizeof(AudioUnitParameterID)==0,"bounded parameter inventory");std::vector<AudioUnitParameterID> ids(size/sizeof(AudioUnitParameterID));ok(AudioUnitGetProperty(unit,kAudioUnitProperty_ParameterList,0,0,ids.data(),&size),"read public parameter IDs");
 NSMutableArray* parameters=[NSMutableArray array];bool verified=false;
 for(auto id:ids){AudioUnitParameterInfo info={};UInt32 infoSize=sizeof(info);ok(AudioUnitGetProperty(unit,kAudioUnitProperty_ParameterInfo,0,id,&info,&infoSize),"public parameter metadata");float old=0;ok(AudioUnitGetParameter(unit,id,0,0,&old),"read old public value");NSMutableDictionary* row=[@{@"id":@(id),@"name":[NSString stringWithUTF8String:info.name]?:@"",@"min":@(info.minValue),@"max":@(info.maxValue),@"old":@(old),@"flags":@(info.flags)}mutableCopy];
  if(!verified&&(info.flags&kAudioUnitParameterFlag_IsWritable)&&std::isfinite(old)&&std::isfinite(info.minValue)&&std::isfinite(info.maxValue)&&info.maxValue>info.minValue){float next=old+(info.maxValue-info.minValue)*.01f;if(next>info.maxValue)next=old-(info.maxValue-info.minValue)*.01f;next=std::fmax(info.minValue,std::fmin(next,info.maxValue));ok(AudioUnitSetParameter(unit,id,0,0,next,0),"approved owned-instance public write");float actual=0;OSStatus read=AudioUnitGetParameter(unit,id,0,0,&actual);OSStatus restore=AudioUnitSetParameter(unit,id,0,0,old,0);ok(restore,"restore original value even before read assertion");ok(read,"read changed public value");require(std::abs(actual-next)<std::max(.0001f,(info.maxValue-info.minValue)*.0001f),"actual parameter write confirmed");float restored=0;ok(AudioUnitGetParameter(unit,id,0,0,&restored),"read restored value");require(std::abs(restored-old)<.0001f,"old value restored");row[@"approvedNew"]=@(next);row[@"actualNew"]=@(actual);row[@"restored"]=@(restored);verified=true;}
  [parameters addObject:row];if((info.flags&kAudioUnitParameterFlag_CFNameRelease)&&info.cfNameString)CFRelease(info.cfNameString);
 }
 require(verified,"one public writable control demonstrated");ok(AudioComponentInstanceDispose(unit),"dispose only owned instance");
 NSDictionary* result=@{@"product":name?:@"Apple LowPass",@"version":@(version),@"componentType":@(identity.componentType),@"componentSubType":@(identity.componentSubType),@"componentManufacturer":@(identity.componentManufacturer),@"parameters":parameters,@"scope":@"standalone host-owned Apple AU instance only",@"logicHostControlled":@NO,@"logicChannelEQVerified":@NO,@"logicCompressorVerified":@NO,@"masteringAssistantVerified":@NO,@"commercialProductVerified":@NO};NSData* json=[NSJSONSerialization dataWithJSONObject:result options:NSJSONWritingPrettyPrinted error:nil];require(json,"JSON evidence");fwrite(json.bytes,1,json.length,stdout);puts("");
}}
