import express from 'express';
import bodyParser from 'body-parser';
import { Configuration, OpenAIApi } from 'openai';
import cors from 'cors';
import dotenv from 'dotenv';
import { TextLoader } from 'langchain/document_loaders/fs/text';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { OpenAI } from 'langchain/llms/openai';
import { HNSWLib } from 'langchain/vectorstores/hnswlib';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { loadQAStuffChain, loadQAMapReduceChain } from "langchain/chains";

dotenv.config();

const app = express();
app.use(bodyParser.json());
app.use(cors());
const port = process.env.PORT || 8001;

// Initialize OpenAI API client
const openaiConfig = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(openaiConfig);

// get api
app.get('/', (req, res) => {
    res.send('Hello World!');
});

const generateText = async (queryText) => {
    try {
        const dataFilePath = './testData.txt';
        if (!dataFilePath) {
            throw new Error('Fine-tune data not provided');
        }

        console.log('------------------Loading test data------------------')

        const loader = new TextLoader(dataFilePath);

        const docs = await loader.load();
        console.log('------------------Test Data Loaded------------------')
        // console.log(docs);

        console.log("------------------Splitting documents------------------");

        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 300,
            chunkOverlap: 100,
        });

        const output = await splitter.splitDocuments(docs);

        console.log("------------------Documents splitted------------------");
        // console.log(output);

        console.log("------------------Vector store------------------");

        // const vectorStore = await HNSWLib.fromDocuments(output, new OpenAIEmbeddings());

        console.log("------------------Vector store created------------------");
        // console.log(vectorStore);

        // await vectorStore.save('data');
        const loadedVectorStore = await HNSWLib.load(
            'data',
            new OpenAIEmbeddings()
        );

        // const msg = "what is the first movie of MCU? ";

        console.log("------------------Similarity search------------------");

        const result = await loadedVectorStore.similaritySearch(queryText, 4);
        // console.log(result);

        console.log("------------------Loading LLM------------------");

        const llmA = new OpenAI({});

        console.log("------------------Loading QA chain------------------");

        const chainA = loadQAStuffChain(llmA);
        const res = await chainA.call({
            input_documents: result,
            question: queryText,
        });

        console.log("------------------QA chain result------------------");

        console.log('question: ', queryText);
        console.log('answer: ', res.text);

        return {
            status: 1,
            message: res.text,
        }

    } catch (error) {
        console.error(`Error: ${error}`);
        return {
            status: 0,
            message: error,
        }
    }
};

// console.log(generateText("what is ssuet?"));

// Dialogflow webhook
app.post('/webhook', async (req, res) => {
    try {
        const intent = req.body.queryResult.intent.displayName;
        const queryText = req.body.queryResult.queryText;

        if (intent === 'Default Welcome Intent') {
            res.send({
                fulfillmentMessages: [{
                    text: { text: [`Hi There, Welcome to SSUET FAQ Chatbot, powered by OpenAi API and LangChain`] }
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