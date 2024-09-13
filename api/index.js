import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import mongoose, { Schema } from 'mongoose';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8000;

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('Connected to MongoDB');
    })
    .catch(err => {
        console.error('Error connecting to MongoDB:', err);
        process.exit(1); // Exit the process with failure
    });

// Define Mongoose schema and model
const entry = new Schema({
    name: {type: String, required: true},
    initials: { type: String, required: true },
    score: { type: Number, required: true },
    hardMode: Boolean,
    timestamp: {type: Number, required: true}
});

const Score = mongoose.model('Score', entry, 'scores');

// GET endpoint to retrieve top scores
app.get('/scores', async (req, res) => {
    try {
        const topScores = await getTop(10);
        if (!topScores || topScores.length === 0) {
            console.log('No scores yet');
            
            return res.send({ scores: ['No scores recorded yet'] });
        }
        console.log('Sending scores');
        
        return res.send({ scores: topScores });
    } catch (error) {
        res.status(500).send({ message: 'Error retrieving scores', error });
    }
});

// POST endpoint to add a new score
app.post('/scores', async (req, res) => {
    const { name, initials, score, mode } = req.body;

    // Validate request data
    if (!name || !initials || !mode || score == null || isNaN(score)) {
        console.log('Incorrect body');
        
        return res.status(400).send({ message: 'Invalid input. Name, initials, mode, and a valid score are required.' });
    }

    try {
        const now = Date.now()
        const topScores = await getTop(10);

        // Add new score if it's among the top 3
        if (topScores.length < 10 || topScores.some(s => s.score < score)) {
            await Score.create({ name, initials, score, hardMode: mode === 'hard', timestamp: now });
            const updated = await getTop(10);
            console.log('Scores updated');
            
            return res.send({ scores: updated });
            
        } else {
            console.log('No score update necessary');
            
            return res.send({ scores: topScores });
        }
    } catch (error) {
        res.status(500).send({ message: 'Error updating scores', error });
    }
});

async function getTop(n) {
    return await Score.find({name: {$ne: 'Anon'}}).sort({score: -1, timestamp: 1}).limit(n);
}

// Start the server
app.listen(PORT, () => {
    console.log('Listening on port', PORT);
});
