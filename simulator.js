// 8085 Microprocessor Simulator Core & IDE Bindings
// Designed with Premium Quality, Pure Javascript, Offline Capable

// CPU State
const cpu = {
    // 8-bit registers
    a: 0, b: 0, c: 0, d: 0, e: 0, h: 0, l: 0,
    
    // Status flags (Sign, Zero, Auxiliary Carry, Parity, Carry)
    f: { s: 0, z: 0, ac: 0, p: 0, cy: 0 },
    
    // 16-bit special registers
    pc: 0x2000, // Program Counter starts at 2000H by default
    sp: 0xFFFF, // Stack Pointer starts at FFFFH
    
    // Memory space: 64KB
    memory: new Uint8Array(65536),
    
    // System status
    halted: true,
    running: false,
    cycles: 0,
    
    // Debugging helpers
    addressToLineNo: {}, // Maps memory address to source line number
    lineToAddress: {}    // Maps source line number to memory address
};

// UI Active state
let activeTab = 'memory';
let consoleLog = [];
let runInterval = null;
let delayMs = 100; // Step speed in ms

// Opcodes & Assembly syntax definition for compilation
const REGISTER_CODES = { 'A': 7, 'B': 0, 'C': 1, 'D': 2, 'E': 3, 'H': 4, 'L': 5, 'M': 6 };
const PAIR_CODES = { 'B': 0, 'D': 1, 'H': 2, 'SP': 3 };

// Pre-loaded recipe programs for the 7 Lab Experiments
const PRESETS = {
    exp1: `; Experiment 01: Introduction to 8085
; Objective: Write an assembly language program to add two numbers.
; Input: Register A = 05H, Register B = 08H
; Output: Stored at address 3000H

MVI A, 05H     ; Load first number 05H into Accumulator
MVI B, 08H     ; Load second number 08H into Register B
ADD B          ; Add B to Accumulator (A = A + B)
STA 3000H      ; Store result (0DH) at memory address 3000H
HLT            ; Halt execution
`,
    exp2: `; Experiment 02: Sequential Sum Storage
; Objective: Add two 8-bit numbers and store numbers and their sum
;            in sequential memory locations (2400H, 2401H, and 2402H).
; Input: Pre-set memory locations 2400H and 2401H
; Output: Stored at address 2402H

LDA 2400H      ; Load first number from memory location 2400H
MOV B, A       ; Save first number in Register B
LDA 2401H      ; Load second number from memory location 2401H
ADD B          ; Add first number to Accumulator (A = A + B)
STA 2402H      ; Store sum at memory location 2402H
HLT            ; Halt execution
`,
    exp3: `; Experiment 03: Addition with Carry (Overflow)
; Objective: Add two 8-bit numbers, taking potential overflow
;            into account, and store 8-bit result and Carry.
; Input: F5H (245 dec) and 15H (21 dec). Sum overflows 255.
; Output: Sum stored at 3000H, Carry stored at 3001H

MVI A, F5H     ; Load Accumulator with F5H
MVI B, 15H     ; Load Register B with 15H
MVI C, 00H     ; Clear Register C to store Carry (C = 0)
ADD B          ; Add B to Accumulator (A = A + B)
JNC SAVE       ; If Carry flag is 0 (no carry), jump to SAVE
INR C          ; Increment C if carry was generated (C = C + 1)
SAVE:
STA 3000H      ; Store 8-bit sum (0AH) at memory address 3000H
MOV A, C       ; Load Carry value (01H) into Accumulator
STA 3001H      ; Store Carry at memory address 3001H
HLT            ; Halt execution
`,
    exp4: `; Experiment 04: Subtraction using 2's Complement
; Objective: Subtract two 8-bit numbers using 2's complement internally.
; Input: A = 20H, B = 05H (Subtract B from A)
; Output: Stored at address 3000H

MVI A, 20H     ; Load minuend (20H) into Accumulator
MVI B, 05H     ; Load subtrahend (05H) into Register B
SUB B          ; Subtract B from A (A = A - B)
STA 3000H      ; Store result (1BH) at memory address 3000H
HLT            ; Halt execution
`,
    exp5: `; Experiment 05: Find Larger of Two Numbers
; Objective: Find the larger of two given 8-bit numbers.
; Input: A = 25H, B = 42H
; Output: Larger value stored at address 3000H

MVI A, 25H     ; Load first number 25H into Accumulator
MVI B, 42H     ; Load second number 42H into Register B
CMP B          ; Compare Accumulator with B (A - B, updates flags)
JNC SAVE_A     ; If A >= B (no carry), jump to SAVE_A
MOV A, B       ; Else, B is larger. Copy B to Accumulator (A = B)
SAVE_A:
STA 3000H      ; Store the larger number at address 3000H
HLT            ; Halt execution
`,
    exp6: `; Experiment 06: Find Smaller of Two Numbers
; Objective: Find the smaller of two given 8-bit numbers.
; Input: A = 45H, B = 18H
; Output: Smaller value stored at address 3000H

MVI A, 45H     ; Load first number 45H into Accumulator
MVI B, 18H     ; Load second number 18H into Register B
CMP B          ; Compare Accumulator with B (A - B)
JC SAVE_A      ; If A < B (carry is set), jump to SAVE_A
MOV A, B       ; Else, B is smaller. Copy B to Accumulator
SAVE_A:
STA 3000H      ; Store the smaller number at address 3000H
HLT            ; Halt execution
`,
    exp7: `; Experiment 07: Largest Number in an Array
; Objective: Find the largest number in a given array of numbers.
; Input: Array length at 3000H, array data starting at 3001H
; Output: Largest number stored at address 3100H

LXI H, 3000H   ; HL points to count location (3000H)
MOV C, M       ; Load count into Register C
INX H          ; Point HL to first data element (3001H)
MOV A, M       ; Set Accumulator as initial Max
DCR C          ; Decrement loop counter since first element is loaded
LOOP:
INX H          ; Point HL to next data element
CMP M          ; Compare current Max (A) with next element (M)
JNC SKIP       ; If Max (A) >= M, jump to SKIP
MOV A, M       ; Else, M is larger. Set Max (A = M)
SKIP:
DCR C          ; Decrement loop counter
JNZ LOOP       ; Jump to LOOP if counter Register C is not 0
STA 3100H      ; Store largest number at address 3100H
HLT            ; Halt execution
`
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // Set initial preset
    loadPreset('exp1');
    initMemoryTable();
    updateUI();
    
    // Bind console
    addLog("Prince Simulator initialized. No 8085 kits were harmed.", "success");
    addLog("Default execution base: 2000H. The sacred starting address.", "info");
    
    // Bind textarea scrolling for line numbers
    const textarea = document.getElementById('code-editor');
    const lineNumbers = document.getElementById('line-numbers');
    textarea.addEventListener('scroll', () => {
        lineNumbers.scrollTop = textarea.scrollTop;
    });
    
    textarea.addEventListener('input', () => {
        updateLineNumbers();
    });
    updateLineNumbers();
    
    // PCB board responsive scaling
    resizePcb();
    window.addEventListener('resize', resizePcb);
});

