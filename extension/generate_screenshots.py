from PIL import Image, ImageDraw, ImageFont
import os

# Screenshot dimensions
WIDTH, HEIGHT = 1280, 800

# Colors
BG_DARK = (15, 15, 20)
BG_CARD = (30, 30, 40)
BRAND_BLUE = (59, 130, 246)
BRAND_LIGHT = (96, 165, 250)
TEXT_WHITE = (255, 255, 255)
TEXT_GRAY = (156, 163, 175)
GREEN = (34, 197, 94)
RED = (239, 68, 68)
PURPLE = (168, 85, 247)
ORANGE = (249, 115, 22)

os.makedirs('screenshots', exist_ok=True)

def create_base_image():
    img = Image.new('RGB', (WIDTH, HEIGHT), BG_DARK)
    return img, ImageDraw.Draw(img)

def draw_rounded_rect(draw, coords, fill, radius=10):
    x1, y1, x2, y2 = coords
    draw.rectangle([x1+radius, y1, x2-radius, y2], fill=fill)
    draw.rectangle([x1, y1+radius, x2, y2-radius], fill=fill)
    draw.ellipse([x1, y1, x1+radius*2, y1+radius*2], fill=fill)
    draw.ellipse([x2-radius*2, y1, x2, y1+radius*2], fill=fill)
    draw.ellipse([x1, y2-radius*2, x1+radius*2, y2], fill=fill)
    draw.ellipse([x2-radius*2, y2-radius*2, x2, y2], fill=fill)

def add_logo(img, x, y, size=60):
    try:
        logo = Image.open('public/icons/icon128.png')
        logo = logo.resize((size, size), Image.LANCZOS)
        if logo.mode == 'RGBA':
            bg = Image.new('RGB', logo.size, BG_DARK)
            bg.paste(logo, mask=logo.split()[3])
            img.paste(bg, (x, y))
        else:
            img.paste(logo, (x, y))
    except Exception as e:
        print(f"Could not load logo: {e}")

def get_font(size):
    try:
        return ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", size)
    except:
        try:
            return ImageFont.truetype("C:/Windows/Fonts/arial.ttf", size)
        except:
            return ImageFont.load_default()

# Screenshot 1: Main Dashboard
def create_dashboard():
    img, draw = create_base_image()

    # Side panel simulation (left side)
    draw_rounded_rect(draw, (40, 40, 440, 760), BG_CARD, 20)

    # Header
    add_logo(img, 60, 60, 50)
    draw.text((120, 70), "TabBrain", fill=TEXT_WHITE, font=get_font(28))

    # Feature cards
    features = [
        ("Find Duplicates", "12 duplicates found", RED),
        ("Organize Windows", "8 windows to label", BRAND_BLUE),
        ("Smart Grouping", "Auto-categorize tabs", PURPLE),
        ("Clean Bookmarks", "Organize 234 bookmarks", GREEN),
    ]

    y = 160
    for title, desc, color in features:
        draw_rounded_rect(draw, (60, y, 420, y+100), (40, 40, 50), 15)
        draw.ellipse([80, y+30, 110, y+60], fill=color)
        draw.text((130, y+25), title, fill=TEXT_WHITE, font=get_font(20))
        draw.text((130, y+55), desc, fill=TEXT_GRAY, font=get_font(14))
        y += 120

    # Right side - Browser mockup
    draw_rounded_rect(draw, (480, 40, 1240, 760), (25, 25, 35), 20)
    draw.text((500, 60), "Your Browser Tabs", fill=TEXT_GRAY, font=get_font(16))

    # Tab examples
    tabs = ["GitHub - Project", "Stack Overflow", "React Docs", "YouTube", "Gmail", "Amazon Cart"]
    y = 100
    for tab in tabs:
        draw_rounded_rect(draw, (500, y, 1220, y+60), (35, 35, 45), 10)
        draw.ellipse([520, y+18, 544, y+42], fill=BRAND_BLUE)
        draw.text((560, y+18), tab, fill=TEXT_WHITE, font=get_font(18))
        y += 80

    # Headline on right
    draw.text((600, 620), "AI-Powered Tab Management", fill=TEXT_WHITE, font=get_font(32))
    draw.text((600, 670), "Organize hundreds of tabs intelligently", fill=TEXT_GRAY, font=get_font(18))

    img.save('screenshots/1-dashboard.png', 'PNG')
    print("Created 1-dashboard.png")

