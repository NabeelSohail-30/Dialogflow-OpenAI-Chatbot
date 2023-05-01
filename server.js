const express = require('express');
const bodyParser = require('body-parser');
const { Configuration, OpenAIApi } = require("openai");
const cors = require('cors');
const dotenv = require('dotenv');
const { loadQARefineChain } = require('langchain/chains');
const { OpenAI } = require('langchain/llms/openai');
const { TextLoader } = require('langchain/document_loaders/fs/text');
const { MemoryVectorStore } = require('langchain/vectorstores/memory');
const { OpenAIEmbeddings } = require('langchain/embeddings/openai');
const { Document } = require('langchain/document');
const path = require('path');

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
const openai = new OpenAIApi(openaiConfig);

// Get Api to test the server
app.get('/', (req, res) => {
    res.send('Hello World!');
});

const generateText = async (queryText) => {
    try {
        // Set a timeout of 10 seconds
        const timeout = 10000;

        const dataFilePath = './testData.txt';
        if (!dataFilePath) {
            throw new Error('Fine-tune data not provided');
        }

        // Load the OpenAI embeddings
        const embeddings = new OpenAIEmbeddings();

        console.log('Loading OpenAI model...');

        // Load the OpenAI model
        const model = new OpenAI({
            temperature: 0,
            maxTokens: 500,
            modelName: 'text-davinci-003'
        });

        console.log('Loading QA refinement chain...');

        // Load the QA refinement chain
        const chain = loadQARefineChain(model);

        console.log('Loading documents...');

        // Load the text file
        const __dirname = path.resolve();
        const loader = new TextLoader(path.join(__dirname, dataFilePath));
        const rawDoc = await loader.load();
        const doc = rawDoc[0].pageContent.replace(/(\r\n|\n|\r)/gm, ' ');
        const docs = [new Document({ pageContent: doc })];

        console.log('Generating answer...');

        // Find the relevant documents based on the question
        const store = await MemoryVectorStore.fromDocuments(docs, embeddings);
        const relevantDocs = await store.similaritySearch(queryText);

        console.log('Answering question...');
        console.log('Question: ' + queryText);

        // Use the QA refinement chain to generate the answer
        const res = await Promise.race([
            chain.call({
                input_documents: relevantDocs,
                question: queryText,
            }),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout')), timeout)
            ),
        ]);

        let text = res.output_text.trim();

        console.log('Answer: ' + text);

        // Process the answer to remove the question text and extra whitespace
        text = text.split('?');
        if (text.length > 1) {
            text = text[1].trim();
        } else if (text.length > 0) {
            text = text[0].trim();
        }

        return {
            status: 1,
            message: text,
        };
    } catch (error) {
        console.error(`OpenAI API error: ${error}`);
        return {
            status: 0,
            message: 'An internal server error occurred',
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
                    text: { text: [`Hi There, Welcome to Chatbot`] }
                }]
            });
        } else if (intent === 'Default Fallback Intent') {
            const result = await generateText(queryText);
            console.log(result);
            if (result.status === 1) {
                res.send({
                    fulfillmentMessages: [{
                        text: { text: [result.message] }
                    }]
                });
            }
            else {
                res.send({
                    fulfillmentMessages: [{
                        text: { text: [`Sorry, I didn't get that. Can you rephrase your question?`] }
                    }]
                });
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