// --- UI Utility Functions ---
function openLogoLightbox() {
    const lightbox = document.getElementById('logo-lightbox');
    if (lightbox) {
        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeLogoLightbox() {
    const lightbox = document.getElementById('logo-lightbox');
    if (lightbox) {
        lightbox.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Add escape key handler for logo lightbox
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeLogoLightbox();
    }
});

function addLog(text, type = "info") {
    const time = new Date().toLocaleTimeString();
    consoleLog.push({ time, text, type });
    if (consoleLog.length > 50) consoleLog.shift();
    
    const consoleBox = document.getElementById('console');
    if (consoleBox) {
        consoleBox.innerHTML = consoleLog.map(log => 
            `<div class="console-line">
                <span class="console-time">[${log.time}]</span>
                <span class="console-${log.type}">${log.text}</span>
             </div>`
        ).join('');
        consoleBox.scrollTop = consoleBox.scrollHeight;
    }
}

function showToast(text, type = "success") {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = '●';
    if (type === 'success') icon = '✓';
    if (type === 'error') icon = '✗';
    if (type === 'warn') icon = '!';
    
    toast.innerHTML = `<span>${icon}</span> <span>${text}</span>`;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function loadPreset(name) {
    if (PRESETS[name]) {
        document.getElementById('code-editor').value = PRESETS[name];
        updateLineNumbers();
        
        // Sync HTML select dropdown if not already matched
        const selectEl = document.getElementById('experiment-select');
        if (selectEl && selectEl.value !== name) {
            selectEl.value = name;
        }
        
        const expLabel = name.toUpperCase().replace('EXP', 'Experiment 0');
        showToast(`Loaded ${expLabel}!`, "success");
        addLog(`Loaded ${expLabel} workspace preset.`, "success");
        resetCpu();
        
        // Auto-configure physical memory inputs so experiments work immediately
        if (name === 'exp2') {
            cpu.memory[0x2400] = 0x12; // Input 1: 18 decimal
            cpu.memory[0x2401] = 0x25; // Input 2: 37 decimal
            cpu.memory[0x2402] = 0x00; // Clear sum
            addLog("Experiment 02 preloaded. Preset Inputs: [2400H] = 12H, [2401H] = 25H.", "info");
            refreshMemoryTable();
        } else if (name === 'exp7') {
            cpu.memory[0x3000] = 0x05; // Array size: 5 elements
            cpu.memory[0x3001] = 0x42; // Elem 1
            cpu.memory[0x3002] = 0x1A; // Elem 2
            cpu.memory[0x3003] = 0xF5; // Elem 3 (Expected Max!)
            cpu.memory[0x3004] = 0x8D; // Elem 4
            cpu.memory[0x3005] = 0x6C; // Elem 5
            cpu.memory[0x3100] = 0x00; // Clear output
            addLog("Experiment 07 preloaded. Count: 05 at 3000H, Array: [42H, 1AH, F5H, 8DH, 6CH] at 3001H-3005H.", "info");
            refreshMemoryTable();
        }
    }
}

function updateLineNumbers() {
    const textarea = document.getElementById('code-editor');
    const lineNumbers = document.getElementById('line-numbers');
    const lines = textarea.value.split('\n').length;
    lineNumbers.innerHTML = Array(lines).fill(0).map((_, i) => i + 1).join('<br>');
}

function switchTab(tabId) {
    activeTab = tabId;
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `${tabId}-tab`);
    });
    
    // Reflow PCB scaling after tab switch
    setTimeout(resizePcb, 50);
}

// --- Number Helpers ---
function toHex8(num) {
    return (num & 0xFF).toString(16).toUpperCase().padStart(2, '0') + 'H';
}

function toHex16(num) {
    return (num & 0xFFFF).toString(16).toUpperCase().padStart(4, '0') + 'H';
}

function parseHexDec(str) {
    str = str.trim();
    if (str.toUpperCase().endsWith('H')) {
        return parseInt(str.slice(0, -1), 16);
    }
    if (str.startsWith('0x') || str.startsWith('0X')) {
        return parseInt(str, 16);
    }
    return parseInt(str, 10);
}

// --- UI Status Updates ---
let prevValues = {};
function flashAndUpdate(elementId, val, formatFn) {
    const el = document.getElementById(elementId);
    if (!el) return;
    
    const formatted = formatFn(val);
    const prev = prevValues[elementId];
    
    if (prev !== undefined && prev !== formatted) {
        el.parentElement.classList.add('flash-change');
        setTimeout(() => {
            el.parentElement.classList.remove('flash-change');
        }, 800);
    }
    
    el.innerText = formatted.replace('H', '');
    prevValues[elementId] = formatted;
}

function updateUI() {
    // Registers
    flashAndUpdate('reg-a', cpu.a, toHex8);
    flashAndUpdate('reg-b', cpu.b, toHex8);
    flashAndUpdate('reg-c', cpu.c, toHex8);
    flashAndUpdate('reg-d', cpu.d, toHex8);
    flashAndUpdate('reg-e', cpu.e, toHex8);
    flashAndUpdate('reg-h', cpu.h, toHex8);
    flashAndUpdate('reg-l', cpu.l, toHex8);
    
    // Register Binaries
    document.getElementById('reg-a-bin').innerText = cpu.a.toString(2).padStart(8, '0');
    document.getElementById('reg-b-bin').innerText = cpu.b.toString(2).padStart(8, '0');
    document.getElementById('reg-c-bin').innerText = cpu.c.toString(2).padStart(8, '0');
    document.getElementById('reg-d-bin').innerText = cpu.d.toString(2).padStart(8, '0');
    document.getElementById('reg-e-bin').innerText = cpu.e.toString(2).padStart(8, '0');
    document.getElementById('reg-h-bin').innerText = cpu.h.toString(2).padStart(8, '0');
    document.getElementById('reg-l-bin').innerText = cpu.l.toString(2).padStart(8, '0');
 
    // Program Flow
    flashAndUpdate('reg-pc', cpu.pc, toHex16);
    flashAndUpdate('reg-sp', cpu.sp, toHex16);
    
    const headerPc = document.getElementById('header-pc');
    if (headerPc) {
        headerPc.innerText = toHex16(cpu.pc).replace('H', '');
    }
    
    // Status Badge
    const dot = document.getElementById('status-dot');
    const lbl = document.getElementById('status-lbl');
    if (cpu.running) {
        dot.className = 'status-dot running';
        lbl.innerText = 'RUNNING';
    } else if (cpu.halted) {
        dot.className = 'status-dot halted';
        lbl.innerText = 'HALTED';
    } else {
        dot.className = 'status-dot idle';
        lbl.innerText = 'IDLE (COMPILED)';
    }
    
    // Physical PCB LEDs synchronization
    const ledPwr = document.getElementById('led-pwr');
    const ledRun = document.getElementById('led-run');
    const ledHlt = document.getElementById('led-hlt');
    const ledCy = document.getElementById('led-cy');
    
    if (ledPwr) ledPwr.classList.add('active'); // PWR always ON
    if (ledRun) ledRun.classList.toggle('active', cpu.running);
    if (ledHlt) ledHlt.classList.toggle('active', cpu.halted && !cpu.running);
    if (ledCy) ledCy.classList.toggle('active', cpu.f.cy === 1);
    
    // Flags
    updateFlagUI('flag-s', cpu.f.s, 7);
    updateFlagUI('flag-z', cpu.f.z, 6);
    updateFlagUI('flag-ac', cpu.f.ac, 4);
    updateFlagUI('flag-p', cpu.f.p, 2);
    updateFlagUI('flag-cy', cpu.f.cy, 0);
 
    // Refresh memory table if active
    updateMemoryTablePC();
    
    // Update Trainer kit display if loaded
    updateTrainerDisplay();
}

function updateFlagUI(elementId, val, bit) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.classList.toggle('active', val === 1);
    el.querySelector('.flag-bit').innerText = val;
}

// --- Memory Visualizer ---
let memoryStart = 0x2000;
function initMemoryTable() {
    refreshMemoryTable();
}

function refreshMemoryTable() {
    const tableBody = document.getElementById('memory-table-body');
    if (!tableBody) return;
    
    let html = '';
    for (let i = 0; i < 30; i++) {
        let addr = (memoryStart + i) & 0xFFFF;
        let hexVal = cpu.memory[addr].toString(16).toUpperCase().padStart(2, '0');
        let activeClass = (addr === cpu.pc) ? 'active-pc' : '';
        
        html += `
            <tr class="memory-row ${activeClass}" id="mem-row-${addr}">
                <td>${toHex16(addr)}</td>
                <td>
                    <input type="text" class="mem-cell-input" value="${hexVal}" 
                           onchange="onMemoryCellEdit(${addr}, this.value)" maxlength="2">
                </td>
                <td>${cpu.memory[addr]}</td>
                <td style="color: var(--text-dark); font-size: 0.7rem;">${getMemoryOpcodeDescription(addr)}</td>
            </tr>
        `;
    }
    tableBody.innerHTML = html;
}

function updateMemoryTablePC() {
    document.querySelectorAll('.memory-row').forEach(row => {
        row.classList.remove('active-pc');
    });
    const activeRow = document.getElementById(`mem-row-${cpu.pc}`);
    if (activeRow) {
        activeRow.classList.add('active-pc');
    }
}

function onMemoryCellEdit(addr, valStr) {
    let val = parseInt(valStr, 16);
    if (isNaN(val) || val < 0 || val > 255) {
        showToast("Invalid Hex byte (00 to FF)", "error");
        refreshMemoryTable();
        return;
    }
    cpu.memory[addr] = val;
    addLog(`Memory at ${toHex16(addr)} modified to ${toHex8(val)}`, "info");
    refreshMemoryTable();
}

function shiftMemoryView(delta) {
    memoryStart = (memoryStart + delta) & 0xFFFF;
    refreshMemoryTable();
}

