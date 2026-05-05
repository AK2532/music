from PIL import Image

def process_image():
    img_path = r'd:\E\stuff\music\android\app\asset\image.png'
    out_path = r'd:\E\stuff\music\android\app\asset\logo_transparent.png'
    out_public_path = r'd:\E\stuff\music\public\logo.png'
    
    img = Image.open(img_path).convert('RGBA')
    pixels = img.load()
    width, height = img.size
    
    # We assume the top-left 50x50 area contains the background checkerboard colors.
    bg_colors = []
    for x in range(min(50, width)):
        for y in range(min(50, height)):
            color = pixels[x, y]
            # Group colors by RGB values, ignoring alpha for background detection
            r, g, b, a = color
            if a > 0:
                found = False
                for bc in bg_colors:
                    if abs(bc[0]-r) < 15 and abs(bc[1]-g) < 15 and abs(bc[2]-b) < 15:
                        found = True
                        break
                if not found:
                    bg_colors.append((r,g,b))
    
    print("Found background colors:", bg_colors)
    
    # Let's just make all pixels that are "light" (R>200, G>200, B>200) transparent, 
    # but ONLY if we do a flood fill from the borders to preserve white text inside.
    
    # Create a mask for flood fill
    # We will start from all borders.
    visited = set()
    stack = []
    
    # Add border pixels to stack
    for x in range(width):
        stack.append((x, 0))
        stack.append((x, height - 1))
    for y in range(height):
        stack.append((0, y))
        stack.append((width - 1, y))
        
    while stack:
        x, y = stack.pop()
        if (x, y) in visited:
            continue
            
        visited.add((x, y))
        
        r, g, b, a = pixels[x, y]
        
        # Check if it matches any background color or is generally "light" and non-black
        # The app logo is mostly dark.
        # Background is white/grey checkerboard. Let's assume background is anything with R>150, G>150, B>150.
        if r > 150 and g > 150 and b > 150:
            pixels[x, y] = (0, 0, 0, 0)
            
            # Add neighbors
            for dx, dy in [(0, 1), (1, 0), (0, -1), (-1, 0)]:
                nx, ny = x + dx, y + dy
                if 0 <= nx < width and 0 <= ny < height and (nx, ny) not in visited:
                    stack.append((nx, ny))
                    
    img.save(out_path)
    img.save(out_public_path)
    print("Image saved successfully to", out_path, "and", out_public_path)

if __name__ == '__main__':
    process_image()
