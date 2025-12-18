from PIL import Image, ImageDraw, ImageFont
import os

def create_icon(size, filename, primary_color, secondary_color):
    """指定されたサイズでアイコンを生成"""
    # 新しい画像を作成（透明背景のRGBA）
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # 背景円を描画
    draw.ellipse([(0, 0), (size, size)], fill=primary_color)
    
    # 中央のバランス記号（天秤）を描画
    center = size // 2
    line_width = max(size // 10, 1)
    
    # 棒（横線）
    draw.rectangle([(size//4, center), (size*3//4, center + line_width)], fill=secondary_color)
    
    # 支点（丸）
    pivot_radius = size // 8
    draw.ellipse([(center - pivot_radius, center - pivot_radius), 
                  (center + pivot_radius, center + pivot_radius)], fill=secondary_color)
    
    # 左右の皿（小さな丸）
    dish_radius = size // 6
    draw.ellipse([(size//3 - dish_radius, center - size//5), 
                  (size//3 + dish_radius, center + size//5)], fill=secondary_color)
    draw.ellipse([(size*2//3 - dish_radius, center - size//5), 
                  (size*2//3 + dish_radius, center + size//5)], fill=secondary_color)
    
    # 画像を保存
    img.save(filename)

# アイコンのサイズと名前
sizes = [
    (16, "icon16.png"),
    (48, "icon48.png"),
    (128, "icon128.png")
]

# アイコンを生成
for size, filename in sizes:
    create_icon(
        size=size,
        filename=filename,
        primary_color=(70, 130, 180, 255),  # Steel Blue
        secondary_color=(255, 255, 255, 255)  # White
    )

print("アイコンファイルが生成されました:")
for _, filename in sizes:
    print(f"- {filename}")