function searchMemory() {
    let input = document.getElementById('memory-search').value;
    let addr = parseHexDec(input);
    if (isNaN(addr) || addr < 0 || addr > 65535) {
        showToast("Invalid Memory Address", "error");
        return;
    }
    memoryStart = addr;
    refreshMemoryTable();
    showToast(`Jumped to memory location ${toHex16(addr)}`, "success");
}

function getMemoryOpcodeDescription(addr) {
    // Small descriptions for visual cues
    let b = cpu.memory[addr];
    if (b === 0x76) return "HLT (Halt)";
    if (b === 0x00) return "NOP (No-Op)";
    if (b === 0x3E) return `MVI A, ${cpu.memory[(addr+1)&0xFFFF].toString(16).toUpperCase()}H`;
    return "";
}

// --- The Assembler Core ---
function compileCode() {
    const code = document.getElementById('code-editor').value;
    const lines = code.split('\n');
    
    let baseAddress = 0x2000; // Standard 8085 starting point
    cpu.lineToAddress = {};
    cpu.addressToLineNo = {};
    
    // First Pass: Record Labels & compute sizes
    const labels = {};
    let currentAddress = baseAddress;
    
    addLog("Starting compilation pass 1 (Resolving labels)...", "info");
    
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        // Remove comments
        const commentIdx = line.indexOf(';');
        if (commentIdx !== -1) {
            line = line.substring(0, commentIdx).trim();
        }
        
        if (line === '') continue;
        
        // Check for Label
        const colonIdx = line.indexOf(':');
        if (colonIdx !== -1) {
            let labelName = line.substring(0, colonIdx).trim().toUpperCase();
            labels[labelName] = currentAddress;
            addLog(`Found label: "${labelName}" mapping to address ${toHex16(currentAddress)}`, "info");
            
            // Remove label from execution line
            line = line.substring(colonIdx + 1).trim();
            if (line === '') continue;
        }
        
        // Estimate line instruction size
        let size = estimateInstructionSize(line);
        if (size === 0) {
            showToast(`Compilation Error at Line ${i+1}: Unknown instruction format`, "error");
            addLog(`Error: Syntax error on line ${i+1}: "${line}"`, "error");
            return;
        }
        
        cpu.lineToAddress[i] = currentAddress;
        currentAddress += size;
    }
    
    // Second Pass: Assemble instructions into Opcodes in memory
    addLog("Starting compilation pass 2 (Generating Opcodes)...", "info");
    
    // Clear simulation memory range first (from 2000H to currentAddress)
    for (let a = baseAddress; a <= currentAddress + 10; a++) {
        cpu.memory[a] = 0;
    }
    
    let compilePc = baseAddress;
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        const commentIdx = line.indexOf(';');
        if (commentIdx !== -1) {
            line = line.substring(0, commentIdx).trim();
        }
        if (line === '') continue;
        
        const colonIdx = line.indexOf(':');
        if (colonIdx !== -1) {
            line = line.substring(colonIdx + 1).trim();
            if (line === '') continue;
        }
        
        let bytes = assembleLine(line, compilePc, labels);
        if (!bytes || bytes.error) {
            let errorMsg = bytes && bytes.error ? bytes.error : `Unknown instruction "${line}"`;
            showToast(`Line ${i+1}: ${errorMsg}`, "error");
            addLog(`Compile Error [Line ${i+1}]: ${errorMsg}`, "error");
            return;
        }
        
        // Write to Simulated CPU Memory
        for (let b = 0; b < bytes.length; b++) {
            let addr = (compilePc + b) & 0xFFFF;
            cpu.memory[addr] = bytes[b];
            cpu.addressToLineNo[addr] = i + 1; // Map address to 1-indexed line no
        }
        
        compilePc += bytes.length;
    }
    
    // Init CPU pointer
    cpu.pc = baseAddress;
    cpu.halted = false;
    cpu.running = false;
    
    showToast("Assembly Code Compiled Successfully!", "success");
    addLog(`Build complete! Opcodes injected from ${toHex16(baseAddress)} to ${toHex16(compilePc - 1)}.`, "success");
    
    refreshMemoryTable();
    updateUI();
}

function estimateInstructionSize(line) {
    const tokens = line.toUpperCase().replace(/,/g, ' ').split(/\s+/).filter(t => t !== '');
    if (tokens.length === 0) return 0;
    
    const instr = tokens[0];
    
    // 3 Byte Instructions (LXI, LDA, STA, JMP, JZ, JNZ, JC, JNC, JP, JM, LHLD, SHLD)
    if (['LXI', 'LDA', 'STA', 'JMP', 'JZ', 'JNZ', 'JC', 'JNC', 'JP', 'JM', 'LHLD', 'SHLD'].includes(instr)) {
        return 3;
    }
    
    // 2 Byte Instructions (MVI, ADI, SUI, CPI, ANI, ORI, XRI)
    if (['MVI', 'ADI', 'SUI', 'CPI', 'ANI', 'ORI', 'XRI'].includes(instr)) {
        return 2;
    }
    
    // 1 Byte Instructions (MOV, ADD, SUB, INR, DCR, INX, DCX, CMP, ANA, ORA, XRA, CMA, HLT, NOP, STAX, LDAX)
    if (['MOV', 'ADD', 'SUB', 'INR', 'DCR', 'INX', 'DCX', 'CMP', 'ANA', 'ORA', 'XRA', 'CMA', 'HLT', 'NOP', 'STAX', 'LDAX'].includes(instr)) {
        return 1;
    }
    
    return 0;
}

