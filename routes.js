const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'db.json');

// In-Memory Database Cache
let db = { users: [], wallets: [], loans: [], transactions: [] };

// Initialize Helper
const initDB = () => {
    try {
        if (!fs.existsSync(DB_FILE)) {
            const initialData = { users: [], wallets: [], loans: [], transactions: [] };
            fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
            db = initialData;
        } else {
            const data = fs.readFileSync(DB_FILE, 'utf8');
            db = JSON.parse(data);
        }
        console.log('Database loaded into memory');
    } catch (err) {
        console.error('Error initializing DB:', err);
    }
};

// Start DB
initDB();

// Helper to save changes
const saveDB = () => {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    } catch (err) {
        console.error('Error writing DB:', err);
    }
};

// Helper to generate random 10-digit account number
const generateAccountNumber = () => {
    return Math.floor(1000000000 + Math.random() * 9000000000).toString();
};

// Onboarding API
router.post('/onboarding', (req, res) => {
    const { email, password, fullName } = req.body;
    if (!email || !password || !fullName) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // Use db directly
    const existingUser = db.users.find(u => u.email === email);
    if (existingUser) {
        return res.status(400).json({ error: 'User already exists' });
    }

    const newUser = { id: db.users.length + 1, email, password, fullName, verified: false };
    db.users.push(newUser);
    saveDB();

    res.status(201).json({ message: 'User created successfully', user: { id: newUser.id, email: newUser.email, fullName: newUser.fullName, verified: newUser.verified } });
});

// Login API
router.post('/login', (req, res) => {
    const { email, password } = req.body;
    const user = db.users.find(u => u.email === email && u.password === password);

    if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.json({ message: 'Login successful', user: { id: user.id, email: user.email, fullName: user.fullName, verified: user.verified } });
});

// Verification Flow API
router.post('/verify', (req, res) => {
    const { userId } = req.body;
    const user = db.users.find(u => u.id === parseInt(userId));
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    user.verified = true;
    saveDB();

    res.json({ message: 'Verification successful', verified: true, user: { id: user.id, email: user.email, fullName: user.fullName, verified: true } });
});

// Wallet Creation API
router.post('/wallet/create', (req, res) => {
    const { userId } = req.body;
    const existingWallet = db.wallets.find(w => w.userId === userId);
    if (existingWallet) {
        return res.status(400).json({ error: 'Wallet already exists' });
    }

    const wallet = {
        id: db.wallets.length + 1,
        userId,
        balance: 0.00,
        accountNumber: generateAccountNumber()
    };
    db.wallets.push(wallet);
    saveDB();

    res.status(201).json({ message: 'Wallet created', wallet });
});

// Get User Wallet
router.get('/wallet/:userId', (req, res) => {
    const wallet = db.wallets.find(w => w.userId === parseInt(req.params.userId));
    if (!wallet) {
        return res.status(404).json({ error: 'Wallet not found' });
    }
    res.json(wallet);
});

// Get Transactions
router.get('/transactions/:userId', (req, res) => {
    const userTransactions = db.transactions
        .filter(t => t.userId === parseInt(req.params.userId))
        .sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json(userTransactions);
});

// Withdraw Funds API (Replaces Deposit)
router.post('/wallet/withdraw', (req, res) => {
    const { userId, amount, externalAccount } = req.body;
    const wallet = db.wallets.find(w => w.userId === userId);

    if (!wallet) {
        return res.status(404).json({ error: 'Wallet not found' });
    }

    const withdrawAmount = parseFloat(amount);

    if (withdrawAmount > wallet.balance) {
        return res.status(400).json({ error: 'Insufficient funds' });
    }

    wallet.balance -= withdrawAmount;

    // Log Transaction
    db.transactions.push({
        id: db.transactions.length + 1,
        userId,
        type: 'Withdrawal',
        amount: withdrawAmount,
        externalAccount,
        date: new Date().toISOString(),
        status: 'Completed'
    });

    saveDB();
    res.json({ message: 'Withdrawal successful', wallet });
});

// Static Loan Application API (Get Options)
router.get('/loans/static', (req, res) => {
    const loanOptions = [
        { id: 1, name: 'Personal Loan', interestRate: '5%', maxAmount: 5000 },
        { id: 2, name: 'Home Improvement', interestRate: '4.5%', maxAmount: 15000 },
        { id: 3, name: 'Business Starter', interestRate: '6%', maxAmount: 10000 }
    ];
    res.json(loanOptions);
});

// Wallet Lookup API
router.get('/wallet/lookup/:accountNumber', (req, res) => {
    const { accountNumber } = req.params;
    const wallet = db.wallets.find(w => w.accountNumber === accountNumber);

    if (!wallet) {
        return res.status(404).json({ error: 'Account not found' });
    }

    const user = db.users.find(u => u.id === wallet.userId);
    res.json({
        valid: true,
        ownerName: user ? user.fullName : 'Unknown User',
        walletId: wallet.id
    });
});

// Submit Loan Application (Auto-Approve & Credit)
router.post('/loans/apply', (req, res) => {
    const { userId, loanId, amount, accountNumber } = req.body;

    // Find wallet by account number if provided, otherwise fallback to userId
    let wallet;
    if (accountNumber) {
        wallet = db.wallets.find(w => w.accountNumber === accountNumber);
    } else {
        wallet = db.wallets.find(w => w.userId === userId);
    }

    if (!wallet) {
        return res.status(400).json({ error: 'Invalid wallet account' });
    }

    const loanAmount = parseFloat(amount);
    const loan = { id: db.loans.length + 1, userId, loanId, amount: loanAmount, status: 'Approved', creditedTo: wallet.accountNumber };
    db.loans.push(loan);

    // Credit wallet
    wallet.balance += loanAmount;

    // Log Transaction
    db.transactions.push({
        id: db.transactions.length + 1,
        userId: wallet.userId, // Credit the owner of the wallet
        type: 'Loan Credit',
        amount: loanAmount,
        date: new Date().toISOString(),
        status: 'Completed'
    });

    saveDB();
    res.status(201).json({ message: 'Loan approved', loan, newBalance: wallet.balance });
});

module.exports = router;
