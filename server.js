const express = require('express');
const bodyParser = require('body-parser');
const { Configuration, OpenAIApi } = require("openai");
const cors = require('cors');
const dotenv = require('dotenv');
const { loadQARefineChain } = require('langchain/chains');
const { OpenAI } = require('langchain/llms');
const { VectorDBQAChain } = require('langchain/chains');
const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');
const { HNSWLib } = require('langchain/vectorstores');
const { TextLoader } = require('langchain/document_loaders/fs/text');
// const { MemoryVectorStore } = require('langchain/vectorstores/memory');
const { OpenAIEmbeddings } = require('langchain/embeddings/openai');
const { Document } = require('langchain/document');
const path = require('path');
const { PineconeStore } = require('langchain/vectorstores/pinecone')
const { PineconeClient, MemoryVectorStore } = require('@pinecone-database/pinecone');
const fs = require('fs');

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
        const model = new OpenAI({});
        const text = fs.readFileSync("./testData.txt", "utf8");
        const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000 });
        const docs = await textSplitter.createDocuments([text]);
        const vectorStore = await HNSWLib.fromDocuments(docs, new OpenAIEmbeddings());
        const chain = VectorDBQAChain.fromLLM(model, vectorStore);
        const res = await chain.call({
            input_documents: docs,
            query: queryText,
        });

        console.log(res);

        return {
            status: 1,
            message: 'success'
        }
    } catch (error) {
        console.error(`OpenAI API error: ${error}`);
        return {
            status: 0,
            message: 'An internal server error occurred'
        };
    }
};

// const generateText = async (queryText) => {
//     try {
//         const dataFilePath = './testData.txt';
//         if (!dataFilePath) {
//             throw new Error('Fine-tune data not provided');
//         }

//         // Load the text file
//         const __dirname = path.resolve();
//         const loader = new TextLoader(path.join(__dirname, dataFilePath));
//         const rawDoc = await loader.load();
//         const doc = rawDoc[0].pageContent.replace(/(\r\n|\n|\r)/gm, " ");
//         const docs = [new Document({ pageContent: doc })];

//         // Initialize the Pinecone client
//         const pinecone = new PineconeClient();
//         await pinecone.init({
//             environment: process.env.PINECONE_ENVIRONMENT,
//             apiKey: process.env.PINECONE_API_KEY,
//         });
//         const pineconeIndex = client.Index(process.env.PINECONE_INDEX);

//         const vectorStore = await PineconeStore.fromExistingIndex(
//             docs,
//             new OpenAIEmbeddings(),
//             { pineconeIndex }
//         );

//         const results = await vectorStore.similaritySearch(queryText);

//         // Load the OpenAI model
//         const model = new OpenAI({
//             temperature: 0,
//             maxTokens: 500,
//             modelName: 'text-davinci-003'
//         });

//         const chain = VectorDBQAChain.fromLLM(model, vectorStore, {
//             k: 1,
//             returnSourceDocuments: true,
//         });

//         const res = await chain.call({
//             query: queryText,
//         });


//         let text = res.outputText.trim();

//         // Process the answer to remove the question text and extra whitespace
//         text = text.split('?');
//         if (text.length > 1) {
//             text = text[1].trim();
//         } else if (text.length > 0) {
//             text = text[0].trim();
//         }

//         return {
//             status: 1,
//             message: text
//         }
//     } catch (error) {
//         console.error(`OpenAI API error: ${error}`);
//         return {
//             status: 0,
//             message: 'An internal server error occurred'
//         };
//     }
// };


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