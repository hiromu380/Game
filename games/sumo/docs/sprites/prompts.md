# プロンプト集（Gemini の画像生成用）

[spec.md](spec.md) の決まりで、部屋の全景の絵を Gemini（Nano Banana）で作るためのプロンプト。英語のまま貼り付ける（画像モデルは英語の指示のほうが崩れにくい）。

## 使い方

1. **最初に「見本」を作る**（下の「0. 見本」）。何枚か作って、いちばん好みの1枚を選び `client/sprites/raw/_reference.png` として保存する
2. 以後はどの素材も、**見本の画像を添付してから**、「共通の文」＋「素材の文」を貼る
3. 1回に1つの素材。気に入らなければ、同じ会話で直してほしい点だけを短く言う（下の「直すときの言い方」）
4. よい1枚ができたら、ID の名前で保存して `client/sprites/raw/` に置く（例: `pine.png`、`rikishi_shiko__kuro.png`）
5. 取り込む: リポジトリ直下で `python3 games/sumo/client/build/import-sprites.py`

おすすめ: 下書きは Nano Banana 2（速い）、本番は Nano Banana Pro（細部と一貫性が強い）。縦横比は各プロンプトの「比率」に合わせる。

## 共通の文（毎回、素材の文の前に貼る）

```
Use the attached reference image as the strict style guide: same line weight, same colors, same camera angle, same proportions.
Style: cute deformed ukiyo-e (nishiki-e woodblock print) look, rendered as clean pixel-art-like game sprite. Flat color areas, bold dark sumi-ink outlines, only one step of shading (light side and shadow side), no gradients, no gloss, no photorealism, no 3D-render look. Traditional Japanese muted palette: sumi ink #2a2420, washi paper #f4ecdc, indigo #1f4466, vermilion #b3322a, ochre #c69a4a, pine green #4f7a4a, wood brown #8a5a34, roof tile slate #46505c, white plaster #f1e8d4.
Camera: isometric 2:1 game view from above at about 30 degrees; the front of the object faces the lower-left, its side faces the lower-right; light comes from the upper-left.
Background: one flat solid magenta color #FF00FF filling the whole background. No ground, no floor tiles, no cast shadow on the background, no text, no letters, no logo, no frame, no watermark. Draw the subject large, centered, fully inside the image, not cropped.
```

## 0. 見本（最初に1回）

比率 16:9。添付なしで生成する。

```
Style: cute deformed ukiyo-e (nishiki-e woodblock print) look, rendered as clean pixel-art-like game sprite. Flat color areas, bold dark sumi-ink outlines, only one step of shading (light side and shadow side), no gradients, no gloss, no photorealism, no 3D-render look. Traditional Japanese muted palette: sumi ink #2a2420, washi paper #f4ecdc, indigo #1f4466, vermilion #b3322a, ochre #c69a4a, pine green #4f7a4a, wood brown #8a5a34, roof tile slate #46505c, white plaster #f1e8d4.
Camera: isometric 2:1 game view from above at about 30 degrees; the front of the object faces the lower-left, its side faces the lower-right; light comes from the upper-left.
Background: one flat solid magenta color #FF00FF filling the whole background. No ground, no floor tiles, no cast shadow on the background, no text, no letters, no logo, no frame, no watermark. Draw the subject large, centered, fully inside the image, not cropped.
Draw a small style sheet with three separate items side by side with wide gaps: 1) a young chubby sumo wrestler, 2.5 heads tall, round face, small topknot chonmage, black practice mawashi, bare feet, standing and facing the lower-left; 2) a small traditional wooden gate with a tiled roof and a blank signboard; 3) a small Japanese black pine tree.
```

## 直すときの言い方

