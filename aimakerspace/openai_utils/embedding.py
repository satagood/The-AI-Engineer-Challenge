from dotenv import load_dotenv
from openai import AsyncOpenAI, OpenAI
import openai
from typing import List
import os
import asyncio
import tiktoken


class EmbeddingModel:
    def __init__(self, embeddings_model_name: str = "text-embedding-3-small", api_key: str = None):
        load_dotenv()
        if api_key is not None:
            self.openai_api_key = api_key
        else:
            self.openai_api_key = os.getenv("OPENAI_API_KEY")
        if self.openai_api_key is None:
            raise ValueError(
                "OPENAI_API_KEY environment variable is not set and no api_key was provided. Please set it to your OpenAI API key."
            )
        openai.api_key = self.openai_api_key
        self.async_client = AsyncOpenAI(api_key=self.openai_api_key)
        self.client = OpenAI(api_key=self.openai_api_key)
        self.embeddings_model_name = embeddings_model_name

    async def async_get_embeddings(self, list_of_text: List[str]) -> List[List[float]]:
        # OpenAI max: 300,000 tokens per request
        # Use a lower limit (240,000) to account for possible discrepancies between tiktoken and OpenAI's backend token counting.
        # This safety margin helps avoid 400 errors due to token overages.
        max_tokens_per_batch = 240_000  # safety margin below 300k
        max_tokens_per_chunk = 300_000
        encoding = tiktoken.encoding_for_model(self.embeddings_model_name)
        all_embeddings = []
        batch = []
        batch_tokens = 0
        for idx, text in enumerate(list_of_text):
            tokens = len(encoding.encode(text))
            print(f"[DEBUG] Chunk {idx}: {tokens} tokens")
            if tokens > max_tokens_per_chunk:
                print(f"[WARNING] Skipping chunk {idx} (len={tokens} tokens) because it exceeds the per-request token limit.")
                continue
            if batch_tokens + tokens > max_tokens_per_batch:
                # Send current batch
                if batch:
                    print(f"[DEBUG] Sending batch of {len(batch)} chunks, {batch_tokens} tokens (limit: {max_tokens_per_batch})")
                    embedding_response = await self.async_client.embeddings.create(
                        input=batch, model=self.embeddings_model_name
                    )
                    all_embeddings.extend([embeddings.embedding for embeddings in embedding_response.data])
                # Start new batch with current chunk
                batch = [text]
                batch_tokens = tokens
            else:
                batch.append(text)
                batch_tokens += tokens
        if batch:
            print(f"[DEBUG] Sending final batch of {len(batch)} chunks, {batch_tokens} tokens (limit: {max_tokens_per_batch})")
        embedding_response = await self.async_client.embeddings.create(
                input=batch, model=self.embeddings_model_name
        )
            all_embeddings.extend([embeddings.embedding for embeddings in embedding_response.data])
        return all_embeddings

    async def async_get_embedding(self, text: str) -> List[float]:
        embedding = await self.async_client.embeddings.create(
            input=text, model=self.embeddings_model_name
        )

        return embedding.data[0].embedding

    def get_embeddings(self, list_of_text: List[str]) -> List[List[float]]:
        embedding_response = self.client.embeddings.create(
            input=list_of_text, model=self.embeddings_model_name
        )

        return [embeddings.embedding for embeddings in embedding_response.data]

    def get_embedding(self, text: str) -> List[float]:
        embedding = self.client.embeddings.create(
            input=text, model=self.embeddings_model_name
        )

        return embedding.data[0].embedding


if __name__ == "__main__":
    embedding_model = EmbeddingModel()
    print(asyncio.run(embedding_model.async_get_embedding("Hello, world!")))
    print(
        asyncio.run(
            embedding_model.async_get_embeddings(["Hello, world!", "Goodbye, world!"])
        )
    )
