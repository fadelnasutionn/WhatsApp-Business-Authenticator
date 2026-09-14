require('dotenv').config();
const express = require('express');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

const OTP_API_URL   = process.env.OTP_API_URL;
const OTP_API_TOKEN = process.env.OTP_API_TOKEN;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Proxy: Send OTP
app.post('/api/otp/send', async (req, res) => {
  try {
    const response = await fetch(`${OTP_API_URL}/otp/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OTP_API_TOKEN}`,
      },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error('OTP send error:', err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

// Proxy: Verify OTP
app.post('/api/otp/verify', async (req, res) => {
  try {
    const response = await fetch(`${OTP_API_URL}/otp/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OTP_API_TOKEN}`,
      },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error('OTP verify error:', err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});