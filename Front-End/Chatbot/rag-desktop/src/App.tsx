// Import React hooks for state management and DOM reference access, and Tauri HTTP plugin
import { useState, useRef, useEffect } from "react";
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import "./App.css";

// Interface defining the structure of a single chat message with metadata
interface Message {
  id: number; // Unique identifier for the message
  text: string; // The actual message content
  sender: "user" | "bot"; // Indicates whether message is from user or bot
  timestamp: Date; // When the message was sent
}

// Interface defining the structure of a conversation (chat thread)
interface Conversation {
  id: number; // Unique identifier for the conversation
  title: string; // Display name/title of the conversation
  lastMessage: Date; // Timestamp of the most recent message
  messages: Message[]; // Array of all messages in this conversation
}

function App() {
  // AWS API Gateway endpoint URL for the RAG (Retrieval-Augmented Generation) backend. API has been blurred due to safety reasons
  const API_GATEWAY_URL = "********************************************";
  
  // State: stores all conversations (chat threads) with initial empty conversation
  const [conversations, setConversations] = useState<Conversation[]>([
    {
      id: 1,
      title: "Current Chat",
      lastMessage: new Date(),
      messages: []
    }
  ]);
  
  // State: tracks which conversation is currently displayed in the main chat area
  const [activeConversationId, setActiveConversationId] = useState(1);
  
  // State: stores the current value of the message input field
  const [inputValue, setInputValue] = useState("");
  
  // State: indicates whether the bot is currently processing a response (loading state)
  const [isTyping, setIsTyping] = useState(false);
  
  // State: stores any error messages to display to the user
  const [error, setError] = useState<string | null>(null);
  
  // State: stores the API URL (could be configurable, but currently uses the constant)
  const [apiUrl] = useState(API_GATEWAY_URL);
  
  // State: stores optional API key for authentication (currently empty)
  const [apiKey] = useState("");
  
  // Ref: reference to the bottom of the messages list for auto-scrolling
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Derived state: gets the currently active conversation object
  const activeConversation = conversations.find(c => c.id === activeConversationId);
  
  // Derived state: extracts messages from the active conversation, or empty array if none exists
  const messages = activeConversation?.messages || [];

  // Array of suggested prompts shown to users at the start of a conversation
  const suggestedPrompts = [
    "Ingenieures Berufe in der Nähe Gummersbach",
    "Karrierechancen in Oberberg",
    "Tipps für das Finden meines Praktikums",
    "Wie trete ich mit den Unternehmen in Kontakt?"
  ];

  // Function to smoothly scroll the messages container to the bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Function to format message text by converting markdown **bold** syntax to HTML <strong> tags and handling line breaks
  const formatMessageText = (text: string) => {
    // Split the text by newline characters to preserve line structure
    const lines = text.split('\n');
    
    return lines.map((line, lineIndex) => {
      // Use regex to find all **text** patterns and split by them
      const parts = line.split(/(\*\*.*?\*\*)/g);
      
      // Process each part: if it's bold markdown, convert to <strong>, otherwise keep as text
      const formattedLine = parts.map((part, partIndex) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          // Remove the ** delimiters and wrap in <strong> tag for bold styling
          return <strong key={`${lineIndex}-${partIndex}`}>{part.slice(2, -2)}</strong>;
        }
        return part;
      });
      
      // Render the line with <br> tags between lines (except after the last line)
      return (
        <span key={lineIndex}>
          {formattedLine}
          {lineIndex < lines.length - 1 && <br />}
        </span>
      );
    });
  };

  // Effect hook: automatically scroll to the bottom whenever messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Function to create a new empty conversation and switch to it
  const createNewChat = () => {
    // Create a new conversation object with unique ID, default title, and empty messages
    const newConv: Conversation = {
      id: Date.now(), // Use timestamp as unique ID
      title: "New Chat", // Default title to be replaced by first message
      lastMessage: new Date(), // Current timestamp
      messages: [] // Start with no messages
    };
    // Add the new conversation to the list and switch to it
    setConversations([...conversations, newConv]);
    setActiveConversationId(newConv.id);
    setError(null); // Clear any previous errors
  };

  // Function to update a conversation's title based on its first message
  const updateConversationTitle = (convId: number, firstMessage: string) => {
    setConversations(prev => prev.map(conv => {
      // Find the conversation and update its title if it's still the default "New Chat"
      if (conv.id === convId && conv.title === "New Chat") {
        // Set title to first 30 characters of the first message, truncated with "..."
        return { ...conv, title: firstMessage.substring(0, 30) + "..." };
      }
      return conv;
    }));
  };

  // Async function that sends a user message to the AWS API Gateway and returns the bot's response
  const callAwsApiGateway = async (userMessage: string): Promise<string> => {
    try {
      // Clear any previous error state before making the API call
      setError(null);
      
      // Initialize headers with JSON content type
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      
      // Add API key to headers if one is configured
      if (apiKey.trim() !== "") {
        headers["x-api-key"] = apiKey.trim();
      }
      
      // Create the request payload in the format expected by the Lambda function
      // Lambda expects { frage: "..." } (German for "question")
      const requestPayload = { frage: userMessage };
      
      // Log request details for debugging purposes
      console.log("Sending request to:", apiUrl);
      console.log("Headers:", headers);
      console.log("Request body:", requestPayload);
      
      // Send the POST request to AWS API Gateway using Tauri's HTTP plugin
      const response = await tauriFetch(apiUrl, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(requestPayload),
      });

      // Log the response status for debugging
      console.log("Response status:", response.status);

      // Check if the response was successful; if not, throw an error
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Response error:", errorText);
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      // Parse the response JSON
      const data = await response.json();
      console.log("API Response:", data);
      
      // Handle case where the response body is a JSON string instead of an object
      let parsedData = data;
      if (typeof data.body === 'string') {
        try {
          parsedData = JSON.parse(data.body);
        } catch {
          // If parsing fails, wrap the body as the answer
          parsedData = { antwort: data.body };
        }
      }
      
      // Extract the bot's answer from the response
      // Lambda returns { antwort: "..." } (German for "answer")
      // Try multiple possible response field names for flexibility
      const botMessage = parsedData.antwort || 
                        data.antwort || 
                        parsedData.response || 
                        parsedData.message || 
                        (typeof data === 'string' ? data : JSON.stringify(data));
      
      return botMessage;
      
    } catch (error) {
      // Log the error and store it in state for UI display
      console.error("Error calling API Gateway:", error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMsg);
      return `Error: ${errorMsg}`;
    }
  };

  // Handler function that processes sending a message when the form is submitted
  const handleSendMessage = async (e: React.FormEvent) => {
    // Prevent default form submission behavior
    e.preventDefault();
    
    // Don't send empty messages
    if (inputValue.trim() === "") return;

    // Create a new message object for the user's input
    const userMessage: Message = {
      id: Date.now(), // Use timestamp as unique ID
      text: inputValue, // The message content
      sender: "user", // Mark as user message
      timestamp: new Date(), // Current time
    };

    // Store the message text before clearing the input
    const messageText = inputValue;
    
    // Add the user's message to the active conversation
    setConversations(prev => prev.map(conv => {
      if (conv.id === activeConversationId) {
        const updatedMessages = [...conv.messages, userMessage];
        // Update the conversation title based on the first message
        if (conv.messages.length === 0) {
          updateConversationTitle(conv.id, messageText);
        }
        // Update the conversation with new message and timestamp
        return { ...conv, messages: updatedMessages, lastMessage: new Date() };
      }
      return conv;
    }));
    
    // Clear the input field for the next message
    setInputValue("");
    
    // Set loading state to show typing indicator
    setIsTyping(true);
    setError(null);

    // Call the API to get the bot's response
    const responseText = await callAwsApiGateway(messageText);
    
    // Create a new message object for the bot's response
    const botResponse: Message = {
      id: Date.now() + 1, // Unique ID (offset by 1 to avoid collision)
      text: responseText, // The bot's response text
      sender: "bot", // Mark as bot message
      timestamp: new Date(), // Current time
    };
    
    // Add the bot's response to the conversation
    setConversations(prev => prev.map(conv => {
      if (conv.id === activeConversationId) {
        return { ...conv, messages: [...conv.messages, botResponse] };
      }
      return conv;
    }));
    
    // Clear the loading state
    setIsTyping(false);
  };

  // Handler to set the input field to a suggested prompt when clicked
  const handleSuggestedPrompt = (prompt: string) => {
    setInputValue(prompt);
  };

  // Function to copy a message's text to the clipboard
  const copyMessage = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Helper function that returns a human-readable time label based on how long ago the message was
  const getTimeLabel = (date: Date) => {
    const now = new Date();
    // Calculate the time difference in milliseconds
    const diff = now.getTime() - date.getTime();
    // Convert to days
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    // Return appropriate label based on how many days ago
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return "Last 7 days";
    return "Older";
  };

  // Group conversations by time period for organized display in the sidebar
  const groupedConversations = conversations.reduce((acc, conv) => {
    // Get the time label for this conversation
    const label = getTimeLabel(conv.lastMessage);
    // Create a category if it doesn't exist, then add the conversation to it
    if (!acc[label]) acc[label] = [];
    acc[label].push(conv);
    return acc;
  }, {} as Record<string, Conversation[]>);

  // Main JSX return: renders the complete application UI with sidebar and chat area
  return (
    <div className="dashboard-container">
      {/* Sidebar: displays navigation and conversation list */}
      <aside className="sidebar">
        {/* Sidebar header with app title and branding */}
        <div className="sidebar-header">
          <h2>🤖 AI Career Assistant</h2>
          <p className="subtitle">TH Köln Chatbot</p>
        </div>
        
        {/* Button to create a new chat conversation */}
        <button className="new-chat-btn" onClick={createNewChat}>
          <span className="plus-icon">+</span>
          New Chat
        </button>
        
        {/* Navigation area: displays grouped conversations by time period */}
        <nav className="conversation-list">
          {Object.entries(groupedConversations).map(([label, convs]) => (
            // Each time period group (Today, Yesterday, etc.)
            <div key={label} className="chat-group">
              <h4 className="group-label">{label}</h4>
              {/* List of conversations within this time period */}
              {convs.map(conv => (
                // Each conversation as a clickable button
                <button
                  key={conv.id}
                  className={`chat-item ${conv.id === activeConversationId ? 'active' : ''}`}
                  onClick={() => setActiveConversationId(conv.id)}
                >
                  <span className="chat-icon">💬</span>
                  <span className="chat-title">{conv.title}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
        
        {/* Sidebar footer: shows connection status */}
        <div className="sidebar-footer">
          <div className="status-indicator">
            <span className="status-dot"></span>
            <span>Connected</span>
          </div>
        </div>
      </aside>
      
      {/* Main chat area */}
      <main className="chat-area">
        {/* Header: displays current chat title and message count */}
        <header className="chat-header">
          <div>
            <h1>Chat</h1>
            <span className="chat-subtitle">{activeConversation?.title}</span>
          </div>
          <div className="chat-info">
            <span>{messages.length} messages</span>
          </div>
        </header>
        
        {/* Error banner: shows any connection or API errors */}
        {error && (
          <div className="error-banner">
            <span className="error-icon">⚠️</span>
            <div className="error-content">
              <strong>Connection Error</strong>
              <p>{error}</p>
            </div>
            {/* Button to dismiss the error */}
            <button className="error-close" onClick={() => setError(null)}>×</button>
          </div>
        )}
        
        {/* Messages container and list */}
        <div className="messages-wrapper">
          <div className="messages-list">
            {/* Empty state: shown when no messages exist yet */}
            {messages.length === 0 && !isTyping && (
              <div className="empty-state">
                <div className="empty-icon">💼</div>
                <h3>Start Your Career Journey</h3>
                <p>Ask me about internships, companies, or career advice</p>
                {/* Display suggested prompts for the user to click */}
                <div className="suggested-prompts">
                  {suggestedPrompts.map((prompt, index) => (
                    <button
                      key={index}
                      className="prompt-btn"
                      onClick={() => handleSuggestedPrompt(prompt)}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* Message list: renders all messages in the conversation */}
            {messages.map((message) => (
              <div
                key={message.id}
                className={`message ${message.sender === "user" ? "user-message" : "bot-message"}`}
              >
                {/* Message avatar: emoji representing user or bot */}
                <div className="message-avatar">
                  {message.sender === "user" ? "👤" : "🤖"}
                </div>
                {/* Message content bubble */}
                <div className="message-bubble">
                  {/* Message header: shows sender name and timestamp */}
                  <div className="message-header">
                    <span className="message-sender">
                      {message.sender === "user" ? "You" : "AI Assistant"}
                    </span>
                    <span className="message-time">
                      {message.timestamp.toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </span>
                  </div>
                  {/* Message text: renders formatted text with bold and line breaks */}
                  <div className="message-content">
                    <p>{formatMessageText(message.text)}</p>
                  </div>
                  {/* Action buttons: shown only for bot messages */}
                  {message.sender === "bot" && (
                    <div className="message-actions">
                      <button
                        className="action-btn"
                        onClick={() => copyMessage(message.text)}
                        title="Copy message"
                      >
                        📋 Copy
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {/* Typing indicator: shown while bot is processing a response */}
            {isTyping && (
              <div className="message bot-message">
                <div className="message-avatar">🤖</div>
                <div className="message-bubble">
                  <div className="message-content typing-indicator">
                    {/* Animated three-dot indicator */}
                    <div className="typing-dots">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Invisible div used as scroll target for auto-scrolling to latest messages */}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input area: form for sending messages */}
        <div className="input-area">
          <form className="input-form" onSubmit={handleSendMessage}>
            {/* Text input field for typing messages */}
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Type your message here..."
              className="message-input"
              autoFocus
            />
            {/* Send button: disabled when input is empty or bot is typing */}
            <button 
              type="submit" 
              className="send-btn"
              disabled={!inputValue.trim() || isTyping}
            >
              <span>Send</span>
              <span className="send-icon">→</span>
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

// Export the App component as the default export for use in main.tsx
export default App;
