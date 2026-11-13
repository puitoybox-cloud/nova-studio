#include "../Analysis.hpp"
#include <fstream>
#include <iostream>
#include <iomanip>
int main(int argc,char** argv){if(argc!=2)return 1;std::ifstream f(argv[1],std::ios::binary|std::ios::ate);auto bytes=f.tellg();if(bytes<=0||bytes>nova::Capture::capacity*8||bytes%8)return 2;std::vector<float> data(size_t(bytes)/4);f.seekg(0);f.read((char*)data.data(),bytes);if(!f.good())return 3;auto m=nova::measure(data.data(),data.size()/2,48000);auto l=m.loudness;std::cout<<std::setprecision(15)<<"{\"valid\":"<<(l.valid?"true":"false")<<",\"lufs\":"<<l.integrated<<",\"truePeak\":"<<l.truePeak<<",\"samplePeak\":"<<m.peak<<",\"momentary\":"<<l.momentary<<",\"shortTermValid\":"<<(l.shortTermValid?"true":"false")<<",\"shortTerm\":"<<l.shortTerm<<"}\n";}