function assembleLine(line, currentAddr, labels) {
    const tokens = line.toUpperCase().replace(/,/g, ' ').split(/\s+/).filter(t => t !== '');
    if (tokens.length === 0) return [];
    
    const instr = tokens[0];
    
    // Helper to evaluate values or labels
    function getValue(valStr) {
        valStr = valStr.trim();
        if (labels[valStr] !== undefined) {
            return labels[valStr];
        }
        return parseHexDec(valStr);
    }
    
    try {
        switch (instr) {
            case 'NOP': return [0x00];
            case 'HLT': return [0x76];
            case 'CMA': return [0x2F];
            
            case 'MOV': {
                if (!tokens[1]) throw new Error('MOV requires a destination register (e.g., MOV A, B)');
                if (!tokens[2]) throw new Error(`MOV ${tokens[1]} requires a source register (e.g., MOV ${tokens[1]}, B)`);
                let dest = tokens[1];
                let src = tokens[2];
                let dCode = REGISTER_CODES[dest];
                let sCode = REGISTER_CODES[src];
                if (dCode === undefined || sCode === undefined) return null;
                return [0x40 + (dCode << 3) + sCode];
            }
            
            case 'MVI': {
                if (!tokens[1]) throw new Error('MVI requires a register operand (e.g., MVI A, 05H)');
                if (!tokens[2]) throw new Error(`MVI ${tokens[1]} requires a data byte (e.g., MVI ${tokens[1]}, 05H)`);
                let reg = tokens[1];
                let data = getValue(tokens[2]);
                let rCode = REGISTER_CODES[reg];
                if (rCode === undefined || isNaN(data)) return null;
                return [0x06 + (rCode << 3), data & 0xFF];
            }
            
            case 'LXI': {
                if (!tokens[1]) throw new Error('LXI requires a register pair (e.g., LXI H, 2000H)');
                if (!tokens[2]) throw new Error(`LXI ${tokens[1]} requires a 16-bit value (e.g., LXI ${tokens[1]}, 2000H)`);
                let rp = tokens[1];
                let data16 = getValue(tokens[2]);
                let rpCode = PAIR_CODES[rp];
                if (rpCode === undefined || isNaN(data16)) return null;
                return [0x01 + (rpCode << 4), data16 & 0xFF, (data16 >> 8) & 0xFF];
            }
            
            case 'LDA': {
                if (!tokens[1]) throw new Error('LDA requires a memory address (e.g., LDA 2400H)');
                let addr = getValue(tokens[1]);
                if (isNaN(addr)) return null;
                return [0x3A, addr & 0xFF, (addr >> 8) & 0xFF];
            }
            
            case 'STA': {
                if (!tokens[1]) throw new Error('STA requires a memory address (e.g., STA 3000H)');
                let addr = getValue(tokens[1]);
                if (isNaN(addr)) return null;
                return [0x32, addr & 0xFF, (addr >> 8) & 0xFF];
            }
            
            case 'LHLD': {
                if (!tokens[1]) throw new Error('LHLD requires a memory address (e.g., LHLD 2500H)');
                let addr = getValue(tokens[1]);
                if (isNaN(addr)) return null;
                return [0x2A, addr & 0xFF, (addr >> 8) & 0xFF];
            }
            
            case 'SHLD': {
                if (!tokens[1]) throw new Error('SHLD requires a memory address (e.g., SHLD 2500H)');
                let addr = getValue(tokens[1]);
                if (isNaN(addr)) return null;
                return [0x22, addr & 0xFF, (addr >> 8) & 0xFF];
            }
            
            case 'STAX': {
                if (!tokens[1]) throw new Error('STAX requires a register pair B or D (e.g., STAX B)');
                let rp = tokens[1];
                if (rp === 'B') return [0x02];
                if (rp === 'D') return [0x12];
                return null;
            }
            
            case 'LDAX': {
                if (!tokens[1]) throw new Error('LDAX requires a register pair B or D (e.g., LDAX D)');
                let rp = tokens[1];
                if (rp === 'B') return [0x0A];
                if (rp === 'D') return [0x1A];
                return null;
            }
            
            case 'ADD': {
                if (!tokens[1]) throw new Error('ADD requires a register operand (e.g., ADD B)');
                let reg = tokens[1];
                let rCode = REGISTER_CODES[reg];
                if (rCode === undefined) return null;
                return [0x80 + rCode];
            }
            
            case 'ADI': {
                if (!tokens[1]) throw new Error('ADI requires an immediate data byte (e.g., ADI 05H)');
                let data = getValue(tokens[1]);
                if (isNaN(data)) return null;
                return [0xC6, data & 0xFF];
            }
            
            case 'SUB': {
                if (!tokens[1]) throw new Error('SUB requires a register operand (e.g., SUB B)');
                let reg = tokens[1];
                let rCode = REGISTER_CODES[reg];
                if (rCode === undefined) return null;
                return [0x90 + rCode];
            }
            
            case 'SUI': {
                if (!tokens[1]) throw new Error('SUI requires an immediate data byte (e.g., SUI 05H)');
                let data = getValue(tokens[1]);
                if (isNaN(data)) return null;
                return [0xD6, data & 0xFF];
            }
            
            case 'CMP': {
                if (!tokens[1]) throw new Error('CMP requires a register operand (e.g., CMP B)');
                let reg = tokens[1];
                let rCode = REGISTER_CODES[reg];
                if (rCode === undefined) return null;
                return [0xB8 + rCode];
            }
            
            case 'CPI': {
                if (!tokens[1]) throw new Error('CPI requires an immediate data byte (e.g., CPI 42H)');
                let data = getValue(tokens[1]);
                if (isNaN(data)) return null;
                return [0xFE, data & 0xFF];
            }
            
            case 'INR': {
                if (!tokens[1]) throw new Error('INR requires a register operand (e.g., INR A)');
                let reg = tokens[1];
                let rCode = REGISTER_CODES[reg];
                if (rCode === undefined) return null;
                return [0x04 + (rCode << 3)];
            }
            
            case 'DCR': {
                if (!tokens[1]) throw new Error('DCR requires a register operand (e.g., DCR C)');
                let reg = tokens[1];
                let rCode = REGISTER_CODES[reg];
                if (rCode === undefined) return null;
                return [0x05 + (rCode << 3)];
            }
            
            case 'INX': {
                if (!tokens[1]) throw new Error('INX requires a register pair (e.g., INX H)');
                let rp = tokens[1];
                let rpCode = PAIR_CODES[rp];
                if (rpCode === undefined) return null;
                return [0x03 + (rpCode << 4)];
            }
            
            case 'DCX': {
                if (!tokens[1]) throw new Error('DCX requires a register pair (e.g., DCX H)');
                let rp = tokens[1];
                let rpCode = PAIR_CODES[rp];
                if (rpCode === undefined) return null;
                return [0x0B + (rpCode << 4)];
            }
            
            case 'ANA': {
                if (!tokens[1]) throw new Error('ANA requires a register operand (e.g., ANA B)');
                let reg = tokens[1];
                let rCode = REGISTER_CODES[reg];
                if (rCode === undefined) return null;
                return [0xA0 + rCode];
            }
            
            case 'ANI': {
                if (!tokens[1]) throw new Error('ANI requires an immediate data byte (e.g., ANI 0FH)');
                let data = getValue(tokens[1]);
                if (isNaN(data)) return null;
                return [0xE6, data & 0xFF];
            }
            
            case 'ORA': {
                if (!tokens[1]) throw new Error('ORA requires a register operand (e.g., ORA C)');
                let reg = tokens[1];
                let rCode = REGISTER_CODES[reg];
                if (rCode === undefined) return null;
                return [0xB0 + rCode];
            }
            
            case 'ORI': {
                if (!tokens[1]) throw new Error('ORI requires an immediate data byte (e.g., ORI F0H)');
                let data = getValue(tokens[1]);
                if (isNaN(data)) return null;
                return [0xF6, data & 0xFF];
            }
            
            case 'XRA': {
                if (!tokens[1]) throw new Error('XRA requires a register operand (e.g., XRA A)');
                let reg = tokens[1];
                let rCode = REGISTER_CODES[reg];
                if (rCode === undefined) return null;
                return [0xA8 + rCode];
            }
            
            case 'XRI': {
                if (!tokens[1]) throw new Error('XRI requires an immediate data byte (e.g., XRI FFH)');
                let data = getValue(tokens[1]);
                if (isNaN(data)) return null;
                return [0xEE, data & 0xFF];
            }
            
            case 'JMP': {
                if (!tokens[1]) throw new Error('JMP requires a target address or label (e.g., JMP 2000H)');
                let addr = getValue(tokens[1]);
                if (isNaN(addr)) return null;
                return [0xC3, addr & 0xFF, (addr >> 8) & 0xFF];
            }
            
            case 'JZ': {
                if (!tokens[1]) throw new Error('JZ requires a target address or label (e.g., JZ LOOP)');
                let addr = getValue(tokens[1]);
                if (isNaN(addr)) return null;
                return [0xCA, addr & 0xFF, (addr >> 8) & 0xFF];
            }
            
            case 'JNZ': {
                if (!tokens[1]) throw new Error('JNZ requires a target address or label (e.g., JNZ LOOP)');
                let addr = getValue(tokens[1]);
                if (isNaN(addr)) return null;
                return [0xC2, addr & 0xFF, (addr >> 8) & 0xFF];
            }
            
            case 'JC': {
                if (!tokens[1]) throw new Error('JC requires a target address or label (e.g., JC SAVE)');
                let addr = getValue(tokens[1]);
                if (isNaN(addr)) return null;
                return [0xDA, addr & 0xFF, (addr >> 8) & 0xFF];
            }
            
            case 'JNC': {
                if (!tokens[1]) throw new Error('JNC requires a target address or label (e.g., JNC SKIP)');
                let addr = getValue(tokens[1]);
                if (isNaN(addr)) return null;
                return [0xD2, addr & 0xFF, (addr >> 8) & 0xFF];
            }
            
            case 'JP': {
                if (!tokens[1]) throw new Error('JP requires a target address or label (e.g., JP DONE)');
                let addr = getValue(tokens[1]);
                if (isNaN(addr)) return null;
                return [0xF2, addr & 0xFF, (addr >> 8) & 0xFF];
            }
            
            case 'JM': {
                if (!tokens[1]) throw new Error('JM requires a target address or label (e.g., JM NEG)');
                let addr = getValue(tokens[1]);
                if (isNaN(addr)) return null;
                return [0xFA, addr & 0xFF, (addr >> 8) & 0xFF];
            }
        }
    } catch(e) {
        return { error: e.message };
    }
    
    return null;
}

// --- The CPU Emulator Execution Core ---

function getRegValue(code) {
    if (code === 7) return cpu.a;
    if (code === 0) return cpu.b;
    if (code === 1) return cpu.c;
    if (code === 2) return cpu.d;
    if (code === 3) return cpu.e;
    if (code === 4) return cpu.h;
    if (code === 5) return cpu.l;
    if (code === 6) { // Memory pointed by HL
        let hl = (cpu.h << 8) | cpu.l;
        return cpu.memory[hl];
    }
}

function setRegValue(code, val) {
    val = val & 0xFF;
    if (code === 7) cpu.a = val;
    else if (code === 0) cpu.b = val;
    else if (code === 1) cpu.c = val;
    else if (code === 2) cpu.d = val;
    else if (code === 3) cpu.e = val;
    else if (code === 4) cpu.h = val;
    else if (code === 5) cpu.l = val;
    else if (code === 6) { // Memory pointed by HL
        let hl = (cpu.h << 8) | cpu.l;
        cpu.memory[hl] = val;
    }
}

