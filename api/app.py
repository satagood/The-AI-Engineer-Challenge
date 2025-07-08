# Import required FastAPI components for building the API
from fastapi import FastAPI, HTTPException, UploadFile, File, BackgroundTasks
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
from aimakerspace.text_utils import PDFLoader, MarkdownLoader, CharacterTextSplitter
from aimakerspace.vectordatabase import VectorDatabase
from aimakerspace.openai_utils.chatmodel import ChatOpenAI
import time
from aimakerspace.vectordatabase import EmbeddingModel

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

UPLOAD_DIR = "/tmp/tmp_uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

def cleanup_file(path: str, delay: int = 600):
    time.sleep(delay)
    try:
        if os.path.exists(path):
            os.remove(path)
    except Exception as e:
        print(f"Failed to cleanup file {path}: {e}")

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    # Accept PDF or Markdown
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".pdf", ".md"]:
        raise HTTPException(status_code=400, detail="Only PDF and Markdown (.md) files are supported.")
    tmp_dir = "/tmp/tmp_uploads"
    os.makedirs(tmp_dir, exist_ok=True)
    file_id = str(uuid.uuid4())
    file_path = os.path.join(tmp_dir, f"{file_id}_{file.filename}")
    with open(file_path, "wb") as f:
        f.write(await file.read())
    return {"file_id": file_id, "file_path": file_path, "ext": ext}

# In-memory stores for vector DBs
vector_db_store_pdf = {}
vector_db_store_md = {}

class IndexRequest(BaseModel):
    file_id: str
    file_path: str
    api_key: str

@app.post("/api/index")
async def index_file(request: IndexRequest):
    # Accept PDF or Markdown
    ext = os.path.splitext(request.file_path)[1].lower()
    if ext == ".pdf":
        loader = PDFLoader(request.file_path)
    elif ext == ".md":
        loader = MarkdownLoader(request.file_path)
    else:
        raise HTTPException(status_code=400, detail="Only PDF and Markdown (.md) files are supported.")
    documents = loader.load_documents()
    splitter = CharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    chunks = splitter.split_texts(documents)
    # Use separate vector DB stores
    embedding_model = EmbeddingModel(api_key=request.api_key)
    if ext == ".pdf":
        vector_db = VectorDatabase(embedding_model=embedding_model)
        await vector_db.abuild_from_list(chunks)
        vector_db_store_pdf[request.file_id] = vector_db
    elif ext == ".md":
        vector_db = VectorDatabase(embedding_model=embedding_model)
        await vector_db.abuild_from_list(chunks)
        vector_db_store_md[request.file_id] = vector_db
    return {"status": "indexed", "file_id": request.file_id, "ext": ext}

class ChatPDFRequest(BaseModel):
    file_id: str
    user_query: str
    api_key: str
    developer_message: str

@app.post("/api/chat_pdf")
async def chat_pdf(request: ChatPDFRequest, k: int = 3):
    file_id = request.file_id
    user_query = request.user_query
    api_key = request.api_key
    developer_message = request.developer_message
    if file_id not in vector_db_store_pdf and file_id not in vector_db_store_md:
        raise HTTPException(status_code=404, detail="Indexed PDF not found. Please index the PDF first.")
    
    vector_db = None
    if file_id in vector_db_store_pdf:
        vector_db = vector_db_store_pdf[file_id]
    elif file_id in vector_db_store_md:
        vector_db = vector_db_store_md[file_id]

    # Get top-k relevant chunks
    relevant_chunks = vector_db.search_by_text(user_query, k=k, return_as_text=True)
    context = "\n".join(relevant_chunks)
    # Use aimakerspace's ChatOpenAI to generate a response
    chat = ChatOpenAI(api_key=api_key)
    messages = [
        {"role": "system", "content": developer_message},
        {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {user_query}"}
    ]
    response = chat.run(messages, text_only=True)
    return {"response": response, "context": relevant_chunks}

class ChatDualRAGRequest(BaseModel):
    pdf_file_id: str
    md_file_id: str
    user_query: str
    api_key: str
    developer_message: str

@app.post("/api/chat_dual_rag")
async def chat_dual_rag(request: ChatDualRAGRequest, k: int = 3):
    pdf_file_id = request.pdf_file_id
    md_file_id = request.md_file_id
    user_query = request.user_query
    api_key = request.api_key
    developer_message = request.developer_message
    if pdf_file_id not in vector_db_store_pdf:
        raise HTTPException(status_code=404, detail="Indexed PDF not found. Please index the PDF first.")
    if md_file_id not in vector_db_store_md:
        raise HTTPException(status_code=404, detail="Indexed Markdown not found. Please index the Markdown file first.")
    try:
        import openai
        openai.api_key = api_key
        pdf_vector_db = vector_db_store_pdf[pdf_file_id]
        md_vector_db = vector_db_store_md[md_file_id]
        # Get top-k relevant chunks from both
        pdf_chunks = pdf_vector_db.search_by_text(user_query, k=k, return_as_text=True)
        md_chunks = md_vector_db.search_by_text(user_query, k=k, return_as_text=True)
        context = f"Knowledge (from PDF):\n{chr(10).join(pdf_chunks)}\n\nIdea (from Markdown):\n{chr(10).join(md_chunks)}"
        # Prompt: critique the idea using the knowledge
        chat = ChatOpenAI(api_key=api_key)
        messages = [
            {"role": "system", "content": developer_message},
            {"role": "user", "content": f"Use the following knowledge to critique the idea.\n\n{context}\n\nQuestion: {user_query}"}
        ]
        response = chat.run(messages, text_only=True)
        return {"response": response, "context": {"pdf": pdf_chunks, "md": md_chunks}}
    except Exception as e:
        print(f"[ERROR] Exception in /api/chat_dual_rag: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to chat with dual RAG: {str(e)}")

# Entry point for running the application directly
if __name__ == "__main__":
    import uvicorn
    # Start the server on all network interfaces (0.0.0.0) on port 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)
