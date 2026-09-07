import jwt from 'jsonwebtoken';

const secret = "CIRA_SUPER_SECRET_KEY_2026";
const token = jwt.sign({ userId: 'test-faculty', role: 'FACULTY' }, secret, { expiresIn: '1h' });
const baseUrl = 'http://localhost:3000';

async function testApi() {
  try {
    // 1. Create Quiz
    const quizPayload = {
      title: "Sample Python Basics Quiz",
      subject: "Python Programming",
      durationMinutes: 60,
      instructions: "Answer all questions. Each question carries 1 mark.",
      totalMarks: 10,
      passingMarks: 0,
      startDate: "",
      endDate: "",
      targetDepartments: [],
      targetSections: []
    };

    const res = await fetch(`${baseUrl}/api/v1/faculty/quiz/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(quizPayload)
    });
    
    const data = await res.json();
    console.log("Create Quiz Response:", data);
    
    if (data.status !== 'success') {
      console.log("Quiz creation failed.");
      return;
    }
    
    const quizId = data.data.id;

    // 2. Add Questions
    const questionsPayload = {
      questions: [
        { type: "MCQ", text: "What is the output of print(2 + 3)?", marks: 1, options: ["4", "5", "6", "23"], answerKey: "5" },
        { type: "MCQ", text: "Which keyword defines a function in Python?", marks: 1, options: ["func", "define", "def", "function"], answerKey: "def" }
      ]
    };

    const qRes = await fetch(`${baseUrl}/api/v1/faculty/quiz/${quizId}/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(questionsPayload)
    });
    
    const qData = await qRes.json();
    console.log("Add Questions Response:", qData);
    
  } catch (err: any) {
    console.error("Test Error:", err.message);
  }
}

testApi();
