# Headless build of the shared DSP core + its tests (Linux/macOS, no RN/NDK).
# The Android app builds the same sources from android/app/src/main/cpp/CMakeLists.txt;
# keep its DSP_SOURCES list in sync when adding a .cpp here.
#
#   cmake -S cpp -B build/cpp && cmake --build build/cpp && ctest --test-dir build/cpp --output-on-failure
cmake_minimum_required(VERSION 3.16)
project(clarihear_dsp_tests LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
if(NOT CMAKE_BUILD_TYPE)
  set(CMAKE_BUILD_TYPE Release)
endif()

# Mirror the Android flags that change numerics/semantics (-ffast-math, no exceptions),
# so tests exercise the same code the device runs.
add_compile_options(-Wall -Wextra -Werror -ffast-math -fno-exceptions)

add_library(clarihear_dsp STATIC
  AudioEngine.cpp
  BiquadFilter.cpp
  Compressor.cpp
)
target_include_directories(clarihear_dsp PUBLIC ${CMAKE_CURRENT_SOURCE_DIR})

enable_testing()
add_executable(dsp_test test/dsp_test.cpp)
target_link_libraries(dsp_test PRIVATE clarihear_dsp)
target_compile_definitions(dsp_test PRIVATE
  CLARIHEAR_FIXTURE_DIR="${CMAKE_CURRENT_SOURCE_DIR}/test/fixtures")
add_test(NAME dsp_test COMMAND dsp_test)

add_executable(engine_test test/engine_test.cpp)
target_link_libraries(engine_test PRIVATE clarihear_dsp ${CMAKE_DL_LIBS})
target_compile_definitions(engine_test PRIVATE
  CLARIHEAR_FIXTURE_DIR="${CMAKE_CURRENT_SOURCE_DIR}/test/fixtures")
add_test(NAME engine_test COMMAND engine_test)