- 背景に影や地面が出た → `Remove the ground and shadow. The background must be flat solid magenta #FF00FF only.`
- 角度がずれた → `Keep the same isometric angle as the reference: front facing lower-left, side facing lower-right.`
- リアルすぎる・立体的すぎる → `Make it flatter and more like a cute woodblock print: flat colors, bold ink outlines, one step of shading.`
- コマがくっついた → `Draw the poses separately side by side with a wide empty gap between them.`
- 頭身が違う → `Make the character 2.5 heads tall like the reference.`

## 1. 稽古場

### `keikoba_back` — 稽古場の奥の壁と床（断面）（優先 A・比率 4:3・1コマ）

```
Draw a cutaway diorama of a sumo stable practice hall (keikoba): only the back wall and the left side wall remain, the roof and the front walls are removed so we can see inside. Packed-earth floor raised slightly on a wooden base, white plaster walls with dark wooden pillars and beams, a small Shinto shrine shelf (kamidana) high on the back wall. Leave the floor empty (the ring, pillars and people are separate sprites).
```

### `dohyo` — 稽古土俵（優先 A・比率 16:9・1コマ）

```
Draw a square practice sumo ring (keiko-dohyo): a low raised square mound of ochre packed clay with a circle of straw rice-bale tawara on top, two short white starting lines in the middle. Nothing else.
```

### `keikoba_modern` — 稽古場（改修3段目・今どきの稽古場）（優先 B・比率 4:3・1コマ）

```
Draw a cutaway diorama of a modern, renovated sumo stable practice hall: only the back wall and the left side wall remain, the roof and front walls removed. Grey walls with dark blue steel pillars, a small Shinto shrine shelf (kamidana) high on the wall, air conditioners, a wall clock, a whiteboard, glass sliding doors. A square practice sumo ring of packed clay with a straw-bale circle in the middle of the floor, and a corner with weight-training machines (power rack, barbell, weight machine) on a rubber mat. No people.
```

### `teppo` — 鉄砲柱（優先 A・比率 9:16・1コマ）

```
Draw a single wooden teppo training pillar: a thick round wooden post standing upright, slightly worn where wrestlers push it, with a tiny base.
```

### `zashiki` — 上がり座敷（優先 A・比率 4:3・1コマ）

```
Draw a small raised tatami platform (agari-zashiki) where the stablemaster sits to watch practice: a low wooden platform with green-yellow tatami mats on top and one red zabuton cushion. No person.
```

### `weights` — 筋トレの器具（稽古場の改修2段目から）（優先 B・比率 1:1・1コマ）

```
Draw a simple strength-training corner: a short barbell on a wooden rack and two round iron weight plates, drawn in the same cute woodblock style.
```

## 2. 建物

### `omoya` — 母屋（二階建て・縁側・暖簾）（優先 A・比率 1:1・1コマ）

```
Draw the main house of a sumo stable: a two-story traditional Japanese wooden house with a dark tiled gable roof and wide eaves, white plaster walls, dark wooden pillars, paper shoji windows, a wooden engawa veranda along the front, and an indigo noren curtain (plain, no letters) hanging at the entrance.
```

### `dorm_0` — 寮（増築なし）（優先 A・比率 1:1・1コマ）

```
Draw a two-story dormitory building for young sumo wrestlers: long narrow traditional wooden building with tiled roof, shoji windows on both floors, a small wooden balcony with futons hanging over the rail to air.
```

### `dorm_1` — 寮（増築1段目）（優先 B・比率 1:1・1コマ）

```
Draw the same dormitory building as before but extended: longer, with an added wing, tiled roof, shoji windows, futons airing on the balcony.
```

### `dorm_2` — 寮（増築2段目・三階建て）（優先 B・比率 3:4・1コマ）

```
Draw the same dormitory building but now three stories tall and long, tiled roof, rows of shoji windows, futons and towels airing on balconies.
```

### `dorm_modern__a` — 現代風の寮（優先 C・比率 1:1・1コマ）

```
Draw a modern two-storey reinforced-concrete dormitory of a present-day sumo stable: flat grey roof, grey and navy walls, a balcony with a metal railing and colourful towels hanging, a front door with an intercom, gas and electric meters, air-conditioner units and pipes on the side wall, an outdoor metal staircase at the back, on a low concrete base.
```

