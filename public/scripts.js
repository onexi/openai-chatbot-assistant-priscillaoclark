let state = {
  assistants: [],
  selectedAssistantId: null,
  threadId: null,
};

document.addEventListener('DOMContentLoaded', fetchAssistants);

async function fetchAssistants() {
  try {
    const response = await fetch('/api/assistants');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    state.assistants = await response.json();
    populateAssistantDropdown();
  } catch (error) {
    console.error('Error fetching assistants:', error);
    writeToMessages(`Error fetching assistants: ${error.message}`, 'error-message');
  }
}

function populateAssistantDropdown() {
  const select = document.getElementById('assistant-select');
  select.innerHTML = '<option value="">Select an assistant</option>';
  state.assistants.forEach(assistant => {
    const option = document.createElement('option');
    option.value = assistant.id;
    option.textContent = assistant.name;
    select.appendChild(option);
  });
}

function selectAssistant() {
  const select = document.getElementById('assistant-select');
  state.selectedAssistantId = select.value;
  if (state.selectedAssistantId) {
    writeToMessages(`Selected assistant: ${select.options[select.selectedIndex].text}`, 'system-message');
  }
}

async function createNewThread() {
  try {
    const response = await fetch('/api/threads', {
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    state.threadId = data.thread_id;
    document.getElementById('thread-id').value = state.threadId;
    
    clearChatWindow();
    
    writeToMessages('New thread created', 'system-message');
  } catch (error) {
    console.error('Error creating thread:', error);
    writeToMessages(`Error creating thread: ${error.message}`, 'error-message');
  }
}

function clearChatWindow() {
  const messageContainer = document.getElementById('message-container');
  messageContainer.innerHTML = '';
}

async function getResponse() {
  const userInput = document.getElementById('user-input').value;
  if (!userInput.trim()) return;

  if (!state.selectedAssistantId) {
    writeToMessages("Please select an assistant first.", 'error-message');
    return;
  }

  if (!state.threadId) {
    writeToMessages("Please create a new thread first.", 'error-message');
    return;
  }

  writeToMessages(`You: ${userInput}`, 'user-message');
  document.getElementById('user-input').value = '';

  try {
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: userInput,
        assistant_id: state.selectedAssistantId
      }),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    
    if (data.message && data.message.role === 'assistant') {
      const formattedMessage = formatCustomMessage(data.message.content);
      writeToMessages(`Assistant: ${formattedMessage}`, 'assistant-message');
    } else {
      throw new Error('Invalid assistant message format');
    }
  } catch (error) {
    console.error('Error getting response:', error);
    writeToMessages(`Error getting response: ${error.message}`, 'error-message');
  }
}

function formatCustomMessage(message) {
  // Remove any references to file search vector store
  message = message.replace(/【[^】]*】/g, '');

  // Check if the message starts with "Here are the banking products available:"
  if (message.startsWith("Here are the banking products available:")) {
    const products = message.split('\n').slice(1); // Skip the first line
    let formattedHtml = '<h4>Banking Products Available:</h4><ul class="product-list">';
    
    products.forEach(product => {
      const [number, rest] = product.split('. ');
      const [name, description] = rest.split(': ');
      formattedHtml += `
        <li class="product-item">
          <strong class="product-name">${name}</strong>
          <p class="product-description">${description}</p>
        </li>
      `;
    });
    
    formattedHtml += '</ul>';
    return formattedHtml;
  }
  
  // If it's not the specific format, return the cleaned message
  return message;
}

function writeToMessages(message, className = '') {
  const messageContainer = document.getElementById('message-container');
  const messageElement = document.createElement('div');
  messageElement.className = className;
  
  if (className === 'assistant-message' && message.startsWith('Assistant: <')) {
    messageElement.innerHTML = message;
  } else {
    messageElement.textContent = message;
  }
  
  if (className === 'user-message') {
    messageElement.style.alignSelf = 'flex-end';
  } else if (className === 'assistant-message') {
    messageElement.style.alignSelf = 'flex-start';
  }
  
  messageContainer.appendChild(messageElement);
  messageContainer.scrollTop = messageContainer.scrollHeight;
}