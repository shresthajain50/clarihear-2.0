cmake_minimum_required(VERSION 3.22.1)
project(clarihear_dsp VERSION 2.0.0 LANGUAGES CXX)

# ──────────────────────────────────────────────────────────────
#  C++17 required for if-constexpr, std::optional, etc.
# ──────────────────────────────────────────────────────────────
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# ──────────────────────────────────────────────────────────────
#  Compiler flags: aggressive optimisation for the hot DSP path,
#  with ARM NEON auto-vectorisation enabled.
# ──────────────────────────────────────────────────────────────
add_compile_options(
    -O3
    -ffast-math                  # permits reordering of FP ops (safe for DSP)
    -fno-exceptions              # no C++ exception overhead in the hot path
    -fno-rtti
    -Wall
    -Wextra
    -Werror=return-type
)

# ──────────────────────────────────────────────────────────────
#  Google Oboe — pulled from Maven/AAR via Prefab.
#  In build.gradle.kts add:
#    implementation("com.google.oboe:oboe:1.9.0")
#  and enable prefab { } in the android {} block.
#  CMake then just finds it:
# ──────────────────────────────────────────────────────────────
find_package(oboe REQUIRED CONFIG)

# ──────────────────────────────────────────────────────────────
#  Shared C++ DSP source files (identical on iOS & Android)
#  Path is relative to this CMakeLists — adjust if structure changes.
# ──────────────────────────────────────────────────────────────
set(DSP_ROOT "${CMAKE_CURRENT_SOURCE_DIR}/../../../../cpp")

set(DSP_SOURCES
    ${DSP_ROOT}/AudioEngine.cpp
    ${DSP_ROOT}/BiquadFilter.cpp
    ${DSP_ROOT}/Compressor.cpp
    ${DSP_ROOT}/jsi/ClarihearHostObject.cpp    # Phase 4 — shared JSI HostObject
)

# ──────────────────────────────────────────────────────────────
#  Android-specific Oboe audio I/O wrapper + JNI bridge
# ──────────────────────────────────────────────────────────────
set(ANDROID_SOURCES
    OboeAudioPlayer.cpp     # Phase 3 — Oboe stream + data callback (COMPLETE)
    ClarihearJNI.cpp        # Phase 3 — JNI bridge: Kotlin external fun ↔ C++
    ClarihearJSI.cpp        # Phase 4 — Android JSI installer (COMPLETE)
)

# ──────────────────────────────────────────────────────────────
#  Build the shared library loaded by the RN app
# ──────────────────────────────────────────────────────────────
add_library(clarihear_dsp SHARED
    ${DSP_SOURCES}
    ${ANDROID_SOURCES}
)

target_include_directories(clarihear_dsp PRIVATE
    ${DSP_ROOT}                              # shared C++ headers
    ${CMAKE_CURRENT_SOURCE_DIR}              # android-specific headers
)

# ──────────────────────────────────────────────────────────────
#  Link against:
#   • oboe::oboe   — Google Oboe (low-latency audio I/O)
#   • log          — Android logging (used in Oboe callbacks)
#   • android      — ANativeActivity, AssetManager (optional)
# ──────────────────────────────────────────────────────────────
target_link_libraries(clarihear_dsp
    oboe::oboe
    log
    android
)

# ──────────────────────────────────────────────────────────────
#  JSI — statically linked from React Native's build
#  jsi is available as a prebuilt from the RN Gradle plugin.
# ──────────────────────────────────────────────────────────────
if(DEFINED REACT_NATIVE_DIR)
    # Find the pre-built jsi.a or libjsi.so from the RN android build
    find_library(JSI_LIB jsi
        PATHS ${REACT_NATIVE_DIR}/ReactAndroid/build/intermediates/library_jni
        NO_DEFAULT_PATH)
    if(JSI_LIB)
        target_link_libraries(clarihear_dsp ${JSI_LIB})
    else()
        # Fallback: link by name (Gradle will resolve it via prefab)
        target_link_libraries(clarihear_dsp jsi)
    endif()
endif()

# ──────────────────────────────────────────────────────────────
#  React Native JSI headers — provided by the RN build system.
#  ${REACT_NATIVE_DIR} is set in build.gradle.kts via:
#    cmake { arguments "-DREACT_NATIVE_DIR=..." }
# ──────────────────────────────────────────────────────────────
if(DEFINED REACT_NATIVE_DIR)
    target_include_directories(clarihear_dsp PRIVATE
        ${DSP_ROOT}/jsi                                              # our HostObject header
        ${REACT_NATIVE_DIR}/ReactAndroid/src/main/jni/react/jni
        ${REACT_NATIVE_DIR}/ReactCommon
        ${REACT_NATIVE_DIR}/ReactCommon/jsi
        ${REACT_NATIVE_DIR}/ReactCommon/callinvoker
    )
endif()
