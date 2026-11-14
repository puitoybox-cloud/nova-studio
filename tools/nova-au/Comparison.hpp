#pragma once
#include "Control.hpp"
#include <fstream>
#include <stdexcept>
namespace nova {
struct Comparison {
 std::array<std::vector<float>,4> audio;
 std::array<Measurement,4> measurements;
 std::array<double,4> matching{};
};
inline Comparison compare(const float* data,unsigned frames,double sr,unsigned stride,unsigned offset,const Proposal& p){
 if(!p.audioAnalyzed||!frames||frames>Capture::capacity)throw std::runtime_error("実音声の候補が必要です");
 Comparison out;std::vector<float> l(frames),r(frames),a(frames),b(frames);
 for(unsigned i=0;i<frames;++i){l[i]=data[i*stride+offset];r[i]=data[i*stride+offset+1];}
 auto actual=measure(data,frames,sr,stride,offset);if(!actual.valid||actual.hash!=p.audioHash)throw std::runtime_error("音声IDの不一致");
 double target=actual.rms;
 for(unsigned k=0;k<4;++k){auto& v=out.audio[k];v.resize(frames*2);
  if(k){DSP d;d.reset(sr,p.choices[k-1],p.processingChoices[k-1]);d.process(l.data(),r.data(),a.data(),b.data(),frames,p.choices[k-1]);}
  for(unsigned i=0;i<frames;++i){v[2*i]=k?a[i]:l[i];v[2*i+1]=k?b[i]:r[i];}
  out.measurements[k]=measure(v.data(),frames,sr);if(!out.measurements[k].valid)throw std::runtime_error("比較音声の計測失敗");target=std::min(target,out.measurements[k].rms);
 }
 for(unsigned k=0;k<4;++k)out.matching[k]=target/out.measurements[k].rms;
 return out;
}
// Excerpt mastering: measured EQ/dynamics first, then bounded static output gain.
// Never claims a true-peak limiter. 4x FIR is an estimate with 0.5 dB safety margin.
inline Proposal proposeMaster(const Binding& binding,const std::array<float,4>& values,const Processing& processing,const float* data,unsigned frames,double sr,unsigned stride,unsigned offset,double target){
 auto m=measure(data,frames,sr,stride,offset);
 if(binding.kind!="stereo-out"||!m.valid||!m.loudness.valid||!std::isfinite(target)||target< -36||target> -5)throw std::runtime_error("MasteringはStereo Out・48 kHzの実解析と目標LUFS指定が必要です");
 auto p=proposeMeasured(binding,values,"全体の音を自然に整えて",m,processing);
 p.reason="実音声の抜粋Mastering：EQ→Stereo Compressor→静的Gain。目標LUFS "+std::to_string(target)+"。全曲未測定・True Peak limiterなし";
 auto trial=compare(data,frames,sr,stride,offset,p);
 for(unsigned k=0;k<3;++k){auto& measured=trial.measurements[k+1];if(!measured.loudness.valid)throw std::runtime_error("候補LUFSの計測失敗");double desired=target-(2-k);double delta=std::min(desired-measured.loudness.integrated,db(std::pow(10.,-1.5/20)/std::max(measured.loudness.truePeak,1e-12)));p.choices[k][0]=std::clamp(float(p.choices[k][0]+delta),-24.f,6.f);p.choices[k]=decode(encode(p.choices[k]));}
 return p;
}
inline void writeWave(const std::string& path,const std::vector<float>& stereo,unsigned rate,double scale=1){
 std::ofstream o(path,std::ios::binary);auto u16=[&](uint16_t n){char b[]={char(n),char(n>>8)};o.write(b,2);};auto u32=[&](uint32_t n){char b[]={char(n),char(n>>8),char(n>>16),char(n>>24)};o.write(b,4);};
 o.write("RIFF",4);u32(36+stereo.size()*4);o.write("WAVEfmt ",8);u32(16);u16(3);u16(2);u32(rate);u32(rate*8);u16(8);u16(32);o.write("data",4);u32(stereo.size()*4);
 for(float x:stereo){x*=scale;uint32_t bits;std::memcpy(&bits,&x,4);u32(bits);}if(!o.good())throw std::runtime_error("WAV保存失敗");
}
}
