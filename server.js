const express = require('express');
const bodyParser = require('body-parser');
const { Configuration, OpenAIApi } = require("openai");
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const port = process.env.PORT || 5005;

// Use middleware to handle repeated code
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Initialize OpenAI API client
const openaiConfig = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});
const openaiClient = new OpenAIApi(openaiConfig);

// Get Api to test the server
app.get('/', (req, res) => {
    res.send('Hello World!');
});

// fine tune the openai model on custom text and generate the answer for the questions
const generateText = async (prompt) => {
    try {
        const fineTuneData = './data.txt'
        if (!fineTuneData) {
            throw new Error('Fine-tune data not provided');
        }

        let modelId;
        const trainingData = {
            file: fineTuneData,
            model: 'davinci',
            epoch: 3,
            batchSize: 1,
            learningRate: 0.0001,
            prompt: 'Fine-tune the GPT model with your own data',
            validationSplit: 0.1,
            maxChars: 10000,
        };
        const response = await openaiClient.training.create(trainingData);

        if (response.status !== 'success') {
            throw new Error('Training failed');
        }

        modelId = response.data.model.id;

        const responseChat = await openaiClient.completions.create({
            engine: 'davinci',
            prompt: `Human: ${prompt}\nAI: `,
            maxTokens: 500,
            n: 1,
            stop: ['Human:', 'AI:'],
            model: modelId,
        });
        return {
            status: 1,
            response: responseChat.data.choices[0].text,
        };
    } catch (error) {
        console.error(`OpenAI API error: ${error}`);
        return {
            status: 0,
            response: '',
        };
    }
};

// Dialogflow webhook
app.post('/webhook', async (req, res) => {
    try {
        const intent = req.body.queryResult.intent.displayName;
        const queryText = req.body.queryResult.queryText;

        if (intent === 'Default Welcome Intent') {
            res.send({
                fulfillmentMessages: [{
                    text: { text: [`Hi, I'm your personal assistant. How can I help you?`] }
                }]
            });
        } else {
            const result = await generateText(queryText);
            if (result.status === 1) {
                res.send({ fulfillmentText: result.response });
            } else {
                res.send({ fulfillmentText: `Sorry, I'm not able to help with that.` });
            }
        }
    } catch (error) {
        console.error(`Dialogflow webhook error: ${error}`);
        res.status(500).send({ error: 'An internal server error occurred' });
    }
});

// Start server
app.listen(port, () => {
    console.log(`Server is up and listening on port ${port}`);
});