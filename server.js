const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const { v4: uuid } = require('uuid');
const dialogflow = require('dialogflow');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const port = process.env.PORT || 5005;
const token = process.env.TOKEN;
const mytoken = process.env.MYTOKEN;
const dialogflowProjectId = process.env.DIALOGFLOW_PROJECT_ID;

const sessionClient = new dialogflow.SessionsClient();

app.use(bodyParser.json());

//to verify the callback url from dashboard side - cloud api side
app.get('/webhook', (req, res) => {
    const { 'hub.mode': mode, 'hub.challenge': challenge, 'hub.verify_token': verifyToken } = req.query;

    if (mode && verifyToken) {
        if (mode === 'subscribe' && verifyToken === mytoken) {
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    } else {
        res.sendStatus(404);
    }
});

app.post('/webhook', async (req, res) => {
    try {
        const { entry } = req.body;

        if (!entry || !entry[0] || !entry[0].changes || !entry[0].changes[0].value || !entry[0].changes[0].value.messages || !entry[0].changes[0].value.messages[0]) {
            throw new Error('Invalid request body');
        }

        const { metadata, messages } = entry[0].changes[0].value;
        const { phone_number_id: phoneNumberId } = metadata;
        const { from, text: { body: messageBody } } = messages[0];

        const sessionPath = sessionClient.sessionPath(dialogflowProjectId, uuid());

        const request = {
            session: sessionPath,
            queryInput: {
                text: {
                    text: messageBody,
                    languageCode: 'en-US',
                },
            },
        };

        const responses = await sessionClient.detectIntent(request);
        const result = responses[0].queryResult;

        const sendMessageUrl = `https://graph.facebook.com/v13.0/${phoneNumberId}/messages?access_token=${token}`;

        await axios.post(sendMessageUrl, {
            messaging_product: 'whatsapp',
            to: from,
            text: {
                body: result.fulfillmentText,
            },
        });

        res.sendStatus(200);
    } catch (error) {
        console.error('Error occurred while processing webhook request', error);
        res.sendStatus(500);
    }
});

// Dialogflow fulfillment webhook
app.post('/dialogflow-fulfillment', async (req, res) => {
    const intent = req.body.queryResult.intent.displayName;

    switch (intent) {
        case 'Default Welcome Intent':
            {
                res.send({
                    fulfillmentMessages: [
                        {
                            text: {
                                text: ['Welcome to the WhatsApp bot!'],
                            },
                        },
                    ],
                });
                break;
            }

        case 'About': {
            res.send({
                fulfillmentMessages: [
                    {
                        text: {
                            text: ['This is a WhatsApp bot created using Dialogflow and Node.js.'],
                        },
                    },
                ],
            });
            break;
        }

        default: {
            res.send({
                fulfillmentMessages: [
                    {
                        text: {
                            text: ['Sorry, I don\'t understand.'],
                        },
                    },
                ],
            });
        }
    }
});

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});