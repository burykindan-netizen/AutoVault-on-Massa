// Vault State Interface
interface VaultState {
    balance: number;
    earnings: number;
    apy: number;
    autoCompound: boolean;
}

// Massa RPC Response Types
interface MassaAddressInfo {
    candidate_balance: string;
    final_balance: string;
}

interface MassaRPCResponse {
    jsonrpc: string;
    result?: MassaAddressInfo[];
    error?: {
        code: number;
        message: string;
    };
    id: number;
}

// Constants
const RPC_URL = "https://test.massa.net/api/v2";
const STORAGE_KEY = "autovault_state";
const AUTO_COMPOUND_INTERVAL = 10000; // 10 seconds
const BASE_APY = 12.5;
const COMPOUND_RATE = 0.001; // 0.1% per compound

// Global State
let vaultState: VaultState = {
    balance: 0,
    earnings: 0,
    apy: BASE_APY,
    autoCompound: false
};

let autoCompoundInterval: number | null = null;
let lastOperationId: string = "";

// DOM Elements
const elements = {
    vaultBalance: document.getElementById('vaultBalance') as HTMLElement,
    totalEarnings: document.getElementById('totalEarnings') as HTMLElement,
    currentAPY: document.getElementById('currentAPY') as HTMLElement,
    amountInput: document.getElementById('amountInput') as HTMLInputElement,
    depositBtn: document.getElementById('depositBtn') as HTMLButtonElement,
    withdrawBtn: document.getElementById('withdrawBtn') as HTMLButtonElement,
    autoCompoundToggle: document.getElementById('autoCompoundToggle') as HTMLInputElement,
    addressInput: document.getElementById('addressInput') as HTMLInputElement,
    fetchBalanceBtn: document.getElementById('fetchBalanceBtn') as HTMLButtonElement,
    walletBalance: document.getElementById('walletBalance') as HTMLElement,
    lastOpId: document.getElementById('lastOpId') as HTMLElement,
    themeToggle: document.getElementById('themeToggle') as HTMLButtonElement
};

// Initialize App
function init() {
    loadState();
    setupEventListeners();
    updateUI();
    setupThemeToggle();
    
    // Start auto-compound if it was enabled
    if (vaultState.autoCompound) {
        startAutoCompound();
    }
}

// Load state from localStorage
function loadState(): void {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            vaultState = { ...vaultState, ...parsed };
        } catch (e) {
            console.error("Failed to load state:", e);
        }
    }
}

// Save state to localStorage
function saveState(): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(vaultState));
    } catch (e) {
        console.error("Failed to save state:", e);
    }
}

// Setup Event Listeners
function setupEventListeners(): void {
    elements.depositBtn.addEventListener('click', handleDeposit);
    elements.withdrawBtn.addEventListener('click', handleWithdraw);
    elements.autoCompoundToggle.addEventListener('change', handleAutoCompoundToggle);
    elements.fetchBalanceBtn.addEventListener('click', handleFetchBalance);
    
    // Enter key support for inputs
    elements.amountInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleDeposit();
        }
    });
    
    elements.addressInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleFetchBalance();
        }
    });
}

// Setup Theme Toggle
function setupThemeToggle(): void {
    const currentTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', currentTheme);
    updateThemeIcon(currentTheme);
    
    elements.themeToggle.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const newTheme = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeIcon(newTheme);
    });
}

function updateThemeIcon(theme: string): void {
    const icon = elements.themeToggle.querySelector('.theme-icon');
    if (icon) {
        icon.textContent = theme === 'dark' ? '🌙' : '☀️';
    }
}

// Handle Deposit
function handleDeposit(): void {
    const amount = parseFloat(elements.amountInput.value);
    
    if (isNaN(amount) || amount <= 0) {
        alert('Please enter a valid amount');
        return;
    }
    
    vaultState.balance += amount;
    lastOperationId = generateOperationId('deposit');
    elements.lastOpId.textContent = lastOperationId;
    
    elements.amountInput.value = '';
    saveState();
    updateUI();
    
    // Visual feedback
    elements.depositBtn.style.transform = 'scale(0.95)';
    setTimeout(() => {
        elements.depositBtn.style.transform = '';
    }, 150);
}

