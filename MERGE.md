# Merging Feature Branch: PDF RAG Upload & Chat

This guide explains how to merge the `feature/pdf-rag-upload-chat` branch back to `main` using both GitHub Pull Request (PR) and GitHub CLI methods.

---

## 1. GitHub Pull Request (PR) Route

1. **Push your branch to GitHub (if not already pushed):**
   ```bash
   git push origin feature/pdf-rag-upload-chat
   ```
2. **Go to your repository on GitHub.**
3. **Click the "Compare & pull request" button** for `feature/pdf-rag-upload-chat`.
4. **Review the changes** and add a descriptive PR title and summary.
5. **Submit the pull request.**
6. **After review, click "Merge pull request"** to merge into `main`.
7. **Delete the feature branch** on GitHub if desired.

---

## 2. GitHub CLI Route

1. **Push your branch to GitHub (if not already pushed):**
   ```bash
   git push origin feature/pdf-rag-upload-chat
   ```
2. **Create a pull request from the CLI:**
   ```bash
   gh pr create --base main --head feature/pdf-rag-upload-chat --title "PDF RAG Upload & Chat" --body "Implements PDF upload, indexing, and chat with RAG."
   ```
3. **(Optional) View and review the PR:**
   ```bash
   gh pr view --web
   ```
4. **Merge the PR from the CLI:**
   ```bash
   gh pr merge --merge
   ```
5. **Delete the feature branch locally and remotely:**
   ```bash
   git branch -d feature/pdf-rag-upload-chat
   git push origin --delete feature/pdf-rag-upload-chat
   ```

---

**Note:** Always ensure all tests pass and the application works as expected before merging. 