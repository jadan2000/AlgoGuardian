import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Initialize theme - set dark mode by default before React renders
const storedTheme = localStorage.getItem('jibu-theme');
const theme = storedTheme || 'dark';
if (theme === 'dark') {
  document.documentElement.classList.add('dark');
  document.body.classList.add('dark');
} else {
  document.documentElement.classList.remove('dark');
  document.body.classList.remove('dark');
}

createRoot(document.getElementById("root")!).render(<App />);
