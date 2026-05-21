# Prince Simulator — 8085 Microprocessor Emulator

A web-based Intel 8085 microprocessor simulator built for engineering students who are tired of fighting over the one working kit in the lab.

Write, compile, and execute 8085 assembly programs directly in your browser. No downloads. No Java. No excuses.

## What's Inside

- **Full 8085 CPU emulation** — registers, flags, memory, the whole thing
- **Assembly compiler** — two-pass assembler with label resolution and real error messages
- **7 lab experiments** pre-loaded and ready to run (Experiments 01–07)
- **Trainer board kit** — a digital twin of the physical 8085 lab hardware, complete with LCD display, LEDs, and command buttons
- **Keyboard-driven workflow** — use your keyboard exactly like you would in the lab
- **Fullscreen mode** — immersive trainer board experience
- **Responsive** — works on phones, tablets, laptops, and that one guy's ultra-wide monitor

## Lab Experiments Included

| # | Experiment | What It Does |
|---|-----------|-------------|
| 01 | Simple Addition | Add two numbers. The "Hello World" of 8085. |
| 02 | Sequential Storage | Store numbers and their sum at 2400H–2402H |
| 03 | Addition with Carry | Handle overflow like a responsible engineer |
| 04 | Subtraction | 2's complement subtraction |
| 05 | Find Larger | Compare two numbers, keep the big one |
| 06 | Find Smaller | Same idea, opposite result |
| 07 | Largest in Array | Loop through an array, find the max |

## Keyboard Shortcuts (Trainer Board)

| Key | Action |
|-----|--------|
| `0`–`F` | Type hex values |
| `Enter` / `→` | NEXT address |
| `Backspace` / `←` | PREV address |
| `M` | EXMEM (address entry mode) |
| `D` | DATA REG (data edit mode) |
| `E` | EXREG (examine registers) |
| `G` / `Space` | GO (execute program) |
| `S` / `T` | STEP (single instruction) |
| `R` / `Esc` | RESET |

## Run Locally

```bash
# Option 1: Any static server
npx serve .

# Option 2: Python
python -m http.server 3000

# Option 3: Just open index.html
# (yes, it works. it's a static site.)
```

## Deploy to Vercel

```bash
# Install Vercel CLI (if you haven't)
npm i -g vercel

# Deploy
vercel --prod
```

Or just connect your GitHub repo to [vercel.com](https://vercel.com) and it auto-deploys on every push.

## Tech Stack

- **HTML** — structure
- **CSS** — obsidian-dark glassmorphic theme with 3D neumorphic controls
- **JavaScript** — vanilla, zero dependencies, zero frameworks
- **Total size** — under 150KB. Your professor's PowerPoint is bigger.

## Architecture

```
├── index.html        # UI layout — PCB board, registers, editor, memory table
├── styles.css        # Design system — responsive from 375px to 4K
├── simulator.js      # CPU emulator, assembler, trainer board logic
├── vercel.json       # Deployment config
├── package.json      # Scripts and metadata
└── .gitignore        # Keep it clean
```

## Intel 8085 Flag Behavior

This simulator accurately implements Intel 8085 flag specifications:

- **ANA/ANI**: Sets AC=1, clears CY=0
- **ORA/ORI/XRA/XRI**: Clears both AC=0 and CY=0
- **INR/DCR**: Modifies S, Z, AC, P — preserves CY
- **ADD/SUB/CMP**: Full flag computation including auxiliary carry

## License

MIT — do whatever you want with it. Just don't blame us if you fail your viva.
