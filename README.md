# Fit or Feast

A free, static browser visual-novel gacha game. Pull loot, go to work for coins, and steer **Mira Solenne** toward a muscle path or a weight-gain path. No build step, no paid services, and no server — just open the files.

## Play

- **Local:** open `index.html` in a browser (double-click it, or drag it into a tab). It works from `file://`.
- **GitHub Pages:** upload this folder (or push the repo) and set Pages to deploy from the root of the branch. The site is ready as-is; all asset paths are relative.

Progress is saved in `localStorage` under the key `fitOrFeast.save.v1`. Use the **?** button in the header if you want to reset.

## Character

The roster has five original adult characters. Each has eight stages and a `bodyType` tag so future sets can be grouped.

| Id | Name | Job | Rarity | bodyType | Art | Base weight |
| --- | --- | --- | --- | --- | --- | --- |
| mira | Mira Solenne | Gym receptionist | SSR | balanced | Pixel-art VN card | 60 kg |
| june | June Hale | Bartender | SSR | top-heavy | Clean anime | 62 kg |
| sable | Sable Reed | Librarian | SR | top-heavy | Clean anime | 58 kg |
| noor | Noor El-Amin | Clinic nurse | SR | top-heavy | Clean anime | 61 kg |
| tess | Tess Okada | Office analyst | SSR | top-heavy | Clean anime | 59 kg |

You start with **Mira** already on your roster, **1000 coins**, a garden salad, a slice of chocolate cake, and one workout day pass. The other four are unlocked by pulling (the 4% character drop picks uniformly from the roster; duplicates pay coins).

Top-heavy fat stages put added weight in the chest and upper body first, then the whole figure. Clothes stay fully on and closed.

Contact sheets: `preview-stages.jpg` (Mira), `preview-june.jpg`, `preview-sable.jpg`, `preview-noor.jpg`, `preview-tess.jpg`.


## Mechanics

### Economy

| Action | Effect |
| --- | --- |
| **Pull** | Costs **100 coins**. Rolls the loot table below. |
| **10× Pull** | Costs **900 coins** (10 pulls at **10% off**). Results appear in a 10-card grid with a staggered reveal. You can reroll any individual result if you have a token. |
| **Go to Work** | Grants **100 coins**. **2.0s** cooldown with a progress bar so it feels like a shift. One shift pays for one single pull; nine shifts pay for a 10× pull. |
| Duplicate character | If you pull a character you already own, you receive **200 coins** instead (two shifts). |
| **Reroll token** | After a pull (or on any card in a 10× pull), spend a token to roll that result again without paying more coins. Keep / Keep all commits the results. You may spend a token you just pulled. |

### Loot odds

| Result | Chance |
| --- | --- |
| Character | **4%** |
| Consumable food (healthy or junk, uniform among all foods) | **72%** |
| Workout day pass | **20%** |
| Reroll token | **4%** |

### Foods and workouts

Healthy foods lower weight slightly and raise **fitness**. Junk foods raise **weight** (and may dip fitness). Workout day passes cut weight and raise fitness more.

| Item | Type | Weight | Fitness |
| --- | --- | --- | --- |
| Garden Salad | Healthy | −0.8 kg | +2 |
| Grilled Chicken | Healthy | −1.0 kg | +3 |
| Protein Smoothie | Healthy | −0.5 kg | +2 |
| Fruit Bowl | Healthy | −0.6 kg | +1 |
| Veggie Wrap | Healthy | −0.7 kg | +2 |
| Double Burger | Junk | +3.5 kg | −1 |
| Chocolate Cake | Junk | +3.0 kg | −0.5 |
| Loaded Fries | Junk | +2.5 kg | −0.5 |
| Sugar Boba | Junk | +2.0 kg | — |
| Pizza Slice | Junk | +3.2 kg | −0.5 |
| Ice Cream Sundae | Junk | +2.8 kg | — |
| Donut Box | Junk | +4.0 kg | −1 |
| Workout Day Pass | Workout | −2.5 kg | +4 |

Weight cannot fall below **85%** of a character's base weight (51.0 kg for Mira).

### Growth stages (8 images)

Each character has **1 base**, **2 muscle/fit** stages, and **5 fat** stages.

**Muscle path** — accumulated fitness from healthy food and workouts:

- **Toned (Fit 1)** at **10** fitness
- **Athletic (Fit 2)** at **24** fitness

**Fat path** — body weight must rise about **15%** over the previous stage threshold (compounding, within the requested 10–25% band). Mira's base weight is **60.0 kg**:

- **Soft (Fat 1)** at **69.00 kg**
- **Chubby (Fat 2)** at **79.35 kg**
- **Plump (Fat 3)** at **91.2525 kg**
- **Heavy (Fat 4)** at **104.9404 kg**
- **Very Heavy (Fat 5)** at **120.6815 kg**

If weight is high enough for a fat stage, that sprite is shown even if fitness is also high. Workouts and healthy food can bring weight back under the threshold and return her to a fit or base sprite.

The character screen shows current weight, a stage badge, two progress bars (weight toward the next fat threshold, fitness toward the next muscle stage), and visual-novel dialogue that changes with the stage. Tap the dialogue box for another line.

Sprites are pixel art and are scaled with `image-rendering: pixelated`.

## How to add a new character

Adding someone new should only take images plus one data entry. No engine changes.

1. Create a folder `assets/characters/<id>/` where `<id>` is a short lowercase slug, for example `assets/characters/reno/`.
2. Add **exactly these eight filenames** (WebP or JPG is fine; keep each file under ~400 KB):

   - `base.webp` — starting figure
   - `fit1.webp` — toned
   - `fit2.webp` — clearly muscular
   - `fat1.webp` … `fat5.webp` — each step visibly heavier

   Use the same face, hair, outfit, colors, pose, and framing on every stage so swaps look clean. Prefer a tall 9:16 full-body or ¾ standing sprite and a simple two-tone background.

3. Append one object to the array in `data/characters.js`. Example:

```javascript
{
  id: "reno",
  name: "Reno Hale",
  shortName: "Reno",
  rarity: "SR",
  baseWeight: 72,
  bio: "A short bio shown on their roster page.",
  images: {
    base: "assets/characters/reno/base.webp",
    fit1: "assets/characters/reno/fit1.webp",
    fit2: "assets/characters/reno/fit2.webp",
    fat1: "assets/characters/reno/fat1.webp",
    fat2: "assets/characters/reno/fat2.webp",
    fat3: "assets/characters/reno/fat3.webp",
    fat4: "assets/characters/reno/fat4.webp",
    fat5: "assets/characters/reno/fat5.webp"
  },
  dialogue: {
    base: ["A line for the starting stage."],
    fit1: ["Toned."],
    fit2: ["Athletic."],
    fat1: ["Soft."],
    fat2: ["Chubby."],
    fat3: ["Plump."],
    fat4: ["Heavy."],
    fat5: ["Very heavy."]
  }
}
```

4. Reload `index.html`. The new character appears as a locked silhouette on the Roster until you pull them (the 4% character drop picks uniformly from everyone in `GAME_CHARACTERS`).

Optional fields: `bodyType` (for grouping future sets, e.g. `"top-heavy"` or `"balanced"`), `artStyle` (`"pixel"` uses crisp nearest-neighbor scaling; `"anime"` uses smooth scaling), and `job` (shown on the character page).

`data/characters.js` is a regular script that sets `window.GAME_CHARACTERS`, so it loads from `file://` with no server and no `fetch`. The same pattern is used for `data/items.js` and `data/config.js` if you want to add foods or tweak costs and odds.

## Project layout

```
index.html                 # game shell
css/style.css
data/config.js             # costs, odds, stage thresholds
data/items.js              # foods, workout passes, reroll tokens
data/characters.js         # roster (add characters here)
js/engine.js               # drops + growth math (browser + Node)
js/save.js                 # localStorage
js/game.js                 # UI
assets/characters/<id>/    # 8 stage images per character
preview-stages.jpg         # contact sheet of Mira's 8 stages
tests/simulate-pulls.js    # 10,000-pull odds check
```

## Tests

From this folder, with Node.js:

```bash
node --check data/config.js data/items.js data/characters.js js/engine.js js/save.js js/game.js tests/simulate-pulls.js
node tests/simulate-pulls.js
```

The simulation prints observed vs expected category rates (tolerance: 1 percentage point) and a quick growth-path sanity check.

## Credits

Original character and writing for this project. Pixel-art style inspired by visual-novel character cards; Mira is not based on any existing commercial character.