function getPairValue(rpCode) {
    if (rpCode === 0) return (cpu.b << 8) | cpu.c;
    if (rpCode === 1) return (cpu.d << 8) | cpu.e;
    if (rpCode === 2) return (cpu.h << 8) | cpu.l;
    if (rpCode === 3) return cpu.sp;
}

function setPairValue(rpCode, val) {
    val = val & 0xFFFF;
    let high = (val >> 8) & 0xFF;
    let low = val & 0xFF;
    if (rpCode === 0) { cpu.b = high; cpu.c = low; }
    else if (rpCode === 1) { cpu.d = high; cpu.e = low; }
    else if (rpCode === 2) { cpu.h = high; cpu.l = low; }
    else if (rpCode === 3) { cpu.sp = val; }
}

// Update Flags based on operation result
function updateFlags(result, operandA = null, operandB = null, isSubtraction = false) {
    let res8 = result & 0xFF;
    
    // Sign flag (S)
    cpu.f.s = (res8 & 0x80) ? 1 : 0;
    
    // Zero flag (Z)
    cpu.f.z = (res8 === 0) ? 1 : 0;
    
    // Parity flag (P) - Even Parity
    let ones = 0;
    for (let i = 0; i < 8; i++) {
        if (res8 & (1 << i)) ones++;
    }
    cpu.f.p = (ones % 2 === 0) ? 1 : 0;
    
    // Carry Flag (CY)
    if (result > 0xFF || result < 0) {
        cpu.f.cy = 1;
    } else {
        cpu.f.cy = 0;
    }
    
    // Auxiliary Carry Flag (AC) - Mock arithmetic half carry
    if (operandA !== null && operandB !== null) {
        if (isSubtraction) {
            cpu.f.ac = (((operandA & 0x0F) - (operandB & 0x0F)) < 0) ? 1 : 0;
        } else {
            cpu.f.ac = (((operandA & 0x0F) + (operandB & 0x0F)) > 0x0F) ? 1 : 0;
        }
    }
}

// Single step instruction
function stepExecution() {
    if (cpu.halted) {
        showToast("CPU is in HALT state. Click Reset to start again.", "warn");
        addLog("Status: Execution halted.", "warn");
        stopSimulation();
        return false;
    }
    
    let opcode = cpu.memory[cpu.pc];
    let startPc = cpu.pc;
    
    // Fetch operands based on size
    let size = estimateInstructionSizeByOpcode(opcode);
    let byte1 = cpu.memory[(cpu.pc + 1) & 0xFFFF];
    let byte2 = cpu.memory[(cpu.pc + 2) & 0xFFFF];
    let word16 = (byte2 << 8) | byte1;
    
    // Highlight line inside the editor
    let lineNo = cpu.addressToLineNo[cpu.pc];
    if (lineNo) {
        highlightEditorLine(lineNo);
    }
    
    // Move PC forward
    cpu.pc = (cpu.pc + size) & 0xFFFF;
    cpu.cycles++;
    
    // Decode Opcode
    // 1. MOV instructions (0x40 to 0x7F, except 0x76 HLT)
    if (opcode >= 0x40 && opcode <= 0x7F && opcode !== 0x76) {
        let dest = (opcode >> 3) & 0x7;
        let src = opcode & 0x7;
        setRegValue(dest, getRegValue(src));
    }
    
    // 2. MVI instructions (0x06 + (reg<<3))
    else if ((opcode & 0xC7) === 0x06) {
        let reg = (opcode >> 3) & 0x7;
        setRegValue(reg, byte1);
    }
    
    // 3. LXI instructions (0x01 + (rp<<4))
    else if ((opcode & 0xCF) === 0x01) {
        let rp = (opcode >> 4) & 0x3;
        setPairValue(rp, word16);
    }
    
    // 4. LDA & STA
    else if (opcode === 0x3A) { // LDA a16
        cpu.a = cpu.memory[word16];
    }
    else if (opcode === 0x32) { // STA a16
        cpu.memory[word16] = cpu.a;
    }
    
    // 5. LHLD & SHLD
    else if (opcode === 0x2A) { // LHLD a16
        cpu.l = cpu.memory[word16];
        cpu.h = cpu.memory[(word16 + 1) & 0xFFFF];
    }
    else if (opcode === 0x22) { // SHLD a16
        cpu.memory[word16] = cpu.l;
        cpu.memory[(word16 + 1) & 0xFFFF] = cpu.h;
    }
    
    // 6. STAX & LDAX
    else if (opcode === 0x02) { // STAX B
        let addr = getPairValue(0);
        cpu.memory[addr] = cpu.a;
    }
    else if (opcode === 0x12) { // STAX D
        let addr = getPairValue(1);
        cpu.memory[addr] = cpu.a;
    }
    else if (opcode === 0x0A) { // LDAX B
        let addr = getPairValue(0);
        cpu.a = cpu.memory[addr];
    }
    else if (opcode === 0x1A) { // LDAX D
        let addr = getPairValue(1);
        cpu.a = cpu.memory[addr];
    }
    
    // 7. Arithmetic ADD / ADI
    else if (opcode >= 0x80 && opcode <= 0x87) { // ADD R
        let reg = opcode & 0x7;
        let val = getRegValue(reg);
        let res = cpu.a + val;
        updateFlags(res, cpu.a, val, false);
        cpu.a = res & 0xFF;
    }
    else if (opcode === 0xC6) { // ADI d8
        let res = cpu.a + byte1;
        updateFlags(res, cpu.a, byte1, false);
        cpu.a = res & 0xFF;
    }
    
    // 8. Arithmetic SUB / SUI
    else if (opcode >= 0x90 && opcode <= 0x97) { // SUB R
        let reg = opcode & 0x7;
        let val = getRegValue(reg);
        let res = cpu.a - val;
        updateFlags(res, cpu.a, val, true);
        cpu.a = res & 0xFF;
    }
    else if (opcode === 0xD6) { // SUI d8
        let res = cpu.a - byte1;
        updateFlags(res, cpu.a, byte1, true);
        cpu.a = res & 0xFF;
    }
    
    // 9. Compare CMP / CPI
    else if (opcode >= 0xB8 && opcode <= 0xBF) { // CMP R
        let reg = opcode & 0x7;
        let val = getRegValue(reg);
        let res = cpu.a - val;
        updateFlags(res, cpu.a, val, true);
    }
    else if (opcode === 0xFE) { // CPI d8
        let res = cpu.a - byte1;
        updateFlags(res, cpu.a, byte1, true);
    }
    
    // 10. Increment/Decrement registers (INR/DCR)
    else if ((opcode & 0xC7) === 0x04) { // INR R
        let reg = (opcode >> 3) & 0x7;
        let val = getRegValue(reg);
        let res = (val + 1) & 0xFF;
        // INR modifies all flags except CY
        let cy = cpu.f.cy;
        updateFlags(res, val, 1, false);
        cpu.f.cy = cy;
        setRegValue(reg, res);
    }
    else if ((opcode & 0xC7) === 0x05) { // DCR R
        let reg = (opcode >> 3) & 0x7;
        let val = getRegValue(reg);
        let res = (val - 1) & 0xFF;
        let cy = cpu.f.cy;
        updateFlags(res, val, 1, true);
        cpu.f.cy = cy;
        setRegValue(reg, res);
    }
    
    // 11. Pair Increment/Decrement (INX/DCX)
    else if ((opcode & 0xCF) === 0x03) { // INX RP
        let rp = (opcode >> 4) & 0x3;
        setPairValue(rp, getPairValue(rp) + 1);
    }
    else if ((opcode & 0xCF) === 0x0B) { // DCX RP
        let rp = (opcode >> 4) & 0x3;
        setPairValue(rp, getPairValue(rp) - 1);
    }
    
    // 12. Logical ANA / ANI / ORA / ORI / XRA / XRI
    else if (opcode >= 0xA0 && opcode <= 0xA7) { // ANA R
        cpu.a = cpu.a & getRegValue(opcode & 0x7);
        updateFlags(cpu.a);
        cpu.f.ac = 1;  // ANA always sets AC
        cpu.f.cy = 0;  // ANA always clears CY
    }
    else if (opcode === 0xE6) { // ANI d8
        cpu.a = cpu.a & byte1;
        updateFlags(cpu.a);
        cpu.f.ac = 1;  // ANI always sets AC
        cpu.f.cy = 0;  // ANI always clears CY
    }
    else if (opcode >= 0xB0 && opcode <= 0xB7) { // ORA R
        cpu.a = cpu.a | getRegValue(opcode & 0x7);
        updateFlags(cpu.a);
        cpu.f.ac = 0;  // ORA always clears AC
        cpu.f.cy = 0;  // ORA always clears CY
    }
    else if (opcode === 0xF6) { // ORI d8
        cpu.a = cpu.a | byte1;
        updateFlags(cpu.a);
        cpu.f.ac = 0;  // ORI always clears AC
        cpu.f.cy = 0;  // ORI always clears CY
    }
    else if (opcode >= 0xA8 && opcode <= 0xAF) { // XRA R
        cpu.a = cpu.a ^ getRegValue(opcode & 0x7);
        updateFlags(cpu.a);
        cpu.f.ac = 0;  // XRA always clears AC
        cpu.f.cy = 0;  // XRA always clears CY
    }
    else if (opcode === 0xEE) { // XRI d8
        cpu.a = cpu.a ^ byte1;
        updateFlags(cpu.a);
        cpu.f.ac = 0;  // XRI always clears AC
        cpu.f.cy = 0;  // XRI always clears CY
    }
    
    // 13. Jumps
    else if (opcode === 0xC3) { // JMP a16
        cpu.pc = word16;
    }
    else if (opcode === 0xCA) { // JZ a16
        if (cpu.f.z === 1) cpu.pc = word16;
    }
    else if (opcode === 0xC2) { // JNZ a16
        if (cpu.f.z === 0) cpu.pc = word16;
    }
    else if (opcode === 0xDA) { // JC a16
        if (cpu.f.cy === 1) cpu.pc = word16;
    }
    else if (opcode === 0xD2) { // JNC a16
        if (cpu.f.cy === 0) cpu.pc = word16;
    }
    else if (opcode === 0xF2) { // JP a16 (Positive / No Sign)
        if (cpu.f.s === 0) cpu.pc = word16;
    }
    else if (opcode === 0xFA) { // JM a16 (Minus / Sign)
        if (cpu.f.s === 1) cpu.pc = word16;
    }
    
    // 14. Control
    else if (opcode === 0x76) { // HLT
        cpu.halted = true;
        cpu.pc = startPc; // Lock PC at HLT
        addLog(`HLT executed at ${toHex16(startPc)}. Program finished. Go check your results.`, "success");
        showToast("Execution complete — HLT reached", "success");
        stopSimulation();
    }
    else if (opcode === 0x00) { // NOP
        // Do nothing
    }
    else if (opcode === 0x2F) { // CMA
        cpu.a = (~cpu.a) & 0xFF;
    }
    
    // Unknown Opcode
    else {
        cpu.halted = true;
        addLog(`Error: Unknown opcode ${opcode.toString(16).toUpperCase()}H at PC ${toHex16(startPc)}`, "error");
        showToast(`Hardware Crash: Unknown Opcode at ${toHex16(startPc)}`, "error");
        stopSimulation();
        return false;
    }
    
    updateUI();
    return true;
}

