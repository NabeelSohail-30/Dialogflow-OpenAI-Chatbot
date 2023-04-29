const express = require('express');
const bodyParser = require('body-parser');
const { Configuration, OpenAIApi } = require("openai");
const cors = require('cors');
const dialogflow = require('dialogflow');
const dotenv = require('dotenv');

dotenv.config();
const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
const port = process.env.PORT || 5005;

app.get('/', (req, res) => {
    res.send('Hello World!');
});

const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const textGeneration = async (prompt) => {
    try {
        const response = await openai.createCompletion({
            model: 'text-davinci-003',
            prompt: `Human: ${prompt}\nAI: `,
            temperature: 0.9,
            max_tokens: 500,
            top_p: 1,
            frequency_penalty: 0,
            presence_penalty: 0.6,
            stop: ['Human:', 'AI:']
        });

        return {
            status: 1,
            response: `${response.data.choices[0].text}`
        };
    } catch (error) {
        return {
            status: 0,
            response: ''
        };
    }
};

app.post('/webhook', async (req, res) => {
    let intent = req.body.queryResult.intent.displayName;
    let queryText = req.body.queryResult.queryText;

    switch (intent) {
        case 'Default Welcome Intent':
            {
                res.send(
                    {
                        fulfillmentMessages: [
                            {
                                text: {
                                    text: [
                                        `Hi, I'm your personal assistant. How can I help you?`
                                    ]
                                }
                            }
                        ]
                    }
                );
                break;
            }

        default: {
            let result = await textGeneration(queryText);
            if (result.status == 1) {
                res.send(
                    {
                        fulfillmentText: result.response
                    }
                );
            } else {
                res.send(
                    {
                        fulfillmentText: `Sorry, I'm not able to help with that.`
                    }
                );
            }
        }
    }
});

// Start server
app.listen(port, () => {
    console.log(`Server is up and listening on port ${port}`);
});