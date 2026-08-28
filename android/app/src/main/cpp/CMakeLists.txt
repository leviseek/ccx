cmake_minimum_required(VERSION 3.22)
project(ccx_shell C CXX)
add_library(ccx_shell SHARED shell.cpp)
target_compile_features(ccx_shell PUBLIC cxx_std_20)
