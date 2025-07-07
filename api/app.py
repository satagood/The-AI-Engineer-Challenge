# Import required FastAPI components for building the API
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
# Import Pydantic for data validation and settings management
from pydantic import BaseModel
# Import OpenAI client for interacting with OpenAI's API
from openai import OpenAI
import os
from typing import Optional
import shutil
import uuid
from aimakerspace.text_utils import PDFLoader, CharacterTextSplitter
from aimakerspace.vectordatabase import VectorDatabase
from aimakerspace.openai_utils.chatmodel import ChatOpenAI

# Initialize FastAPI application with a title
app = FastAPI(title="OpenAI Chat API")

# Configure CORS (Cross-Origin Resource Sharing) middleware
# This allows the API to be accessed from different domains/origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows requests from any origin
    allow_credentials=True,  # Allows cookies to be included in requests
    allow_methods=["*"],  # Allows all HTTP methods (GET, POST, etc.)
    allow_headers=["*"],  # Allows all headers in requests
)

# Define the data model for chat requests using Pydantic
# This ensures incoming request data is properly validated
class ChatRequest(BaseModel):
    developer_message: str  # Message from the developer/system
    user_message: str      # Message from the user
    model: Optional[str] = "gpt-4.1-mini"  # Optional model selection with default
    api_key: str          # OpenAI API key for authentication

# Define the main chat endpoint that handles POST requests
@app.post("/api/chat")
async def chat(request: ChatRequest):
    try:
        # Initialize OpenAI client with the provided API key
        client = OpenAI(api_key=request.api_key)
        
        # Create an async generator function for streaming responses
        async def generate():
            # Create a streaming chat completion request
            stream = client.chat.completions.create(
                model=request.model,
                messages=[
                    {"role": "developer", "content": request.developer_message},
                    {"role": "user", "content": request.user_message}
                ],
                stream=True  # Enable streaming response
            )
            
            # Yield each chunk of the response as it becomes available
            for chunk in stream:
                if chunk.choices[0].delta.content is not None:
                    yield chunk.choices[0].delta.content

        # Return a streaming response to the client
        return StreamingResponse(generate(), media_type="text/plain")
    
    except Exception as e:
        # Handle any errors that occur during processing
        raise HTTPException(status_code=500, detail=str(e))

# Define a health check endpoint to verify API status
@app.get("/api/health")
async def health_check():
    return {"status": "ok"}

UPLOAD_DIR = "./tmp_uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.post("/api/upload_pdf")
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed.")
    try:
        unique_id = str(uuid.uuid4())
        file_path = os.path.join(UPLOAD_DIR, f"{unique_id}_{file.filename}")
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        return {"file_id": unique_id, "file_path": file_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload PDF: {str(e)}")

vector_db_store = {}

@app.post("/api/index_pdf")
async def index_pdf(file_id: str):
    # Find the file path in the upload dir
    file_path = None
    for fname in os.listdir(UPLOAD_DIR):
        if fname.startswith(file_id):
            file_path = os.path.join(UPLOAD_DIR, fname)
            break
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found for indexing.")
    try:
        loader = PDFLoader(file_path)
        documents = loader.load_documents()  # List of text from PDF
        splitter = CharacterTextSplitter()
        chunks = splitter.split_texts(documents)
        # Build vector DB
        vector_db = await VectorDatabase().abuild_from_list(chunks)
        vector_db_store[file_id] = vector_db
        return {"status": "indexed", "num_chunks": len(chunks)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to index PDF: {str(e)}")

@app.post("/api/chat_pdf")
async def chat_pdf(file_id: str, user_query: str, k: int = 3):
    if file_id not in vector_db_store:
        raise HTTPException(status_code=404, detail="Indexed PDF not found. Please index the PDF first.")
    try:
        vector_db = vector_db_store[file_id]
        # Get top-k relevant chunks
        relevant_chunks = vector_db.search_by_text(user_query, k=k, return_as_text=True)
        context = "\n".join(relevant_chunks)
        # Use aimakerspace's ChatOpenAI to generate a response
        chat = ChatOpenAI()
        messages = [
            {"role": "system", "content": "You are a helpful assistant. Use the following PDF context to answer the user's question."},
            {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {user_query}"}
        ]
        response = chat.run(messages, text_only=True)
        return {"response": response, "context": relevant_chunks}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to chat with PDF: {str(e)}")

# Entry point for running the application directly
if __name__ == "__main__":
    import uvicorn
    # Start the server on all network interfaces (0.0.0.0) on port 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)