function estimateInstructionSizeByOpcode(opcode) {
    // Determine instruction size purely from opcode byte
    if ([0x3A, 0x32, 0x2A, 0x22, 0xC3, 0xCA, 0xC2, 0xDA, 0xD2, 0xF2, 0xFA, 0x01, 0x11, 0x21, 0x31].includes(opcode)) {
        return 3;
    }
    if ([0x3E, 0x06, 0x0E, 0x16, 0x1E, 0x26, 0x2E, 0x36, 0xC6, 0xD6, 0xFE, 0xE6, 0xF6, 0xEE].includes(opcode)) {
        return 2;
    }
    return 1;
}

function highlightEditorLine(lineNo) {
    const textarea = document.getElementById('code-editor');
    if (!textarea) return;
    const lines = textarea.value.split('\n');
    let startIdx = 0;
    for (let i = 0; i < lineNo - 1; i++) {
        if (lines[i] !== undefined) {
            startIdx += lines[i].length + 1;
        }
    }
    if (lines[lineNo - 1] === undefined) return;
    let endIdx = startIdx + lines[lineNo - 1].length;
    
    // Visual select current line - Do NOT steal focus from the trainer board keyboard inputs
    if (activeTab !== 'trainer') {
        textarea.focus();
    }
    textarea.setSelectionRange(startIdx, endIdx);
}

// --- Simulation Controls ---
function runSimulation() {
    if (cpu.halted) {
        showToast("Compile your program first!", "warn");
        return;
    }
    
    if (cpu.running) return;
    
    cpu.running = true;
    
    // Activate bus traffic animation on the PCB board
    const pcbBoard = document.getElementById('pcb-board-element');
    if (pcbBoard) pcbBoard.classList.add('executing');
    
    updateUI();
    addLog("Running program at speed scale...", "info");
    
    runInterval = setInterval(() => {
        let success = stepExecution();
        if (!success || cpu.halted) {
            stopSimulation();
        }
    }, delayMs);
}

function stopSimulation() {
    if (runInterval) {
        clearInterval(runInterval);
        runInterval = null;
    }
    cpu.running = false;
    
    // Deactivate bus traffic animation on the PCB board
    const pcbBoard = document.getElementById('pcb-board-element');
    if (pcbBoard) pcbBoard.classList.remove('executing');
    
    updateUI();
}

function resetCpu() {
    stopSimulation();
    
    cpu.a = 0; cpu.b = 0; cpu.c = 0; cpu.d = 0; cpu.e = 0; cpu.h = 0; cpu.l = 0;
    cpu.pc = 0x2000;
    cpu.sp = 0xFFFF;
    cpu.f = { s: 0, z: 0, ac: 0, p: 0, cy: 0 };
    cpu.halted = false;
    cpu.running = false;
    cpu.cycles = 0;
    
    prevValues = {};
    
    addLog("CPU reset. Fresh start, clean slate.", "info");
    showToast("CPU state reset", "success");
    
    // Clear selection
    const textarea = document.getElementById('code-editor');
    textarea.setSelectionRange(0, 0);
    
    refreshMemoryTable();
    updateUI();
}

function clearMemory() {
    stopSimulation();
    cpu.memory.fill(0);
    addLog("64KB memory wiped. Hope you saved your work.", "warn");
    showToast("Memory cleared", "success");
    refreshMemoryTable();
    updateUI();
}

function setExecutionSpeed(val) {
    delayMs = 1000 - val; // Invert speed range
    if (cpu.running) {
        stopSimulation();
        runSimulation();
    }
}

// --- Virtual Trainer Kit Board UI Logic ---
// --- Virtual Trainer Kit Board UI Logic ---
let trainerMode = 'BOOT'; // BOOT, ADDR, DATA, REG, GO_ADDR
let trainerCurrentAddr = 0x2000;
let trainerSelectedReg = 'A'; // A, B, C, D, E, H, L, F
let inputBuffer = '';
let justAutoAdvanced = false;
let autoAdvanceTimeout = null;

