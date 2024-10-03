import dotenv from 'dotenv';
dotenv.config();
import OpenAI from 'openai';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

let state = {
  assistant_id: null,
  thread_id: null,
  run_id: null,
  user_message: null,
};

// Route to get all Assistants
app.get('/api/assistants', async (req, res) => {
  try {
    const response = await openai.beta.assistants.list({
      order: "desc",
      limit: 20,
    });
    const assistants = response.data.map(assistant => ({
      id: assistant.id,
      name: assistant.name
    }));
    res.status(200).json(assistants);
  } catch (error) {
    console.error('Error fetching assistants:', error);
    res.status(500).json({ error: 'Failed to fetch assistants', details: error.message });
  }
});

// Route to get a specific Assistant
app.get('/api/assistants/:assistant_id', async (req, res) => {
  try {
    const assistant = await openai.beta.assistants.retrieve(req.params.assistant_id);
    res.status(200).json(assistant);
  } catch (error) {
    console.error('Error fetching assistant:', error);
    res.status(500).json({ error: 'Failed to fetch assistant', details: error.message });
  }
});

// Route to create a new Thread
app.post('/api/threads', async (req, res) => {
  try {
    const thread = await openai.beta.threads.create();
    state.thread_id = thread.id;
    res.json({ thread_id: thread.id });
  } catch (error) {
    console.error('Error creating thread:', error);
    res.status(500).json({ error: 'Failed to create thread', details: error.message });
  }
});

// Route to run the agent
app.post('/api/run', async (req, res) => {
  try {
    state.user_message = req.body.message;
    state.assistant_id = req.body.assistant_id;

    if (!state.thread_id) {
      throw new Error('No active thread. Please create a thread first.');
    }

    // Add the user's message to the thread
    await openai.beta.threads.messages.create(state.thread_id, {
      role: "user",
      content: state.user_message,
    });

    // Run the assistant
    const run = await openai.beta.threads.runs.create(state.thread_id, {
      assistant_id: state.assistant_id
    });

    state.run_id = run.id;

    // Poll for completion
    let runStatus;
    do {
      await new Promise(resolve => setTimeout(resolve, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(state.thread_id, state.run_id);
    } while (runStatus.status !== 'completed' && runStatus.status !== 'failed');

    if (runStatus.status === 'failed') {
      throw new Error('Run failed: ' + runStatus.last_error?.message || 'Unknown error');
    }

    // Retrieve messages, focusing on the last assistant message
    const messages = await openai.beta.threads.messages.list(state.thread_id);
    const lastAssistantMessage = messages.data
      .filter(msg => msg.role === 'assistant')
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

    if (!lastAssistantMessage) {
      throw new Error('No assistant message found');
    }

    res.json({ 
      message: {
        role: lastAssistantMessage.role,
        content: lastAssistantMessage.content[0].text.value
      }
    });
  } catch (error) {
    console.error('Error running agent:', error);
    res.status(500).json({ error: 'Failed to run agent', details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});