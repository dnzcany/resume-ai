
# RESUME AI – Multi-AI Powered Resume Analyzer

<p align="center"> 
  
<img src="https://img.shields.io/badge/AI%20Powered-OpenAI%20%7C%20Gemini%20%7C%20Ollama-blue?style=for-the-badge" /> 

<img src="https://img.shields.io/badge/Frontend-Next.js%2015-black?style=for-the-badge&logo=next.js" /> 

<img src="https://img.shields.io/badge/Backend-FastAPI-green?style=for-the-badge&logo=fastapi" /> 

<img src="https://img.shields.io/badge/Desktop-Electron-gray?style=for-the-badge&logo=electron" /> 

<img src="https://img.shields.io/badge/docker-257bd6?style=for-the-badge&logo=docker&logoColor=white" />

<img src="https://img.shields.io/badge/AWS-ECS%20%7C%20Fargate%20%7C%20Terraform-orange?style=for-the-badge&logo=amazonaws" />

</p>



Do you want to have your resume analyzed by multiple AI systems and get detailed insights on each section — including your strengths, missing elements, and how you can further improve your resume? And do you also want to save these results so you can review them anytime later? 

Or you just want to see an example of modern full-stack development with AI integrations?

I built ResumeAI specifically for you — to help you do exactly that.

<p align="center">
  <img src="./public/Animation111.gif" width="700" />
</p>





## Overview

Analyze your resume using multiple AI engines (OpenAI, Gemini, or fully local via Ollama).
Get section-by-section feedback, smart scoring, ATS insights, and job-match evaluation — all with a clean, modern UI.

Private. Offline-capable. Developer-friendly. 100% Open Source.

You can use it to practice building AI systems (local or cloud-based) or take it as a reference for your own SaaS products.



## Features

- Multi-AI Provider Support: Ollama (local), OpenAI GPT, Google Gemini

- Comprehensive Analysis: Detailed feedback across 8+ resume sections

- Smart Scoring: Weighted scoring system prioritizing work experience & projects

- Role Matching: Resume-job fit analysis + better-matching role suggestions

- File Format Support: Accepts PDF and DOCX

- PDF Preview: Built-in side-by-side viewer

- History Tracking: Save & revisit previous analyses

- Multiple Deployment Options: Web app, Docker, or Desktop App (Electron)

## Recently Added :sparkles:
- AWS Deployment
- Applicant Tracking System Analysis

## Privacy & Data Security

- ResumeAI does not store any data on servers.

- When using the Local LLM (Ollama) option, all analysis runs entirely on your device—offline—and your resume never leaves your machine.

- When using OpenAI or Gemini, only the required text is sent to their APIs; ResumeAI does not store or transmit this data anywhere else.

- Analysis history is saved locally in your browser (localStorage + IndexedDB) and can be cleared at any time.

- API keys are never stored; they exist only temporarily in memory and are removed as soon as the page is refreshed or closed.




## 📦 Prerequisites

- Python 3.9+

- Node.js 18+

(Optional) Docker & Docker Compose

(Optional) Ollama for local LLM usage

## Installation & Setup

Important! If you wanna use Local AI you must install Ollama

 Install Ollama from https://ollama.ai     

    # Pull the model
    ollama pull qwen2.5:14b

    # Verify installation
    ollama list

### Method 1: Docker (Recommended)

Make sure Docker Desktop is installed and open.



    # Clone the repository
    git clone https://github.com/dnzcany/resume-ai
    cd resume-checkerv2

    # Start with Docker Compose
    docker-compose up -d

    Access the application
    Frontend: http://localhost:3000
    Backend: http://localhost:8000



If you want to use Local LLMs, install curl inside backend container once.

    # Enter the backend container terminal
    -docker exec -it resumeai-backend sh

    # Update package lists inside the container
    -apt-get update

    # Install curl so the backend can check Ollama
    -apt-get install -y curl

(You only need to do this once per container build. Optional: add it to Dockerfile to make it automatic.)



### Method 2: Manual Setup

#### Backend Setup

    cd backend

    # Create virtual environment
    python -m venv venv

    # Activate the virtual environment on MacOs/Linux
    source venv/bin/activate  

    # Activate the virtual environment on Windows       
    venv\Scripts\activate

    # Install dependencies
    pip install -r requirements.txt

    # Start backend server
    uvicorn main:app --host 0.0.0.0 --port 8000  


#### Frontend Setup

    cd frontend

    # Install dependencies
    npm install

    # Development mode
    npm run dev

    # Production build
    npm run build
    npm start


  


### Method 3: Desktop Application

    cd desktop

    # Install dependencies
    npm install

    # Run in development
    npm run dev

    # Build executable
    npm run build

    # Output: desktop/dist/Resume Checker AI
    Setup.exe

### Method 4: AWS Cloud Deployment

Deploy to AWS with Terraform for production use:
  ### See detailed guide
  [AWS Deployment Guide](README-AWS.md)

**Features:**
- Serverless with ECS Fargate
- Auto-scaling with Load Balancer
- Infrastructure as Code with Terraform
- ~$25/month hosting cost

## Contributing

Contributions are welcome!
Feel free to open issues or submit pull requests for improvements, bug fixes, or new features.

##  Issues

If you encounter any problems, please open an issue with steps to reproduce and your environment details.

##  License

This project is licensed under the MIT License.



























