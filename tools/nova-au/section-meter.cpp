#include "WholeSong.hpp"
#include <fstream>
#include <iostream>
#include <iomanip>
// Independent diagnostic executable: do not expand the production render path.
int main(int argc,char** argv){try{
 if(argc!=4||std::string(argv[1])!="sections")throw std::runtime_error("sections INPUT.f32 RATE");
 double sr=std::stod(argv[3]);
 if(sr!=44100&&sr!=48000&&sr!=96000)throw std::runtime_error("whole-song rate must be 44100/48000/96000");
 std::ifstream f(argv[2],std::ios::binary|std::ios::ate);auto bytes=f.tellg();
 if(!f||bytes<=0||bytes%8||bytes>sr*7200*8)throw std::runtime_error("invalid bounded stereo float32 input");
 uint64_t frames=uint64_t(bytes)/8;f.seekg(0);
 // Independent diagnostic mode; never changes production rendering or its meters.
 {
  const uint64_t sectionFrames=uint64_t(sr*3);uint64_t position=0;
  std::cout<<std::setprecision(15)<<"{\"sectionSeconds\":3,\"perceptualQualityVerified\":false,\"sections\":[";
  while(position<frames){nova::WholeMeter section(sr);uint64_t count=std::min(sectionFrames,frames-position);
   for(uint64_t i=0;i<count;++i){float pair[2];f.read(reinterpret_cast<char*>(pair),8);if(!f)throw std::runtime_error("incomplete section input");section.add(pair[0],pair[1]);}
   section.finish();if(position)std::cout<<",";std::cout<<"{\"startFrame\":"<<position<<",\"measurement\":";section.json(std::cout);std::cout<<"}";position+=count;
  }
  std::cout<<"]}\n";return 0;
 }
 }catch(const std::exception& e){std::cerr<<e.what()<<"\n";return 1;}}
