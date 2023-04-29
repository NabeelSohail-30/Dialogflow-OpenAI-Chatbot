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

//fine tune the model
const fineTune = async () => {
    try {
        const trainingData = [
            `What is the capital of India? Delhi`,
            `What is the capital of France? Paris`,
            `What is the capital of Germany? Berlin`,
            `What is the capital of Italy? Rome`,
            `What is the capital of Spain? Madrid`,
            `What is the capital of Japan? Tokyo`,
            `What is the capital of China? Beijing`,
            `What is the capital of Australia? Canberra`,
            `What is the capital of USA? Washington DC`,
            `What is the capital of Canada? Ottawa`,
            `What is the capital of Russia? Moscow`,
            `What is the capital of Brazil? Brasilia`,
            `What is the capital of Argentina? Buenos Aires`,
            `What is the capital of Mexico? Mexico City`,
            `What is the capital of South Africa? Cape Town`,
            `What is the capital of Nigeria? Abuja`,
            `What is the capital of Egypt? Cairo`,
            `What is the capital of Kenya? Nairobi`,
            `What is the capital of Turkey? Ankara`,
            `What is the capital of Iran? Tehran`,
            `What is the capital of Iraq? Baghdad`,
            `What is the capital of Saudi Arabia? Riyadh`,
            `What is the capital of Pakistan? Islamabad`,
            `What is the capital of Afghanistan? Kabul`,
            `What is the capital of Nepal? Kathmandu`,
            `What is the capital of Bhutan? Thimphu`,
            `What is the capital of Bangladesh? Dhaka`,
            `What is the capital of Sri Lanka? Colombo`,
            `What is the capital of Myanmar? Naypyidaw`,
        ];

        const fineTuneConfig = {
            "prompt": "What is the capital of India? Delhi\nWhat is the capital of France? Paris\nWhat is the capital of Germany? Berlin\nWhat is the capital of Italy? Rome\nWhat is the capital of Spain? Madrid\nWhat is the capital of Japan? Tokyo\nWhat is the capital of China? Beijing\nWhat is the capital of Australia? Canberra\nWhat is the capital of USA? Washington DC\nWhat is the capital of Canada? Ottawa\nWhat is the capital of Russia? Moscow\nWhat is the capital of Brazil? Brasilia\nWhat is the capital of Argentina? Buenos Aires\nWhat is the capital of Mexico? Mexico City\nWhat is the capital of South Africa? Cape Town\nWhat is the capital of Nigeria? Abuja\nWhat is the capital of Egypt? Cairo\nWhat is the capital of Kenya? Nairobi\nWhat is the capital of Turkey? Ankara\nWhat is the capital of Iran? Tehran\nWhat is the capital of Iraq? Baghdad\nWhat is the capital of Saudi Arabia? Riyadh\nWhat is the capital of Pakistan? Islamabad\nWhat is the capital of Afghanistan? Kabul\nWhat is the capital of Nepal? Kathmandu\nWhat is the capital of Bhutan? Thimphu\nWhat is the capital of Bangladesh? Dhaka\nWhat is the capital of Sri Lanka? Colombo\nWhat is the capital of Myanmar? Naypyidaw\n",
            "max_tokens": 1000,
            "temperature": 0.3,
            "top_p": 1,
            "frequency_penalty": 0,
            "presence_penalty": 0,
            "stop": ["\n"]
        };

        const fineTuneResponse = await openaiClient.fineTunes.create(fineTuneConfig);
        console.log(fineTuneResponse);
    } catch (error) {
        console.error(`Fine tune error: ${error}`);
    }
};

// Generate text
const generateText = async (queryText) => {
    try {
        const generateConfig = {
            "prompt": queryText,
            "max_tokens": 100,
            "temperature": 0.3,
            "top_p": 1,
            "frequency_penalty": 0,
            "presence_penalty": 0,
            "stop": ["\n"]
        };

        const generateResponse = await openaiClient.completions.create(generateConfig);
        console.log(generateResponse);
        return { status: 1, response: generateResponse.data.choices[0].text };
    } catch (error) {
        console.error(`Generate text error: ${error}`);
        return { status: 0, response: '' };
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