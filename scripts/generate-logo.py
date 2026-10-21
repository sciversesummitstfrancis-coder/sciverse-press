#!/usr/bin/env python3
"""Generate the Sciverse Press launcher logo and all Android icon densities.

Outputs:
  mobile/assets/icon.png            1024x1024 master (legacy + splash)
  mobile/assets/adaptive-icon.png   1024x1024 adaptive foreground (safe zone)
  mobile/assets/icon-round.png      1024x1024 circular master
  mobile/android/app/src/main/res/mipmap-*/ic_launcher.png
  mobile/android/app/src/main/res/mipmap-*/ic_launcher_round.png
"""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "mobile", "assets")
RES = os.path.join(ROOT, "mobile", "android", "app", "src", "main", "res")

BG = (12, 12, 16, 255)
ACCENT = (255, 165, 0, 255)
S = 1024

FONT_CANDIDATES = [
    "/usr/share/fonts/liberation-sans-fonts/LiberationSans-Bold.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/open-sans/OpenSans-Bold.ttf",
    "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
    "/usr/share/fonts/adobe-source-sans-pro-fonts/SourceSans3-Bold.otf",
    "/usr/share/fonts/julietaula-montserrat-fonts/Montserrat-Bold.otf",
]


def font(size):
    for path in FONT_CANDIDATES:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def draw_mark(size, padding_ratio=0.0, circular=False):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    inset = int(size * padding_ratio)
    box = (inset, inset, size - inset, size - inset)
    if circular:
        d.ellipse(box, fill=BG)
    else:
        d.rounded_rectangle(box, radius=int(size * 0.22), fill=BG)

    # accent ring
    ring_pad = int(size * (0.14 + padding_ratio))
    d.ellipse(
        (ring_pad, ring_pad, size - ring_pad, size - ring_pad),
        outline=ACCENT,
        width=max(2, int(size * 0.018)),
    )

    # "SP" wordmark
    f = font(int(size * 0.34))
    text = "SP"
    bbox = d.textbbox((0, 0), text, font=f)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text(((size - w) / 2 - bbox[0], (size - h) / 2 - bbox[1]), text, fill=ACCENT, font=f)

    # accent underline
    bar_w = int(size * 0.34)
    bar_h = max(2, int(size * 0.022))
    d.rectangle(
        ((size - bar_w) / 2, size * 0.68, (size + bar_w) / 2, size * 0.68 + bar_h),
        fill=ACCENT,
    )
    return img


def main():
    os.makedirs(ASSETS, exist_ok=True)

    master = draw_mark(S)
    master.save(os.path.join(ASSETS, "icon.png"))

    adaptive = draw_mark(S, padding_ratio=0.14)
    adaptive.save(os.path.join(ASSETS, "adaptive-icon.png"))

    round_master = draw_mark(S, circular=True)
    round_master.save(os.path.join(ASSETS, "icon-round.png"))

    sizes = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
    for density, size in sizes.items():
        out = os.path.join(RES, f"mipmap-{density}")
        os.makedirs(out, exist_ok=True)
        master.resize((size, size), Image.LANCZOS).save(os.path.join(out, "ic_launcher.png"))
        round_master.resize((size, size), Image.LANCZOS).save(
            os.path.join(out, "ic_launcher_round.png")
        )
        print(f"mipmap-{density}: {size}x{size}")

    print("assets/icon.png, assets/adaptive-icon.png, assets/icon-round.png written")


if __name__ == "__main__":
    main()
