// server.js
const express = require('express');
const cors = require('cors');
const routes = require('./routes'); // your routes file

const app = express();

// --- CORS configuration ---
const allowedOrigins = [
  'https://sheddy-frontend.vercel.app',       // your Vercel frontend URL
  'https://teal.buttercream-99c9e5.netlify.app', // your Netlify frontend URL
  'http://localhost:5173'                     // optional: local frontend dev
];

app.use(cors({
  origin: function(origin, callback) {
    // allow requests with no origin (like Postman)
    if(!origin) return callback(null, true);
    if(allowedOrigins.indexOf(origin) === -1){
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true
}));

// --- Middleware ---
app.use(express.json());

// --- Routes ---
app.use('/api', routes);

// --- Start server ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
