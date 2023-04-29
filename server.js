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
const fineTuneData = `Saylani Welfare Trust is a non-profit organization based in Karachi, Pakistan. The organization was founded in 1999 by Maulana Bashir Ahmed Farooqi, a religious scholar, and social worker. The organization started as a small effort to provide meals to the needy, and it has now expanded to provide various services to underprivileged people.

The organization is managed by a board of trustees, which is headed by Maulana Bashir Ahmed Farooqi. The board of trustees comprises of individuals from different fields, including religious scholars, businessmen, and professionals. The trustees oversee the overall functioning of the organization and ensure that the programs are implemented effectively.

The organization has a dedicated team of professionals and volunteers who work tirelessly to provide services to the people. The team comprises of doctors, engineers, social workers, and other professionals who bring their expertise and skills to support the organization's programs.

Saylani Welfare Trust has a transparent financial system and maintains detailed records of its finances. The organization receives funding from various sources, including donations from individuals and corporations, Zakat, and other charitable contributions. The organization ensures that the funds are utilized effectively and efficiently to support its programs.

Over the years, Saylani Welfare Trust has received numerous awards and recognition for its services to the community. In 2015, the organization was awarded the Sitara-e-Imtiaz, one of the highest civil awards in Pakistan, for its contribution to social welfare.

One of the significant programs run by Saylani Welfare Trust is the Saylani Mass Training and Job Placement Program.

The Saylani Mass Training and Job Placement Program is designed to provide free technical and vocational training to unemployed youth, which will enable them to earn a decent livelihood. The program aims to provide training in different fields, such as computer programming, mobile phone repairing, and home appliance repairing. Once the training is completed, Saylani Welfare Trust helps these individuals to find suitable job opportunities.

To support its training programs, Saylani Welfare Trust has partnered with a private educational institution in Karachi called the Sir Syed Institute of Technology (SMIT). SMIT is a technical college that offers courses in various fields, such as mechanical engineering, electrical engineering, and computer science. The college has state-of-the-art facilities and highly qualified faculty members who provide quality education to the students.

Saylani Welfare Trust and SMIT have signed a Memorandum of Understanding (MoU) to collaborate on various programs, including the Saylani Mass Training and Job Placement Program. Under the MoU, SMIT provides training facilities and technical expertise, while Saylani Welfare Trust provides financial support and manages the overall program.

The collaboration between Saylani Welfare Trust and SMIT has been a success, with thousands of students graduating from the training programs and finding employment opportunities. The program has not only provided much-needed support to the unemployed youth in Pakistan but has also helped in promoting technical and vocational education in the country.

In addition to the Saylani Mass Training and Job Placement Program, Saylani Welfare Trust and SMIT also collaborate on other initiatives, such as providing scholarships to deserving students and organizing health camps for the underprivileged.

In conclusion, Saylani Welfare Trust and SMIT have formed a strong partnership to promote technical and vocational education and provide job opportunities to the unemployed youth in Pakistan. The collaboration has been a success, and it is hoped that it will continue to benefit the people of Pakistan in the years to come.`;

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