function updateTrainerDisplay() {
    const line1 = document.getElementById('lcd-line-1');
    const line2 = document.getElementById('lcd-line-2');
    if (!line1 || !line2) return;
    
    if (trainerMode === 'BOOT') {
        line1.innerHTML = 'PRINCE-8085';
        line2.innerHTML = 'SYSTEM READY';
        return;
    }
    
    if (trainerMode === 'ADDR') {
        // Format address with dynamic blinking placeholders
        let addrStr = '';
        for (let i = 0; i < 4; i++) {
            if (i < inputBuffer.length) {
                addrStr += inputBuffer[i];
            } else if (i === inputBuffer.length) {
                addrStr += '<span class="lcd-blink">_</span>';
            } else {
                addrStr += '_';
            }
        }
        line1.innerHTML = `ADR: ${addrStr}  DAT: --`;
        line2.innerHTML = 'MODE: ADDRESS ENTRY';
    } 
    else if (trainerMode === 'DATA') {
        // Display current address
        let addrStr = trainerCurrentAddr.toString(16).toUpperCase().padStart(4, '0');
        
        // Format data with placeholders if typing, or current memory value if empty
        let dataStr = '';
        if (inputBuffer.length === 0) {
            let val = cpu.memory[trainerCurrentAddr];
            dataStr = val.toString(16).toUpperCase().padStart(2, '0');
        } else {
            for (let i = 0; i < 2; i++) {
                if (i < inputBuffer.length) {
                    dataStr += inputBuffer[i];
                } else if (i === inputBuffer.length) {
                    dataStr += '<span class="lcd-blink">_</span>';
                } else {
                    dataStr += '_';
                }
            }
        }
        
        line1.innerHTML = `ADR: ${addrStr}  DAT: ${dataStr}H`;
        line2.innerHTML = 'MODE: DATA EDIT (CELL)';
    } 
    else if (trainerMode === 'REG') {
        let val = 0;
        if (trainerSelectedReg === 'A') val = cpu.a;
        else if (trainerSelectedReg === 'B') val = cpu.b;
        else if (trainerSelectedReg === 'C') val = cpu.c;
        else if (trainerSelectedReg === 'D') val = cpu.d;
        else if (trainerSelectedReg === 'E') val = cpu.e;
        else if (trainerSelectedReg === 'H') val = cpu.h;
        else if (trainerSelectedReg === 'L') val = cpu.l;
        else if (trainerSelectedReg === 'F') {
            val = (cpu.f.s << 7) | (cpu.f.z << 6) | (cpu.f.ac << 4) | (cpu.f.p << 2) | cpu.f.cy;
        }
        let dataStr = val.toString(16).toUpperCase().padStart(2, '0');
        
        line1.innerHTML = `REG: ${trainerSelectedReg}  VAL: ${dataStr}H`;
        line2.innerHTML = `REG EXAMINE: rE-${trainerSelectedReg}`;
    } 
    else if (trainerMode === 'GO_ADDR') {
        // Format address with dynamic blinking placeholders for execution address entry
        let addrStr = '';
        for (let i = 0; i < 4; i++) {
            if (i < inputBuffer.length) {
                addrStr += inputBuffer[i];
            } else if (i === inputBuffer.length) {
                addrStr += '<span class="lcd-blink">_</span>';
            } else {
                addrStr += '_';
            }
        }
        
        line1.innerHTML = `GO: ${addrStr}  DAT: Ad`;
        let targetAddr = inputBuffer.length > 0 ? parseInt(inputBuffer, 16) : trainerCurrentAddr;
        let targetStr = targetAddr.toString(16).toUpperCase().padStart(4, '0');
        line2.innerHTML = `EXECUTE AT ${targetStr}H?`;
    }
}

// PCB Board Proportional Resizer — scales the fixed-pixel PCB layout to fit narrow containers
function resizePcb() {
    const container = document.querySelector('.pcb-container');
    const board = document.getElementById('pcb-board-element');
    if (!container || !board) return;
    
    const containerWidth = container.clientWidth;
    const designWidth = 460;  // PCB design width in px
    const designHeight = 290; // PCB design height in px
    const scale = containerWidth / designWidth;
    
    if (scale < 1) {
        board.style.transform = 'scale(' + scale + ')';
        board.style.transformOrigin = 'top center';
        container.style.height = (designHeight * scale) + 'px';
    } else {
        board.style.transform = 'none';
        container.style.height = 'auto';
    }
}

// Fullscreen toggle for the Trainer Board Kit — immersive lab mode
let isTrainerFullscreen = false;