### `dorm_modern__b` — 現代風の寮（もう1案）（優先 C・比率 1:1・1コマ）

```
Same building as dorm_modern__a, with a slightly different set of towels and a mailbox by the glass door (use dorm_modern__a as the reference image).
```

### `chanko` — ちゃんこ場（屋根つきの炊事場）（優先 A・比率 4:3・1コマ）

```
Draw an open-sided chanko cooking shed: a small tiled lean-to roof on four wooden posts, a clay stove (kamado), a low wooden table and a huge black chanko pot; open on the front so we can see inside.
```

### `gate` — 門（看板は無地）（優先 A・比率 1:1・1コマ）

```
Draw the entrance gate of a sumo stable: a traditional wooden gate with two thick posts, a crossbeam, a small tiled roof on top, and a plain blank wooden signboard on the beam (no letters).
```

### `clinic` — 治療院（トレーナー契約のとき）（優先 B・比率 4:3・1コマ）

```
Draw a small one-story clinic hut for a sports trainer: white plaster walls, wooden frame, tiled roof, a plain light-blue cloth curtain at the door (no letters, no cross symbol).
```

## 3. 小物と植物

### `fence` — 板塀（左下がり・右下がりの2本）（優先 A・比率 16:9・2コマ）

```
Draw two straight segments of a traditional dark wooden board fence (itabei) with a narrow tiled cap on top, side by side with a wide gap: the left one runs diagonally down to the lower-left, the right one runs diagonally down to the lower-right.
```

### `fence_corner` — 板塀の角（優先 B・比率 1:1・1コマ）

```
Draw a corner section of a traditional wooden board fence (itabei) shaped like a U seen from above: dark wooden boards and posts on a white plaster base, a narrow black tiled cap on top, standing on a low stone-and-earth base.
```

### `pine` — 松（優先 A・比率 3:4・1コマ）

```
Draw a single Japanese black pine tree in garden style (niwaki): a twisted trunk and flat cloud-like layers of dark green needles.
```

### `tree_season__spring` — 季節の木・春の桜（優先 A・比率 1:1・1コマ）

```
Draw a single garden cherry tree in full bloom: a twisted dark trunk and cloud-like layers of pale pink cherry blossoms, a few petals falling, on a small patch of grass with stones. Use the pine tree as the reference for the trunk shape and size.
```

### `tree_season__summer` — 季節の木・夏の青葉（優先 A・比率 1:1・1コマ）

```
Same tree as tree_season__spring (use it as the reference image), in summer: fresh bright green leaves instead of blossoms.
```

### `tree_season__autumn` — 季節の木・秋の紅葉（優先 A・比率 1:1・1コマ）

```
Same tree as tree_season__spring (use it as the reference image), in autumn: red and orange maple-like leaves, a few leaves falling.
```

### `tree_season__winter` — 季節の木・冬の枯れ木と雪（優先 A・比率 1:1・1コマ）

```
Same tree as tree_season__spring (use it as the reference image), in winter: bare branches with a little white snow on them and on the ground.
```

### `lantern` — 石灯籠（優先 A・比率 9:16・1コマ）

```
Draw a small Japanese stone lantern (ishidoro) with a little square window and a pointed roof.
```

### `rock` — 庭石（優先 B・比率 1:1・1コマ）

```
Draw a large mossy garden rock (niwa-ishi) with patches of moss and lichen, a few small pebbles and grass tufts at its base.
```

### `tsukubai` — つくばい（優先 B・比率 1:1・1コマ）

```
Draw a Japanese garden water basin (tsukubai): a round stone basin full of water, a bamboo spout (kakei) pouring water into it, a flat stepping stone in front, ferns and low shrubs behind.
```

### `nafuda` — 名札掛け（優先 B・比率 1:1・1コマ）

