#pragma once
#include "Analysis.hpp"
#include <string>
#include <stdexcept>
#include <vector>
namespace nova {
struct Binding { std::string project,track,instance; bool confirmed=false; bool operator==(const Binding&)const=default; };
struct Proposal { Binding binding; std::array<float,4> before; std::array<std::array<float,4>,3> choices; std::string reason; bool audioAnalyzed=false; uint64_t audioHash=0; };
inline Proposal propose(const Binding& b,const std::array<float,4>& values,const std::string& request){
 if(!b.confirmed||b.project.empty()||b.track.empty()||b.instance.empty())throw std::runtime_error("対象の明示的確認が必要です");
 Proposal p{b,values,{values,values,values},"音声未解析・ルールによる提案"};
 if(request=="ピアノを柔らかくして"||request=="高音を少し抑えて"){
  for(unsigned i=0;i<3;++i)p.choices[i][2]=std::max(-6.f,values[2]-float(i+1));
  p.reason+="：高域を1 / 2 / 3 dB抑える";
 }else if(request=="ボーカルをもう少し前に出して"){
  for(unsigned i=0;i<3;++i)p.choices[i][0]=std::min(6.f,values[0]+float(i+1)*.5f);
  p.reason+="：Gainを0.5 / 1 / 1.5 dB上げる。定位・明瞭度の保証なし";
 }else throw std::runtime_error("未対応の指示です");
 return p;
}
}

namespace nova {
inline Proposal proposeMeasured(const Binding& b,const std::array<float,4>& v,const std::string& request,const Measurement& m){
 if(!b.confirmed||b.project.empty()||b.track.empty()||b.instance.empty()||!m.valid)throw std::runtime_error("有効な実音声解析と対象確認が必要です");
 Proposal p{b,v,{v,v,v},"実音声FFT・Peak・RMSに基づくルール提案（機械学習推論なし）",true,m.hash};
 const bool warm=request=="ピアノをもっと温かくして"||request=="ピアノを柔らかくして";
 const bool soft=request=="ストリングスの高音を柔らかくして"||request=="高音を少し抑えて";
 const bool vocal=request=="ボーカルをもう少し前に出して";
 const bool bass=request=="低音が強すぎるので調整して";
 const bool natural=request=="全体の音を自然に整えて";
 if(!warm&&!soft&&!vocal&&!bass&&!natural)throw std::runtime_error("未対応の指示です");
 for(unsigned i=0;i<3;++i){
  double strength=(i+1)/3.;auto& x=p.choices[i];
  double headroom=std::max(0.,db(.85/std::max(m.peak,1e-9)));
  double safety=m.peak>.85?db(.85/m.peak):0;
  x[0]=std::clamp(float(v[0]+safety),-24.f,6.f);
  if(vocal)x[0]=std::clamp(float(v[0]+safety+std::min({headroom,3.,std::max(0.,-20-db(m.rms))})*strength),-24.f,6.f);
  if(warm||soft||natural)x[2]=std::clamp(float(v[2]-strength*std::min(.2+m.bands[2]*8.,4.)),-6.f,6.f);
  if(bass||natural)x[1]=std::clamp(float(v[1]-strength*std::min(.2+m.bands[0]*8.,4.)),-6.f,6.f);
  if(warm)x[1]=std::clamp(float(v[1]+strength*std::max(0.,(.35-m.bands[0])*3.)),-6.f,6.f);
  // Conservative bound for this parallel EQ: do not spend more than measured input headroom.
  double eqBound=20*std::log10(1+std::abs(std::pow(10.,x[1]/20)-1)+2*std::abs(std::pow(10.,x[2]/20)-1));
  x[0]=std::min(x[0],float(std::clamp(db(.90/std::max(m.peak,1e-9))-eqBound,-24.,6.)));
  x=decode(encode(x));
 }
 return p;
}
}
