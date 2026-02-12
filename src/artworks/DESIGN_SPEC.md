# 3D Animation Design Specification

> Visual design guide for all 19 AI concept animations.
> Each follows the same architecture as the RAG reference: left-to-right pipeline flow, 5-6 phases, ~18s total duration, stage nodes with labels, animated data flying between stages.

---

## Global Conventions

### Framework & Patterns
- **Shared utilities**: Import `V3, ElRef, SceneProps, lerp, lerp3Into, easeInOut, easeOut, easeIn, clamp01, phaseT, TrailRing` from `../shared/sceneUtils`
- **Phase timing**: Each animation uses a `PHASE` constant with `[start, end]` pairs in seconds
- **Total duration**: 18 seconds (matches RAG)
- **Total steps**: 5-6 per animation
- **Step labels**: Exported as `STEP_LABELS` array from `constants.ts`
- **Positions**: Exported as `POS` object with named stage positions along X-axis
- **Colors**: Exported as `COLOR` object with hex strings
- **Background**: Every scene includes `AmbientParticles` (180 floating dots) and `ConnectionLines`

### Spatial Layout
- **X-axis range**: -11 to +11 (left-to-right flow)
- **Y-axis**: Center ~0, arcs reach up to +5
- **Z-axis**: Minimal depth, used for subtle curves (-2 to +2)
- **Stage spacing**: ~4-5 units apart on X-axis
- **Labels**: Text positioned below each stage node at y = -1.3 to -2.2

### Animation Language
- **Flying orb**: Glowing sphere with particle trail (`TrailRing`, 25-30 capacity), represents data moving between stages
- **Burst/shatter**: Sphere explodes into 20-30 smaller particles that scatter then reconverge (like EmbeddingBurst)
- **Pulse/glow**: `emissiveIntensity` ramps up with `easeOut` to show activity
- **Rotation**: Slow continuous rotation (0.1-0.5 rad/s) for idle; faster (0.6-1.2 rad/s) when processing
- **Stage nodes**: Semi-transparent mesh + wireframe inner mesh, with `pointLight` for glow
- **Trail particles**: InstancedMesh with descending scale, depthWrite=false, opacity 0.4-0.5

### Lighting Template
```
ambientLight intensity=0.15
directionalLight position=[5,8,5] intensity=0.35
directionalLight position=[-8,4,-3] intensity=0.15
```

### Background Color
All scenes use `bg: "#1e3a5f"` (deep navy) as the scene background.

---

## 1. LLM (Large Language Model)

**Concept**: Show how text enters an LLM, gets embedded, passes through transformer layers, predicts the next token, and produces output.

### Steps & Phase Timing
| # | Label | Phase Key | Timing |
|---|-------|-----------|--------|
| 0 | Token Input | INPUT | [0, 3] |
| 1 | Embedding | EMBED | [3, 6] |
| 2 | Transformer Layers | TRANSFORM | [6, 10] |
| 3 | Next Token Prediction | PREDICT | [10, 14] |
| 4 | Output | OUTPUT | [14, 18] |

### Positions
```
input:  [-10, 0, 0]
embed:  [-5, 0, 0]
layers: [0, 0, 0]
predict:[5, 0, 0]
output: [10, 0, 0]
```

### Color Palette
```
input:   "#94a3b8"  (slate — raw text)
embed:   "#a78bfa"  (violet — embeddings)
layers:  "#f472b6"  (pink — transformer processing)
predict: "#fb923c"  (orange — prediction heat)
output:  "#34d399"  (emerald — final output)
bg:      "#1e3a5f"
```

### Visual Design

**Stage 1 — Token Input**: A horizontal row of 5-6 small white rounded-box geometries (like word tiles) floating at the left. They appear one by one with a slight fade-in and drop-down. Each box has a subtle glow. Label: "Tokens".

**Stage 2 — Embedding**: The word tiles fly rightward in an arc and transform into colored spheres (violet). Use a burst animation: the boxes dissolve (scale down) while spheres emerge at the embed position, arranged in a vertical column (representing a vector). Label: "Embedding".

**Stage 3 — Transformer Layers**: A stack of 3 translucent horizontal rings (torus geometries) spinning slowly, spaced vertically. The violet spheres fly into the bottom ring, get "absorbed" (scale to 0 on entry). Each ring lights up in sequence from bottom to top, with a wave of pink emissive glow traveling upward. After all three rings light up, pink particles emerge from the top ring. Label: "Transformer x3".

**Stage 4 — Next Token Prediction**: A large semi-transparent icosahedron that "thinks" — it distorts and pulses (use `MeshDistortMaterial`). Pink particles arrive and orbit around it. Multiple small candidate tokens (3-4 small boxes with different glow intensities) appear around it, then all but one fade out. The brightest one pulses and grows. Label: "Predict Next".

**Stage 5 — Output**: The winning token flies in a grand arc back to the right and lands at the output position. A larger green glowing sphere forms, representing the complete output. Triumphant glow pulse. Label: "Output".

---

## 2. Diffusion Models

**Concept**: Show how diffusion starts with a clean shape, progressively adds noise until pure noise, then reverses the process to generate a new shape.

### Steps & Phase Timing
| # | Label | Phase Key | Timing |
|---|-------|-----------|--------|
| 0 | Clean Shape | CLEAN | [0, 3] |
| 1 | Add Noise | NOISE_ADD | [3, 6.5] |
| 2 | Pure Noise | PURE_NOISE | [6.5, 9] |
| 3 | Denoise | DENOISE | [9, 14] |
| 4 | Generated Shape | GENERATE | [14, 18] |

### Positions
```
clean:    [-10, 0, 0]
noisy:    [-4, 0, 0]
noise:    [0, 0, 0]
denoise:  [4, 0, 0]
generate: [10, 0, 0]
```

### Color Palette
```
clean:    "#60a5fa"  (blue — pristine)
noise:    "#ef4444"  (red — entropy/noise)
pure:     "#6b7280"  (gray — chaos)
denoise:  "#a78bfa"  (violet — reconstruction)
generate: "#34d399"  (emerald — result)
bg:       "#1e3a5f"
```

### Visual Design

**Stage 1 — Clean Shape**: A beautiful, smooth dodecahedron (12-sided) rotating slowly with a gentle blue glow. Very clean, crisp edges. Small sparkle particles orbit it to emphasize purity. Label: "Clean Shape".

