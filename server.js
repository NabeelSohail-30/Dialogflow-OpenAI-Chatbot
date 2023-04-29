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

const generateText = async (prompt, fineTuneData) => {
    try {
        if (!fineTuneData) {
            throw new Error('Fine-tune data not provided');
        }

        let modelId;
        const trainingData = {
            file: fineTuneData,
            model: 'text-davinci-003',
            epoch: 3,
            batchSize: 1,
            learningRate: 0.0001,
            prompt: 'Fine-tune the GPT model with your own data',
            validationSplit: 0.1,
            maxChars: 10000,
        };
        const response = await openai.training.create(trainingData);

        if (response.status !== 'success') {
            throw new Error('Training failed');
        }

        modelId = response.data.model.id;

        const responseChat = await openai.completions.create({
            engine: 'text-davinci-003',
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

// Fine-tune data
const fineTuneData = `Human: Hello, who are you?
AI: I am doing great. How can I help you today?
Human: I am looking for a restaurant in the center of town.
AI: Ok, what is the name of the restaurant?
Human: The name of the restaurant is Blue Lemon.
AI: Ok, what is the address, phone number and post code of the restaurant?
Human: The address is 42 Church St. The phone number is 01223 244277. And the post code is CB2 3AR.
AI: Here is the contact information for Blue Lemon restaurant. Address: 42 Church St. Phone number: 01223 244277. Post code: CB2 3AR.
Human: Thank you. Can you tell me what type of food they serve and what is the price range?
AI: They serve European food and the price range is moderate.
Human: Can you give me the phone number of another restaurant?
AI: Sure, what is the name of the restaurant?
Human: The name of the restaurant is The Rice Boat.
AI: Ok, what is the address, phone number and post code of the restaurant?
Human: The address is 1 Riverside. The phone number is 01223 353554. And the post code is CB5 8JB.
AI: Here is the contact information for The Rice Boat restaurant. Address: 1 Riverside. Phone number: 01223 353554. Post code: CB5 8JB.
Human: Thank you. That is all I need.
AI: You are welcome. Have a great day.`;

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
            const result = await generateText(queryText, fineTuneData);
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