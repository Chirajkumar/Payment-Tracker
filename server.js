const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// MongoDB Connection
const MONGODB_URI = 'mongodb://localhost:27017/payment-tracker';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('Connected to MongoDB');
}).catch(err => {
  console.error('MongoDB connection failed:', err);
  console.log('Make sure MongoDB is running: mongod');
});

// Define Schemas
const paymentSchema = new mongoose.Schema({
  balance: { type: Number, default: 3000 },
  password: { type: String, default: '1234' },
  updatedAt: { type: Date, default: Date.now }
});

const transactionSchema = new mongoose.Schema({
  id: { type: Number, required: true },
  type: { type: String, required: true },
  amount: { type: Number, required: true },
  description: { type: String },
  timestamp: { type: Date, default: Date.now }
});

// Create Models
const Payment = mongoose.model('Payment', paymentSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);

// Get all data
app.get('/api/data', async (req, res) => {
  try {
    let payment = await Payment.findOne();
    if (!payment) {
      payment = new Payment({ balance: 3000, password: '1234' });
      await payment.save();
    }
    const transactions = await Transaction.find().sort({ timestamp: -1 });
    res.json({ balance: payment.balance, transactions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

// Get transactions by date range
app.get('/api/transactions/range', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const query = {};
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }
    
    const transactions = await Transaction.find(query).sort({ timestamp: -1 });
    res.json(transactions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Add transaction
app.post('/api/transaction', async (req, res) => {
  try {
    const { type, amount, description } = req.body;
    
    let payment = await Payment.findOne();
    if (!payment) {
      payment = new Payment({ balance: 3000, password: '1234' });
    }

    const transaction = new Transaction({
      id: Date.now(),
      type,
      amount: parseFloat(amount),
      description,
      timestamp: new Date()
    });

    if (type === 'add') {
      payment.balance += parseFloat(amount);
    } else if (type === 'deduct') {
      payment.balance -= parseFloat(amount);
    }

    payment.updatedAt = new Date();
    await payment.save();
    await transaction.save();
    
    res.json({ success: true, balance: payment.balance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add transaction' });
  }
});

// Update balance with password
app.post('/api/update-balance', async (req, res) => {
  try {
    const { newBalance, password } = req.body;
    
    let payment = await Payment.findOne();
    if (!payment) {
      return res.status(404).json({ error: 'Payment record not found' });
    }

    if (payment.password !== password) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    const oldBalance = payment.balance;
    payment.balance = parseFloat(newBalance);
    payment.updatedAt = new Date();
    await payment.save();

    // Create transaction record for balance edit
    const transaction = new Transaction({
      id: Date.now(),
      type: 'edit',
      amount: parseFloat(newBalance) - oldBalance,
      description: 'Balance Manual Edit',
      timestamp: new Date()
    });
    await transaction.save();

    res.json({ success: true, balance: payment.balance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update balance' });
  }
});

// Delete transaction
app.delete('/api/transaction/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const transaction = await Transaction.findOneAndDelete({ id: parseInt(id) });
    
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({ success: true, message: 'Transaction deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

// Reset balance and transactions
app.post('/api/reset', async (req, res) => {
  try {
    const { password } = req.body;
    
    let payment = await Payment.findOne();
    if (!payment) {
      payment = new Payment({ balance: 3000, password: '1234' });
      await payment.save();
    }

    if (password && payment.password !== password) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    await Transaction.deleteMany({});
    payment.balance = 3000;
    payment.updatedAt = new Date();
    await payment.save();

    res.json({ success: true, balance: 3000, transactions: [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to reset' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});