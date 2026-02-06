export interface ThemeCategory {
  name: string;
  nameMyanmar: string;
  themes: Theme[];
}

export interface Theme {
  id: string;
  name: string;
  prompt: string;
}

export const THEME_CATEGORIES: ThemeCategory[] = [
  {
    name: "Luxury",
    nameMyanmar: "အဆင့်မြင့်",
    themes: [
      { id: "lux_marble", name: "Marble Stand", prompt: "elegant marble pedestal, luxury product photography, studio lighting" },
      { id: "lux_gold_silk", name: "Gold & Silk", prompt: "golden silk fabric backdrop, premium product photography, warm lighting" },
      { id: "lux_velvet", name: "Velvet Shadow", prompt: "dark velvet background, dramatic shadows, luxury product display" },
      { id: "lux_penthouse", name: "Penthouse View", prompt: "penthouse window view, city skyline backdrop, luxury setting" },
      { id: "lux_crystal", name: "Crystal Clear", prompt: "crystal glass surface, reflective, clean luxury aesthetic" },
      { id: "lux_minimal_white", name: "Minimalist White", prompt: "pure white minimalist background, clean product photography" },
      { id: "lux_obsidian", name: "Dark Obsidian", prompt: "dark obsidian surface, moody luxury lighting, premium feel" },
      { id: "lux_palace", name: "Royal Palace", prompt: "royal palace interior, ornate gold details, regal backdrop" },
      { id: "lux_leather", name: "Premium Leather", prompt: "premium leather surface, rich brown tones, sophisticated" },
      { id: "lux_champagne", name: "Champagne Glow", prompt: "champagne gold warm glow, soft bokeh, luxurious atmosphere" },
    ],
  },
  {
    name: "Nature",
    nameMyanmar: "သဘာဝ",
    themes: [
      { id: "nat_tropical", name: "Tropical Forest", prompt: "lush tropical forest background, green leaves, natural light" },
      { id: "nat_garden", name: "Sun-drenched Garden", prompt: "sunny garden setting, flowers, warm natural daylight" },
      { id: "nat_mossy", name: "Mossy Rocks", prompt: "moss-covered rocks, forest floor, earthy natural backdrop" },
      { id: "nat_mountain", name: "Mountain Peak", prompt: "mountain peak vista, clear sky, dramatic alpine landscape" },
      { id: "nat_autumn", name: "Autumn Leaves", prompt: "autumn fallen leaves, warm orange red tones, seasonal" },
      { id: "nat_spring", name: "Spring Bloom", prompt: "spring cherry blossoms, pink petals, fresh spring light" },
      { id: "nat_desert", name: "Desert Sands", prompt: "golden desert sand dunes, warm sunset tones, vast landscape" },
      { id: "nat_lake", name: "Lakeside Morning", prompt: "calm lake at dawn, misty mountains, serene peaceful" },
      { id: "nat_bamboo", name: "Bamboo Grove", prompt: "bamboo grove, dappled sunlight, zen tranquil atmosphere" },
      { id: "nat_pine", name: "Pine Forest", prompt: "pine forest, tall trees, soft diffused woodland light" },
    ],
  },
  {
    name: "Studio",
    nameMyanmar: "စတူဒီယို",
    themes: [
      { id: "stu_softbox", name: "Softbox Lighting", prompt: "professional softbox studio lighting, clean white background" },
      { id: "stu_neon", name: "Neon Gradient", prompt: "neon gradient background, vibrant purple blue glow, modern" },
      { id: "stu_pastel", name: "Solid Pastel", prompt: "soft pastel colored background, clean minimal product shot" },
      { id: "stu_highkey", name: "High-Key White", prompt: "high-key white studio, bright even lighting, commercial" },
      { id: "stu_loft", name: "Industrial Loft", prompt: "industrial loft with exposed brick, modern urban studio" },
      { id: "stu_bokeh", name: "Bokeh Street", prompt: "street bokeh lights background, shallow depth of field" },
      { id: "stu_abstract", name: "Abstract Geometry", prompt: "abstract geometric shapes background, modern design" },
      { id: "stu_concrete", name: "Concrete Minimalist", prompt: "concrete minimalist surface, industrial clean aesthetic" },
      { id: "stu_pedestal", name: "Product Pedestal", prompt: "product on white pedestal, gradient background, spotlight" },
      { id: "stu_3point", name: "3-Point Lighting", prompt: "professional 3-point lighting setup, studio photography" },
    ],
  },
  {
    name: "Lifestyle",
    nameMyanmar: "လူနေမှုပုံစံ",
    themes: [
      { id: "life_cafe", name: "Cozy Cafe", prompt: "cozy cafe interior, warm ambient light, coffee shop vibes" },
      { id: "life_kitchen", name: "Modern Kitchen", prompt: "modern kitchen counter, clean bright interior, home setting" },
      { id: "life_dining", name: "Wooden Dining Table", prompt: "wooden dining table, natural light from window, rustic" },
      { id: "life_office", name: "Office Desk", prompt: "clean office desk setup, modern workspace, professional" },
      { id: "life_bedside", name: "Bedside Table", prompt: "bedside table, cozy bedroom, soft morning light" },
      { id: "life_living", name: "Living Room Rug", prompt: "living room rug, comfortable home setting, warm tones" },
      { id: "life_window", name: "Sunlit Window", prompt: "sunlit window sill, bright natural daylight, airy" },
      { id: "life_balcony", name: "Balcony Breeze", prompt: "balcony with city view, fresh air, outdoor living" },
      { id: "life_library", name: "Library Shelf", prompt: "library bookshelves background, intellectual, warm wood" },
      { id: "life_yoga", name: "Yoga Studio", prompt: "zen yoga studio, calm minimal space, peaceful atmosphere" },
    ],
  },
  {
    name: "Seasonal",
    nameMyanmar: "ရာသီအလိုက်",
    themes: [
      { id: "sea_christmas", name: "Christmas Sparkle", prompt: "christmas decorations, sparkling lights, festive red green" },
      { id: "sea_newyear", name: "New Year Fireworks", prompt: "new year fireworks, celebration backdrop, sparkle" },
      { id: "sea_summer", name: "Summer Beach", prompt: "summer beach, sandy shore, blue ocean, bright sunlight" },
      { id: "sea_rainy", name: "Rainy Window", prompt: "rainy window with water droplets, moody cozy atmosphere" },
      { id: "sea_snowy", name: "Snowy Winter", prompt: "snowy winter landscape, white snow, cold blue tones" },
      { id: "sea_golden", name: "Golden Hour", prompt: "golden hour sunset, warm amber orange light, magical" },
      { id: "sea_halloween", name: "Halloween Spooky", prompt: "halloween spooky atmosphere, orange pumpkins, dark moody" },
      { id: "sea_diwali", name: "Diwali Lights", prompt: "diwali festival lights, colorful diyas, festive celebration" },
      { id: "sea_cherry", name: "Cherry Blossom", prompt: "cherry blossom trees, pink sakura petals falling, spring" },
      { id: "sea_autumn_sun", name: "Autumn Sunset", prompt: "autumn sunset, warm golden orange sky, seasonal beauty" },
    ],
  },
  {
    name: "Artistic",
    nameMyanmar: "အနုပညာ",
    themes: [
      { id: "art_watercolor", name: "Watercolor Splash", prompt: "watercolor splash background, artistic paint strokes" },
      { id: "art_cyberpunk", name: "Cyberpunk City", prompt: "cyberpunk neon city, futuristic, dark with neon lights" },
      { id: "art_retro80", name: "Retro 80s", prompt: "retro 80s aesthetic, synthwave colors, vintage vibes" },
      { id: "art_clouds", name: "Dreamy Clouds", prompt: "dreamy soft clouds, ethereal sky, pastel dreamscape" },
      { id: "art_underwater", name: "Under-water Effect", prompt: "underwater effect, blue light caustics, aquatic" },
      { id: "art_space", name: "Space Nebula", prompt: "space nebula, cosmic stars, deep purple galaxy" },
      { id: "art_oil", name: "Oil Painting BG", prompt: "oil painting textured background, classical art style" },
      { id: "art_popart", name: "Pop Art", prompt: "pop art style, bold colors, comic dot pattern" },
      { id: "art_sketch", name: "Sketch Paper", prompt: "sketch paper texture, pencil drawing background, artistic" },
      { id: "art_holo", name: "Holographic", prompt: "holographic iridescent background, rainbow shimmer, futuristic" },
    ],
  },
];
