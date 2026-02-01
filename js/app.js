const API = "http://localhost:8080";

// ================= AUTH =================

function login() {
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    fetch(API + "/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    })
    .then(r => {
        if (!r.ok) throw new Error();
        return r.json();
    })
    .then(user => {
    console.log("Logged user:", user);
    localStorage.setItem("user", user.username);
    localStorage.setItem("role", user.role);
    window.location.href = "dashboard.html";
});
}

function register() {
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    fetch(API + "/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    })
    .then(r => {
        if (!r.ok) throw new Error();
        alert("Registered successfully!");
        window.location.href = "login.html";
    })
    .catch(() => alert("Register failed"));
}

function logout() {
    localStorage.clear();
    window.location.href = "login.html";
}

// ================= DASHBOARD =================

function loadDashboard() {
    const role = localStorage.getItem("role");
    console.log("Current role:", role); // 👈 DEBUG

    const adminPanel = document.getElementById("adminPanel");
    if (adminPanel && role === "ADMIN") {
        adminPanel.style.display = "block";
    }

    fetch(API + "/quiz/all")
        .then(r => r.json())
        .then(data => {
            const box = document.getElementById("quizList");
            if (!box) return;

            box.innerHTML = "";

            data.forEach(q => {
                const div = document.createElement("div");
                div.className = "quiz-card";
                div.innerText = "📘 " + q.title;

                div.onclick = () => {
                    localStorage.setItem("quizId", q.id);
                    window.location.href = "quiz.html";
                };
                const username = localStorage.getItem("user");
                document.getElementById("welcomeText").innerText =`Welcome, ${username}`;

                // ADMIN DELETE BUTTON
                if (role === "ADMIN") {
                    const del = document.createElement("button");
                    del.innerText = "Delete";
                    del.onclick = (e) => {
                        e.stopPropagation();
                        deleteQuiz(q.id);
                    };
                    div.appendChild(del);
                }

                box.appendChild(div);
            });
        });
}

// ================= CREATE QUIZ =================

function createQuiz() {
    const title = document.getElementById("title").value.trim();
    const category = document.getElementById("category").value.trim();
    const numQ = document.getElementById("numQ").value;

    if (!title || !category || !numQ) {
        alert("Please fill all fields");
        return;
    }

    const url = `${API}/quiz/create?category=${encodeURIComponent(category)}&numQ=${numQ}&title=${encodeURIComponent(title)}`;

    fetch(url, {
        method: "POST",
        headers: {
            "role": localStorage.getItem("role")
        }
    })
    .then(r => {
        if (r.status === 403) {
            alert("Only ADMIN can create quiz");
            throw new Error("Forbidden");
        }
        if (!r.ok) throw new Error("Create failed");
        return r.json();
    })
    .then(() => {
        alert("Quiz created successfully");
        loadDashboard();
    })
    .catch(err => console.error(err));
}


function deleteQuiz(id) {
    if (!confirm("Delete this quiz?")) return;

    fetch(API + "/quiz/delete/" + id, {
        method: "DELETE",
        headers: {
            "role": localStorage.getItem("role")
        }
    })
    .then(r => {
        if (!r.ok) throw "Delete failed";
        alert("Quiz deleted");
        loadDashboard();
    });
}


// ================= QUIZ =================

let questions = [];
let index = 0;
let answers = [];
let selected = null;
let timer = 30;
let timerInterval = null;

function loadQuiz() {
    const id = localStorage.getItem("quizId");

    fetch(API + "/quiz/get/" + id)
        .then(r => r.json())
        .then(data => {
            questions = data;
            index = 0;
            answers = [];
            showQuestion();
        });
}

function showQuestion() {
    if (index >= questions.length) {
        submitQuiz();
        return;
    }

    const q = questions[index];
    selected = null;

    document.getElementById("questionTitle").innerText =
        `${index + 1}. ${q.questionTitle}`;

    const box = document.getElementById("optionsBox");
    box.innerHTML = "";

    [q.option1, q.option2, q.option3, q.option4].forEach(opt => {
        const div = document.createElement("div");
        div.className = "option";
        div.innerText = opt;

        div.onclick = () => {
            document.querySelectorAll(".option")
                .forEach(o => o.classList.remove("selected"));
            div.classList.add("selected");
            selected = opt;
        };

        box.appendChild(div);
    });

    resetTimer();
}

function resetTimer() {
    clearInterval(timerInterval);
    timer = 30;
    document.getElementById("timer").innerText = timer;

    timerInterval = setInterval(() => {
        timer--;
        document.getElementById("timer").innerText = timer;

        if (timer <= 0) {
            nextQuestion();
        }
    }, 1000);
}

function nextQuestion() {
    // save current answer (or skipped)
    answers.push({
        id: questions[index].id,
        response: selected || ""
    });

    index++;

    // just go to next question silently
    if (index < questions.length) {
        showQuestion();
    } else {
        submitQuiz();   // auto submit ONLY at end
    }
}


// ================= MANUAL SUBMIT =================

function confirmSubmit() {
    // popup ONLY when user clicks Submit button
    if (confirm("Are you sure you want to submit the quiz?")) {
        submitQuiz();
    }
}


function submitQuiz() {
    clearInterval(timerInterval);

    const id = localStorage.getItem("quizId");

    // ✅ Push last question if not already pushed
    if (answers.length < questions.length) {
        answers.push({
            id: questions[index].id,
            response: selected || ""
        });
    }

    fetch(`${API}/quiz/submit/${id}/detailed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(answers)
    })
    .then(r => r.json())
    .then(data => {
        localStorage.setItem("result", JSON.stringify(data));
        window.location.href = "result.html";
    });
}

// ================= RESULT =================

function loadResult() {
    const data = JSON.parse(localStorage.getItem("result"));
    const box = document.getElementById("resultBox");
    if (!box) return;

    box.innerHTML = "";
    let score = 0;

    data.forEach((r, i) => {
        const div = document.createElement("div");
        div.className = "result-card";

        if (r.correct) {
            score++;
            div.classList.add("correct");
        } else {
            div.classList.add("wrong");
        }

        div.innerHTML = `
            <h3>Q${i + 1}. ${r.question}</h3>
            <p>Your Answer: ${r.userAnswer || "Skipped"}</p>
            <p>Correct Answer: ${r.correctAnswer}</p>
        `;
        box.appendChild(div);
    });

    const scoreBox = document.createElement("div");
    scoreBox.className = "score-box";
    scoreBox.innerText = `Score: ${score} / ${data.length}`;
    box.prepend(scoreBox);
}

// ================= NAVIGATION =================

function goToDashboard() {
    window.location.href = "dashboard.html";
}

function exitApp() {
    localStorage.clear();
    window.location.href = "login.html";
}

// ================= AUTO LOAD =================

window.onload = function () {
    if (document.getElementById("quizList")) loadDashboard();
    if (document.getElementById("questionTitle")) loadQuiz();
    if (document.getElementById("resultBox")) loadResult();
};