```
Draw a wooden name-tag board (nafuda-kake) of a sumo stable standing outdoors on two braced posts, with a small tiled roof: rows of plain wooden name tags hanging on it, with no letters on the tags.
```

### `chochin` — 提灯（優先 B・比率 1:1・1コマ）

```
Draw a red paper lantern (chochin) with a little tiled hood, hanging from the arm of a wooden post braced on the ground, on a small patch of grass. No readable letters on the lantern.
```

### `well` — 井戸（優先 B・比率 3:4・1コマ）

```
Draw an old wooden water well with a stone rim, a small tiled roof on two posts and a wooden bucket hanging on a rope.
```

### `nobori` — 幟（無地の紅白）（優先 B・比率 1:1・1コマ）

```
Draw one tall nobori banner flag on a green bamboo pole tied to a short wooden stake, with a small tassel of colourful ribbons, standing on a small patch of grass. The cloth is plain red and white horizontal stripes with no letters at all (the game writes the wrestler's name on it).
```

### `laundry` — 物干し（まわしと浴衣）（優先 B・比率 16:9・1コマ）

```
Draw a bamboo laundry pole on two wooden posts with drying sumo practice belts (long folded black and white mawashi strips), a towel and a light cotton yukata hanging from it.
```

### `pot` — ちゃんこの大鍋（湯気2コマ）（優先 A・比率 16:9・2コマ）

```
Draw a huge black chanko-nabe cooking pot with a wooden lid slightly open, drawn twice side by side with a wide gap: 1) with a small puff of white steam above it; 2) with the steam puff a little higher and differently shaped.
```

### `tawara` — 米俵の山（優先 B・比率 4:3・1コマ）

```
Draw a small neat pile of rice straw bales (kome-dawara) tied with rope.
```

## 4. 人（まわしは幕下以下が黒・関取が白。稽古場の決まりどおり）

### `rikishi_idle__kuro` — 力士・立つ（ふつう／息を吸う）（優先 A・比率 16:9・2コマ）

```
Draw a young chubby sumo wrestler (2.5 heads tall, round face, small topknot chonmage, bare feet), standing relaxed with arms at his sides, facing the lower-left. Draw him twice side by side with a wide gap: 1) normal; 2) breathing in, belly slightly bigger. His practice mawashi belt is BLACK (lower-division wrestler).
```

### `rikishi_idle__shiro` — 力士・立つ（ふつう／息を吸う）（優先 A・比率 16:9・2コマ）

```
Draw a young chubby sumo wrestler (2.5 heads tall, round face, small topknot chonmage, bare feet), standing relaxed with arms at his sides, facing the lower-left. Draw him twice side by side with a wide gap: 1) normal; 2) breathing in, belly slightly bigger. His practice mawashi belt is WHITE (sekitori, a senior wrestler); make him a bit bigger and heavier.
```

### `rikishi_shiko__kuro` — 力士・四股（足を上げる／踏む）（優先 A・比率 16:9・2コマ）

```
Draw a young chubby sumo wrestler (2.5 heads tall, small topknot chonmage, bare feet) doing shiko (the sumo leg stomp), facing the lower-left. Draw him twice side by side with a wide gap: 1) one leg raised high to the side, hands on his knees; 2) the leg stomped down, deep squat with knees wide. His practice mawashi belt is BLACK (lower-division wrestler).
```

### `rikishi_shiko__shiro` — 力士・四股（足を上げる／踏む）（優先 A・比率 16:9・2コマ）

```
Draw a young chubby sumo wrestler (2.5 heads tall, small topknot chonmage, bare feet) doing shiko (the sumo leg stomp), facing the lower-left. Draw him twice side by side with a wide gap: 1) one leg raised high to the side, hands on his knees; 2) the leg stomped down, deep squat with knees wide. His practice mawashi belt is WHITE (sekitori, a senior wrestler); make him a bit bigger and heavier.
```

### `rikishi_teppo__kuro` — 力士・鉄砲（右手／左手で突く）（優先 A・比率 16:9・2コマ）