# Screenshot 2: Duplicate Finder
def create_duplicates():
    img, draw = create_base_image()

    # Header
    add_logo(img, 540, 40, 60)
    draw.text((620, 50), "Find & Remove Duplicates", fill=TEXT_WHITE, font=get_font(36))
    draw.text((540, 110), "Instantly detect duplicate tabs and bookmarks across all windows", fill=TEXT_GRAY, font=get_font(18))

    # Duplicate groups
    y = 180
    groups = [
        ("github.com/repo/issues", 3, ["Window 1", "Window 3", "Window 5"]),
        ("stackoverflow.com/questions/123", 2, ["Window 2", "Window 4"]),
        ("docs.react.dev/hooks", 4, ["Window 1", "Window 2", "Window 3", "Window 6"]),
    ]

    for url, count, windows in groups:
        draw_rounded_rect(draw, (100, y, 1180, y+150), BG_CARD, 15)
        draw.ellipse([130, y+20, 170, y+60], fill=RED)
        draw.text((142, y+28), str(count), fill=TEXT_WHITE, font=get_font(20))
        draw.text((200, y+25), url, fill=TEXT_WHITE, font=get_font(20))
        draw.text((200, y+60), f"Found in: {', '.join(windows)}", fill=TEXT_GRAY, font=get_font(14))

        # Checkboxes
        draw_rounded_rect(draw, (900, y+90, 1050, y+130), GREEN, 8)
        draw.text((920, y+98), "Keep First", fill=TEXT_WHITE, font=get_font(14))
        draw_rounded_rect(draw, (1060, y+90, 1160, y+130), RED, 8)
        draw.text((1075, y+98), "Close All", fill=TEXT_WHITE, font=get_font(14))
        y += 170

    # Stats
    draw_rounded_rect(draw, (100, 700, 400, 760), BRAND_BLUE, 10)
    draw.text((150, 715), "9 Duplicates Found", fill=TEXT_WHITE, font=get_font(22))

    img.save('screenshots/2-duplicates.png', 'PNG')
    print("Created 2-duplicates.png")

# Screenshot 3: Window Organizer
def create_windows():
    img, draw = create_base_image()

    add_logo(img, 540, 40, 60)
    draw.text((620, 50), "Smart Window Labels", fill=TEXT_WHITE, font=get_font(36))
    draw.text((480, 110), "AI automatically detects what you're working on in each window", fill=TEXT_GRAY, font=get_font(18))

    # Window cards
    windows = [
        ("Window 1", "React Development", ["React Docs", "GitHub PR", "Stack Overflow"], BRAND_BLUE),
        ("Window 2", "Online Shopping", ["Amazon", "eBay", "Best Buy"], GREEN),
        ("Window 3", "Research Papers", ["Google Scholar", "arXiv", "ResearchGate"], PURPLE),
        ("Window 4", "Entertainment", ["YouTube", "Netflix", "Spotify"], ORANGE),
    ]

    x, y = 80, 180
    for i, (win, topic, tabs, color) in enumerate(windows):
        draw_rounded_rect(draw, (x, y, x+540, y+260), BG_CARD, 15)
        draw.text((x+20, y+15), win, fill=TEXT_GRAY, font=get_font(14))

        # AI suggested topic
        draw_rounded_rect(draw, (x+20, y+45, x+520, y+95), (40, 40, 55), 10)
        draw.text((x+40, y+58), f'AI Suggests: "{topic}"', fill=color, font=get_font(20))

        # Tab list
        ty = y + 110
        for tab in tabs:
            draw.ellipse([x+30, ty+2, x+46, ty+18], fill=(50, 50, 60))
            draw.text((x+55, ty), tab, fill=TEXT_WHITE, font=get_font(14))
            ty += 28

        # Accept button
        draw_rounded_rect(draw, (x+350, y+210, x+520, y+245), color, 8)
        draw.text((x+395, y+218), "Accept", fill=TEXT_WHITE, font=get_font(16))

        if i == 1:
            x = 80
            y = 460
        else:
            x += 580

    img.save('screenshots/3-windows.png', 'PNG')
    print("Created 3-windows.png")