**Stage 2 — Add Noise**: The dodecahedron flies rightward. As it moves, random particles (tiny red cubes) start attaching to it. Use `MeshDistortMaterial` with `distort` ramping from 0 to 0.3. The surface becomes increasingly rough. 20-30 noise particles orbit chaotically. Label: "Add Noise".

**Stage 3 — Pure Noise**: At center, the shape is now fully distorted — a chaotic cloud of ~50 gray particles randomly scattered in a sphere volume, no clear shape. Particles jitter randomly (small random position offsets each frame). A "fog" effect using a large transparent sphere. Label: "Pure Noise".

**Stage 4 — Denoise**: The gray particles begin to organize. Show a violet "sweeping beam" (a thin torus or plane) that moves through the cloud from one side to the other. As the beam passes through each particle, the particle snaps from random jitter into a smooth orbiting path and changes color from gray to violet. The cloud gradually resolves into an organized spherical arrangement. Label: "Denoise".

**Stage 5 — Generated Shape**: The organized particles converge and fuse into a new clean dodecahedron, but green. It spins, glows, and emits celebration particles (small sparkles flying outward). Label: "Generated".

---

## 3. Transformer

**Concept**: Show the core transformer architecture — tokens get positional encoding, pass through self-attention, then feed-forward layers.

### Steps & Phase Timing
| # | Label | Phase Key | Timing |
|---|-------|-----------|--------|
| 0 | Tokens | TOKENS | [0, 3] |
| 1 | Position Encoding | POS_ENC | [3, 6] |
| 2 | Self-Attention | ATTENTION | [6, 10.5] |
| 3 | Feed Forward | FFN | [10.5, 14] |
| 4 | Output | OUTPUT | [14, 18] |

### Positions
```
tokens:    [-10, 0, 0]
posEnc:    [-5, 0, 0]
attention: [0, 0, 0]
ffn:       [5, 0, 0]
output:    [10, 0, 0]
```

### Color Palette
```
tokens:    "#94a3b8"  (slate)
posEnc:    "#fbbf24"  (amber — positional info)
attention: "#f472b6"  (pink — attention)
ffn:       "#818cf8"  (indigo — feed-forward)
output:    "#34d399"  (emerald)
bg:        "#1e3a5f"
```

### Visual Design

**Stage 1 — Tokens**: 5 small cube geometries in a horizontal row, each with a slate glow. They appear staggered left-to-right. Label: "Tokens".

**Stage 2 — Position Encoding**: The cubes fly to the posEnc position. As they arrive, a golden sine wave (a visible wavy line geometry) overlays on each cube. Each cube gets a unique wave amplitude, making them visually distinct. The cubes now carry both their original color and an amber tint. Label: "Position Encoding".

**Stage 3 — Self-Attention**: Central showcase. The 5 cubes fly to the center and arrange in a pentagon. Glowing pink lines (beams) connect every cube to every other cube — 10 connections total. The lines pulse in sequence showing attention flow. One or two lines become much brighter (high attention weight) while others dim (low weight). Show the "looking at each other" concept. Label: "Self-Attention".

**Stage 4 — Feed Forward**: The cubes (now absorbing the attention info) fly into a tall rectangular prism (the FFN). The prism glows indigo from bottom to top in a wave. After the wave passes, the cubes emerge from the other side, slightly larger and brighter. Label: "Feed Forward".

**Stage 5 — Output**: The transformed cubes fly to the output position and arrange in a row. They pulse emerald green. A final glow radiates outward. Label: "Output".

---

## 4. Fine-tuning

**Concept**: A pre-trained model gets specialized with task-specific data through a training loop.

### Steps & Phase Timing
| # | Label | Phase Key | Timing |
|---|-------|-----------|--------|
| 0 | Pre-trained Model | PRETRAINED | [0, 3] |
| 1 | Task Data | TASK_DATA | [3, 6.5] |
| 2 | Training Loop | TRAIN | [6.5, 11] |
| 3 | Adapted Model | ADAPTED | [11, 14.5] |
| 4 | Output | OUTPUT | [14.5, 18] |

### Positions
```
pretrained: [-10, 0, 0]
taskData:   [-4, 0, 0]
train:      [1, 0, 0]
adapted:    [6, 0, 0]
output:     [10, 0, 0]
```

### Color Palette
```
pretrained: "#94a3b8"  (slate — generic model)
taskData:   "#fbbf24"  (amber — training data)
train:      "#f472b6"  (pink — training process)
adapted:    "#a78bfa"  (violet — specialized)
output:     "#34d399"  (emerald)
bg:         "#1e3a5f"
```

### Visual Design

**Stage 1 — Pre-trained Model**: A large sphere with a wireframe overlay, generic and gray. It slowly rotates. Represents a "blank-ish" capable model. Label: "Pre-trained".

**Stage 2 — Task Data**: Small amber document-shaped boxes (flat rectangles) appear and fly toward the model. 8-10 data rectangles stream from the left, each with a slight wobble. Label: "Task Data".

**Stage 3 — Training Loop**: The model sphere moves to center. The amber data rectangles orbit it in a spiral path, progressively getting absorbed (scale to 0 on contact). Each absorption causes a pink pulse wave on the sphere surface. Show 3 orbits — each orbit makes the sphere slightly more pink/violet, indicating it's learning. A circular arrow or ring (torus) spins around the sphere to indicate the "loop". Label: "Training".

**Stage 4 — Adapted Model**: The sphere transforms: it changes from slate to violet, becomes an icosahedron (more complex shape = specialized), and the wireframe tightens. Emissive glow increases. The transformation is a smooth morph (scale the sphere down while scaling the icosahedron up). Label: "Adapted".

**Stage 5 — Output**: A test query (small cyan orb) flies in from the left, passes through the adapted model, and emerges as a bright green orb with a trail. The adapted model pulses to show it processed the query. Label: "Output".

---

## 5. Prompt Engineering

**Concept**: Show how a raw query is transformed through template application and context addition before LLM processing.

### Steps & Phase Timing
| # | Label | Phase Key | Timing |
|---|-------|-----------|--------|
| 0 | Raw Query | RAW | [0, 3] |
| 1 | Template | TEMPLATE | [3, 6.5] |
| 2 | Add Context | CONTEXT | [6.5, 10] |
| 3 | LLM Processing | LLM | [10, 14] |
| 4 | Enhanced Output | OUTPUT | [14, 18] |

