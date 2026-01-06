# Guided Translator

**Guided Translator** is a terminology-aware technical translation assistant designed specifically for standards documents (EN, ISO, IEC). It leverages Google Gemini's multimodal capabilities to extract and translate complex documents with high structural fidelity.

## 🚀 Key Features

- **AI-Powered Visual Parsing**: Uses Gemini 1.5 Flash Vision to "read" PDF pages as images, ensuring complex layouts, tables, and multi-column structures are perfectly preserved in Markdown format.
- **Terminology Awareness**: Integrates CSV-based glossaries and learns from user edits to maintain consistency across technical translations.
- **Agentic Editing Interface**: Analyzes manual edits to detect terminological improvements and offers to apply them throughout the document.
- **Multi-Key Management**: Supports multiple Gemini API keys with automatic rate-limit switching to ensure uninterrupted long-document translation.
- **Local Persistence**: Save and resume projects locally using a robust browser-based storage service.
- **Markdown & PDF Support**: Accept and process both raw Markdown and complex PDF files as source documents.

## 🛠 Tech Stack

- **Frontend**: React 19, Vite, TypeScript
- **Styling**: Tailwind CSS
- **PDF Processing**: PDF.js (Mozilla)
- **AI Models**: Google Gemini 1.5 Pro & Flash
- **Icons**: Lucide React
- **Serialization**: PapaParse (CSV), html2canvas/jspdf (Export)

## 📦 Getting Started

### Prerequisites

- Node.js (v18+)
- A Google AI Studio API Key ([Get one here](https://aistudio.google.com/))

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd Guided-Translator
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:5173](http://localhost:5173) in your browser.

## 📖 Usage Guide

1. **Setup API Key**: Click on the **Key** icon in the header to add your Gemini API keys.
2. **Load Glossary**: Upload a CSV glossary (format: `English Term, Chinese Term`) to guide the translation.
3. **Upload Document**: Drag and drop a PDF or Markdown file.
4. **Translate**: Hit "Start Translation". The app will process pages visually for maximum accuracy.
5. **Refine**: After translation, enter "Edit & Refine Mode" to tweak results. The AI will learn from your corrections!
6. **Export**: Export the final transalted document as PDF, Markdown, or Word.

## 📄 License

MIT