```
Draw a young chubby sumo wrestler (2.5 heads tall, small topknot chonmage, bare feet) doing teppo training, thrusting his open palm forward at an invisible pillar, facing the lower-left, leaning forward. Draw him twice side by side with a wide gap: 1) right hand thrust forward; 2) left hand thrust forward. His practice mawashi belt is BLACK (lower-division wrestler).
```

### `rikishi_teppo__shiro` — 力士・鉄砲（右手／左手で突く）（優先 A・比率 16:9・2コマ）

```
Draw a young chubby sumo wrestler (2.5 heads tall, small topknot chonmage, bare feet) doing teppo training, thrusting his open palm forward at an invisible pillar, facing the lower-left, leaning forward. Draw him twice side by side with a wide gap: 1) right hand thrust forward; 2) left hand thrust forward. His practice mawashi belt is WHITE (sekitori, a senior wrestler); make him a bit bigger and heavier.
```

### `rikishi_suriashi__kuro` — 力士・すり足（右足／左足）（優先 A・比率 16:9・2コマ）

```
Draw a young chubby sumo wrestler (2.5 heads tall, small topknot chonmage, bare feet) doing suri-ashi (low sliding steps) in a low crouch with hands forward, facing the lower-left. Draw him twice side by side with a wide gap: 1) right foot forward; 2) left foot forward. His practice mawashi belt is BLACK (lower-division wrestler).
```

### `rikishi_suriashi__shiro` — 力士・すり足（右足／左足）（優先 A・比率 16:9・2コマ）

```
Draw a young chubby sumo wrestler (2.5 heads tall, small topknot chonmage, bare feet) doing suri-ashi (low sliding steps) in a low crouch with hands forward, facing the lower-left. Draw him twice side by side with a wide gap: 1) right foot forward; 2) left foot forward. His practice mawashi belt is WHITE (sekitori, a senior wrestler); make him a bit bigger and heavier.
```

### `rikishi_sit__kuro` — 力士・あぐらで座る／ちゃんこを食べる（優先 A・比率 16:9・2コマ）

```
Draw a young chubby sumo wrestler (2.5 heads tall, small topknot chonmage) sitting cross-legged on the ground, facing the lower-left. Draw him twice side by side with a wide gap: 1) resting with hands on knees; 2) eating chanko from a bowl with chopsticks. His practice mawashi belt is BLACK (lower-division wrestler).
```

### `rikishi_sit__shiro` — 力士・あぐらで座る／ちゃんこを食べる（優先 A・比率 16:9・2コマ）

```
Draw a young chubby sumo wrestler (2.5 heads tall, small topknot chonmage) sitting cross-legged on the ground, facing the lower-left. Draw him twice side by side with a wide gap: 1) resting with hands on knees; 2) eating chanko from a bowl with chopsticks. His practice mawashi belt is WHITE (sekitori, a senior wrestler); make him a bit bigger and heavier.
```

### `rikishi_lie__kuro` — 力士・布団で横になる（けが・包帯）（優先 A・比率 16:9・1コマ）

```
Draw a young chubby sumo wrestler (small topknot chonmage) lying on his back on a white futon with a blanket over his belly, a white bandage around one arm and his head, resting because of an injury. Viewed from the same isometric angle. His practice mawashi belt is BLACK (lower-division wrestler).
```

### `rikishi_lie__shiro` — 力士・布団で横になる（けが・包帯）（優先 A・比率 16:9・1コマ）

```
Draw a young chubby sumo wrestler (small topknot chonmage) lying on his back on a white futon with a blanket over his belly, a white bandage around one arm and his head, resting because of an injury. Viewed from the same isometric angle. His practice mawashi belt is WHITE (sekitori, a senior wrestler); make him a bit bigger and heavier.
```

### `moushiai__kuro` — 申し合い（2人が組む・押し込む）（優先 A・比率 21:9・2コマ）