### Positions
```
raw:      [-10, 0, 0]
template: [-4, 0, 0]
context:  [1, 0, 0]
llm:      [6, 0, 0]
output:   [10, 0, 0]
```

### Color Palette
```
raw:      "#94a3b8"  (slate — unrefined)
template: "#22d3ee"  (cyan — structure)
context:  "#fbbf24"  (amber — knowledge)
llm:      "#f472b6"  (pink — processing)
output:   "#34d399"  (emerald — polished result)
bg:       "#1e3a5f"
```

### Visual Design

**Stage 1 — Raw Query**: A small, dim, rough-edged sphere (low-poly, 4 subdivisions). It looks incomplete and simple. Label: "Raw Query".

**Stage 2 — Template**: The raw query flies to the template position. A wireframe rectangular frame (like a document outline) appears. The small sphere enters the frame and gets "wrapped" — the frame contracts around it and they merge. The combined shape is now a neat cyan-outlined box with the sphere visible inside. Think of it as putting the query into a structured envelope. Label: "Template".

**Stage 3 — Add Context**: Several amber orbs (5-6) fly in from above and below, converging on the templated query. Each orb attaches and the central shape grows larger and more complex. The box expands and gains more layers (concentric boxes). Label: "+ Context".

**Stage 4 — LLM Processing**: The enriched prompt flies to the LLM position. Reuse LLM visual: distorted icosahedron with pink glow, spins faster on receipt. Internal wireframe flickers. Processing sparkles. Label: "LLM".

**Stage 5 — Enhanced Output**: A polished, bright emerald dodecahedron emerges from the LLM and flies rightward with a grand trail. Much larger and more refined than the original raw query sphere. Celebration glow. Label: "Enhanced Output".

---

## 6. AI Agents

**Concept**: An AI agent receives a task, plans, selects tools, executes, observes, and loops until producing a result.

### Steps & Phase Timing
| # | Label | Phase Key | Timing |
|---|-------|-----------|--------|
| 0 | Task | TASK | [0, 2.5] |
| 1 | Planning | PLAN | [2.5, 5.5] |
| 2 | Tool Selection | TOOLS | [5.5, 9] |
| 3 | Execute & Observe | EXECUTE | [9, 13.5] |
| 4 | Result | RESULT | [13.5, 18] |

### Positions
```
task:    [-10, 0, 0]
plan:    [-5, 0, 0]
tools:   [0, 0, 0]
execute: [5, 0, 0]
result:  [10, 0, 0]
```

### Color Palette
```
task:    "#94a3b8"  (slate)
plan:    "#22d3ee"  (cyan — thinking)
tools:   "#fbbf24"  (amber — tools)
execute: "#f472b6"  (pink — action)
result:  "#34d399"  (emerald)
bg:      "#1e3a5f"
```

### Visual Design

**Stage 1 — Task**: A glowing slate orb with a question mark label appears. It represents the incoming task. Label: "Task".

**Stage 2 — Planning**: The orb flies to the plan position. A "brain" visual: an icosahedron with slowly rotating wireframe rings (3 orthogonal torus rings). The rings spin up as planning begins. Small cyan thought-bubbles (tiny spheres) pop outward and fade. Label: "Planning".

**Stage 3 — Tool Selection**: Below the plan node, 4 tool icons appear (represented as distinct geometries): a box (search), a cylinder (database), a cone (calculator), a tetrahedron (API). The brain sends a selecting beam down to highlight one tool after evaluating them. The selected tool glows bright amber. Label: "Tool Select".

**Stage 4 — Execute & Observe**: The selected tool and the plan orb merge and fly to the execute position. An action sequence: the tool shape pulses pink, emits sparks, and produces a result orb. Then show a feedback loop — a thin ring/arc from execute back toward plan lights up briefly (observation arrow), showing the agent checking its work. Label: "Execute".

**Stage 5 — Result**: The final green orb flies to the result position, growing in size and brightness. Label: "Result".

---

## 7. Multimodal AI

**Concept**: Multiple input types (text, image, audio) are encoded separately, fused, and produce cross-modal understanding.

### Steps & Phase Timing
| # | Label | Phase Key | Timing |
|---|-------|-----------|--------|
| 0 | Multi-Input | INPUTS | [0, 3] |
| 1 | Encoders | ENCODERS | [3, 6.5] |
| 2 | Fusion | FUSION | [6.5, 10] |
| 3 | Cross-Modal Attention | CROSS_ATT | [10, 14] |
| 4 | Output | OUTPUT | [14, 18] |

### Positions
```
inputs:   [-10, 0, 0]  (but vertically spread: text at y=2, image at y=0, audio at y=-2)
encoders: [-4, 0, 0]   (three encoders stacked vertically)
fusion:   [2, 0, 0]
crossAtt: [6, 0, 0]
output:   [10, 0, 0]
```

### Color Palette
```
text:     "#22d3ee"  (cyan)
image:    "#f472b6"  (pink)
audio:    "#fbbf24"  (amber)
fusion:   "#a78bfa"  (violet — merged)
output:   "#34d399"  (emerald)
bg:       "#1e3a5f"
```

### Visual Design

**Stage 1 — Multi-Input**: Three distinct shapes appear stacked vertically at the left:
- **Text** (top, y=2): A small cube with cyan glow
- **Image** (middle, y=0): A flat square (plane geometry) with pink glow
- **Audio** (bottom, y=-2): A wavy torus with amber glow
Label each: "Text", "Image", "Audio".

**Stage 2 — Encoders**: Each input flies to its own encoder — three small cylinders stacked at the encoder position (y=2, y=0, y=-2). Each cylinder glows its input's color as it processes. Internal dots orbit within each cylinder. Label: "Encoders".

**Stage 3 — Fusion**: All three encoded outputs (now spheres matching their input colors) fly toward the central fusion point. They converge into a single larger sphere that swirls with all three colors (use vertex colors or animated material). A burst of mixed-color particles on impact. Label: "Fusion".

