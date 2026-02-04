const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const apiRoutes = require('./routes');

app.use(cors());
app.use(express.json());

// Routes
app.use('/api', apiRoutes);

// Basic Route
app.get('/', (req, res) => {
  res.send('Loan App Backend is running');
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