# Screenshot 4: Tab Grouping
def create_grouping():
    img, draw = create_base_image()

    add_logo(img, 540, 40, 60)
    draw.text((620, 50), "Auto Tab Grouping", fill=TEXT_WHITE, font=get_font(36))
    draw.text((460, 110), "Automatically organize tabs into Chrome tab groups by category", fill=TEXT_GRAY, font=get_font(18))

    # Category groups
    categories = [
        ("Technology", BRAND_BLUE, ["GitHub", "Stack Overflow", "Dev.to", "MDN Docs"]),
        ("Shopping", GREEN, ["Amazon", "eBay", "Etsy"]),
        ("Social", PURPLE, ["Twitter", "LinkedIn", "Reddit"]),
        ("News", RED, ["CNN", "BBC", "TechCrunch"]),
        ("Entertainment", ORANGE, ["YouTube", "Netflix", "Twitch"]),
    ]

    y = 180
    for cat, color, tabs in categories:
        # Category header
        draw_rounded_rect(draw, (100, y, 1180, y+45), color, 8)
        draw.text((130, y+10), cat, fill=TEXT_WHITE, font=get_font(20))
        draw.text((1050, y+12), f"{len(tabs)} tabs", fill=TEXT_WHITE, font=get_font(14))

        # Tabs in group
        x = 120
        for tab in tabs:
            draw_rounded_rect(draw, (x, y+55, x+150, y+90), BG_CARD, 6)
            draw.text((x+15, y+63), tab, fill=TEXT_WHITE, font=get_font(14))
            x += 165

        y += 115

    # Action button
    draw_rounded_rect(draw, (490, 720, 790, 770), BRAND_BLUE, 10)
    draw.text((530, 733), "Create All Groups", fill=TEXT_WHITE, font=get_font(22))

    img.save('screenshots/4-grouping.png', 'PNG')
    print("Created 4-grouping.png")

# Screenshot 5: AI Settings
def create_settings():
    img, draw = create_base_image()

    add_logo(img, 540, 40, 60)
    draw.text((620, 50), "Flexible AI Integration", fill=TEXT_WHITE, font=get_font(36))
    draw.text((440, 110), "Use any AI provider - cloud APIs or local models with Ollama", fill=TEXT_GRAY, font=get_font(18))

    # Provider options
    providers = [
        ("OpenAI", "GPT-4, GPT-3.5", "Cloud API", BRAND_BLUE),
        ("Anthropic", "Claude 3.5, Claude 3", "Cloud API", PURPLE),
        ("Ollama", "Llama, Mistral, Qwen", "Local - Free", GREEN),
        ("OpenRouter", "100+ Models", "Cloud API", ORANGE),
    ]

    x, y = 100, 200
    for name, models, type_, color in providers:
        draw_rounded_rect(draw, (x, y, x+520, y+120), BG_CARD, 15)
        draw.ellipse([x+20, y+35, x+70, y+85], fill=color)
        draw.text((x+90, y+30), name, fill=TEXT_WHITE, font=get_font(24))
        draw.text((x+90, y+65), models, fill=TEXT_GRAY, font=get_font(14))
        draw_rounded_rect(draw, (x+380, y+40, x+500, y+80), (50, 50, 60), 8)
        draw.text((x+400, y+50), type_, fill=TEXT_WHITE, font=get_font(14))

        if x == 100:
            x = 660
        else:
            x = 100
            y += 140

    # Privacy note
    draw_rounded_rect(draw, (200, 620, 1080, 720), (30, 40, 35), 15)
    draw.text((250, 645), "Your data never leaves your browser", fill=TEXT_WHITE, font=get_font(20))
    draw.text((250, 680), "AI processes locally or via your own API keys - Full privacy control", fill=GREEN, font=get_font(16))

    img.save('screenshots/5-settings.png', 'PNG')
    print("Created 5-settings.png")

# Generate all screenshots
if __name__ == '__main__':
    create_dashboard()
    create_duplicates()
    create_windows()
    create_grouping()
    create_settings()
    print("\nAll screenshots created in screenshots/ folder")