**Stage 4 — Cross-Modal Attention**: The fused sphere is surrounded by 3 orbiting rings (one per modality color). The rings periodically connect with glowing beams — showing cross-modal interaction. Beams pulse in different pairs: text-image, image-audio, text-audio. Label: "Cross-Attention".

**Stage 5 — Output**: The unified understanding emerges as a bright emerald shape and flies to the output. Label: "Output".

---

## 8. RLHF (Reinforcement Learning from Human Feedback)

**Concept**: LLM produces outputs, humans compare them, a reward model is trained, PPO aligns the model.

### Steps & Phase Timing
| # | Label | Phase Key | Timing |
|---|-------|-----------|--------|
| 0 | LLM Outputs | LLM_OUT | [0, 3] |
| 1 | Human Comparison | COMPARE | [3, 6.5] |
| 2 | Reward Model | REWARD | [6.5, 10.5] |
| 3 | PPO Training | PPO | [10.5, 14.5] |
| 4 | Aligned Output | ALIGNED | [14.5, 18] |

### Positions
```
llmOut:   [-10, 0, 0]
compare:  [-4, 0, 0]
reward:   [1, 0, 0]
ppo:      [6, 0, 0]
aligned:  [10, 0, 0]
```

### Color Palette
```
llmOut:   "#94a3b8"  (slate — raw outputs)
compare:  "#fbbf24"  (amber — human judgment)
reward:   "#f472b6"  (pink — reward signal)
ppo:      "#818cf8"  (indigo — training)
aligned:  "#34d399"  (emerald — aligned)
bg:       "#1e3a5f"
```

### Visual Design

**Stage 1 — LLM Outputs**: An icosahedron (LLM) produces 3 small output orbs of varying brightness (one bright, one medium, one dim). They fly rightward in parallel. Label: "LLM Outputs".

