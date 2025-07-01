require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

// METHODS 
app.get('/', (req, res) => res.send('Backend is live!'));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Search: http://localhost:${PORT}`);
});
