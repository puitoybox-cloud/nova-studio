#pragma once
#include "DSP.hpp"
#include "Loudness.hpp"
#include <complex>
#include <cstring>
#include <vector>
#include <string>
namespace nova {
// Fixed, preallocated single-producer capture. Control reads only after release/acquire ready.
// 2 seconds at the maximum supported sample rate, input and output stereo: 6,144,000 bytes.
static_assert(std::atomic<unsigned>::is_always_lock_free && std::atomic<bool>::is_always_lock_free);
struct Capture {
 static constexpr unsigned capacity=384000;
 std::vector<float> samples=std::vector<float>(capacity*4);
 std::atomic<unsigned> progress{0};
 std::atomic<unsigned> state{0}; // 0 idle, 1 armed, 2 writing, 3 ready, 4 incomplete/reset
 unsigned frames=0,limit=0; double rate=0; uint64_t settings=0; bool changed=false;
 void invalidate() noexcept {auto s=state.load();if(s==1||s==2)state.store(4,std::memory_order_release);}
 bool arm(){unsigned s=state.load(std::memory_order_acquire);if(s==1||s==2)return false;frames=0;progress.store(0);changed=false;state.store(1,std::memory_order_release);return true;}
 // Called before DSP so in-place hosts retain the actual unprocessed input.
 unsigned input(const float* l,const float* r,unsigned n,double sr,uint64_t p) noexcept {
  auto s=state.load(std::memory_order_acquire);if(s!=1&&s!=2)return 0;
  if(s==1){rate=sr;limit=std::min(capacity,unsigned(sr*2));settings=p;state.store(2,std::memory_order_relaxed);}
  if(sr!=rate||p!=settings)changed=true;
  unsigned k=std::min(n,limit-frames);for(unsigned i=0;i<k;++i){samples[(frames+i)*4]=l[i];samples[(frames+i)*4+1]=r[i];}return k;
 }
 void output(const float* l,const float* r,unsigned n) noexcept {
  if(!n)return;for(unsigned i=0;i<n;++i){samples[(frames+i)*4+2]=l[i];samples[(frames+i)*4+3]=r[i];}frames+=n;progress.store(frames,std::memory_order_relaxed);
  if(frames==limit)state.store(3,std::memory_order_release);
 }
};
struct Measurement {
 Loudness loudness;
 bool valid=false; unsigned frames=0,invalid=0,clipped=0; double rate=0,peak=0,rms=0;
 std::array<double,3> bands{}; uint64_t hash=14695981039346656037ull; std::string status="unmeasured";
};
inline double db(double x){return x>0?20*std::log10(x):-160;}
inline void fft(std::array<std::complex<double>,2048>& a){
 constexpr unsigned n=2048;for(unsigned i=1,j=0;i<n;++i){unsigned b=n>>1;for(;j&b;b>>=1)j^=b;j^=b;if(i<j)std::swap(a[i],a[j]);}
 for(unsigned len=2;len<=n;len*=2){auto w=std::polar(1.,-2*3.141592653589793/len);for(unsigned i=0;i<n;i+=len){std::complex<double> v=1;for(unsigned j=0;j<len/2;++j){auto x=a[i+j],y=a[i+j+len/2]*v;a[i+j]=x+y;a[i+j+len/2]=x-y;v*=w;}}}
}
// Non-realtime only. Hann-window FFT powers normalized across 20 Hz..Nyquist.
inline Measurement measure(const float* data,unsigned frames,double sr,unsigned stride=2,unsigned offset=0){
 Measurement m;m.frames=frames;m.rate=sr;if(!std::isfinite(sr)||sr<22050||sr>192000||frames>Capture::capacity||stride<2||offset+1>=stride){m.status="invalid-format";return m;}
 double sum=0;for(unsigned i=0;i<frames;++i)for(unsigned c=0;c<2;++c){float x=data[i*stride+offset+c];uint32_t bits;std::memcpy(&bits,&x,4);m.hash^=bits;m.hash*=1099511628211ull;if(!std::isfinite(x)){++m.invalid;continue;}m.peak=std::max(m.peak,double(std::abs(x)));sum+=double(x)*x;if(std::abs(x)>=1)++m.clipped;}
 m.rms=frames?std::sqrt(sum/(frames*2)):0;
 if(m.invalid){m.status="nonfinite-input";return m;}if(frames<sr*.5){m.status="too-short";return m;}if(m.rms<1e-7){m.status="silence";return m;}
 std::array<std::complex<double>,2048> a{};
 for(unsigned start=0;start+2048<=frames;start+=1024)for(unsigned c=0;c<2;++c){
  for(unsigned i=0;i<2048;++i)a[i]=double(data[(start+i)*stride+offset+c])*(.5-.5*std::cos(2*3.141592653589793*i/2047));fft(a);
  for(unsigned k=1;k<=1024;++k){double hz=k*sr/2048;if(hz<20)continue;m.bands[hz<200?0:hz<4000?1:2]+=std::norm(a[k]);}
 }
 double total=m.bands[0]+m.bands[1]+m.bands[2];if(total<=0){m.status="no-spectrum";return m;}for(auto& b:m.bands)b/=total;m.loudness=nova::loudness(data,frames,sr,stride,offset);m.valid=true;m.status=m.clipped?"clipping-detected":"measured";return m;
}
}
