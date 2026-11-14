#pragma once
#include "DSP.hpp"
namespace nova {
// Offline streaming adapter for the exact real-time DSP. No mastering additions,
// latency, resampling or alternate coefficient implementation. Initial state is
// explicit; callers must use host-decoded values to reproduce host quantization.
struct SharedRender {
 DSP dsp;
 void reset(double rate,const std::array<float,4>& initial,const Processing& extra) {
  dsp.reset(rate,initial,extra);
 }
 void process(const float* interleaved,float* output,unsigned count,
              const std::array<float,4>& target,const Processing& extra) noexcept {
  dsp.processing=extra;
  // Bounded stack storage; preserve DSP state/control phase across all chunks.
  constexpr unsigned quantum=512;
  std::array<float,quantum> l{},r{},ol{},orr{};
  for(unsigned at=0;at<count;at+=quantum){
   unsigned n=std::min(quantum,count-at);
   for(unsigned i=0;i<n;++i){l[i]=interleaved[2*(at+i)];r[i]=interleaved[2*(at+i)+1];}
   dsp.process(l.data(),r.data(),ol.data(),orr.data(),n,target);
   for(unsigned i=0;i<n;++i){output[2*(at+i)]=ol[i];output[2*(at+i)+1]=orr[i];}
  }
 }
};
}
