#pragma once
#include <algorithm>
#include <array>
#include <atomic>
#include <cmath>
#include <cstdint>
namespace nova {
constexpr unsigned ParameterCount = 4;
constexpr float minimum[4] = {-24,-6,-6,0};
constexpr float maximum[4] = {6,6,6,1};
constexpr float initial[4] = {0,0,0,0}; // gain, low band, high band, bypass
inline bool valid(unsigned id,float v) { return id<4 && std::isfinite(v) && v>=minimum[id] && v<=maximum[id]; }
// 41 bits of quantized values, 23 bits of write generation in one lock-free word.
// Including generation in CAS rejects host automation even if values return to baseline.
constexpr unsigned shifts[4]={0,12,23,34};
constexpr uint64_t masks[4]={4095,2047,2047,127};
inline uint64_t encode(const std::array<float,4>& v) {
 uint64_t n=0;for(unsigned i=0;i<4;++i)n|=uint64_t(std::lround((v[i]-minimum[i])*100))<<shifts[i];return n;
}
inline uint64_t revised(uint64_t old,const std::array<float,4>& v){return encode(v)|((((old>>41)+1)&0x7fffffULL)<<41);}
inline std::array<float,4> decode(uint64_t n) {
 std::array<float,4> v{};for(unsigned i=0;i<4;++i)v[i]=float((n>>shifts[i])&masks[i])/100+minimum[i];return v;
}
static_assert(std::atomic<uint64_t>::is_always_lock_free,"Render targets must be lock free");
struct DSP {
 double rate=44100, smooth=0, lowA=0, highA=0;
 std::array<double,2> low{},high{};
 std::array<float,4> current{0,0,0,0};
 void reset(double sr,const std::array<float,4>& p) {
  rate=sr;smooth=1-std::exp(-1/(.020*sr));lowA=1-std::exp(-2*3.141592653589793*180/sr);highA=1-std::exp(-2*3.141592653589793*4000/sr);low={};high={};current=p;
 }
 void process(const float* l,const float* r,float* ol,float* oright,unsigned count,const std::array<float,4>& target) noexcept {
  for(unsigned f=0;f<count;++f){
   for(unsigned i=0;i<4;++i)current[i]+=float(smooth)*(target[i]-current[i]);
   const double gain=std::pow(10.,current[0]/20.), lg=std::pow(10.,current[1]/20.)-1, hg=std::pow(10.,current[2]/20.)-1;
   for(unsigned c=0;c<2;++c){
    double x=(c?r:l)[f];if(!std::isfinite(x))x=0;
    // Bound hostile inputs and internal state before filtering; bypass preserves normal float audio.
    x=std::clamp(x,-16.,16.);low[c]+=lowA*(x-low[c]);high[c]+=highA*(x-high[c]);
    double y=(x+lg*low[c]+hg*(x-high[c]))*gain;
    y=std::clamp(y,-.98,.98);y=y*(1-current[3])+x*current[3];
    (c?oright:ol)[f]=std::isfinite(y)?float(y):0;
   }
  }
 }
};
}
