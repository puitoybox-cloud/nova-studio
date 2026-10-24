#pragma once
#include "DSP.hpp"
#include <string>
#include <stdexcept>
#include <vector>
namespace nova {
struct Binding { std::string project,track,instance; bool confirmed=false; bool operator==(const Binding&)const=default; };
struct Proposal { Binding binding; std::array<float,4> before; std::array<std::array<float,4>,3> choices; std::string reason; };
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
