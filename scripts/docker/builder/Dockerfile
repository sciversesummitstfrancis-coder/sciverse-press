FROM fedora:40

# System build deps for Tauri (webkit2gtk, tray, svg), a C toolchain,
# mingw for the Windows cross-build, and node for the frontend.
RUN dnf -y install \
      gcc gcc-c++ make pkgconf-pkg-config \
      webkit2gtk4.1-devel \
      libappindicator-gtk3-devel \
      librsvg2-devel \
      openssl-devel \
      cairo-devel \
      gtk3-devel \
      libxdo-devel \
      xz file wget \
      nodejs npm \
      mingw64-gcc mingw64-winpthreads-static \
      mingw64-headers \
      mingw-nsis-base \
 && dnf clean all

# Rust toolchain + Windows target
ENV RUSTUP_HOME=/opt/rustup CARGO_HOME=/opt/cargo
ENV PATH=/opt/cargo/bin:$PATH
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --no-modify-path \
 && rustup target add x86_64-pc-windows-msvc \
 && cargo install cargo-xwin --locked

WORKDIR /workspace/desktop
