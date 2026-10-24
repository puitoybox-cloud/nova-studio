#pragma once
#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
namespace nova {
// Append-only host IDs 4..16. A single lock-free word publishes all advanced values.
// Frequencies/times use logarithmic quantization; values shown to the user are decoded values.
constexpr unsigned ExtraCount=13;
constexpr float extraMin[ExtraCount]={0,30,1000,100,-12,.25,0,-60,1,.1,10,0,0};
constexpr float extraMax[ExtraCount]={1,500,16000,12000,12,8,1,0,16,100,2000,15,12};
constexpr float extraDefault[ExtraCount]={0,180,4000,1000,0,1,0,-18,2,10,150,6,0};
constexpr unsigned extraBits[ExtraCount]={1,6,6,6,7,5,1,7,4,5,5,4,5};
constexpr bool extraLog[ExtraCount]={false,true,true,true,false,true,false,false,false,true,true,false,false};
constexpr unsigned extraLevels[ExtraCount]={1,63,63,63,96,31,1,120,15,31,31,15,24};
using Processing=std::array<float,ExtraCount>;
inline bool extraValid(unsigned i,float x){return i<ExtraCount&&std::isfinite(x)&&x>=extraMin[i]&&x<=extraMax[i];}
inline uint64_t pack(const Processing& p){uint64_t word=0;unsigned shift=0;for(unsigned i=0;i<ExtraCount;++i){double x=std::isfinite(p[i])?std::clamp(p[i],extraMin[i],extraMax[i]):extraDefault[i];double t=extraLog[i]?std::log(x/extraMin[i])/std::log(extraMax[i]/extraMin[i]):(x-extraMin[i])/(extraMax[i]-extraMin[i]);auto max=extraLevels[i];word|=uint64_t(std::llround(t*max))<<shift;shift+=extraBits[i];}return word;}
inline Processing unpack(uint64_t word){Processing p{};unsigned shift=0;for(unsigned i=0;i<ExtraCount;++i){auto max=extraLevels[i];double t=double(std::min<uint64_t>(max,(word>>shift)&((1ULL<<extraBits[i])-1)))/max;p[i]=extraLog[i]?extraMin[i]*std::pow(extraMax[i]/extraMin[i],t):extraMin[i]+t*(extraMax[i]-extraMin[i]);p[i]=std::clamp(p[i],extraMin[i],extraMax[i]);shift+=extraBits[i];}return p;}
inline Processing defaults(){Processing p;std::copy_n(extraDefault,ExtraCount,p.begin());return unpack(pack(p));}
constexpr double pi=3.14159265358979323846;
// Audio EQ Cookbook normalized RBJ biquads, transposed direct form II, double state.
struct Biquad {
 double b0=1,b1=0,b2=0,a1=0,a2=0;std::array<double,2> z1{},z2{};
 void set(unsigned type,double sr,double hz,double db,double q){
  hz=std::clamp(hz,10.,sr*.45);q=std::clamp(q,.25,8.);double A=std::pow(10.,db/40),w=2*pi*hz/sr,c=std::cos(w),s=std::sin(w),alpha=s/(2*q),a0;
  if(type==0){double beta=2*std::sqrt(A)*alpha;b0=A*((A+1)-(A-1)*c+beta);b1=2*A*((A-1)-(A+1)*c);b2=A*((A+1)-(A-1)*c-beta);a0=(A+1)+(A-1)*c+beta;a1=-2*((A-1)+(A+1)*c);a2=(A+1)+(A-1)*c-beta;}
  else if(type==2){double beta=2*std::sqrt(A)*alpha;b0=A*((A+1)+(A-1)*c+beta);b1=-2*A*((A-1)+(A+1)*c);b2=A*((A+1)+(A-1)*c-beta);a0=(A+1)-(A-1)*c+beta;a1=2*((A-1)-(A+1)*c);a2=(A+1)-(A-1)*c-beta;}
  else {b0=1+alpha*A;b1=-2*c;b2=1-alpha*A;a0=1+alpha/A;a1=-2*c;a2=1-alpha/A;}
  b0/=a0;b1/=a0;b2/=a0;a1/=a0;a2/=a0;
 }
 double tick(double x,unsigned c)noexcept{double y=b0*x+z1[c];z1[c]=b1*x-a1*y+z2[c];z2[c]=b2*x-a2*y;if(!std::isfinite(y)||!std::isfinite(z1[c])||!std::isfinite(z2[c])){z1[c]=z2[c]=0;return 0;}if(std::abs(z1[c])<1e-25)z1[c]=0;if(std::abs(z2[c])<1e-25)z2[c]=0;return y;}
};
inline double compressionDb(double level,double threshold,double ratio,double knee){double over=level-threshold,slope=1-1/ratio;if(over<=-knee*.5)return 0;if(knee>0&&over<knee*.5)return slope*(over+knee*.5)*(over+knee*.5)/(2*knee);return slope*over;}
struct Quality {
 Processing current=defaults();Biquad low,mid,high;double reduction=0,maximumReduction=0,enable=0,modern=0;unsigned phase=0;
 void reset(const Processing& p){current=p;low={};mid={};high={};reduction=maximumReduction=0;enable=p[6];modern=p[0];phase=0;}
 void frame(double sr,double smooth,const Processing& p,double lowDb,double highDb){
  for(unsigned i=0;i<ExtraCount;++i)current[i]+=smooth*(p[i]-current[i]);enable+=smooth*(p[6]-enable);modern+=smooth*(p[0]-modern);
  // Fixed 16-frame control quantum, independent of host buffer boundaries. Smooth physical
  // parameters before coefficient design; no interpolation between unrelated coefficient sets.
  if(phase++%16==0){low.set(0,sr,current[1],lowDb,.7071067811865476);mid.set(1,sr,current[3],current[4],current[5]);high.set(2,sr,current[2],highDb,.7071067811865476);}
 }
 void process(double& l,double& r,double sr){
  l=high.tick(mid.tick(low.tick(l,0),0),0);r=high.tick(mid.tick(low.tick(r,1),1),1);
  double level=20*std::log10(std::max({std::abs(l),std::abs(r),1e-20}));double wanted=compressionDb(level,current[7],current[8],current[11]);double ms=wanted>reduction?current[9]:current[10];double coefficient=std::exp(-1/(ms*.001*sr));reduction=coefficient*reduction+(1-coefficient)*wanted;maximumReduction=std::max(maximumReduction,reduction*enable);
  double g=std::pow(10.,(current[12]-reduction)*enable/20);l*=g;r*=g;
 }
};
}