**Stage 2 — Human Comparison**: A human figure node (sphere + ring, like RAG's UserNode but amber-colored). The 3 orbs arrive. Glowing lines connect each pair — one pair gets a bright "thumbs up" beam (scales up, glows), another gets a dim "thumbs down" beam (shrinks, dims). The winner orb floats above. Label: "Human Ranking".

**Stage 3 — Reward Model**: The ranking data flies into a diamond shape (octahedron). The diamond processes it with a pink glow-wave, then produces a small bright pink "score" orb that flies toward PPO. Label: "Reward Model".

**Stage 4 — PPO Training**: Show the original LLM (a copy of the icosahedron from stage 1) receiving the reward signal. The reward orb orbits the LLM and gets absorbed. The LLM shifts color from slate toward indigo. A spinning optimization ring (torus) surrounds it, contracting inward. Label: "PPO Training".

**Stage 5 — Aligned Output**: The now-indigo-to-emerald LLM produces a final bright green orb. It's notably brighter and more stable than the initial outputs. Label: "Aligned".

---

## 9. LoRA (Low-Rank Adaptation)

**Concept**: Show how large weight matrices are decomposed into smaller low-rank matrices for efficient fine-tuning.

### Steps & Phase Timing
| # | Label | Phase Key | Timing |
|---|-------|-----------|--------|
| 0 | Original Weights | WEIGHTS | [0, 3] |
| 1 | Low-Rank Decompose | DECOMPOSE | [3, 7] |
| 2 | A x B Matrices | MATRICES | [7, 11] |
| 3 | Addition | ADD | [11, 14.5] |
| 4 | Efficient Model | EFFICIENT | [14.5, 18] |

### Positions
```
weights:   [-10, 0, 0]
decompose: [-4, 0, 0]
matrices:  [1, 0, 0]
add:       [6, 0, 0]
efficient: [10, 0, 0]
```

### Color Palette
```
weights:   "#94a3b8"  (slate — original)
decompose: "#f472b6"  (pink — decomposition)
matA:      "#22d3ee"  (cyan — matrix A)
matB:      "#fbbf24"  (amber — matrix B)
add:       "#a78bfa"  (violet — combination)
efficient: "#34d399"  (emerald)
bg:        "#1e3a5f"
```

### Visual Design

**Stage 1 — Original Weights**: A large flat grid of dots (8x8 = 64 dots arranged in a plane), representing a weight matrix. Each dot is a small sphere. The grid slowly rotates to show it's 3D. Label: "Weight Matrix".

**Stage 2 — Low-Rank Decompose**: A pink "slicing beam" sweeps through the grid. The 64 dots split into two groups: a tall thin column (8x2 = matrix A, cyan) and a short wide row (2x8 = matrix B, amber). The two groups separate vertically. A visual "crack" or slice effect. Label: "Decompose".

**Stage 3 — A x B Matrices**: Matrix A (tall cyan column of dots) floats above, Matrix B (wide amber row) floats below. They are MUCH smaller than the original 8x8 grid — emphasize the size reduction. Show a pulsing connection beam between them. Small particles flow between A and B showing multiplication. Label: "A x B".

**Stage 4 — Addition**: The original weight grid (a ghost/transparent version) reappears at the add position. The A x B product (now a violet set of particles) flies over and overlays onto the ghost grid. They merge with a satisfying glow pulse. The combined result becomes solid. Label: "W + AB".

**Stage 5 — Efficient Model**: The combined matrix transforms into a compact, bright emerald icosahedron. Much smaller and cleaner than a full fine-tune would be. Small sparkles indicate efficiency. A tiny "badge" text shows the parameter savings concept. Label: "Efficient Model".

---

## 10. Attention Mechanism

**Concept**: Deep dive into how attention works — Q/K/V split, dot product, softmax, weighted sum.

### Steps & Phase Timing
| # | Label | Phase Key | Timing |
|---|-------|-----------|--------|
| 0 | Input | INPUT | [0, 2.5] |
| 1 | Q / K / V Split | QKV | [2.5, 6] |
| 2 | Dot Product | DOT | [6, 9.5] |
| 3 | Softmax | SOFTMAX | [9.5, 13] |
| 4 | Weighted Sum | WEIGHTED | [13, 16] |
| 5 | Output | OUTPUT | [16, 18] |

### Positions
```
input:    [-11, 0, 0]
qkv:      [-5.5, 0, 0]
dot:      [-0.5, 0, 0]
softmax:  [4, 0, 0]
weighted: [8, 0, 0]
output:   [11, 0, 0]
```

### Color Palette
```
input:    "#94a3b8"  (slate)
query:    "#f472b6"  (pink — Q)
key:      "#22d3ee"  (cyan — K)
value:    "#fbbf24"  (amber — V)
softmax:  "#a78bfa"  (violet)
output:   "#34d399"  (emerald)
bg:       "#1e3a5f"
```

### Visual Design

**Stage 1 — Input**: A row of 4 orbs (tokens) in slate. Label: "Input".

**Stage 2 — Q/K/V Split**: Each orb splits into three smaller orbs — one pink (Q), one cyan (K), one amber (V). The three groups separate vertically: Q floats to y=2, K stays at y=0, V drops to y=-2. 12 total orbs (4x3). Label: "Q / K / V".

**Stage 3 — Dot Product**: Q orbs and K orbs fly toward each other. Pink lines connect each Q to each K (4x4 = 16 lines). The lines pulse to show dot product computation. Some lines glow brighter (high similarity), others dim. The intersection points produce small violet sparks. Label: "Q . K".

**Stage 4 — Softmax**: The 16 connection strengths visualize as bars or orbs of varying sizes. They fly to the softmax position and normalize — the largest grows, the smallest shrinks, but all together they form a balanced arrangement. Show a "normalization wave" (a horizontal plane sweeping through). Label: "Softmax".

**Stage 5 — Weighted Sum**: The V orbs (amber) get scaled by the softmax weights. Larger weight = bigger V orb. The weighted V orbs converge and merge into fewer, combined orbs. The merging is a smooth attraction. Label: "Weighted Sum".

**Stage 6 — Output**: The final combined orbs become emerald and fly to output position. Label: "Output".

---

## 11. Stable Diffusion

**Concept**: Text-to-image pipeline through CLIP encoding, latent noise, U-Net denoising, and VAE decoding.

### Steps & Phase Timing
| # | Label | Phase Key | Timing |
|---|-------|-----------|--------|
| 0 | Text Prompt | TEXT | [0, 2.5] |
| 1 | CLIP Encode | CLIP | [2.5, 5.5] |
| 2 | Latent Noise | LATENT | [5.5, 9] |
| 3 | U-Net Denoise | UNET | [9, 13] |
| 4 | VAE Decode | VAE | [13, 16] |
| 5 | Image | IMAGE | [16, 18] |

### Positions
```
text:    [-11, 0, 0]
clip:    [-5.5, 0, 0]
latent:  [-0.5, 0, 0]
unet:    [4, 0, 0]
vae:     [8, 0, 0]
image:   [11, 0, 0]
```

### Color Palette
```
text:    "#94a3b8"  (slate)
clip:    "#22d3ee"  (cyan — encoding)
latent:  "#6b7280"  (gray — noise)
unet:    "#a78bfa"  (violet — denoising)
vae:     "#f472b6"  (pink — decoding)
image:   "#34d399"  (emerald — final image)
bg:      "#1e3a5f"
```

### Visual Design

**Stage 1 — Text Prompt**: Small text-tile boxes appear (like LLM's token input). Label: "Text".

**Stage 2 — CLIP Encode**: Text tiles fly into a cylinder (the CLIP encoder). The cylinder glows cyan. A single encoded vector orb (larger, cyan) emerges. Label: "CLIP".

**Stage 3 — Latent Noise**: A flat square grid of jittering gray particles (like a 2D noise texture in 3D). Particles randomly jump positions. The CLIP orb arrives and hovers above, guiding the noise. Label: "Latent Noise".

**Stage 4 — U-Net Denoise**: Show multiple passes (3 visible sweeps) of a violet wave/plane that slides across the noise grid. Each pass reduces the jitter. After sweep 1: particles are still mostly chaotic. After sweep 2: clusters form. After sweep 3: clear structure emerges. The CLIP orb remains connected via a beam (conditioning). Label: "U-Net".

**Stage 5 — VAE Decode**: The structured latent grid flies to the VAE position — a pink tube/cylinder. As it passes through, the grid expands (upscales) from a small grid to a larger grid of organized, colorful particles. Label: "VAE Decode".

**Stage 6 — Image**: The final grid of particles settles into a clear rectangular arrangement, glowing emerald. Represents the generated image. Label: "Image".

---

## 12. GPT Architecture

**Concept**: Show GPT's autoregressive nature — token embedding, positional encoding, masked attention, feed-forward, next-token loop.

### Steps & Phase Timing
| # | Label | Phase Key | Timing |
|---|-------|-----------|--------|
| 0 | Token Embed | EMBED | [0, 3] |
| 1 | Position Encode | POS_ENC | [3, 6] |
| 2 | Masked Attention | MASKED_ATT | [6, 10] |
| 3 | Feed Forward | FFN | [10, 14] |
| 4 | Next Token Loop | NEXT_TOKEN | [14, 18] |

### Positions
```
embed:    [-10, 0, 0]
posEnc:   [-5, 0, 0]
masked:   [0, 0, 0]
ffn:      [5, 0, 0]
nextToken:[10, 0, 0]
```

### Color Palette
```
embed:    "#94a3b8"  (slate)
posEnc:   "#fbbf24"  (amber)
masked:   "#ef4444"  (red — masking)
ffn:      "#818cf8"  (indigo)
nextToken:"#34d399"  (emerald)
bg:       "#1e3a5f"
```

### Visual Design

**Stage 1 — Token Embed**: Similar to Transformer's token input but emphasize embedding — raw cubes descend into a "pool" (flat plane), emerge as glowing spheres. Label: "Token Embed".

**Stage 2 — Position Encode**: Each sphere gets a unique golden ring at a different angle (visualizing positional information). The rings are toruses of increasing radius per position. Label: "Position Encode".

**Stage 3 — Masked Attention**: The key differentiator from regular Transformer. Show 5 tokens arranged left-to-right. Attention lines appear BUT with a triangular mask: token 1 can only see itself, token 2 sees 1-2, token 3 sees 1-3, etc. Show a red triangular "wall" or "curtain" that blocks rightward attention. The allowed connections glow while blocked ones show as faint red dashes. Label: "Masked Attention".

**Stage 4 — Feed Forward**: Same as Transformer FFN — rectangular prism with indigo glow wave. Label: "Feed Forward".

**Stage 5 — Next Token Loop**: The output produces a new token (a green sphere) that flies to the end of the sequence. Then show a curved arrow (arc or ring segment) that loops from the new token back to the beginning, indicating the autoregressive nature. The sequence is now one token longer. Label: "Next Token".

---

## 13. Image Generation (General)

**Concept**: Generic text-to-image pipeline: encoding, noise initialization, iterative refinement, upscaling.

### Steps & Phase Timing
| # | Label | Phase Key | Timing |
|---|-------|-----------|--------|
| 0 | Text Prompt | TEXT | [0, 2.5] |
| 1 | Encoding | ENCODE | [2.5, 5.5] |
| 2 | Noise Init | NOISE | [5.5, 8.5] |
| 3 | Iterative Refine | REFINE | [8.5, 13] |
| 4 | Upscale | UPSCALE | [13, 16] |
| 5 | Image | IMAGE | [16, 18] |

### Positions
```
text:    [-11, 0, 0]
encode:  [-5.5, 0, 0]
noise:   [-0.5, 0, 0]
refine:  [4, 0, 0]
upscale: [8, 0, 0]
image:   [11, 0, 0]
```

### Color Palette
```
text:    "#94a3b8"  (slate)
encode:  "#22d3ee"  (cyan)
noise:   "#6b7280"  (gray)
refine:  "#a78bfa"  (violet)
upscale: "#f472b6"  (pink)
image:   "#34d399"  (emerald)
bg:      "#1e3a5f"
```

### Visual Design

**Stage 1 — Text Prompt**: Small text tiles (3-4 boxes). Label: "Text".

**Stage 2 — Encoding**: Tiles fly into a glowing cyan sphere (encoder), get absorbed, a compact vector orb emerges. Label: "Encode".

**Stage 3 — Noise Init**: A cloud of randomly scattered gray particles (4x4 grid with jitter). The encoded vector "seeds" the noise — a cyan beam from the encoder orb to the cloud. Label: "Noise".

**Stage 4 — Iterative Refine**: The star animation. Show 4 refinement steps visually: the cloud passes through 4 vertical "gates" (thin translucent planes) spaced along the path. Each gate is a deeper shade of violet. As the cloud passes each gate, particles become more organized. Show a counter or progress indication. Label: "Refine x4".

**Stage 5 — Upscale**: The refined 4x4 grid expands to 8x8. New particles appear between existing ones (interpolation visualized). Pink glow pulses outward. Label: "Upscale".

**Stage 6 — Image**: The 8x8 grid settles into a clean rectangular arrangement, all emerald. Sparkle particles. Label: "Image".

---

## 14. Vector Databases

**Concept**: Data embedding, index building, query, approximate nearest neighbor search, and top-K retrieval.

### Steps & Phase Timing
| # | Label | Phase Key | Timing |
|---|-------|-----------|--------|
| 0 | Data | DATA | [0, 3] |
| 1 | Embedding | EMBED | [3, 6] |
| 2 | Index Build | INDEX | [6, 9.5] |
| 3 | Query + ANN | SEARCH | [9.5, 13.5] |
| 4 | Top-K Results | RESULTS | [13.5, 18] |

### Positions
```
data:    [-10, 0, 0]
embed:   [-5, 0, 0]
index:   [0, 0, 0]
search:  [5, 0, 0]
results: [10, 0, 0]
```

### Color Palette
```
data:    "#94a3b8"  (slate)
embed:   "#a78bfa"  (violet)
index:   "#22d3ee"  (cyan — structured)
search:  "#fbbf24"  (amber — query)
results: "#34d399"  (emerald)
bg:      "#1e3a5f"
```

### Visual Design

**Stage 1 — Data**: Various small shapes (mix of cubes, spheres, tetrahedrons) appear — representing diverse data types. 8-10 items, all slate colored. Label: "Data".

**Stage 2 — Embedding**: The diverse shapes fly toward the embed position. As each arrives, it transforms into a uniform violet sphere (everything becomes a vector). Label: "Embed".

**Stage 3 — Index Build**: The violet spheres fly to center and self-organize into a 3D spatial structure. Show them settling into clusters — nearby spheres attract each other (like a gravity simulation). Thin cyan lines connect nearby neighbors, forming a graph structure (tree/graph index visual). The whole structure slowly rotates. Label: "Index".

**Stage 4 — Query + ANN**: A bright amber query orb flies in from the left. It enters the index structure. Show a search "ripple" emanating from the query point — expanding rings of light. Spheres close to the query brighten (high similarity), distant ones stay dim. The search narrows: first a wide region glows, then a smaller region, then specific points. Label: "ANN Search".

**Stage 5 — Top-K Results**: The 3 closest spheres (Top-3) light up bright emerald, detach from the index, and fly to the results position. They arrange in a podium-like formation (1st, 2nd, 3rd). The rest of the index fades slightly. Label: "Top-K".

---

## 15. Tokenization

**Concept**: Raw text gets split into characters, BPE merges frequent pairs, assigns token IDs, maps to vocabulary.

### Steps & Phase Timing
| # | Label | Phase Key | Timing |
|---|-------|-----------|--------|
| 0 | Raw Text | RAW | [0, 3] |
| 1 | Character Split | CHARS | [3, 6.5] |
| 2 | BPE Merging | BPE | [6.5, 11] |
| 3 | Token IDs | IDS | [11, 14.5] |
| 4 | Vocabulary | VOCAB | [14.5, 18] |

### Positions
```
raw:   [-10, 0, 0]
chars: [-5, 0, 0]
bpe:   [0, 0, 0]
ids:   [5, 0, 0]
vocab: [10, 0, 0]
```

### Color Palette
```
raw:   "#94a3b8"  (slate)
chars: "#22d3ee"  (cyan — characters)
bpe:   "#f472b6"  (pink — merging)
ids:   "#fbbf24"  (amber — numeric IDs)
vocab: "#34d399"  (emerald)
bg:    "#1e3a5f"
```

### Visual Design

**Stage 1 — Raw Text**: A single long rounded-box representing a text string. Gently glowing slate. Label: "Raw Text".

**Stage 2 — Character Split**: The long box shatters into many small cubes (10-12), each representing a character. They spread out in a row with small gaps. Each cube is cyan. Label: "Characters".

**Stage 3 — BPE Merging**: The key visual. Adjacent cube pairs merge: two cubes slide toward each other and fuse into one slightly larger box with a pink glow. Show 3-4 merges happening in sequence. After merging, there are fewer, larger boxes. Some cubes remain un-merged (rare characters). The merging has a satisfying snap animation. Label: "BPE Merge".

**Stage 4 — Token IDs**: Each merged box transforms: it rotates and gains a number label (or changes to a uniform amber color with a bright ID marker). The boxes become uniform amber cubes. Label: "Token IDs".

**Stage 5 — Vocabulary**: The token cubes fly to the right and slot into a large vertical grid structure (the vocabulary). Show a tall cylinder with horizontal shelves — each token flies to its assigned shelf/position. The vocabulary glows emerald when all tokens are placed. Label: "Vocabulary".

---

## 16. Chain-of-Thought (CoT)

**Concept**: A question triggers step-by-step reasoning — understand, break down, reason, verify, answer.

### Steps & Phase Timing
| # | Label | Phase Key | Timing |
|---|-------|-----------|--------|
| 0 | Question | QUESTION | [0, 2.5] |
| 1 | Understand | UNDERSTAND | [2.5, 5.5] |
| 2 | Break Down | BREAKDOWN | [5.5, 9] |
| 3 | Reason | REASON | [9, 13] |
| 4 | Verify | VERIFY | [13, 15.5] |
| 5 | Answer | ANSWER | [15.5, 18] |

### Positions
```
question:  [-11, 0, 0]
understand:[-5.5, 0, 0]
breakdown: [-0.5, 0, 0]
reason:    [4, 0, 0]
verify:    [8, 0, 0]
answer:    [11, 0, 0]
```

### Color Palette
```
question:  "#94a3b8"  (slate)
understand:"#22d3ee"  (cyan — comprehension)
breakdown: "#fbbf24"  (amber — decomposition)
reason:    "#f472b6"  (pink — reasoning)
verify:    "#818cf8"  (indigo — checking)
answer:    "#34d399"  (emerald)
bg:        "#1e3a5f"
```

### Visual Design

**Stage 1 — Question**: A glowing slate sphere with a "?" feel — use an icosahedron with low subdivision for a rough, uncertain look. Label: "Question".

**Stage 2 — Understand**: The question orb flies to the understand position and enters a magnifying-glass visual: a large torus (lens) with a handle (cylinder). The orb passes through the lens and becomes brighter/cyan — it's now "understood". Label: "Understand".

**Stage 3 — Break Down**: The understood orb shatters into 4 smaller amber orbs, each representing a sub-problem. They spread out in a diamond pattern. Connecting lines appear between them showing relationships. Label: "Break Down".

**Stage 4 — Reason**: Each sub-problem orb processes in sequence (left to right, or clockwise). When processing, it spins fast and emits pink sparks. After processing, it calms down and glows brighter. A chain link (small torus segment) appears connecting it to the next orb — literally a "chain of thought". Label: "Reason".

**Stage 5 — Verify**: All 4 processed orbs fly to the verify position. An indigo scanning ring sweeps over them (like a verification pass). One orb briefly flashes red then corrects to green — showing the verification caught an issue and fixed it. Label: "Verify".

**Stage 6 — Answer**: The verified orbs merge into one large emerald sphere. Grand glow, celebration sparkles. Label: "Answer".

---

## 17. Model Distillation

**Concept**: A large teacher model transfers its knowledge through soft labels to a smaller student model.

### Steps & Phase Timing
| # | Label | Phase Key | Timing |
|---|-------|-----------|--------|
| 0 | Teacher Model | TEACHER | [0, 3] |
| 1 | Soft Labels | SOFT | [3, 7] |
| 2 | Student Model | STUDENT | [7, 10.5] |
| 3 | Knowledge Transfer | TRANSFER | [10.5, 14.5] |
| 4 | Compact Model | COMPACT | [14.5, 18] |

### Positions
```
teacher:  [-10, 0, 0]
soft:     [-4, 0, 0]
student:  [1, 0, 0]
transfer: [5, 0, 0]
compact:  [10, 0, 0]
```

### Color Palette
```
teacher:  "#f472b6"  (pink — large/powerful)
soft:     "#fbbf24"  (amber — soft labels)
student:  "#94a3b8"  (slate — small/learning)
transfer: "#a78bfa"  (violet — knowledge flow)
compact:  "#34d399"  (emerald — efficient result)
bg:       "#1e3a5f"
```

### Visual Design

**Stage 1 — Teacher Model**: A LARGE icosahedron (radius 1.5) with `MeshDistortMaterial`, heavy pink glow, many wireframe layers. It's impressive and complex but big. Small orbiting particles emphasize its power. Label: "Teacher".

**Stage 2 — Soft Labels**: The teacher emits "knowledge bubbles" — streams of amber orbs of varying sizes (some big = high confidence, some small = low confidence). Not hard 0/1 labels, but soft probability distributions shown via size variation. 10-15 orbs stream rightward. Label: "Soft Labels".

**Stage 3 — Student Model**: A SMALL sphere (radius 0.5), plain slate, minimal glow. It looks humble compared to the teacher. It sits waiting to learn. Label: "Student".

**Stage 4 — Knowledge Transfer**: The amber orbs flow into the student sphere. With each absorption, the student grows slightly and gains color (slate -> violet). Show a "learning glow" — concentric rings pulse outward from the student with each absorbed orb. The student never grows to teacher size, but becomes notably more vibrant. Label: "Transfer".

**Stage 5 — Compact Model**: The student transforms into a small but bright emerald icosahedron. It's much smaller than the teacher but glows with similar intensity. Side-by-side: show a faint ghost of the teacher (large, transparent) next to the compact student (small, solid) — emphasizing same capability, smaller size. Label: "Compact Model".

---

## 18. Text-to-Video

**Concept**: Text gets spatially encoded, individual frames are generated, temporal coherence is applied, and video emerges.

### Steps & Phase Timing
| # | Label | Phase Key | Timing |
|---|-------|-----------|--------|
| 0 | Text | TEXT | [0, 2.5] |
| 1 | Spatial Encoding | SPATIAL | [2.5, 5.5] |
| 2 | Frame Generation | FRAMES | [5.5, 9.5] |
| 3 | Temporal Coherence | TEMPORAL | [9.5, 14] |
| 4 | Video | VIDEO | [14, 18] |

### Positions
```
text:     [-10, 0, 0]
spatial:  [-5, 0, 0]
frames:   [0, 0, 0]
temporal: [5, 0, 0]
video:    [10, 0, 0]
```

### Color Palette
```
text:     "#94a3b8"  (slate)
spatial:  "#22d3ee"  (cyan — spatial)
frames:   "#f472b6"  (pink — individual frames)
temporal: "#a78bfa"  (violet — time coherence)
video:    "#34d399"  (emerald — final)
bg:       "#1e3a5f"
```

### Visual Design

**Stage 1 — Text**: Small text tiles. Label: "Text".

**Stage 2 — Spatial Encoding**: Text tiles fly into a flattened sphere (oblate spheroid) that encodes them. A cyan grid appears inside the spheroid, representing spatial understanding. Label: "Spatial Encode".

**Stage 3 — Frame Generation**: The encoder produces individual "frames" — 6-8 flat squares (plane geometries) that emerge one by one and arrange in a Z-depth line (like a deck of cards). Each frame has a pink glow and slight jitter (they don't yet match each other). Label: "Frames".

**Stage 4 — Temporal Coherence**: A violet wave sweeps through the frame stack from front to back. As the wave passes each frame, the frame's jitter stops and it aligns with its neighbors. Thin violet lines connect adjacent frames (temporal connections). After the wave passes, all frames are smooth and aligned. Label: "Temporal".

**Stage 5 — Video**: The aligned frame stack compresses into a single glowing emerald rectangle that "plays" — it pulses rhythmically (simulating playback). Small emerald sparkles fly off it. Label: "Video".

---

## 19. Mixture of Experts (MoE)

**Concept**: Input goes through a router/gate that selects which expert networks to activate, then outputs are combined.

### Steps & Phase Timing
| # | Label | Phase Key | Timing |
|---|-------|-----------|--------|
| 0 | Input | INPUT | [0, 2.5] |
| 1 | Router Gate | ROUTER | [2.5, 5.5] |
| 2 | Expert Selection | SELECT | [5.5, 9] |
| 3 | Parallel Processing | PROCESS | [9, 13.5] |
| 4 | Combine | COMBINE | [13.5, 16] |
| 5 | Output | OUTPUT | [16, 18] |

### Positions
```
input:   [-11, 0, 0]
router:  [-5.5, 0, 0]
experts: [0, 0, 0]   (4 experts at y=-3, -1, 1, 3)
combine: [6, 0, 0]
output:  [11, 0, 0]
```

### Color Palette
```
input:   "#94a3b8"  (slate)
router:  "#22d3ee"  (cyan — routing)
expert1: "#f472b6"  (pink)
expert2: "#fbbf24"  (amber)
expert3: "#818cf8"  (indigo)
expert4: "#a78bfa"  (violet)
combine: "#34d399"  (emerald — combined output)
output:  "#34d399"
bg:      "#1e3a5f"
```

### Visual Design

**Stage 1 — Input**: A glowing slate orb. Label: "Input".

**Stage 2 — Router Gate**: The orb flies to a diamond shape (octahedron) with cyan glow — the router. The diamond "evaluates" the input: it spins and emits scanning beams toward 4 expert positions (thin lines reaching out to y=-3, -1, 1, 3). Label: "Router".

**Stage 3 — Expert Selection**: 4 expert nodes appear vertically at x=0: each is a different colored sphere (pink, amber, indigo, violet). The router's beams resolve — 2 of the 4 beams become bright and thick (selected experts), while 2 dim and fade (unselected). The selected experts glow brighter, the unselected ones become semi-transparent. Label: "Select Top-2".

**Stage 4 — Parallel Processing**: The input splits into 2 copies that fly to the 2 selected experts simultaneously. Each expert processes independently: they spin, distort, pulse, and emit sparks in their respective colors. Processing happens in parallel (both animate at the same time). Label: "Process".

**Stage 5 — Combine**: The 2 expert outputs (colored orbs) fly to the combine position. They merge with a swirl animation — both colors spiral into each other, producing a unified green orb. Show mixing particles. Label: "Combine".

**Stage 6 — Output**: The combined orb flies to the output position with a grand trail. Label: "Output".

---

## Quick Reference: Shared Visual Elements

### Reusable Components
1. **TextTileInput**: Row of small boxes appearing one-by-one (used by: LLM, Transformer, Prompt, StableDiff, GPT, ImageGen, Text2Video, Tokenization)
2. **EncoderCylinder**: Glowing cylinder that absorbs inputs and emits vectors (used by: Multimodal, StableDiff, ImageGen, Text2Video)
3. **ProcessingIcosahedron**: Distorted icosahedron with `MeshDistortMaterial` for "thinking" nodes (used by: LLM, Prompt, RLHF, Distillation, GPT)
4. **BurstParticles**: Sphere shatters into many small particles that reconverge (used by: LLM, Diffusion, CoT, Attention)
5. **DataStreamDots**: Multiple orbs flying along arced paths with staggered delays (used by: FineTune, RLHF, Distillation, LoRA)
6. **ScanWave**: A plane or ring that sweeps through particles, changing their state (used by: Diffusion, StableDiff, ImageGen, CoT, Text2Video)
7. **FeedForwardPrism**: Rectangular box with a glow wave passing through it (used by: Transformer, GPT)
8. **ConnectionBeams**: Glowing lines between orbs showing attention/relationship (used by: Transformer, Attention, GPT, CoT, VectorDB)

### Geometry Cheat Sheet
| Visual Metaphor | Geometry | Use Case |
|---|---|---|
| Token / text unit | boxGeometry (rounded feel via scale) | Input text |
| Vector / embedding | sphereGeometry | Embeddings, data points |
| Encoder / processor | cylinderGeometry (open = wireframe) | Encoding stages |
| "Brain" / LLM | icosahedronGeometry + MeshDistortMaterial | LLM, prediction |
| Database / storage | cylinderGeometry (solid, with cap circles) | VectorDB, vocabulary |
| Router / decision | octahedronGeometry | MoE router, reward model |
| Frame / image | planeGeometry | Image/video frames |
| Connection ring | torusGeometry | Loops, orbits, feedback |
| Matrix / grid | InstancedMesh grid of spheres | LoRA, attention weights |