function toggleTrainerFullscreen() {
    const rightCol = document.querySelector('.right-col');
    const btn = document.getElementById('fullscreen-toggle');
    if (!rightCol || !btn) return;
    
    isTrainerFullscreen = !isTrainerFullscreen;
    
    if (isTrainerFullscreen) {
        // Switch to trainer tab first
        switchTab('trainer');
        
        // Apply fullscreen class
        rightCol.classList.add('trainer-fullscreen-active');
        
        // Update button text
        btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"></path></svg> Exit Fullscreen`;
        
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
        
        addLog("Trainer Board: Fullscreen mode. It's like being back in the lab, minus the smell.", "info");
    } else {
        // Remove fullscreen class
        rightCol.classList.remove('trainer-fullscreen-active');
        
        // Restore button text
        btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg> Fullscreen`;
        
        // Restore body scroll
        document.body.style.overflow = '';
        
        addLog("Exited fullscreen. Welcome back to the dashboard.", "info");
    }
    
    // Re-scale PCB board after layout change
    setTimeout(resizePcb, 100);
}

function animateButtonPress(key) {
    // 1. Highlight console button
    const btn = document.getElementById(`console-btn-${key}`);
    if (btn) {
        btn.classList.add('pressed');
        setTimeout(() => btn.classList.remove('pressed'), 120);
    }
    
    // 2. PCB Reset dome button animation
    if (key === 'RESET') {
        const pcbReset = document.getElementById('pcb-btn-reset');
        if (pcbReset) {
            pcbReset.classList.add('pressed');
            setTimeout(() => pcbReset.classList.remove('pressed'), 150);
        }
    }
    
    // 3. LCD screen receipt flash
    const lcd = document.getElementById('lcd-display');
    if (lcd) {
        lcd.style.filter = 'brightness(1.3) saturate(1.2)';
        setTimeout(() => {
            lcd.style.filter = '';
        }, 85);
    }
}

function onTrainerKey(key) {
    // Animate tactile press
    animateButtonPress(key);
    
    addLog(`Trainer key: ${key}`, "info");
    
    // 1. Hardware Reset Key
    if (key === 'RESET') {
        if (autoAdvanceTimeout) {
            clearTimeout(autoAdvanceTimeout);
            autoAdvanceTimeout = null;
        }
        justAutoAdvanced = false;
        resetCpu();
        trainerMode = 'BOOT';
        trainerCurrentAddr = 0x2000;
        inputBuffer = '';
        updateTrainerDisplay();
        showToast("Trainer Board: System Hardware Reset", "success");
        addLog("Hardware Reset triggered from Trainer Board.", "warn");
        return;
    }
    
    // Lock keypads in BOOT mode except for transition commands
    if (trainerMode === 'BOOT') {
        if (!['RESET', 'EXMEM', 'DATA_REG', 'EXREG', 'GO', 'STEP'].includes(key)) {
            showToast("Select mode first (press EXMEM or EXREG)", "warn");
            return;
        }
    }
    
    // 2. Command Keys
    if (key === 'EXMEM') {
        if (autoAdvanceTimeout) {
            clearTimeout(autoAdvanceTimeout);
            autoAdvanceTimeout = null;
        }
        justAutoAdvanced = false;
        trainerMode = 'ADDR';
        inputBuffer = '';
        updateTrainerDisplay();
        showToast("Mode: Substitute Memory (Address Entry)", "info");
        return;
    }
    
    if (key === 'DATA_REG') {
        if (autoAdvanceTimeout) {
            clearTimeout(autoAdvanceTimeout);
            autoAdvanceTimeout = null;
        }
        justAutoAdvanced = false;
        trainerMode = 'DATA';
        inputBuffer = '';
        updateTrainerDisplay();
        showToast("Mode: Edit Data (Cell Entry)", "info");
        return;
    }
    
    if (key === 'EXREG') {
        if (autoAdvanceTimeout) {
            clearTimeout(autoAdvanceTimeout);
            autoAdvanceTimeout = null;
        }
        justAutoAdvanced = false;
        trainerMode = 'REG';
        trainerSelectedReg = 'A';
        inputBuffer = '';
        updateTrainerDisplay();
        showToast("Mode: Examine Registers (Press A-F, H, L)", "info");
        return;
    }
    
    if (key === 'NEXT') {
        if (autoAdvanceTimeout) {
            clearTimeout(autoAdvanceTimeout);
            autoAdvanceTimeout = null;
        }
        
        if (trainerMode === 'ADDR') {
            // First press in address entry mode transitions to editing data of that address without incrementing
            trainerMode = 'DATA';
            inputBuffer = '';
            justAutoAdvanced = false;
        } else if (trainerMode === 'DATA') {
            if (inputBuffer.length > 0) {
                // If there's pending input, save it first, and advance
                let byteVal = parseInt(inputBuffer, 16);
                cpu.memory[trainerCurrentAddr] = byteVal;
                trainerCurrentAddr = (trainerCurrentAddr + 1) & 0xFFFF;
                inputBuffer = '';
                justAutoAdvanced = false;
            } else {
                // If no input, but we just auto-advanced, consume the delimiter without double-advancing
                if (justAutoAdvanced) {
                    justAutoAdvanced = false;
                    return;
                }
                // Otherwise increment as usual
                trainerCurrentAddr = (trainerCurrentAddr + 1) & 0xFFFF;
                inputBuffer = '';
            }
        }
        updateTrainerDisplay();
        refreshMemoryTable();
        return;
    }
    
    if (key === 'PREV') {
        if (autoAdvanceTimeout) {
            clearTimeout(autoAdvanceTimeout);
            autoAdvanceTimeout = null;
        }
        justAutoAdvanced = false;
        
        if (trainerMode === 'ADDR') {
            // First press in address entry transitions to editing data of that address without decrementing
            trainerMode = 'DATA';
            inputBuffer = '';
        } else if (trainerMode === 'DATA') {
            // Subsequent presses decrement the address
            trainerCurrentAddr = (trainerCurrentAddr - 1) & 0xFFFF;
            inputBuffer = '';
        }
        updateTrainerDisplay();
        refreshMemoryTable();
        return;
    }
    
    if (key === 'GO') {
        if (autoAdvanceTimeout) {
            clearTimeout(autoAdvanceTimeout);
            autoAdvanceTimeout = null;
        }
        justAutoAdvanced = false;
        if (trainerMode !== 'GO_ADDR') {
            trainerMode = 'GO_ADDR';
            inputBuffer = '';
            showToast("GO: Type Start Address & press GO to Exec", "warn");
            updateTrainerDisplay();
        } else {
            // Perform Run execution
            cpu.pc = trainerCurrentAddr;
            cpu.halted = false;
            showToast(`Booting execution at ${toHex16(trainerCurrentAddr)}`, "success");
            addLog(`Execution booted at ${toHex16(trainerCurrentAddr)} from Trainer Board.`, "success");
            runSimulation();
        }
        return;
    }
    
    if (key === 'STEP') {
        if (autoAdvanceTimeout) {
            clearTimeout(autoAdvanceTimeout);
            autoAdvanceTimeout = null;
        }
        justAutoAdvanced = false;
        cpu.pc = trainerCurrentAddr;
        stepExecution();
        trainerCurrentAddr = cpu.pc;
        updateTrainerDisplay();
        showToast("Single Step cycle executed", "info");
        return;
    }
    
    // 3. Hex / Number Inputs (0-F)
    if (['0','1','2','3','4','5','6','7','8','9','A','B','C','D','E','F'].includes(key)) {
        if (autoAdvanceTimeout) {
            clearTimeout(autoAdvanceTimeout);
            autoAdvanceTimeout = null;
        }
        
        if (trainerMode === 'ADDR' || trainerMode === 'GO_ADDR') {
            justAutoAdvanced = false;
            inputBuffer += key;
            if (inputBuffer.length > 4) inputBuffer = inputBuffer.slice(-4);
            trainerCurrentAddr = parseInt(inputBuffer, 16);
        } 
        else if (trainerMode === 'DATA') {
            justAutoAdvanced = false;
            inputBuffer += key;
            if (inputBuffer.length > 2) inputBuffer = inputBuffer.slice(-2);
            let byteVal = parseInt(inputBuffer, 16);
            cpu.memory[trainerCurrentAddr] = byteVal;
            
            // Auto-advance after 150ms once 2 hex digits are entered
            if (inputBuffer.length === 2) {
                autoAdvanceTimeout = setTimeout(() => {
                    if (trainerMode === 'DATA' && inputBuffer.length === 2) {
                        trainerCurrentAddr = (trainerCurrentAddr + 1) & 0xFFFF;
                        inputBuffer = '';
                        justAutoAdvanced = true;
                        updateTrainerDisplay();
                        refreshMemoryTable();
                    }
                }, 150);
            }
        } 
        else if (trainerMode === 'REG') {
            justAutoAdvanced = false;
            // Map hex keypress to register selection in examine mode
            if (key === 'A') trainerSelectedReg = 'A';
            else if (key === 'B') trainerSelectedReg = 'B';
            else if (key === 'C') trainerSelectedReg = 'C';
            else if (key === 'D') trainerSelectedReg = 'D';
            else if (key === 'E') trainerSelectedReg = 'E';
            else if (key === 'F') trainerSelectedReg = 'F';
            else if (key === '0' || key === 'H') trainerSelectedReg = 'H';
            else if (key === '1' || key === 'L') trainerSelectedReg = 'L';
            showToast(`Examining Register ${trainerSelectedReg}`, "info");
        }
        updateTrainerDisplay();
        refreshMemoryTable();
    }
}

// Physical Keyboard Interceptor for Authentic Lab Simulation
window.addEventListener('keydown', (event) => {
    // 1. Bypass if editing in standard inputs or textareas to prevent collisions
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'INPUT')) {
        return;
    }
    
    // 2. Only intercept if the Trainer tab is active
    if (activeTab !== 'trainer') {
        return;
    }
    
    let key = event.key.toUpperCase();
    
    // 3. Map keys
    // ESCAPE: exit fullscreen first, otherwise RESET
    if (key === 'ESCAPE') {
        event.preventDefault();
        if (isTrainerFullscreen) {
            toggleTrainerFullscreen();
        } else {
            onTrainerKey('RESET');
        }
    }
    // RESET: 'R'
    else if (key === 'R') {
        event.preventDefault();
        onTrainerKey('RESET');
    }
    // EXMEM: 'M'
    else if (key === 'M') {
        event.preventDefault();
        onTrainerKey('EXMEM');
    }
    // DATA REG: 'D'
    else if (key === 'D') {
        event.preventDefault();
        onTrainerKey('DATA_REG');
    }
    // EXREG: 'E'
    else if (key === 'E') {
        event.preventDefault();
        onTrainerKey('EXREG');
    }
    // GO: 'G' or ' ' (Space - only when not typing address/data to allow delimiter spacing)
    else if (key === 'G' || (key === ' ' && trainerMode !== 'ADDR' && trainerMode !== 'DATA')) {
        event.preventDefault();
        onTrainerKey('GO');
    }
    // Delimiter keys: ',' (comma) or ' ' (space - only when typing address/data)
    else if (key === ',' || (key === ' ' && (trainerMode === 'ADDR' || trainerMode === 'DATA'))) {
        event.preventDefault();
        onTrainerKey('NEXT');
    }
    // STEP: 'S' or 'T'
    else if (key === 'S' || key === 'T') {
        event.preventDefault();
        onTrainerKey('STEP');
    }
    // PREV: 'ArrowLeft' or 'Backspace' or '-'
    else if (event.key === 'ArrowLeft' || event.key === 'Backspace' || event.key === '-') {
        event.preventDefault();
        onTrainerKey('PREV');
    }
    // NEXT: 'ArrowRight' or 'Enter' or '+'
    else if (event.key === 'ArrowRight' || event.key === 'Enter' || event.key === '+') {
        event.preventDefault();
        onTrainerKey('NEXT');
    }
    // Hex entries: '0'-'9', 'A'-'F'
    else if (/^[0-9A-F]$/.test(key)) {
        event.preventDefault();
        animateButtonPress(key);
        onTrainerKey(key);
    }
    // Support direct H and L key binds in register examine mode
    else if (key === 'H' || key === 'L') {
        event.preventDefault();
        onTrainerKey(key);
    }
});

// ============================================================================
// NAVIGATION & HELP INSTRUCTION MODAL UTILITIES
// ============================================================================

function scrollToSection(id) {
    const section = document.getElementById(id);
    if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        
        // Update active class in header
        document.querySelectorAll('.nav-link').forEach(link => {
            if (link.getAttribute('href') === `#${id}`) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
        
        // Close mobile menu if open
        const navLinks = document.getElementById('nav-links');
        if (navLinks) {
            navLinks.classList.remove('open');
        }
    }
}

function toggleHelpModal() {
    const modal = document.getElementById('help-modal');
    if (modal) {
        if (modal.classList.contains('open')) {
            modal.classList.remove('open');
            // Wait for transition before hiding display
            setTimeout(() => {
                if (!modal.classList.contains('open')) {
                    modal.style.display = 'none';
                }
            }, 300);
        } else {
            modal.style.display = 'flex';
            // Force browser reflow to trigger transition
            modal.offsetHeight;
            modal.classList.add('open');
        }
    }
}

// Scroll-spy active link tracking
window.addEventListener('scroll', () => {
    const sections = ['editor-section', 'registers-section', 'board-section'];
    let currentActive = 'editor-section';
    const scrollPosition = window.scrollY + 120; // offset for sticky header
    
    sections.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            const top = el.offsetTop;
            const height = el.offsetHeight;
            if (scrollPosition >= top && scrollPosition < top + height) {
                currentActive = id;
            }
        }
    });
    
    document.querySelectorAll('.nav-link').forEach(link => {
        if (link.getAttribute('href') === `#${currentActive}`) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
});