```
Draw two chubby sumo wrestlers (2.5 heads tall, small topknots, bare feet) grappling each other in practice bout (moushiai), chest to chest, gripping each other's belts, the left one facing right and the right one facing left, drawn as one connected pair. Draw this pair twice side by side with a wide gap between the two pairs: 1) evenly locked; 2) the left wrestler pushing the right one back a little. His practice mawashi belt is BLACK (lower-division wrestler).
```

### `moushiai__shiro` — 申し合い（2人が組む・押し込む）（優先 A・比率 21:9・2コマ）

```
Draw two chubby sumo wrestlers (2.5 heads tall, small topknots, bare feet) grappling each other in practice bout (moushiai), chest to chest, gripping each other's belts, the left one facing right and the right one facing left, drawn as one connected pair. Draw this pair twice side by side with a wide gap between the two pairs: 1) evenly locked; 2) the left wrestler pushing the right one back a little. His practice mawashi belt is WHITE (sekitori, a senior wrestler); make him a bit bigger and heavier.
```

### `oyakata` — 親方（着物・正座で見る／立つ）（優先 A・比率 16:9・2コマ）

```
Draw a middle-aged stablemaster (oyakata), a former sumo wrestler, chubby, short hair, wearing a dark indigo kimono, facing the lower-left. Draw him twice side by side with a wide gap: 1) sitting in seiza on his knees with arms folded, watching; 2) standing with hands behind his back.
```

### `okami` — おかみさん（着物・立つ／盆を運ぶ）（優先 B・比率 16:9・2コマ）

```
Draw the stablemaster's wife (okami-san), friendly, hair tied up, wearing a calm muted-color kimono with an apron, facing the lower-left. Draw her twice side by side with a wide gap: 1) standing and smiling; 2) carrying a tray with rice balls.
```

### `dorm_modern_3f` — 現代風の寮（三階建て）（優先 C・比率 3:4・1コマ）

```
Draw a modern three-storey reinforced-concrete apartment-style dormitory of a present-day sumo stable: flat grey roof with an air-conditioner unit, navy and grey walls, an open corridor with metal railings on each floor covered with colourful hanging towels, apartment doors with intercoms and water heaters, an outdoor metal staircase on the side, on a low concrete base.
```

### `chanko_modern__a` — 現代風のちゃんこ場（優先 C・比率 4:3・1コマ）

```
Draw a cutaway diorama of the modern professional kitchen of a present-day sumo stable: only two walls remain. Stainless-steel gas ranges, a big extractor hood, huge stock pots, a two-door refrigerator, stainless sinks, a central prep table with trays of vegetables, tofu and meat, shelves of bowls and crates of vegetables, fire extinguishers on the wall, tiled floor. No people.
```

### `chanko_modern__b` — 現代風のちゃんこ場（もう1案）（優先 C・比率 4:3・1コマ）

```
Same kitchen as chanko_modern__a with a slightly different arrangement: the shelf of bowls on the right, one stock pot on the range, a cutting board with vegetables on the front table (use chanko_modern__a as the reference image).
```

### `gate_modern` — 現代風の門（優先 C・比率 1:1・1コマ）

```
Draw the modern entrance gate of a present-day sumo stable: a dark grey steel gate frame with a blank wooden name board (no text), security cameras and lights, an intercom keypad, a sliding mesh gate and mesh fences on both sides, on a concrete base with low concrete blocks at the corners.
```

### `clinic_modern` — 現代風の治療室（優先 C・比率 4:3・1コマ）

```
Draw a cutaway diorama of the treatment room of a present-day sumo stable: only two walls remain. Several padded treatment tables, a reclining treatment chair, a rack of resistance bands, a trainer's desk with a computer and filing cabinets, anatomy posters on the wall, a small sink, shelves of tape and supplies. No people.
```

### `washbasin` — 洗い場（優先 C・比率 1:1・1コマ）