// Handle Withdraw
function handleWithdraw(): void {
    const amount = parseFloat(elements.amountInput.value);
    
    if (isNaN(amount) || amount <= 0) {
        alert('Please enter a valid amount');
        return;
    }
    
    if (amount > vaultState.balance) {
        alert('Insufficient balance');
        return;
    }
    
    vaultState.balance -= amount;
    vaultState.earnings = 0; // Reset earnings on withdraw
    lastOperationId = generateOperationId('withdraw');
    elements.lastOpId.textContent = lastOperationId;
    
    elements.amountInput.value = '';
    saveState();
    updateUI();
    
    // Visual feedback
    elements.withdrawBtn.style.transform = 'scale(0.95)';
    setTimeout(() => {
        elements.withdrawBtn.style.transform = '';
    }, 150);
}

// Handle Auto-Compound Toggle
function handleAutoCompoundToggle(): void {
    vaultState.autoCompound = elements.autoCompoundToggle.checked;
    
    if (vaultState.autoCompound) {
        startAutoCompound();
    } else {
        stopAutoCompound();
    }
    
    saveState();
}

// Start Auto-Compound
function startAutoCompound(): void {
    if (autoCompoundInterval !== null) {
        return; // Already running
    }
    
    if (vaultState.balance <= 0) {
        alert('Please deposit funds to enable auto-compounding');
        elements.autoCompoundToggle.checked = false;
        vaultState.autoCompound = false;
        return;
    }
    
    autoCompoundInterval = window.setInterval(() => {
        compoundEarnings();
    }, AUTO_COMPOUND_INTERVAL);
    
    console.log('Auto-compound started');
}

// Stop Auto-Compound
function stopAutoCompound(): void {
    if (autoCompoundInterval !== null) {
        clearInterval(autoCompoundInterval);
        autoCompoundInterval = null;
        console.log('Auto-compound stopped');
    }
}

// Compound Earnings
function compoundEarnings(): void {
    if (vaultState.balance <= 0) {
        stopAutoCompound();
        elements.autoCompoundToggle.checked = false;
        vaultState.autoCompound = false;
        return;
    }
    
    // Calculate earnings based on APY and compound rate
    const annualYield = vaultState.balance * (vaultState.apy / 100);
    const compoundAmount = annualYield * (COMPOUND_RATE * (AUTO_COMPOUND_INTERVAL / (365 * 24 * 60 * 60 * 1000)));
    
    vaultState.earnings += compoundAmount;
    vaultState.balance += compoundAmount;
    
    saveState();
    updateUI();
}

// Fetch Balance from Massa RPC
async function fetchBalance(address: string): Promise<string | null> {
    if (!address || address.trim() === '') {
        alert('Please enter a valid address');
        return null;
    }
    
    const payload = {
        jsonrpc: "2.0",
        method: "get_addresses",
        params: [[address.trim()]],
        id: 1
    };
    
    try {
        elements.fetchBalanceBtn.textContent = 'Fetching...';
        elements.fetchBalanceBtn.disabled = true;
        
        const res = await fetch(RPC_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        
        const data: MassaRPCResponse = await res.json();
        
        if (data.error) {
            throw new Error(data.error.message);
        }
        
        if (data.result && data.result.length > 0) {
            const balance = parseFloat(data.result[0].candidate_balance) / 1e9; // Convert from nanoMAS to MAS
            return balance.toFixed(4);
        }
        
        return null;
    } catch (error) {
        console.error("Error fetching balance:", error);
        alert(`Failed to fetch balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return null;
    } finally {
        elements.fetchBalanceBtn.textContent = 'Fetch Balance';
        elements.fetchBalanceBtn.disabled = false;
    }
}

// Handle Fetch Balance
async function handleFetchBalance(): Promise<void> {
    const address = elements.addressInput.value.trim();
    
    if (!address) {
        alert('Please enter an address');
        return;
    }
    
    const balance = await fetchBalance(address);
    
    if (balance !== null) {
        elements.walletBalance.textContent = `${balance} MAS`;
    } else {
        elements.walletBalance.textContent = '-- MAS';
    }
}

// Update UI
function updateUI(): void {
    elements.vaultBalance.textContent = `${vaultState.balance.toFixed(4)} MAS`;
    elements.totalEarnings.textContent = `${vaultState.earnings.toFixed(4)} MAS`;
    elements.currentAPY.textContent = `${vaultState.apy.toFixed(2)}%`;
    elements.autoCompoundToggle.checked = vaultState.autoCompound;
}

// Generate Operation ID
function generateOperationId(type: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${type.toUpperCase()}-${timestamp}-${random}`;
}

// TODO: Integrate Massa autonomous smart contract for real auto-compounding
// This would involve:
// 1. Connecting to Massa wallet
// 2. Deploying or interacting with an ASC (Autonomous Smart Contract)
// 3. Handling on-chain state and transactions
// 4. Real-time updates from blockchain events

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

