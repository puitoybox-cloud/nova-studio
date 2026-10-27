#pragma once
#include "Analysis.hpp"
#include <string>
#include <stdexcept>
#include <vector>
namespace nova {
struct Binding { std::string project,track,instance; bool confirmed=false; std::string role="unspecified",kind="track",source="user-confirmed AU input"; bool operator==(const Binding&)const=default; };
struct Proposal { Binding binding; std::array<float,4> before; std::array<std::array<float,4>,3> choices; std::string reason; bool audioAnalyzed=false; uint64_t audioHash=0; Processing processingBefore=defaults(); std::array<Processing,3> processingChoices{defaults(),defaults(),defaults()}; bool attenuationOnly=false; };
// Explicit attenuation only: no inferred source identity, EQ, dynamics or boost.
inline Proposal proposeAttenuation(const Binding& b,const std::array<float,4>& values,double delta,const Processing& processing){
 if(!b.confirmed||b.project.empty()||b.track.empty()||b.instance.empty())throw std::runtime_error("対象の明示的確認が必要です");
 if(!std::isfinite(delta)||delta>=0||delta < -24||values[0]+delta < -24)throw std::runtime_error("Gainの下限は-24 dBです。指定した減衰量を適用できません");
 Proposal p{b,values,{values,values,values},"音声未解析・指定Gain減衰のみ。A=1/3、B=2/3、C=指定量。承認前は変更しません"};
 p.attenuationOnly=true;p.processingBefore=processing;p.processingChoices={processing,processing,processing};
 for(unsigned i=0;i<3;++i){p.choices[i][0]=float(values[0]+delta*(i+1)/3.);p.choices[i]=decode(encode(p.choices[i]));}
 return p;
}
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
inline Proposal proposeMeasured(const Binding& b,const std::array<float,4>& v,const std::string& request,const Measurement& m,const Processing& processing=defaults()){
 if(!b.confirmed||b.project.empty()||b.track.empty()||b.instance.empty()||!m.valid)throw std::runtime_error("有効な実音声解析と対象確認が必要です");
 Proposal p{b,v,{v,v,v},"実音声FFT・Peak・RMSに基づくルール提案（機械学習推論なし）",true,m.hash};
 p.processingBefore=processing;p.processingChoices={processing,processing,processing};
 const bool warm=request=="ピアノを自然に聞こえるように"||request=="ピアノを優しく温かい音にして"||request=="ピアノを温かく自然にして"||request=="ピアノをもっと温かくして"||request=="ピアノを柔らかくして";
 const bool soft=request=="高音がきついので柔らかく"||request=="ストリングスを柔らかくして"||request=="ストリングスの高音を柔らかくして"||request=="高音を少し抑えて";
 const bool vocal=request=="ボーカルを前に出して"||request=="ボーカルをもう少し前に出して";
 const bool bass=request=="低音をすっきりさせて"||request=="ベースの低音を整えて"||request=="ベースが強すぎるので調整して"||request=="低音が強すぎるので調整して";
 const bool drum=request=="ドラムをもう少し力強くして";
 const bool natural=request=="曲全体を自然にまとめて"||request=="全体の音量バランスを整えて"||request=="全体の音を自然に整えて";
 if(!warm&&!soft&&!vocal&&!bass&&!natural&&!drum)throw std::runtime_error("未対応の指示です");
 for(unsigned i=0;i<3;++i){
  double strength=(i+1)/3.;auto& x=p.choices[i];auto& e=p.processingChoices[i];e[0]=1;
  double crest=db(m.peak/std::max(m.rms,1e-20));
  e[6]=crest>6?1:0;e[7]=std::clamp(float(db(m.rms)+crest*.35),-60.f,0.f);e[8]=1+float(strength)*(b.kind=="stereo-out"?1.f:2.f);e[9]=drum?30:10;e[10]=150;e[11]=6;e[12]=0;
  if(vocal){e[3]=2500;e[4]=float(strength)*std::min(2.,m.bands[1]*2);e[5]=.8;}
  e=unpack(pack(e));
  double headroom=std::max(0.,db(.85/std::max(m.peak,1e-9)));
  double safety=m.peak>.85?db(.85/m.peak):0;
  x[0]=std::clamp(float(v[0]+safety),-24.f,6.f);
  if(vocal)x[0]=std::clamp(float(v[0]+safety+std::min({headroom,3.,std::max(0.,-20-db(m.rms))})*strength),-24.f,6.f);
  double roleWeight=natural?(b.role=="bass"?.5:b.role=="vocal"?.7:1.):1.;
  if(warm||soft||natural)x[2]=std::clamp(float(v[2]-strength*roleWeight*std::min(.2+m.bands[2]*8.,4.)),-6.f,6.f);
  if(bass||natural)x[1]=std::clamp(float(v[1]-strength*std::min(.2+m.bands[0]*8.,4.)),-6.f,6.f);
  if(warm)x[1]=std::clamp(float(v[1]+strength*std::max(0.,(.35-m.bands[0])*3.)),-6.f,6.f);
  // Conservative sum of absolute EQ gains (including peak band); not a limiter: do not spend more than measured input headroom.
  double eqBound=std::abs(x[1])+std::abs(x[2])+std::abs(e[4])+e[12];
  x[0]=std::min(x[0],float(std::clamp(db(.90/std::max(m.peak,1e-9))-eqBound,-24.,6.)));
  x=decode(encode(x));
 }
 return p;
}
}

namespace nova {
// Proposal-only interpolation. Categorical state changes cannot be averaged.
// dB quantities use arithmetic means; Hz/ms/Q use geometric means; ratio
// averages the gain-reduction slope (equivalently harmonic ratio), not ratio.
inline Proposal midpointProposal(const Proposal& source,unsigned left,unsigned right){
 if(left>2||right>2||left==right||!source.audioAnalyzed||!source.binding.confirmed)throw std::runtime_error("実測済みA/B/C候補と対象確認が必要です");
 Proposal result=source;auto a=source.choices[left],b=source.choices[right];auto x=a;
 auto e=source.processingChoices[left],f=source.processingChoices[right],y=e;
 for(unsigned i=0;i<4;++i){if(!valid(i,a[i])||!valid(i,b[i]))throw std::runtime_error("候補パラメータが不正です");if(i==3){if(a[i]!=b[i])throw std::runtime_error("Bypassが異なる候補は補間できません");}else x[i]=(a[i]+b[i])*.5f;}
 for(unsigned i=0;i<ExtraCount;++i){
  if(!extraValid(i,e[i])||!extraValid(i,f[i]))throw std::runtime_error("候補パラメータが不正です");
  if(i==0||i==6){if(e[i]!=f[i])throw std::runtime_error("EQ/Compressor有効状態が異なる候補は補間できません");}
  else if(i==1||i==2||i==3||i==5||i==9||i==10)y[i]=std::sqrt(e[i]*f[i]);
  else if(i==8)y[i]=2/(1/e[i]+1/f[i]);
  else y[i]=(e[i]+f[i])*.5f;
 }
 result.choices={a,decode(encode(x)),b};result.processingChoices={e,unpack(pack(y)),f};
 result.reason="既存の実測候補から中間提案：A=選んだ左候補 / B=中間 / C=選んだ右候補。dBは平均、Hz/ms/Qは幾何平均、Ratioは圧縮傾斜を平均。有効状態が異なる場合は拒否。試聴・承認前は変更しません";
 return result;
}
}