```
Draw an outdoor concrete washing sink of a sumo stable: a long concrete basin with a faucet post, a coiled green garden hose on a hook, a scrubbing brush, plastic buckets beside it, a drain grate with a puddle, on a square patch of earth and grass.
```

### `vending` — 自動販売機（優先 C・比率 1:1・1コマ）

```
Draw a Japanese drink vending machine (red front, blue side) full of bottles and cans, with a grey trash bin beside it, on a square patch of earth, concrete and grass. No readable letters.
```

### `phonebox` — 公衆電話（優先 C・比率 1:1・1コマ）

```
Draw a Japanese green public telephone booth with glass walls and a green payphone inside, with a grey trash bin beside it, on a square patch of earth, concrete and grass. No readable letters.
```

### `transformer` — 変電設備の箱（地上の変圧器）（優先 C・比率 1:1・1コマ）

```
Draw a green-grey ground-mounted electrical transformer cabinet with louvres, a small breaker box with conduits, warning stickers with no readable letters, and a small barrier stand beside it, on a square patch of earth, concrete and grass. No readable letters.
```

### `parking_gate` — 駐車場の出入口（遮断機と精算機）（優先 C・比率 1:1・1コマ）

```
Draw a parking lot entrance with a yellow barrier arm machine with a red-and-white striped bar, a ticket payment machine under a small canopy, and yellow guard pipes, on a square patch of earth, concrete and grass. No readable letters.
```

### `signal` — 歩行者用の信号機の柱（優先 C・比率 1:1・1コマ）

```
Draw a dark steel pole with a pedestrian traffic signal (red standing figure, green walking figure), a push-button box and a control box, yellow guard pipes around it; draw the whole pole so it is not cut off at the top, on a square patch of earth, concrete and grass. No readable letters.
```

### `roadwork` — 道路工事の囲い（カラーコーン・バリケード）（優先 C・比率 1:1・1コマ）

```
Draw a small roadwork site: three red-and-white traffic cones linked by yellow-and-black bars, a yellow A-frame barricade with a red warning light, sandbags and an old tyre on dark asphalt, on a square patch of earth, concrete and grass. No readable letters.
```

### `bicycles` — 駐輪場（自転車2台）（優先 C・比率 1:1・1コマ）

```
Draw a bicycle parking rack with two Japanese city bicycles (mamachari) with front baskets, one navy and one silver, and a blank blue sign on a post (no letters), on a square patch of earth, concrete and grass. No readable letters.
```

## 行事・巡業の舞台

### `dohyo_honbasho` — 本場所の土俵（優先 B・比率 1:1・1コマ）

```
Draw a full tournament sumo ring (dohyo) standing outdoors: a tall square platform of packed clay with straw-bale tawara around the square edge and the inner circle, small steps cut into the sides, two white starting lines, a little pile of salt in one corner, on a patch of grass.
```

### `tsuriyane` — 吊り屋根（優先 B・比率 1:1・1コマ）

```
Draw the hanging roof (tsuriyane) of a sumo ring: a Shinto-shrine-style roof with crossed chigi and katsuogi on the ridge, hung by ropes from a chain, purple-blue cloth around the eaves, white paper shide, and four big tassels hanging from the corners: blue, red, white and green (black tortoise, vermilion bird, white tiger, azure dragon colours).
```

### `tent_ai` — 藍と白のテント（優先 B・比率 1:1・1コマ）

```
Same tent as the red one (use it as the reference image), but the cloth has wide indigo and white stripes.
```

### `kohaku_maku` — 紅白幕の囲い（優先 B・比率 1:1・1コマ）

```
Draw a square enclosure made of bamboo poles tied with rope, hung with red-and-white striped curtains (kohaku-maku) on three sides and partly open on the front, standing on a square patch of packed earth and grass.
```

### `tent` — 赤いテント（優先 B・比率 1:1・1コマ）

```
Draw a simple event tent with a red cloth roof and red side curtains tied back, on thin white poles, standing on a square patch of packed earth and grass.
```
