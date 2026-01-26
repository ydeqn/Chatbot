// Import React library for component support
import React from "react";
// Import ReactDOM for rendering React components to the DOM
import ReactDOM from "react-dom/client";
// Import the main App component that contains the chatbot UI
import App from "./App";

// Find the root HTML element (with id="root") and render the entire React application into it
// The "as HTMLElement" is a TypeScript type assertion to tell the compiler it's definitely an HTML element
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  // Wrap the App in React.StrictMode to highlight potential problems in the development build
  // This doesn't affect production and helps identify unsafe lifecycle methods and legacy APIs
  <React.StrictMode>
    {/* Render the main App component */}
    <App />
  </React.StrictMode>,
);
